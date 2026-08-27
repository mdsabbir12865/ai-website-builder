import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-3-flash-preview";

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 90000;

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

You are simultaneously:
- Senior frontend engineer
- UI/UX designer
- Product designer
- Accessibility specialist
- Responsive design expert
- JavaScript engineer

Generate production-quality websites using ONLY:
HTML
CSS
Vanilla JavaScript

==================================================
UPLOADED FILES & ASSETS
==================================================
If the user has uploaded images or files to the project, their secure public/signed URLs and file names will be provided in the context below. 
You MUST use these actual image URLs when designing the website if the user's prompt references images, products, logos, or backgrounds. Do not use placeholder images if project files are available.

==================================================
OUTPUT FORMAT
==================================================
Return ONLY these exact sections:

<WEB_HTML>
HTML BODY CONTENT
</WEB_HTML>

<WEB_CSS>
CSS CONTENT
</WEB_CSS>

<WEB_JS>
JAVASCRIPT CONTENT
</WEB_JS>

No Markdown.
No triple backticks.
No explanations.

WEB_HTML must contain ONLY content inside <body>.
Never include html, head, body, style, or script tags in the output snippets.
`;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clean(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/```html/gi, "")
    .replace(/```css/gi, "")
    .replace(/```javascript/gi, "")
    .replace(/```js/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extract(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return "";
  const contentStart = startIndex + start.length;
  const endIndex = text.indexOf(end, contentStart);
  if (endIndex === -1) return text.slice(contentStart);
  return text.slice(contentStart, endIndex);
}

function getStatus(error) {
  return error?.status || error?.response?.status || error?.statusCode || 500;
}

function retryable(error) {
  const status = getStatus(error);
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

function getExistingCode(body) {
  const current = body?.currentCode || {
    html: body?.html || "",
    css: body?.css || "",
    js: body?.js || "",
  };

  return {
    html: typeof current.html === "string" ? current.html.slice(0, MAX_CODE_LENGTH) : "",
    css: typeof current.css === "string" ? current.css.slice(0, MAX_CODE_LENGTH) : "",
    js: typeof current.js === "string" ? current.js.slice(0, MAX_CODE_LENGTH) : "",
  };
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Gemini request timed out."));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY is not configured.",
    });
  }

  const body = req.body || {};
  const mode = body?.mode === "edit" ? "edit" : "generate";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const projectId = body?.projectId;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Please enter a website request.",
    });
  }

  /* ========================================================
     FETCH PROJECT FILES & CREATE SIGNED URLS FOR AI
  ======================================================== */
  let fileContext = "";
  if (projectId) {
    try {
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      );

      const { data: dbFiles } = await supabaseAdmin
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      if (dbFiles && dbFiles.length > 0) {
        const fileDetails = [];
        for (const file of dbFiles) {
          // Create signed URLs valid for 2 hours for the AI to reference
          const { data: signedData } = await supabaseAdmin.storage
            .from("uploads")
            .createSignedUrl(file.file_path, 7200);

          if (signedData?.signedUrl) {
            fileDetails.push(
              `- Name: ${file.file_name}\n  Type: ${file.file_type}\n  URL: ${signedData.signedUrl}`
            );
          }
        }

        if (fileDetails.length > 0) {
          fileContext = `
==================================================
PROJECT UPLOADED FILES & ASSETS
==================================================
The user has uploaded the following files to this project. Use these exact URLs when incorporating images or files into the website:
${fileDetails.join("\n")}
`;
        }
      }
    } catch (fileErr) {
      console.error("Error fetching files for AI context:", fileErr);
    }
  }

  const existing = getExistingCode(body);
  const hasExisting = Boolean(existing.html || existing.css || existing.js);

  if (mode === "edit" && !hasExisting) {
    return res.status(400).json({
      success: false,
      error: "There is no existing website to edit. Generate a website first.",
    });
  }

  let existingContext = "";
  if (hasExisting) {
    existingContext = `
==================================================
EXISTING WEBSITE
==================================================
HTML:
${existing.html}

CSS:
${existing.css}

JAVASCRIPT:
${existing.js}
`;
  }

  const input = `
TASK MODE: ${mode === "edit" ? "EDIT EXISTING WEBSITE" : "CREATE / GENERATE WEBSITE"}

USER REQUEST:
${prompt}

${fileContext}
${existingContext}
`;

  const ai = new GoogleGenAI({ apiKey });
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: input,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            maxOutputTokens: 30000,
          },
        }),
        REQUEST_TIMEOUT
      );

      const text = response.text || "";
      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      const html = clean(extract(text, "<WEB_HTML>", "</WEB_HTML>"));
      const css = clean(extract(text, "<WEB_CSS>", "</WEB_CSS>"));
      const js = clean(extract(text, "<WEB_JS>", "</WEB_JS>"));

      if (!html && !css && !js) {
        throw new Error("Gemini returned invalid website sections.");
      }

      return res.status(200).json({
        success: true,
        model: MODEL,
        html,
        css,
        js,
      });
    } catch (error) {
      lastError = error;
      if (!retryable(error)) break;
    }
  }

  const status = getStatus(lastError);
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    error: lastError?.message || "AI generation failed.",
  });
}
