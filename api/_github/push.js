import {
  decryptToken,
  getConnection,
  getSupabaseUser,
  githubError,
  githubHeaders,
  readGithubResponse,
  sendError,
  validateBranch,
  validateRepositoryFullName,
} from "./_utils.js";

const FILES = ["index.html", "style.css", "script.js"];
const MAX_FILE_BYTES = 1024 * 1024;

function isTextContent(value) {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= MAX_FILE_BYTES
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
  }

  const { repository, branch, files } = req.body || {};
  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim().slice(0, 250)
      : "";

  if (!validateRepositoryFullName(repository)) {
    return sendError(
      res,
      400,
      "INVALID_REPOSITORY",
      "A repository in owner/name format is required."
    );
  }

  if (!validateBranch(branch)) {
    return sendError(
      res,
      400,
      "INVALID_BRANCH",
      "A valid branch is required."
    );
  }

  if (!message) {
    return sendError(
      res,
      400,
      "INVALID_COMMIT_MESSAGE",
      "A commit message is required."
    );
  }

  if (
    !files ||
    typeof files !== "object" ||
    !FILES.every((path) => isTextContent(files[path]))
  ) {
    return sendError(
      res,
      400,
      "INVALID_FILES",
      "index.html, style.css, and script.js are required and must each be under 1 MB."
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
    const results = [];

    for (const path of FILES) {
      const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
      const currentResponse = await fetch(
        `https://api.github.com/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
        { headers: githubHeaders(token) }
      );

      const current =
        currentResponse.status === 404
          ? null
          : await readGithubResponse(currentResponse);

      if (currentResponse.status !== 404 && !currentResponse.ok) {
        const [status, code, text] = githubError(currentResponse, current);
        return sendError(res, status, code, text);
      }

      const payload = {
        message,
        content: Buffer.from(files[path], "utf8").toString("base64"),
        branch,
      };

      if (current?.sha) {
        payload.sha = current.sha;
      }

      const writeResponse = await fetch(
        `https://api.github.com/repos/${repository}/contents/${encodedPath}`,
        {
          method: "PUT",
          headers: githubHeaders(token, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(payload),
        }
      );
      const written = await readGithubResponse(writeResponse);

      if (!writeResponse.ok) {
        const [status, code, text] = githubError(writeResponse, written);
        return sendError(res, status, code, text);
      }

      results.push({
        path,
        url: written?.content?.html_url || null,
        commit: written?.commit?.sha || null,
      });
    }

    return res.status(200).json({
      success: true,
      repository,
      branch,
      repositoryUrl: `https://github.com/${repository}`,
      commitUrl: results[results.length - 1]?.commit
        ? `https://github.com/${repository}/commit/${results[results.length - 1].commit}`
        : null,
      files: results,
    });
  } catch (error) {
    console.error("GitHub push failed", error?.message);
    return sendError(
      res,
      500,
      "PUSH_FAILED",
      "Unable to push builder files to GitHub."
    );
  }
}
