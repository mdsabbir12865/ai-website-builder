import {
  decryptToken,
  getConnection,
  getGrantedScopes,
  getSupabaseUser,
  githubError,
  githubHeaders,
  hasRepoScope,
  readGithubResponse,
  repoScopeRequiredError,
  sendError,
  validateRepositoryName,
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

    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 350)
        : "";

    if (!validateRepositoryName(name)) {
      return sendError(
        res,
        400,
        "INVALID_REPOSITORY_NAME",
        "Repository names must be 1–100 characters and use only letters, numbers, dots, hyphens, or underscores."
      );
    }

    const connection = await getConnection(user.id);
    if (!connection?.access_token) {
      return sendError(
        res,
        400,
        "GITHUB_NOT_CONNECTED",
        "GitHub is not connected."
      );
    }

    const accessToken = decryptToken(connection.access_token);
    const granted = await getGrantedScopes(
      accessToken,
      connection.scope || ""
    );

    if (!granted.response.ok) {
      const [status, code, message] = githubError(
        granted.response,
        granted.body
      );
      return sendError(res, status, code, message);
    }

    if (!hasRepoScope(granted.scopeList)) {
      const [status, code, message] = repoScopeRequiredError();
      return sendError(res, status, code, message);
    }

    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: githubHeaders(accessToken, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        name,
        description,
        private: req.body?.private === true,
        auto_init: true,
      }),
    });

    const data = await readGithubResponse(response);

    if (!response.ok) {
      const [status, code, message] = githubError(response, data);
      const isDuplicate =
        response.status === 422 && /already exists/i.test(data?.message || "");
      return sendError(
        res,
        status,
        isDuplicate ? "REPOSITORY_EXISTS" : code,
        isDuplicate
          ? "A repository with that name already exists on your account."
          : message
      );
    }

    return res.status(201).json({
      success: true,
      repository: {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        private: data.private,
        default_branch: data.default_branch,
        html_url: data.html_url,
        description: data.description || "",
      },
    });
  } catch (error) {
    console.error("GitHub repository creation failed", error?.message);
    return sendError(
      res,
      500,
      "CREATE_REPOSITORY_FAILED",
      "Unable to create repository."
    );
  }
}
