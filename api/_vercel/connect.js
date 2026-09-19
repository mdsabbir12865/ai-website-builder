import {
  VERCEL_INTEGRATION_CLIENT_ID,
  VERCEL_INTEGRATION_SLUG,
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
    if (!VERCEL_INTEGRATION_CLIENT_ID || !VERCEL_INTEGRATION_SLUG) {
      return sendError(
        res,
        500,
        "VERCEL_NOT_CONFIGURED",
        "Vercel integration is not configured."
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
    setCookie(res, "vercel_oauth_state", state, { maxAge: 600 });

    const authorizationUrl = `https://vercel.com/integrations/${encodeURIComponent(
      VERCEL_INTEGRATION_SLUG
    )}/new?${new URLSearchParams({ state }).toString()}`;

    return res.status(200).json({ success: true, authorizationUrl });
  } catch (error) {
    console.error("Vercel connect failed", error?.message);
    return sendError(
      res,
      500,
      "CONNECT_START_FAILED",
      "Unable to start Vercel connection."
    );
  }
}
