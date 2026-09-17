/**
 * Convert Builder editor HTML/CSS/JS into GitHub export files.
 * Pure function — does not mutate inputs.
 */
export function buildGitHubExportFiles(projectName, html, css, javascript) {
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

  const bodyHtml = typeof html === "string" ? html : "";
  const styleCss = typeof css === "string" ? css : "";
  const scriptJs = typeof javascript === "string" ? javascript : "";

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
${bodyHtml}
  <script src="script.js"></script>
</body>
</html>
`,
    "style.css": styleCss,
    "script.js": scriptJs,
  };
}

/**
 * Safely parse an API response that may be JSON, HTML, or empty.
 */
export async function readApiResponse(response) {
  const text = await response.text();

  if (!text) {
    return {
      success: false,
      error: `Request failed (${response.status}). Empty response.`,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    const looksLikeHtml = /^\s*</.test(text);
    return {
      success: false,
      error: looksLikeHtml
        ? `Request failed (${response.status}). The server returned an HTML page instead of JSON.`
        : `Request failed (${response.status}). Please try again.`,
    };
  }
}
