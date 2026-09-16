import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_REDIRECT_URI,
  getAdminSupabase,
  verifyOAuthState,
  encryptToken,
  clearCookie,
  getCookie,
  githubHeaders,
  scopesFromResponse,
  readJson,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const {
    code,
    state,
    error,
    error_description,
  } = req.query;

  if (error) {
    return res.redirect(
      `/dashboard?github_error=${encodeURIComponent(
        error_description || error
      )}`
    );
  }

  if (!code || !state) {
    return res.status(400).send(
      "Missing GitHub OAuth code or state."
    );
  }

  try {
    const payload = verifyOAuthState(state);

    if (!payload?.userId) {
      return res.redirect("/dashboard?github_error=Invalid%20or%20expired%20OAuth%20state.");
    }

    // The signed state identifies the account and this cookie proves that the
    // same browser initiated the authorization (CSRF protection).
    if (getCookie(req, "github_oauth_state") !== state) {
      return res.redirect("/dashboard?github_error=Invalid%20OAuth%20state.");
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

    const tokenData = await readJson(tokenResponse);

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      console.error(
        "GitHub token exchange failed:", tokenData?.error || tokenData?.message || tokenResponse.status
      );

      return res.redirect(
        `/dashboard?github_error=${encodeURIComponent(
          "GitHub authorization failed."
        )}`
      );
    }

    const accessToken = tokenData.access_token;

    const githubResponse = await fetch(
      "https://api.github.com/user",
      {
        headers: githubHeaders(accessToken),
      }
    );

    if (!githubResponse.ok) {
      throw new Error(
        "Unable to verify GitHub account."
      );
    }

    const githubUser = await readJson(githubResponse);
    const grantedScopes = scopesFromResponse(githubResponse);

    if (!grantedScopes.includes("repo")) {
      clearCookie(res, "github_oauth_state");
      return res.redirect(`/dashboard?github_error=${encodeURIComponent("GitHub did not grant the required repo scope. Revoke this application's authorization in GitHub Settings → Applications, then reconnect. Verify that GITHUB_CLIENT_ID belongs to the OAuth App configured with the production callback URL.")}`);
    }

    const supabase = getAdminSupabase();

    const encryptedToken =
      encryptToken(accessToken);

    const { error: dbError } =
      await supabase
        .from("github_connections")
        .upsert(
          {
            user_id: payload.userId,
            github_id: githubUser.id,
            github_login: githubUser.login,
            github_avatar_url:
              githubUser.avatar_url || null,
            access_token: encryptedToken,
            scope: grantedScopes.join(", "),
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

    if (dbError) {
      throw dbError;
    }

    clearCookie(
      res,
      "github_oauth_state"
    );

    const returnTo =
      payload.returnTo &&
      payload.returnTo.startsWith(
        "/builder/"
      )
        ? payload.returnTo
        : "/dashboard";

    const separator =
      returnTo.includes("?")
        ? "&"
        : "?";

    return res.redirect(
      `${returnTo}${separator}github_connected=1`
    );
  } catch (error) {
    console.error(
      "GitHub callback error:",
      error
    );

    return res.redirect(
      `/dashboard?github_error=${encodeURIComponent(
        "GitHub connection failed."
      )}`
    );
  }
}
