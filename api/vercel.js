import callback from "./_vercel/callback.js";
import connect from "./_vercel/connect.js";
import createProject from "./_vercel/create-project.js";
import deploy from "./_vercel/deploy.js";
import deploymentStatus from "./_vercel/deployment-status.js";
import disconnect from "./_vercel/disconnect.js";
import projects from "./_vercel/projects.js";
import status from "./_vercel/status.js";

const HANDLERS = {
  callback,
  connect,
  "create-project": createProject,
  deploy,
  "deployment-status": deploymentStatus,
  disconnect,
  projects,
  status,
};

function resolveAction(req) {
  if (typeof req.query?.action === "string" && req.query.action) {
    return req.query.action;
  }

  const pathname = String(req.url || "").split("?")[0] || "";
  const match = pathname.match(/^\/api\/vercel\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req, res) {
  const action = resolveAction(req);
  const route = action ? HANDLERS[action] : null;

  if (!route) {
    return res.status(404).json({
      success: false,
      code: "NOT_FOUND",
      error: "Vercel API route not found.",
    });
  }

  return route(req, res);
}
