import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-3-flash-preview";

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;
const MAX_RETRIES = 2;

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

Act as:
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
If the user has uploaded images or files to the project, their secure signed URLs will be listed below. 
You MUST utilize these exact image URLs if the user requests them or if they fit the website context (e.g. products, logos, backgrounds).

==================================================
STREAM OUTPUT FORMAT
==================================================
Return ONLY:

<WEB_HTML>
HTML BODY
</WEB_HTML>

<WEB_CSS>
CSS
</WEB_CSS>

<WEB_JS>
JAVASCRIPT
</WEB_JS>

Never use Markdown, triple backticks, or explanations. HTML must only contain body contents without wrapper tags.
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/```html/gi, "")
    .replace(/```css/gi, "")
    .replace(/```javascript/gi, "")
    .replace(/```js/gi, "")
    .replace(/```/g, "");
}

function extract(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return { content: "", complete: false };

  const contentStart = startIndex + start.length;
  const endIndex = text.indexOf(end, contentStart);

  return {
    content: endIndex === -1 ? text.slice(contentStart) : text.slice(contentStart, endIndex),
    complete: endIndex !== -1,
  };
}

function statusOf(error) {
  return error?.status || error?.response?.status || error?.statusCode || 500;
}

function shouldRetry(error) {
  return [408, 409, 429, 500, 502, 503, 504].includes(statusOf(error));
}

function sendEvent(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}

function existingCode(body) {
  const code = body?.currentCode || {};
  return {
    html: typeof code.html === "string" ? code.html.slice(0, MAX_CODE_LENGTH) : "",
    css: typeof code.css === "string" ? code.css.slice(0, MAX_CODE_LENGTH) : "",
    js: typeof code.js === "string" ? code.js.slice(0, MAX_CODE_LENGTH) : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "GEMINI_API_KEY is not configured." });
  }

  const body = req.body || {};
  const mode = body?.mode === "edit" ? "edit" : "generate";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const projectId = body?.projectId;

  if (!prompt) {
    return res.status(400).json({ success: false, error: "Please enter a website request." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  /* ========================================================
     FETCH PROJECT FILES & SIGNED URLS FOR STREAMING AI
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
The user has uploaded these files. Embed these URLs directly where images/files are needed in the layout:
${fileDetails.join("\n")}
`;
        }
      }
    } catch (err) {
      console.error("Stream file context error:", err);
    }
  }

  const code = existingCode(body);
  const hasExisting = Boolean(code.html || code.css || code.js);

  if (mode === "edit" && !hasExisting) {
    sendEvent(res, "error", {
      message: "There is no existing website to edit. Generate a website first.",
      status: 400,
    });
    return res.end();
  }

  let existingContext = "";
  if (hasExisting) {
    existingContext = `
==================================================
EXISTING WEBSITE
==================================================
HTML:
${code.html}

CSS:
${code.css}

JAVASCRIPT:
${code.js}
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

  sendEvent(res, "status", {
    stage: "thinking",
    message: mode === "edit" ? "Understanding your existing website..." : "Understanding your idea...",
  });

  let stream = null;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        sendEvent(res, "status", {
          stage: "retrying",
          message: "Retrying Gemini connection...",
          attempt,
        });
        await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 4000));
      }

      sendEvent(res, "status", {
        stage: "connecting",
        message: "Connecting to Gemini AI...",
        model: MODEL,
      });

      stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: input,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 30000,
        },
      });
      break;
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error)) break;
    }
  }

  if (!stream) {
    sendEvent(res, "error", {
      message: lastError?.message || "Gemini generation failed.",
      status: statusOf(lastError),
    });
    return res.end();
  }

  let fullText = "";
  let htmlSent = 0;
  let cssSent = 0;
  let jsSent = 0;
  let stage = "generating";

  sendEvent(res, "status", {
    stage,
    message: "Gemini is generating your website with your files...",
    model: MODEL,
  });

  try {
    for await (const chunk of stream) {
      const delta = chunk?.text || "";
      if (!delta) continue;
      fullText += delta;

      // HTML Part
      const htmlPart = extract(fullText, "<WEB_HTML>", "</WEB_HTML>");
      if (htmlPart && htmlPart.content) {
        const html = clean(htmlPart.content);
        if (html.length > htmlSent) {
          const newDelta = html.slice(htmlSent);
          htmlSent = html.length;
          if (stage !== "html") {
            stage = "html";
            sendEvent(res, "status", { stage: "html", message: "Writing HTML..." });
          }
          sendEvent(res, "code", { type: "html", delta: newDelta, value: html, complete: htmlPart.complete });
        }
      }

      // CSS Part
      const cssPart = extract(fullText, "<WEB_CSS>", "</WEB_CSS>");
      if (cssPart && cssPart.content) {
        const css = clean(cssPart.content);
        if (css.length > cssSent) {
          const newDelta = css.slice(cssSent);
          cssSent = css.length;
          if (stage !== "css") {
            stage = "css";
            sendEvent(res, "status", { stage: "css", message: "Designing CSS..." });
          }
          sendEvent(res, "code", { type: "css", delta: newDelta, value: css, complete: cssPart.complete });
        }
      }

      // JS Part
      const jsPart = extract(fullText, "<WEB_JS>", "</WEB_JS>");
      if (jsPart && jsPart.content) {
        const js = clean(jsPart.content);
        if (js.length > jsSent) {
          const newDelta = js.slice(jsSent);
          jsSent = js.length;
          if (stage !== "js") {
            stage = "js";
            sendEvent(res, "status", { stage: "js", message: "Adding interactions..." });
          }
          sendEvent(res, "code", { type: "js", delta: newDelta, value: js, complete: jsPart.complete });
        }
      }
    }

    const finalHtml = extract(fullText, "<WEB_HTML>", "</WEB_HTML>")?.content || "";
    const finalCss = extract(fullText, "<WEB_CSS>", "</WEB_CSS>")?.content || "";
    const finalJs = extract(fullText, "<WEB_JS>", "</WEB_JS>")?.content || "";

    const result = {
      html: clean(finalHtml).trim(),
      css: clean(finalCss).trim(),
      js: clean(finalJs).trim(),
    };

    if (!result.html && !result.css && !result.js) {
      throw new Error("Gemini returned an empty website.");
    }

    sendEvent(res, "complete", {
      success: true,
      model: MODEL,
      html: result.html,
      css: result.css,
      js: result.js,
    });

    return res.end();
  } catch (error) {
    sendEvent(res, "error", {
      message: error?.message || "Gemini streaming generation failed.",
    });
    return res.end();
  }
}
