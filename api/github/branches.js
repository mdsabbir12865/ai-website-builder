import { getSupabaseUser, getGithubConnection, githubHeaders, readJson } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, error: "Method not allowed." });
  try {
    const user = await getSupabaseUser(req);
    if (!user) return res.status(401).json({ success: false, error: "You must be logged in." });
    const owner = typeof req.query.owner === "string" ? req.query.owner : "";
    const repo = typeof req.query.repo === "string" ? req.query.repo : "";
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return res.status(400).json({ success: false, error: "A valid repository is required." });
    const connection = await getGithubConnection(user.id);
    if (!connection) return res.status(400).json({ success: false, error: "GitHub is not connected." });
    const [repoResponse, branchesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: githubHeaders(connection.accessToken) }),
      fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`, { headers: githubHeaders(connection.accessToken) }),
    ]);
    const repoData = await readJson(repoResponse);
    const branchesData = await readJson(branchesResponse);
    if (!repoResponse.ok || !branchesResponse.ok) return res.status(!repoResponse.ok ? repoResponse.status : branchesResponse.status).json({ success: false, error: repoData.message || branchesData.message || "Unable to load branches." });
    return res.json({ success: true, defaultBranch: repoData.default_branch, branches: branchesData.map((branch) => ({ name: branch.name, protected: Boolean(branch.protected), default: branch.name === repoData.default_branch })) });
  } catch { return res.status(500).json({ success: false, error: "Unable to load branches." }); }
}
