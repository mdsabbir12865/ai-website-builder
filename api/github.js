import branches from "./_github/branches.js";
import callback from "./_github/callback.js";
import connect from "./_github/connect.js";
import createRepo from "./_github/create-repo.js";
import disconnect from "./_github/disconnect.js";
import push from "./_github/push.js";
import repos from "./_github/repos.js";
import status from "./_github/status.js";

const HANDLERS = {
  branches,
  callback,
  connect,
  "create-repo": createRepo,
  disconnect,
  push,
  repos,
  status,
};

function resolveAction(req) {
  if (typeof req.query?.action === "string" && req.query.action) {
    return req.query.action;
  }

  const pathname = String(req.url || "").split("?")[0] || "";
  const match = pathname.match(/^\/api\/github\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req, res) {
  const action = resolveAction(req);
  const route = action ? HANDLERS[action] : null;

  if (!route) {
    return res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      error: "GitHub API route not found.",
    });
  }

  return route(req, res);
}
