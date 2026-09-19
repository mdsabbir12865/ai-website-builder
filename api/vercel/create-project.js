import {
  decryptToken,
  getConnection,
  getOwnedProject,
  getSupabaseUser,
  sanitizeProjectName,
  sendError,
  touchConnection,
  validateProjectName,
  validateUuid,
  vercelApi,
  vercelError,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  try {
    const user = await getSupabaseUser(req);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "You must be logged in.");
    }

    const builderProjectId =
      typeof req.body?.projectId === "string" ? req.body.projectId : "";
    if (!validateUuid(builderProjectId)) {
      return sendError(
        res,
        400,
        "INVALID_PROJECT",
        "A valid Builder project ID is required."
      );
    }

    const owned = await getOwnedProject(user.id, builderProjectId);
    if (!owned) {
      return sendError(
        res,
        404,
        "PROJECT_NOT_FOUND",
        "Builder project not found."
      );
    }

    const requestedName =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const name = sanitizeProjectName(requestedName || owned.name || "website");

    if (!validateProjectName(name)) {
      return sendError(
        res,
        400,
        "INVALID_PROJECT_NAME",
        "Project names must start with a letter or number and use only lowercase letters, numbers, dots, hyphens, or underscores."
      );
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
      method: "POST",
      teamId: connection.team_id || undefined,
      body: {
        name,
        framework: null,
      },
    });

    if (!response.ok) {
      const [status, code, message] = vercelError(response, body);
      const isDuplicate = /already exists|taken|conflict/i.test(message);
      return sendError(
        res,
        status,
        isDuplicate ? "PROJECT_EXISTS" : code,
        isDuplicate
          ? "A Vercel project with that name already exists. Choose another name or select the existing project."
          : message || "Unable to create Vercel project."
      );
    }

    await touchConnection(user.id);

    return res.status(201).json({
      success: true,
      project: {
        id: body.id,
        name: body.name,
        framework: body.framework ?? null,
      },
    });
  } catch (error) {
    console.error("Vercel create project failed", error?.message);
    return sendError(
      res,
      500,
      "PROJECT_CREATE_FAILED",
      "Unable to create Vercel project."
    );
  }
}
