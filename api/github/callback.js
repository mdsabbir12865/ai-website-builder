import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  clearCookie,
  encryptToken,
  getAdminSupabase,
  getGrantedScopes,
  hasRepoScope,
  isSafeBuilderReturnTo,
  parseCookies,
  readGithubResponse,
  verifyOAuthState,
} from "./_utils.js";

function redirect(res, path, key, value) {
  const separator = path.includes("?") ? "&" : "?";
  return res.redirect(
    `${path}${separator}${key}=${encodeURIComponent(value)}`
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const { code, state, error, error_description: description } = req.query;
  const fallback = "/dashboard";

  if (error) {
    return redirect(res, fallback, "github_error", description || error);
  }

  if (
    !code ||
    typeof code !== "string" ||
    !state ||
    typeof state !== "string"
  ) {
    return res.status(400).send("Missing GitHub OAuth code or state.");
  }

  try {
    const payload = verifyOAuthState(state);
    const cookieState = parseCookies(req).github_oauth_state;

    if (!payload?.userId || !cookieState || cookieState !== state) {
      return res.status(400).send("Invalid or expired OAuth state.");
    }

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error("GitHub OAuth is not configured.");
    }

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      }
    );

    const tokenData = await readGithubResponse(tokenResponse);

    if (!tokenResponse.ok || !tokenData?.access_token) {
      clearCookie(res, "github_oauth_state");
      return redirect(
        res,
        fallback,
        "github_error",
        "GitHub authorization failed. Please try again."
      );
    }

    if (tokenData.error) {
      clearCookie(res, "github_oauth_state");
      return redirect(
        res,
        fallback,
        "github_error",
        tokenData.error_description || tokenData.error
      );
    }

    const accessToken = tokenData.access_token;
    const {
      response: githubResponse,
      body: githubUser,
      scopes,
      scopeList,
    } = await getGrantedScopes(accessToken, tokenData.scope || "");

    const returnTo = isSafeBuilderReturnTo(payload.returnTo)
      ? payload.returnTo
      : fallback;

    clearCookie(res, "github_oauth_state");

    if (!githubResponse.ok || !githubUser?.id || !githubUser?.login) {
      return redirect(
        res,
        returnTo,
        "github_error",
        "Unable to verify the GitHub account."
      );
    }

    // Never persist a connection that lacks repository permission.
    if (!hasRepoScope(scopeList)) {
      return redirect(
        res,
        returnTo,
        "github_error",
        "GitHub did not grant repository access. Open GitHub Settings → Applications → Authorized OAuth Apps, revoke this app, then reconnect and approve repository access. If this keeps happening, confirm GITHUB_CLIENT_ID belongs to a classic OAuth App (not a GitHub App)."
      );
    }

    const { error: dbError } = await getAdminSupabase()
      .from("github_connections")
      .upsert(
        {
          user_id: payload.userId,
          github_id: githubUser.id,
          github_login: githubUser.login,
          github_avatar_url: githubUser.avatar_url || null,
          access_token: encryptToken(accessToken),
          scope: scopes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) throw dbError;

    return redirect(res, returnTo, "github_connected", "1");
  } catch (error) {
    console.error("GitHub callback failed", error?.message);
    clearCookie(res, "github_oauth_state");
    return redirect(
      res,
      fallback,
      "github_error",
      "GitHub connection failed. Please try again."
    );
  }
}
