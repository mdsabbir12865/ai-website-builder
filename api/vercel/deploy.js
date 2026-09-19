import {
  buildDeploymentFiles,
  decryptToken,
  getAdminSupabase,
  getConnection,
  getOwnedProject,
  getSupabaseUser,
  isDeployInProgress,
  mapReadyStateToPhase,
  publicDeploymentUrl,
  sanitizeProjectName,
  sendError,
  setDeployLock,
  touchConnection,
  validateBranch,
  validateRepositoryFullName,
  validateUuid,
  validateVercelProjectId,
  vercelApi,
  vercelError,
} from "./_utils.js";

/**
 * Build static website files from Builder project columns.
 * Matches the GitHub export structure (index.html / style.css / script.js).
 */
function buildStaticFiles(project) {
  const title = String(project.name || "My Website").replace(
    /[<>&"]/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
      })[char]
  );

  return {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${project.html_code || ""}
  <script src="script.js"></script>
</body>
</html>
`,
    "style.css": project.css_code || "",
    "script.js": project.js_code || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  let lockProjectId = null;
  let lockUserId = null;

  try {
    const user = await getSupabaseUser(req);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "You must be logged in.");
    }

    const projectId =
      typeof req.body?.projectId === "string" ? req.body.projectId : "";
    if (!validateUuid(projectId)) {
      return sendError(
        res,
        400,
        "INVALID_PROJECT",
        "A valid Builder project ID is required."
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

    if (isDeployInProgress(project)) {
      return sendError(
        res,
        409,
        "DUPLICATE_DEPLOYMENT",
        "A deployment is already in progress for this project. Please wait for it to finish."
      );
    }

    const connection = await getConnection(user.id);
    if (!connection?.access_token) {
      return sendError(
        res,
        400,
        "VERCEL_NOT_CONNECTED",
        "Connect Vercel before deploying."
      );
    }

    let vercelProjectId =
      typeof req.body?.vercelProjectId === "string"
        ? req.body.vercelProjectId.trim()
        : project.vercel_project_id || "";

    if (vercelProjectId && !validateVercelProjectId(vercelProjectId)) {
      return sendError(
        res,
        400,
        "INVALID_PROJECT",
        "Invalid Vercel project identifier."
      );
    }

    const githubRepository =
      typeof req.body?.githubRepository === "string"
        ? req.body.githubRepository.trim()
        : project.github_repo_full_name || null;
    const githubBranch =
      typeof req.body?.githubBranch === "string"
        ? req.body.githubBranch.trim()
        : project.github_branch || null;

    if (githubRepository && !validateRepositoryFullName(githubRepository)) {
      return sendError(
        res,
        400,
        "GITHUB_REPOSITORY_NOT_FOUND",
        "GitHub repository must be in owner/name format."
      );
    }
    if (githubBranch && !validateBranch(githubBranch)) {
      return sendError(
        res,
        400,
        "GITHUB_BRANCH_NOT_FOUND",
        "GitHub branch name is invalid."
      );
    }

    lockProjectId = projectId;
    lockUserId = user.id;
    await setDeployLock(projectId, user.id, true);

    const accessToken = decryptToken(connection.access_token);
    const teamId = connection.team_id || project.vercel_team_id || undefined;

    let vercelProjectName =
      typeof req.body?.vercelProjectName === "string"
        ? sanitizeProjectName(req.body.vercelProjectName)
        : project.vercel_project_name ||
          sanitizeProjectName(project.name || "website");

    // Create a Vercel project if the Builder project is not linked yet.
    if (!vercelProjectId) {
      const create = await vercelApi(accessToken, "/v9/projects", {
        method: "POST",
        teamId,
        body: {
          name: vercelProjectName,
          framework: null,
        },
      });

      if (!create.response.ok) {
        // If name taken, try a unique suffix once.
        const message =
          create.body?.error?.message || create.body?.message || "";
        if (/already exists|taken|conflict/i.test(message)) {
          vercelProjectName = sanitizeProjectName(
            `${vercelProjectName}-${Date.now().toString(36).slice(-4)}`
          );
          const retry = await vercelApi(accessToken, "/v9/projects", {
            method: "POST",
            teamId,
            body: { name: vercelProjectName, framework: null },
          });
          if (!retry.response.ok) {
            const [status, code, text] = vercelError(retry.response, retry.body);
            await setDeployLock(projectId, user.id, false);
            return sendError(res, status, code, text);
          }
          vercelProjectId = retry.body.id;
          vercelProjectName = retry.body.name || vercelProjectName;
        } else {
          const [status, code, text] = vercelError(create.response, create.body);
          await setDeployLock(projectId, user.id, false);
          return sendError(
            res,
            status,
            code === "VERCEL_VALIDATION" ? "PROJECT_CREATE_FAILED" : code,
            text
          );
        }
      } else {
        vercelProjectId = create.body.id;
        vercelProjectName = create.body.name || vercelProjectName;
      }
    }

    let files;
    try {
      files = buildDeploymentFiles(buildStaticFiles(project));
    } catch (fileError) {
      await setDeployLock(projectId, user.id, false);
      return sendError(
        res,
        400,
        fileError.code || "INVALID_FILES",
        fileError.message || "Unable to prepare deployment files."
      );
    }

    const deploy = await vercelApi(accessToken, "/v13/deployments", {
      method: "POST",
      teamId,
      query: {
        skipAutoDetectionConfirmation: "1",
        forceNew: "1",
      },
      body: {
        name: vercelProjectName,
        project: vercelProjectId,
        files,
        projectSettings: {
          framework: null,
          buildCommand: null,
          installCommand: null,
          outputDirectory: null,
        },
        target: "production",
        meta: {
          webaiProjectId: projectId,
          ...(githubRepository ? { githubRepository } : {}),
          ...(githubBranch ? { githubBranch } : {}),
        },
      },
    });

    if (!deploy.response.ok) {
      const [status, code, text] = vercelError(deploy.response, deploy.body);
      await setDeployLock(projectId, user.id, false);
      return sendError(
        res,
        status,
        code === "VERCEL_API_ERROR" ? "DEPLOYMENT_FAILED" : code,
        text
      );
    }

    const deploymentId = deploy.body.id || deploy.body.uid || null;
    const readyState = deploy.body.readyState || "QUEUED";
    const url = publicDeploymentUrl(deploy.body);
    const now = new Date().toISOString();

    const admin = getAdminSupabase();

    await admin
      .from("projects")
      .update({
        vercel_project_id: vercelProjectId,
        vercel_project_name: vercelProjectName,
        vercel_team_id: teamId || null,
        github_repo_full_name: githubRepository || null,
        github_branch: githubBranch || null,
        last_deployment_id: deploymentId,
        last_deployment_url: url,
        last_deployed_at: now,
        deploy_in_progress_at:
          readyState === "READY" ||
          readyState === "ERROR" ||
          readyState === "CANCELED"
            ? null
            : now,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);

    await admin.from("vercel_deployments").insert({
      user_id: user.id,
      project_id: projectId,
      github_repository: githubRepository || null,
      github_branch: githubBranch || null,
      vercel_project_id: vercelProjectId,
      vercel_project_name: vercelProjectName,
      deployment_id: deploymentId,
      deployment_status: readyState,
      deployment_url: url,
      last_error: null,
    });

    await touchConnection(user.id);

    if (
      readyState === "READY" ||
      readyState === "ERROR" ||
      readyState === "CANCELED"
    ) {
      await setDeployLock(projectId, user.id, false);
    }

    return res.status(200).json({
      success: true,
      deployment: {
        id: deploymentId,
        readyState,
        phase: mapReadyStateToPhase(readyState),
        url,
        vercelProjectId,
        vercelProjectName,
        inspectorUrl: deploy.body.inspectorUrl || null,
      },
    });
  } catch (error) {
    console.error("Vercel deploy failed", error?.message);
    if (lockProjectId && lockUserId) {
      try {
        await setDeployLock(lockProjectId, lockUserId, false);
      } catch {
        // ignore unlock failure
      }
    }
    return sendError(
      res,
      500,
      "DEPLOYMENT_FAILED",
      "Unable to deploy to Vercel."
    );
  }
}
