import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  clearCookie,
  encryptToken,
  getAdminSupabase,
  getGrantedScopes,
  hasRepoScope,
  parseCookies,
  readGithubResponse,
  resolveReturnTo,
  validateOAuthRequest,
} from "./_utils.js";

function redirect(res, path, key, value) {
  const separator = path.includes("?") ? "&" : "?";
  return res.redirect(
    `${path}${separator}${key}=${encodeURIComponent(value)}`
  );
}

function redirectError(res, returnTo, message) {
  clearCookie(res, "github_oauth_state");
  return redirect(res, resolveReturnTo(returnTo), "github_error", message);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const { code, state, error, error_description: description } = req.query;
  const fallback = "/dashboard";

  if (error) {
    return redirect(
      res,
      fallback,
      "github_error",
      typeof description === "string" ? description : String(error)
    );
  }

  if (
    !code ||
    typeof code !== "string" ||
    !state ||
    typeof state !== "string"
  ) {
    return redirectError(
      res,
      fallback,
      "Missing GitHub authorization details. Please try connecting again."
    );
  }

  const validation = validateOAuthRequest(state, req);
  if (!validation.valid || !validation.payload) {
    const message =
      validation.code === "OAUTH_STATE_COOKIE_MISMATCH"
        ? "GitHub connection could not be verified in this browser. Please try Connect GitHub again."
        : "Invalid or expired OAuth state. Please try Connect GitHub again.";

    console.error("GitHub OAuth state rejected", {
      code: validation.code,
      cookiePresent: Boolean(parseCookies(req).github_oauth_state),
    });

    return redirectError(res, fallback, message);
  }

  const { payload } = validation;
  const returnTo = resolveReturnTo(payload.returnTo, fallback);

  try {
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
      return redirectError(
        res,
        returnTo,
        "GitHub authorization failed. Please try again."
      );
    }

    if (tokenData.error) {
      return redirectError(
        res,
        returnTo,
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

    clearCookie(res, "github_oauth_state");

    if (!githubResponse.ok || !githubUser?.id || !githubUser?.login) {
      return redirectError(
        res,
        returnTo,
        "Unable to verify the GitHub account."
      );
    }

    if (!hasRepoScope(scopeList)) {
      return redirectError(
        res,
        returnTo,
        "GitHub did not grant repository access. Open GitHub Settings → Applications → Authorized OAuth Apps, revoke this app, then reconnect and approve repository access."
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
    return redirectError(
      res,
      returnTo,
      "GitHub connection failed. Please try again."
    );
  }
}
