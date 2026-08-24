import { GoogleGenAI } from "@google/genai";

/*
============================================================
 WebAI Builder — Fast AI Streaming Engine
============================================================

Features:
✓ Gemini 3.7 Flash
✓ Gemini 3.6 Flash fallback
✓ Gemini 3.5 Flash-Lite fast fallback
✓ Gemini 2.5 Flash-Lite fallback
✓ Fast retry
✓ SSE streaming
✓ Live HTML/CSS/JS chunks
✓ Existing-code editing
✓ Request validation
✓ Client disconnect protection
✓ Error classification
✓ No API key exposed to frontend
============================================================
*/

export const maxDuration = 60;

const MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;
const MAX_OUTPUT_TOKENS = 24000;

const RETRYABLE_STATUS = new Set([
  429,
  500,
  502,
  503,
  504,
]);

const SYSTEM_PROMPT = `
You are WebAI Builder, a premium AI website generation engine.

Your job is to create or modify complete production-quality websites.

TECHNOLOGY:
- HTML5
- CSS3
- Vanilla JavaScript only

Do not use React.
Do not use Vue.
Do not use Angular.
Do not use external JavaScript frameworks.

============================================================
OUTPUT FORMAT
============================================================

Return ONLY these three sections:

<WEB_HTML>
body content
</WEB_HTML>

<WEB_CSS>
complete CSS
</WEB_CSS>

<WEB_JS>
complete JavaScript
</WEB_JS>

Do NOT use markdown.
Do NOT use triple backticks.
Do NOT include explanations.

WEB_HTML must contain BODY CONTENT ONLY.

Do not include:
<html>
<head>
<body>

============================================================
DESIGN
============================================================

Create a premium modern design.

Use when appropriate:

- CSS variables
- modern typography
- responsive containers
- CSS Grid
- Flexbox
- gradients
- subtle shadows
- borders
- modern radius
- hover states
- focus states
- smooth animations
- micro interactions
- visual hierarchy

Do not blindly use gradients or glassmorphism.

The design must look intentionally designed, not like a beginner template.

============================================================
RESPONSIVE
============================================================

The website must work correctly on:

Desktop
Tablet
Mobile

Use responsive CSS.

Avoid horizontal overflow.

Navigation must work on mobile.

Cards and grids must adapt naturally.

Buttons must remain usable on touch devices.

============================================================
ACCESSIBILITY
============================================================

Use semantic HTML.

Use:

aria-label
aria-expanded
aria-controls
alt
button
label
input

Provide visible focus states.

Do not use clickable divs when a button is appropriate.

============================================================
JAVASCRIPT
============================================================

Use vanilla JavaScript.

Implement real functionality when requested.

Examples:

- mobile menu
- tabs
- accordion
- modal
- form validation
- filtering
- search
- theme switch
- counters
- smooth scrolling
- interactive buttons

Never create fake functionality.

Never reference elements that do not exist.

If JavaScript is unnecessary, return an empty WEB_JS section.

============================================================
EXISTING CODE
============================================================

If existing website code is provided:

1. Understand the existing website.
2. Preserve useful functionality.
3. Preserve useful structure.
4. Fix obvious bugs.
5. Apply the user's requested changes.
6. Return the COMPLETE updated website.

Never return only a small fragment when modifying an existing website.

============================================================
QUALITY CHECK
============================================================

Before responding internally verify:

- HTML selectors match CSS.
- CSS classes actually exist.
- JavaScript selectors actually exist.
- Buttons work.
- Navigation works.
- Mobile layout works.
- No accidental horizontal scrolling.
- No broken references.
- No API keys.
- No secrets.
- No malicious code.

============================================================
SECURITY
============================================================

Never generate:

- API keys
- passwords
- credential theft
- malware
- destructive code
- secret tokens
- hidden tracking
- phishing systems

============================================================
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatus(error) {
  return (
    error?.status ??
    error?.response?.status ??
    error?.statusCode ??
    error?.error?.code ??
    500
  );
}

function isRetryable(error) {
  return RETRYABLE_STATUS.has(getStatus(error));
}

function cleanText(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/```html/gi, "")
    .replace(/```css/gi, "")
    .replace(/```javascript/gi, "")
    .replace(/```js/gi, "")
    .replace(/```/g, "");
}

function sendEvent(res, event, data) {
  try {
    if (res.writableEnded) return;

    res.write(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
  } catch (error) {
    console.error("[SSE] write failed:", error);
  }
}

function getExistingCode(body) {
  const current = body.currentCode || {};

  const html =
    typeof current.html === "string"
      ? current.html
      : "";

  const css =
    typeof current.css === "string"
      ? current.css
      : "";

  const js =
    typeof current.js === "string"
      ? current.js
      : "";

  if (!html && !css && !js) {
    return "";
  }

  return `
============================================================
CURRENT WEBSITE CODE
============================================================

HTML:
${html.slice(0, MAX_CODE_LENGTH)}

CSS:
${css.slice(0, MAX_CODE_LENGTH)}

JAVASCRIPT:
${js.slice(0, MAX_CODE_LENGTH)}

============================================================
`;
}

function extractSection(text, startTag, endTag) {
  const start = text.indexOf(startTag);

  if (start === -1) {
    return null;
  }

  const contentStart = start + startTag.length;

  const end = text.indexOf(endTag, contentStart);

  if (end === -1) {
    return {
      complete: false,
      content: text.slice(contentStart),
    };
  }

  return {
    complete: true,
    content: text.slice(contentStart, end),
  };
}

function extractResult(text) {
  const html =
    extractSection(
      text,
      "<WEB_HTML>",
      "</WEB_HTML>"
    )?.content || "";

  const css =
    extractSection(
      text,
      "<WEB_CSS>",
      "</WEB_CSS>"
    )?.content || "";

  const js =
    extractSection(
      text,
      "<WEB_JS>",
      "</WEB_JS>"
    )?.content || "";

  return {
    html: cleanText(html).trim(),
    css: cleanText(css).trim(),
    js: cleanText(js).trim(),
  };
}

function errorMessage(status) {
  if (status === 429) {
    return "AI rate limit reached. Trying another model...";
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return "AI model is temporarily busy. Trying another model...";
  }

  return "AI generation failed.";
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

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Please enter a website request.",
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: "Prompt is too long.",
    });
  }

  res.setHeader(
    "Content-Type",
    "text/event-stream; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-cache, no-transform"
  );

  res.setHeader(
    "Connection",
    "keep-alive"
  );

  res.setHeader(
    "X-Accel-Buffering",
    "no"
  );

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  let disconnected = false;

  req.on("close", () => {
    disconnected = true;
  });

  sendEvent(res, "status", {
    stage: "starting",
    message: "Starting AI...",
  });

  const existingCode = getExistingCode(body);

  const finalPrompt = `
USER REQUEST:

${prompt}

${existingCode}

Generate the COMPLETE website.

Output exactly:

<WEB_HTML>
...
</WEB_HTML>

<WEB_CSS>
...
</WEB_CSS>

<WEB_JS>
...
</WEB_JS>
`;

  const ai = new GoogleGenAI({
    apiKey,
  });

  let stream = null;
  let selectedModel = null;
  let lastError = null;

  /*
  ==========================================================
  FAST MODEL FALLBACK
  ==========================================================
  */

  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    if (disconnected) return;

    const model = MODELS[modelIndex];

    /*
    First attempt
    */

    try {
      sendEvent(res, "status", {
        stage: "connecting",
        message:
          modelIndex === 0
            ? "Connecting to AI..."
            : `Switching to backup AI model...`,
        model,
      });

      console.log(
        `[AI] Trying ${model}`
      );

      stream =
        await ai.models.generateContentStream({
          model,

          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    SYSTEM_PROMPT +
                    "\n\n" +
                    finalPrompt,
                },
              ],
            },
          ],

          config: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });

      selectedModel = model;

      console.log(
        `[AI] Connected to ${model}`
      );

      break;
    } catch (error) {
      lastError = error;

      const status = getStatus(error);

      console.error(
        `[AI] ${model} attempt 1 failed`,
        error
      );

      sendEvent(res, "status", {
        stage: "fallback",
        message: errorMessage(status),
        status,
      });

      /*
      --------------------------------------------------------
      Quick retry ONLY for temporary errors.
      --------------------------------------------------------
      */

      if (
        isRetryable(error) &&
        !disconnected
      ) {
        await sleep(650);

        try {
          console.log(
            `[AI] ${model} quick retry`
          );

          stream =
            await ai.models.generateContentStream({
              model,

              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text:
                        SYSTEM_PROMPT +
                        "\n\n" +
                        finalPrompt,
                    },
                  ],
                },
              ],

              config: {
                maxOutputTokens:
                  MAX_OUTPUT_TOKENS,
              },
            });

          selectedModel = model;

          console.log(
            `[AI] ${model} retry succeeded`
          );

          break;
        } catch (retryError) {
          lastError = retryError;

          console.error(
            `[AI] ${model} attempt 2 failed`,
            retryError
          );
        }
      }
    }
  }

  if (!stream) {
    const status = getStatus(lastError);

    console.error(
      "[AI] All models failed",
      lastError
    );

    sendEvent(res, "error", {
      message:
        status === 503
          ? "All AI models are temporarily busy. Please try again shortly."
          : status === 429
          ? "AI rate limit reached. Please try again shortly."
          : "AI generation failed. Please try again.",
      status,
    });

    return res.end();
  }

  /*
  ==========================================================
  STREAMING
  ==========================================================
  */

  let fullText = "";

  let lastHtmlLength = 0;
  let lastCssLength = 0;
  let lastJsLength = 0;

  sendEvent(res, "status", {
    stage: "generating",
    message: "AI is writing your website...",
    model: selectedModel,
  });

  try {
    for await (const chunk of stream) {
      if (disconnected) {
        console.log(
          "[AI] Client disconnected."
        );
        return;
      }

      const text =
        typeof chunk?.text === "string"
          ? chunk.text
          : "";

      if (!text) continue;

      fullText += text;

      /*
      --------------------------------------------------------
      HTML
      --------------------------------------------------------
      */

      const htmlPart = extractSection(
        fullText,
        "<WEB_HTML>",
        "</WEB_HTML>"
      );

      if (htmlPart) {
        const html = cleanText(
          htmlPart.content
        );

        if (html.length > lastHtmlLength) {
          const delta =
            html.slice(lastHtmlLength);

          lastHtmlLength = html.length;

          sendEvent(res, "code", {
            type: "html",
            delta,
            value: html,
            complete: htmlPart.complete,
          });
        }
      }

      /*
      --------------------------------------------------------
      CSS
      --------------------------------------------------------
      */

      const cssPart = extractSection(
        fullText,
        "<WEB_CSS>",
        "</WEB_CSS>"
      );

      if (cssPart) {
        const css = cleanText(
          cssPart.content
        );

        if (css.length > lastCssLength) {
          const delta =
            css.slice(lastCssLength);

          lastCssLength = css.length;

          sendEvent(res, "code", {
            type: "css",
            delta,
            value: css,
            complete: cssPart.complete,
          });
        }
      }

      /*
      --------------------------------------------------------
      JAVASCRIPT
      --------------------------------------------------------
      */

      const jsPart = extractSection(
        fullText,
        "<WEB_JS>",
        "</WEB_JS>"
      );

      if (jsPart) {
        const js = cleanText(
          jsPart.content
        );

        if (js.length > lastJsLength) {
          const delta =
            js.slice(lastJsLength);

          lastJsLength = js.length;

          sendEvent(res, "code", {
            type: "js",
            delta,
            value: js,
            complete: jsPart.complete,
          });
        }
      }
    }

    /*
    ========================================================
    FINAL RESULT
    ========================================================
    */

    const result =
      extractResult(fullText);

    if (
      !result.html &&
      !result.css &&
      !result.js
    ) {
      throw new Error(
        "AI returned empty website code."
      );
    }

    sendEvent(res, "complete", {
      success: true,
      model: selectedModel,
      html: result.html,
      css: result.css,
      js: result.js,
    });

    console.log(
      `[AI] Generation completed using ${selectedModel}`
    );

    return res.end();
  } catch (error) {
    console.error(
      "[AI] Streaming failed:",
      error
    );

    if (!res.writableEnded) {
      sendEvent(res, "error", {
        message:
          error?.message ||
          "Streaming generation failed.",
        status: getStatus(error),
      });

      return res.end();
    }
  }
}