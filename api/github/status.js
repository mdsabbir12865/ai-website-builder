import {
  decryptToken,
  getConnection,
  getGrantedScopes,
  getSupabaseUser,
  hasRepoScope,
  sendError,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  try {
    const user = await getSupabaseUser(req);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Not authenticated.");
    }

    const connection = await getConnection(user.id);
    if (!connection) {
      return res.status(200).json({
        success: true,
        connected: false,
        connection: null,
      });
    }

    let scope = connection.scope || "";
    let hasRepo = hasRepoScope(scope);
    let tokenValid = true;

    try {
      const accessToken = decryptToken(connection.access_token);
      const granted = await getGrantedScopes(accessToken, scope);

      if (!granted.response.ok) {
        tokenValid = granted.response.status !== 401;
        if (granted.response.status === 401) {
          return res.status(200).json({
            success: true,
            connected: false,
            connection: null,
            code: "GITHUB_AUTH_INVALID",
            error:
              "GitHub authorization has expired. Please reconnect GitHub.",
          });
        }
      } else {
        scope = granted.scopes;
        hasRepo = hasRepoScope(granted.scopeList);
      }
    } catch {
      tokenValid = false;
    }

    return res.status(200).json({
      success: true,
      connected: true,
      connection: {
        id: connection.github_id,
        login: connection.github_login,
        avatar: connection.github_avatar_url,
        scope,
        hasRepoScope: hasRepo,
        tokenValid,
        updatedAt: connection.updated_at,
      },
    });
  } catch (error) {
    console.error("GitHub status error:", error?.message);
    return sendError(
      res,
      500,
      "STATUS_FAILED",
      "Unable to check GitHub connection."
    );
  }
}
