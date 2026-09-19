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
      return sendError(res, 401, "UNAUTHENTICATED", "You must be logged in.");
    }

    const connection = await getConnection(user.id);
    if (!connection?.access_token) {
      return sendError(
        res,
        400,
        "VERCEL_NOT_CONNECTED",
        "Vercel is not connected."
      );
    }

    const accessToken = decryptToken(connection.access_token);
    const { response, body } = await vercelApi(accessToken, "/v9/projects", {
      teamId: connection.team_id || undefined,
      query: { limit: "50" },
    });

    if (!response.ok) {
      const [status, code, message] = vercelError(response, body);
      return sendError(res, status, code, message);
    }

    await touchConnection(user.id);

    const projects = Array.isArray(body?.projects)
      ? body.projects.map((project) => ({
          id: project.id,
          name: project.name,
          framework: project.framework ?? null,
          updatedAt: project.updatedAt || null,
          link: project.link
            ? {
                type: project.link.type || null,
                repo: project.link.repo || null,
                org: project.link.org || null,
              }
            : null,
        }))
      : [];

    return res.status(200).json({
      success: true,
      teamId: connection.team_id || null,
      projects,
    });
  } catch (error) {
    console.error("Vercel projects error:", error?.message);
    return sendError(
      res,
      500,
      "PROJECTS_FAILED",
      "Unable to load Vercel projects."
    );
  }
}
