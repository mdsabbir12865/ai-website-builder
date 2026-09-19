import {
  GITHUB_CLIENT_ID,
  GITHUB_OAUTH_SCOPES,
  GITHUB_REDIRECT_URI,
  createOAuthState,
  getSupabaseUser,
  isSafeReturnTo,
  sendError,
  setCookie,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  try {
    if (!GITHUB_CLIENT_ID) {
      return sendError(
        res,
        500,
        "GITHUB_NOT_CONFIGURED",
        "GitHub OAuth is not configured."
      );
    }

    const user = await getSupabaseUser(req);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "You must be logged in.");
    }

    const returnTo = isSafeReturnTo(req.body?.returnTo)
      ? req.body.returnTo
      : "/dashboard";

    const state = createOAuthState(user.id, returnTo);
    setCookie(res, "github_oauth_state", state, { maxAge: 600 });

    // prompt=consent forces GitHub to re-show the permission screen so
    // expanded scopes (repo) are not silently skipped on reconnect.
    const authorizationUrl = `https://github.com/login/oauth/authorize?${new URLSearchParams(
      {
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_REDIRECT_URI,
        scope: GITHUB_OAUTH_SCOPES,
        state,
        allow_signup: "false",
        prompt: "consent",
      }
    ).toString()}`;

    return res.status(200).json({ success: true, authorizationUrl });
  } catch (error) {
    console.error("GitHub connect failed", error?.message);
    return sendError(
      res,
      500,
      "CONNECT_START_FAILED",
      "Unable to start GitHub connection."
    );
  }
}
