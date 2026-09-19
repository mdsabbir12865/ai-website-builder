import {
  decryptToken,
  getAdminSupabase,
  getConnection,
  getSupabaseUser,
  sendError,
  vercelApi,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  try {
    const user = await getSupabaseUser(req);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Not authenticated.");
    }

    const connection = await getConnection(user.id);

    if (connection?.access_token && connection?.configuration_id) {
      try {
        const accessToken = decryptToken(connection.access_token);
        // Best-effort uninstall of the Integration configuration.
        await vercelApi(
          accessToken,
          `/v1/integrations/configuration/${encodeURIComponent(
            connection.configuration_id
          )}`,
          {
            method: "DELETE",
            teamId: connection.team_id || undefined,
          }
        );
      } catch (error) {
        console.error("Vercel configuration revoke failed", error?.message);
      }
    }

    const { error } = await getAdminSupabase()
      .from("vercel_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Vercel disconnected.",
    });
  } catch (error) {
    console.error("Vercel disconnect error:", error?.message);
    return sendError(
      res,
      500,
      "DISCONNECT_FAILED",
      "Unable to disconnect Vercel."
    );
  }
}
