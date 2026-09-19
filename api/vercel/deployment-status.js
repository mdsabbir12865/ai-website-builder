import {
  TERMINAL_DEPLOYMENT_STATES,
  decryptToken,
  getAdminSupabase,
  getConnection,
  getOwnedProject,
  getSupabaseUser,
  mapReadyStateToPhase,
  publicDeploymentUrl,
  sendError,
  setDeployLock,
  touchConnection,
  validateDeploymentId,
  validateUuid,
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

    const projectId =
      typeof req.query?.projectId === "string" ? req.query.projectId : "";
    const deploymentId =
      typeof req.query?.deploymentId === "string"
        ? req.query.deploymentId
        : "";

    if (!validateUuid(projectId)) {
      return sendError(
        res,
        400,
        "INVALID_PROJECT",
        "A valid Builder project ID is required."
      );
    }

    if (!validateDeploymentId(deploymentId)) {
      return sendError(
        res,
        400,
        "INVALID_DEPLOYMENT",
        "A valid deployment ID is required."
      );
    }

    const project = await getOwnedProject(user.id, projectId);
    if (!project) {
      return sendError(
        res,
        404,
        "PROJECT_NOT_FOUND",
        "Builder project not found."
      );
    }

    // Only allow polling deployments that belong to this project (or latest).
    if (
      project.last_deployment_id &&
      project.last_deployment_id !== deploymentId
    ) {
      const { data: history } = await getAdminSupabase()
        .from("vercel_deployments")
        .select("id")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("deployment_id", deploymentId)
        .maybeSingle();

      if (!history) {
        return sendError(
          res,
          403,
          "DEPLOYMENT_FORBIDDEN",
          "This deployment does not belong to your project."
        );
      }
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
    const teamId = connection.team_id || project.vercel_team_id || undefined;

    const { response, body } = await vercelApi(
      accessToken,
      `/v13/deployments/${encodeURIComponent(deploymentId)}`,
      { teamId }
    );

    if (!response.ok) {
      const [status, code, message] = vercelError(response, body);
      return sendError(res, status, code, message);
    }

    const readyState = body.readyState || "QUEUED";
    const url = publicDeploymentUrl(body);
    const terminal = TERMINAL_DEPLOYMENT_STATES.has(readyState);
    const now = new Date().toISOString();

    const admin = getAdminSupabase();

    await admin
      .from("vercel_deployments")
      .update({
        deployment_status: readyState,
        deployment_url: url,
        last_error:
          readyState === "ERROR"
            ? body.readyStateReason || "Deployment failed."
            : null,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("deployment_id", deploymentId);

    const projectUpdate = {
      last_deployment_id: deploymentId,
      last_deployment_url: url || project.last_deployment_url,
    };

    if (readyState === "READY") {
      projectUpdate.last_deployed_at = now;
      projectUpdate.deploy_in_progress_at = null;
    } else if (terminal) {
      projectUpdate.deploy_in_progress_at = null;
    }

    await admin
      .from("projects")
      .update(projectUpdate)
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (terminal) {
      await setDeployLock(projectId, user.id, false);
    }

    await touchConnection(user.id);

    return res.status(200).json({
      success: true,
      deployment: {
        id: body.id || deploymentId,
        readyState,
        phase: mapReadyStateToPhase(readyState),
        url,
        terminal,
        readyStateReason: body.readyStateReason || null,
        inspectorUrl: body.inspectorUrl || null,
      },
    });
  } catch (error) {
    console.error("Vercel deployment status failed", error?.message);
    return sendError(
      res,
      500,
      "STATUS_FAILED",
      "Unable to check deployment status."
    );
  }
}
