/**
 * Pure helpers for Vercel static deployment payloads and UX mapping.
 */

export function buildVercelExportFiles(projectName, html, css, javascript) {
  const title = String(projectName || "My Website").replace(
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
${typeof html === "string" ? html : ""}
  <script src="script.js"></script>
</body>
</html>
`,
    "style.css": typeof css === "string" ? css : "",
    "script.js": typeof javascript === "string" ? javascript : "",
  };
}

export function sanitizeVercelProjectName(value, fallbackSeed = "website") {
  const raw = String(value || fallbackSeed)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (!raw || !/^[a-z0-9]/.test(raw)) {
    return typeof fallbackSeed === "string" && /^[a-z0-9]/.test(fallbackSeed)
      ? fallbackSeed.slice(0, 100)
      : "website";
  }
  return raw;
}

export function deploymentPhaseLabel(phase, readyState) {
  const key = phase || readyState || "";
  switch (String(key).toLowerCase()) {
    case "queued":
      return "Queued on Vercel…";
    case "initializing":
      return "Preparing deployment…";
    case "building":
      return "Building your website…";
    case "deploying":
      return "Deploying…";
    case "ready":
      return "Your website is live";
    case "failed":
    case "error":
      return "Deployment failed";
    case "canceled":
      return "Deployment canceled";
    default:
      return "Working…";
  }
}

export function isTerminalDeploymentState(readyState) {
  return ["READY", "ERROR", "CANCELED"].includes(String(readyState || ""));
}

export function humanizeVercelError(code, fallback) {
  const messages = {
    VERCEL_NOT_CONNECTED: "Connect Vercel before deploying.",
    VERCEL_NOT_CONFIGURED:
      "Vercel integration is not configured on the server yet.",
    OAUTH_CANCELED: "Vercel connection was canceled.",
    OAUTH_STATE_INVALID:
      "Vercel connection could not be verified. Please try again.",
    OAUTH_STATE_EXPIRED:
      "Vercel connection expired. Please try Connect Vercel again.",
    TOKEN_INVALID:
      "Your Vercel connection has expired. Please reconnect your account.",
    TOKEN_REVOKED:
      "Your Vercel connection was revoked. Please reconnect your account.",
    INSUFFICIENT_PERMISSION:
      "Vercel denied this operation. Reconnect and grant project and deployment access.",
    TEAM_ACCESS_DENIED:
      "Vercel denied access for this team. Reconnect and choose a team you can deploy to.",
    PROJECT_NOT_FOUND: "The selected project was not found.",
    PROJECT_CREATE_FAILED: "Unable to create the Vercel project.",
    PROJECT_EXISTS:
      "A Vercel project with that name already exists. Choose another name or select the existing project.",
    GITHUB_REPOSITORY_NOT_FOUND: "GitHub repository was not found or is invalid.",
    GITHUB_BRANCH_NOT_FOUND: "GitHub branch was not found or is invalid.",
    DEPLOYMENT_FAILED: "Deployment failed. Please try again.",
    DEPLOYMENT_TIMEOUT:
      "Deployment is taking longer than expected. Check again in a moment.",
    RATE_LIMITED: "Vercel rate limit reached. Please wait and try again.",
    NETWORK_ERROR: "Network error. Check your connection and try again.",
    INVALID_PROJECT_NAME: "That Vercel project name is invalid.",
    DUPLICATE_DEPLOYMENT:
      "A deployment is already in progress for this project.",
    UNAUTHENTICATED: "Please log in first.",
  };

  return messages[code] || fallback || "Something went wrong. Please try again.";
}
