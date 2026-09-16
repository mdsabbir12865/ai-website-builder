import { getSupabaseUser, getGithubConnection, githubHeaders, readJson, scopesFromResponse } from "./_utils.js";

const validPart = (value) => typeof value === "string" && /^[\w.-]+$/.test(value);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." });
  try {
    const user = await getSupabaseUser(req);
    if (!user) return res.status(401).json({ success: false, error: "You must be logged in." });
    const { owner, repo, branch, files, message } = req.body || {};
    if (![owner, repo, branch].every(validPart) || !Array.isArray(files) || files.length === 0 || files.length > 10) return res.status(400).json({ success: false, error: "Repository, branch, and files are required." });
    if (!files.every((file) => ["index.html", "style.css", "script.js"].includes(file.path) && typeof file.content === "string")) return res.status(400).json({ success: false, error: "Only valid website files can be pushed." });
    const connection = await getGithubConnection(user.id);
    if (!connection) return res.status(400).json({ success: false, error: "GitHub is not connected." });
    const check = await fetch("https://api.github.com/user", { headers: githubHeaders(connection.accessToken) });
    if (!check.ok || !scopesFromResponse(check).includes("repo")) return res.status(403).json({ success: false, error: "GitHub permission missing: repo scope. Revoke the app authorization in GitHub Settings → Applications and reconnect." });
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/`;
    const results = await Promise.all(files.map(async (file) => {
      const url = `${base}${file.path}`;
      const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(connection.accessToken) });
      let sha;
      if (existing.ok) sha = (await readJson(existing)).sha;
      else if (existing.status !== 404) { const data = await readJson(existing); throw new Error(data.message || `Unable to read ${file.path}.`); }
      const response = await fetch(url, { method: "PUT", headers: githubHeaders(connection.accessToken, { "Content-Type": "application/json" }), body: JSON.stringify({ message: typeof message === "string" && message.trim() ? message.trim() : "Export website from AI Website Builder", content: Buffer.from(file.content, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }) });
      const data = await readJson(response);
      if (!response.ok) { const error = new Error(data.message || `Unable to push ${file.path}.`); error.status = response.status; throw error; }
      return file.path;
    }));
    return res.status(200).json({ success: true, files: results, repositoryUrl: `https://github.com/${owner}/${repo}` });
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || "Unable to push website files." }); }
}
