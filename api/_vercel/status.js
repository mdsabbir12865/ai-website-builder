import {
  decryptToken,
  getConnection,
  getSupabaseUser,
  sendError,
  touchConnection,
  vercelApi,
  vercelError,
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

    let tokenValid = true;

    try {
      const accessToken = decryptToken(connection.access_token);
      const { response, body } = await vercelApi(accessToken, "/v2/user", {
        teamId: connection.team_id || undefined,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(200).json({
            success: true,
            connected: false,
            connection: null,
            code: "TOKEN_INVALID",
            error:
              "Your Vercel connection has expired. Please reconnect your account.",
          });
        }
        const [, code, message] = vercelError(response, body);
        tokenValid = false;
        return res.status(200).json({
          success: true,
          connected: true,
          connection: {
            username: connection.vercel_username,
            avatar: connection.vercel_avatar_url,
            teamId: connection.team_id,
            configurationId: connection.configuration_id,
            tokenValid: false,
            updatedAt: connection.updated_at,
          },
          code,
          error: message,
        });
      }

      await touchConnection(user.id);
    } catch {
      tokenValid = false;
    }

    return res.status(200).json({
      success: true,
      connected: true,
      connection: {
        username: connection.vercel_username,
        avatar: connection.vercel_avatar_url,
        teamId: connection.team_id,
        configurationId: connection.configuration_id,
        tokenValid,
        updatedAt: connection.updated_at,
      },
    });
  } catch (error) {
    console.error("Vercel status error:", error?.message);
    return sendError(
      res,
      500,
      "STATUS_FAILED",
      "Unable to check Vercel connection."
    );
  }
}
