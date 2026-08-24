import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

const MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const MAX_PROMPT_LENGTH = 10000;
const MAX_CODE_LENGTH = 70000;
const MAX_OUTPUT_TOKENS = 18000;
const MAX_RETRIES = 1;

const SYSTEM_PROMPT = `
You are the AI engine of a premium AI Website Builder.

Your job is to create or edit production-quality websites using ONLY:

- HTML
- CSS
- Vanilla JavaScript

The website must be:
- modern
- responsive
- visually polished
- accessible
- functional
- mobile friendly
- production-quality

====================================================
VERY IMPORTANT OUTPUT FORMAT
====================================================

You MUST output exactly these three sections:

<WEB_HTML>
HTML BODY CONTENT
</WEB_HTML>

<WEB_CSS>
CSS CONTENT
</WEB_CSS>

<WEB_JS>
JAVASCRIPT CONTENT
</WEB_JS>

Do NOT use markdown.
Do NOT use triple backticks.
Do NOT explain anything.

====================================================
HTML
====================================================

WEB_HTML must contain ONLY content inside <body>.

Never include:
<html>
<head>
<body>
<style>
<script>

Use semantic HTML.

Use:
header
nav
main
section
article
footer

Use meaningful class names.

Use accessible:
aria-label
aria-expanded
aria-controls
alt
button labels

====================================================
DESIGN
====================================================

Create a deliberate visual design.

Use appropriate:
- typography
- spacing
- colors
- borders
- shadows
- radius
- gradients
- cards
- buttons
- hover states
- focus states
- animations

Do not force gradients or glassmorphism if they don't fit.

Avoid:
- boring default layouts
- plain browser buttons
- excessive empty space
- repetitive sections
- generic beginner designs

====================================================
RESPONSIVE
====================================================

The website MUST work on:

Desktop
Tablet
Mobile

Use:
- Flexbox
- CSS Grid
- CSS variables
- fluid sizing
- max-width containers
- media queries

Avoid horizontal overflow.

Mobile navigation must actually work.

====================================================
JAVASCRIPT
====================================================

Use ONLY vanilla JavaScript.

Implement real interactions when useful:

- mobile menu
- smooth scrolling
- tabs
- FAQ accordion
- modal
- filters
- theme toggle
- counters
- form validation
- interactive buttons
- navigation

Never reference elements that do not exist.

If JavaScript is unnecessary, return an empty WEB_JS section.

====================================================
EXISTING WEBSITE
====================================================

If existing code is supplied:

- understand it
- preserve useful functionality
- preserve useful structure
- modify what the user requested
- fix obvious problems
- do not destroy working features unnecessarily

Always return the COMPLETE updated HTML, CSS and JS.

====================================================
SECURITY
====================================================

Never generate:
- API keys
- passwords
- secret credentials
- credential theft
- malware
- destructive code
- token stealing
- malicious tracking

====================================================
QUALITY CHECK
====================================================

Before finishing internally verify:

1. HTML and CSS selectors match.
2. JavaScript selectors match existing HTML.
3. Buttons work.
4. Navigation works.
5. Mobile layout works.
6. No accidental horizontal overflow.
7. No broken references.
8. No markdown.
9. Correct WEB_HTML / WEB_CSS / WEB_JS sections.
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatus(error) {
  return (
    error?.status ||
    error?.response?.status ||
    error?.statusCode ||
    500
  );
}

function isRetryable(error) {
  const status = getStatus(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function cleanSection(text = "") {
  return String(text)
    .replace(/\r/g, "")
    .replace(/```html/gi, "")
    .replace(/```css/gi, "")
    .replace(/```javascript/gi, "")
    .replace(/```js/gi, "")
    .replace(/```/g, "")
    .trim();
}

function sendSSE(res, event, data) {
  try {
    res.write(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
  } catch {
    // Client disconnected.
  }
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

function getExistingCode(body) {
  const currentCode = body.currentCode || {};

  const html =
    typeof currentCode.html === "string"
      ? currentCode.html
      : "";

  const css =
    typeof currentCode.css === "string"
      ? currentCode.css
      : "";

  const js =
    typeof currentCode.js === "string"
      ? currentCode.js
      : "";

  if (!html && !css && !js) {
    return "";
  }

  return `
====================================================
EXISTING WEBSITE CODE
====================================================

HTML:
${html.slice(0, MAX_CODE_LENGTH)}

CSS:
${css.slice(0, MAX_CODE_LENGTH)}

JAVASCRIPT:
${js.slice(0, MAX_CODE_LENGTH)}

====================================================
`;
}

function sendFinalError(res, error) {
  const status = getStatus(error);

  let message =
    "AI generation failed. Please try again.";

  if (status === 429) {
    message =
      "AI rate limit reached. Please wait a moment and try again.";
  } else if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    message =
      "AI is temporarily busy. Please try again in a few seconds.";
  } else if (status === 500) {
    message =
      "AI server error. Please try again.";
  }

  sendSSE(res, "error", {
    success: false,
    message,
    status,
  });

  res.end();
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

  res.statusCode = 200;

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

  const body = req.body || {};

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {
    sendSSE(res, "error", {
      success: false,
      message: "Please enter a website request.",
    });

    return res.end();
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    sendSSE(res, "error", {
      success: false,
      message: "Your prompt is too long.",
    });

    return res.end();
  }

  const existingCode = getExistingCode(body);

  const finalPrompt = `
USER REQUEST:

${prompt}

${existingCode}

Generate the complete website now.

Remember to output ONLY:

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

  sendSSE(res, "status", {
    stage: "thinking",
    message: "AI is thinking...",
  });

  /*
  ==========================================================
  MODEL + RETRY
  ==========================================================
  */

  for (const model of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(700 * attempt);

          sendSSE(res, "status", {
            stage: "retry",
            message: "Retrying connection...",
          });
        }

        sendSSE(res, "status", {
          stage: "connecting",
          message: `Connecting to AI...`,
        });

        stream = await ai.models.generateContentStream({
          model,

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${SYSTEM_PROMPT}

${finalPrompt}`,
                },
              ],
            },
          ],

          config: {
            temperature: 0.55,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });

        selectedModel = model;

        break;
      } catch (error) {
        lastError = error;

        console.error(
          `[AI] ${model} attempt ${attempt + 1} failed:`,
          error
        );

        if (!isRetryable(error)) {
          break;
        }
      }
    }

    if (stream) {
      break;
    }
  }

  if (!stream) {
    sendFinalError(res, lastError);
    return;
  }

  /*
  ==========================================================
  LIVE STREAM
  ==========================================================
  */

  let fullText = "";

  let htmlSent = 0;
  let cssSent = 0;
  let jsSent = 0;

  let currentStage = "";

  sendSSE(res, "status", {
    stage: "generating",
    message: "Writing your website...",
    model: selectedModel,
  });

  try {
    for await (const chunk of stream) {
      const text =
        typeof chunk?.text === "string"
          ? chunk.text
          : "";

      if (!text) {
        continue;
      }

      fullText += text;

      /*
      ========================================================
      HTML
      ========================================================
      */

      const htmlPart = extractSection(
        fullText,
        "<WEB_HTML>",
        "</WEB_HTML>"
      );

      if (htmlPart) {
        const html = cleanSection(htmlPart.content);

        if (html.length > htmlSent) {
          const delta = html.slice(htmlSent);

          htmlSent = html.length;

          if (currentStage !== "html") {
            currentStage = "html";

            sendSSE(res, "status", {
              stage: "html",
              message: "Writing HTML...",
            });
          }

          sendSSE(res, "code", {
            type: "html",
            delta,
            value: html,
            complete: htmlPart.complete,
          });
        }
      }

      /*
      ========================================================
      CSS
      ========================================================
      */

      const cssPart = extractSection(
        fullText,
        "<WEB_CSS>",
        "</WEB_CSS>"
      );

      if (cssPart) {
        const css = cleanSection(cssPart.content);

        if (css.length > cssSent) {
          const delta = css.slice(cssSent);

          cssSent = css.length;

          if (currentStage !== "css") {
            currentStage = "css";

            sendSSE(res, "status", {
              stage: "css",
              message: "Designing CSS...",
            });
          }

          sendSSE(res, "code", {
            type: "css",
            delta,
            value: css,
            complete: cssPart.complete,
          });
        }
      }

      /*
      ========================================================
      JAVASCRIPT
      ========================================================
      */

      const jsPart = extractSection(
        fullText,
        "<WEB_JS>",
        "</WEB_JS>"
      );

      if (jsPart) {
        const js = cleanSection(jsPart.content);

        if (js.length > jsSent) {
          const delta = js.slice(jsSent);

          jsSent = js.length;

          if (currentStage !== "js") {
            currentStage = "js";

            sendSSE(res, "status", {
              stage: "js",
              message: "Adding interactions...",
            });
          }

          sendSSE(res, "code", {
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

    const finalHtml =
      extractSection(
        fullText,
        "<WEB_HTML>",
        "</WEB_HTML>"
      )?.content || "";

    const finalCss =
      extractSection(
        fullText,
        "<WEB_CSS>",
        "</WEB_CSS>"
      )?.content || "";

    const finalJs =
      extractSection(
        fullText,
        "<WEB_JS>",
        "</WEB_JS>"
      )?.content || "";

    const result = {
      html: cleanSection(finalHtml),
      css: cleanSection(finalCss),
      js: cleanSection(finalJs),
    };

    if (
      !result.html &&
      !result.css &&
      !result.js
    ) {
      throw new Error(
        "AI returned an empty website."
      );
    }

    sendSSE(res, "complete", {
      success: true,
      model: selectedModel,
      html: result.html,
      css: result.css,
      js: result.js,
    });

    return res.end();
  } catch (error) {
    console.error(
      "[AI] Streaming generation error:",
      error
    );

    sendSSE(res, "error", {
      success: false,
      message:
        error?.message ||
        "Streaming generation failed.",
    });

    return res.end();
  }
}