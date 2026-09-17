import {
  decryptToken,
  getConnection,
  getSupabaseUser,
  githubError,
  githubHeaders,
  readGithubResponse,
  sendError,
  validateRepositoryFullName,
} from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const repository =
    typeof req.query?.repository === "string" ? req.query.repository : "";

  if (!validateRepositoryFullName(repository)) {
    return sendError(
      res,
      400,
      "INVALID_REPOSITORY",
      "A repository in owner/name format is required."
    );
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

    const token = decryptToken(connection.access_token);

    const repoResponse = await fetch(
      `https://api.github.com/repos/${repository}`,
      { headers: githubHeaders(token) }
    );
    const repo = await readGithubResponse(repoResponse);

    if (!repoResponse.ok) {
      const [status, code, message] = githubError(repoResponse, repo);
      return sendError(res, status, code, message);
    }

    const branchResponse = await fetch(
      `https://api.github.com/repos/${repository}/branches?per_page=100`,
      { headers: githubHeaders(token) }
    );
    const branches = await readGithubResponse(branchResponse);

    if (!branchResponse.ok) {
      const [status, code, message] = githubError(branchResponse, branches);
      return sendError(res, status, code, message);
    }

    const defaultBranch = repo.default_branch || null;
    const branchList = Array.isArray(branches)
      ? branches.map((branch) => ({
          name: branch.name,
          protected: Boolean(branch.protected),
          default: branch.name === defaultBranch,
        }))
      : [];

    return res.status(200).json({
      success: true,
      defaultBranch,
      branches: branchList,
    });
  } catch (error) {
    console.error("GitHub branches failed", error?.message);
    return sendError(
      res,
      500,
      "BRANCHES_FAILED",
      "Unable to load repository branches."
    );
  }
}
