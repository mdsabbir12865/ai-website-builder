import {
  decryptToken,
  getConnection,
  getSupabaseUser,
  githubError,
  githubHeaders,
  readGithubResponse,
  sendError,
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
        "GITHUB_NOT_CONNECTED",
        "GitHub is not connected."
      );
    }

    const accessToken = decryptToken(connection.access_token);
    const githubResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      { headers: githubHeaders(accessToken) }
    );
    const githubData = await readGithubResponse(githubResponse);

    if (!githubResponse.ok) {
      const [status, code, message] = githubError(githubResponse, githubData);
      return sendError(res, status, code, message);
    }

    if (!Array.isArray(githubData)) {
      return sendError(
        res,
        502,
        "GITHUB_API_ERROR",
        "GitHub returned an unexpected repositories response."
      );
    }

    const repositories = githubData.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch,
      html_url: repo.html_url,
      description: repo.description || "",
      owner: repo.owner?.login || "",
      updated_at: repo.updated_at || null,
    }));

    return res.status(200).json({
      success: true,
      github_login: connection.github_login,
      repositories,
    });
  } catch (error) {
    console.error("GitHub repositories error:", error?.message);
    return sendError(
      res,
      500,
      "REPOSITORIES_FAILED",
      "Unable to load GitHub repositories."
    );
  }
}
