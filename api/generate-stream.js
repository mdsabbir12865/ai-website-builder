import { GoogleGenAI } from "@google/genai";

/*
===========================================================
 WebAI Builder — Advanced Streaming Engine
===========================================================

Features:
- Gemini streaming
- Model fallback
- Retry with exponential backoff
- SSE
- Timeout protection
- Existing code editing
- HTML/CSS/JS extraction
- Input limits
- Graceful errors
- Client disconnect handling
===========================================================
*/

const MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 90000;
const MAX_RETRIES_PER_MODEL = 2;
const REQUEST_TIMEOUT = 90000;

const SYSTEM_PROMPT = `
You are the core generation engine of a premium AI Website Builder.

You are simultaneously:

- Senior frontend engineer
- UI/UX designer
- Product designer
- Accessibility specialist
- Responsive design expert
- JavaScript engineer

Your task is to transform the user's request into a production-quality
website using ONLY:

HTML
CSS
Vanilla JavaScript

========================================================
CRITICAL OUTPUT FORMAT
========================================================

You MUST stream the result using exactly these sections:

<WEB_HTML>
HTML BODY CONTENT HERE
</WEB_HTML>

<WEB_CSS>
CSS HERE
</WEB_CSS>

<WEB_JS>
JAVASCRIPT HERE
</WEB_JS>

Do not use Markdown.
Do not use triple backticks.
Do not explain anything.
Do not put <html>, <head> or <body> inside WEB_HTML.

========================================================
HTML
========================================================

WEB_HTML must contain ONLY content that belongs inside <body>.

Use semantic HTML:

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

Avoid meaningless placeholder sections.

Every section must have a purpose.

========================================================
DESIGN QUALITY
========================================================

Do NOT generate beginner-level websites.

Avoid:

- plain default browser buttons
- excessive empty space
- boring white layouts
- repetitive cards
- generic templates

Create a deliberate visual system.

Consider:

- typography
- spacing
- visual hierarchy
- color system
- gradients when appropriate
- shadows
- borders
- radius
- hover states
- focus states
- animations
- responsive layout

Do not force glassmorphism or gradients unless appropriate.

========================================================
RESPONSIVE DESIGN
========================================================

The website MUST work on:

Desktop
Tablet
Mobile

Use:

Flexbox
CSS Grid
fluid sizing
max-width containers
media queries
CSS variables

Never create accidental horizontal scrolling.

Mobile navigation must work.

Cards must adapt to smaller screens.

========================================================
JAVASCRIPT
========================================================

Use only vanilla JavaScript.

Implement functionality when appropriate:

- mobile navigation
- menus
- tabs
- FAQ accordion
- modal
- form validation
- filters
- theme toggle
- counters
- interactions
- smooth scrolling

Do not create fake functionality.

Do not reference elements that do not exist.

If JavaScript is unnecessary:

WEB_JS should be empty.

========================================================
ACCESSIBILITY
========================================================

Use:

semantic HTML
keyboard-friendly controls
visible focus states
reasonable contrast
meaningful labels

Prefer buttons over clickable divs.

========================================================
CSS
========================================================

Use a maintainable CSS architecture.

Prefer:

:root variables
responsive breakpoints
component-like sections
consistent spacing

Avoid unnecessary duplication.

========================================================
EXISTING WEBSITE
========================================================

If existing code is supplied:

- understand it first
- preserve useful functionality
- preserve useful structure
- modify only what the user requested
- fix obvious bugs
- do not destroy working features unnecessarily

Always return the COMPLETE updated website.

========================================================
QUALITY CHECK
========================================================

Before finishing internally verify:

HTML selectors match CSS.
JavaScript selectors match HTML.
Buttons work.
Navigation works.
Mobile layout works.
No horizontal overflow.
No broken references.
No API keys.
No secrets.
No malicious code.

========================================================
SECURITY
========================================================

Never generate:

API keys
password theft
credential harvesting
malware
destructive scripts
secret tokens
hidden tracking for theft

========================================================
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getErrorStatus(error) {
  return (
    error?.status ||
    error?.response?.status ||
    error?.statusCode ||
    500
  );
}

function isRetryable(error) {
  const status = getErrorStatus(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function createTimeout(ms) {
  let timer;

  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("AI request timed out."));
    }, ms);
  });

  return {
    promise,
    clear() {
      clearTimeout(timer);
    },
  };
}

/*
-----------------------------------------------------------
SSE helpers
-----------------------------------------------------------
*/

function sendEvent(res, event, data) {
  try {
    res.write(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
  } catch {
    // Client may have disconnected.
  }
}

/*
-----------------------------------------------------------
Extract streamed sections
-----------------------------------------------------------
*/

function extractSection(text, startTag, endTag) {
  const start = text.indexOf(startTag);

  if (start === -1) return null;

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

function buildExistingCode(body) {
  const currentCode =
    body.currentCode || {
      html: body.html || "",
      css: body.css || "",
      js: body.js || "",
    };

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
========================================================
EXISTING WEBSITE
========================================================

HTML:

${html.slice(0, MAX_CODE_LENGTH)}

CSS:

${css.slice(0, MAX_CODE_LENGTH)}

JAVASCRIPT:

${js.slice(0, MAX_CODE_LENGTH)}

========================================================
`;
}

/*
-----------------------------------------------------------
Main handler
-----------------------------------------------------------
*/

export default async function handler(req, res) {
  /*
  ---------------------------------------------------------
  Method
  ---------------------------------------------------------
  */

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  /*
  ---------------------------------------------------------
  Environment
  ---------------------------------------------------------
  */

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY is not configured.",
    });
  }

  /*
  ---------------------------------------------------------
  Headers
  ---------------------------------------------------------
  */

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

  /*
  ---------------------------------------------------------
  Body
  ---------------------------------------------------------
  */

  const body = req.body || {};

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {
    sendEvent(res, "error", {
      message: "Please enter a website request.",
    });

    return res.end();
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    sendEvent(res, "error", {
      message: "Prompt is too long.",
    });

    return res.end();
  }

  /*
  ---------------------------------------------------------
  Prompt
  ---------------------------------------------------------
  */

  const existingCode = buildExistingCode(body);

  const finalPrompt = `
USER REQUEST:

${prompt}

${existingCode}

Generate the COMPLETE website.

Remember:

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

  /*
  ---------------------------------------------------------
  Gemini
  ---------------------------------------------------------
  */

  const ai = new GoogleGenAI({
    apiKey,
  });

  let successfulStream = null;
  let selectedModel = null;
  let lastError = null;

  /*
  ---------------------------------------------------------
  Model fallback
  ---------------------------------------------------------
  */

  sendEvent(res, "status", {
    stage: "thinking",
    message: "AI is thinking...",
  });

  for (const model of MODELS) {
    for (
      let attempt = 0;
      attempt <= MAX_RETRIES_PER_MODEL;
      attempt++
    ) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            1000 * Math.pow(2, attempt - 1),
            5000
          );

          sendEvent(res, "status", {
            stage: "retrying",
            message: `Retrying AI request...`,
            attempt,
          });

          await sleep(delay);
        }

        sendEvent(res, "status", {
          stage: "connecting",
          message: `Connecting to ${model}...`,
        });

        const timeout = createTimeout(
          REQUEST_TIMEOUT
        );

        const streamPromise =
          ai.models.generateContentStream({
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
              temperature: 0.65,

              maxOutputTokens: 30000,
            },
          });

        successfulStream = await Promise.race([
          streamPromise,
          timeout.promise,
        ]);

        timeout.clear();

        selectedModel = model;

        break;
      } catch (error) {
        lastError = error;

        console.error(
          `[AI] ${model} attempt ${attempt + 1} failed`,
          error
        );

        if (!isRetryable(error)) {
          break;
        }
      }
    }

    if (successfulStream) {
      break;
    }
  }

  /*
  ---------------------------------------------------------
  All models failed
  ---------------------------------------------------------
  */

  if (!successfulStream) {
    const status = getErrorStatus(lastError);

    let message =
      "AI generation failed. Please try again.";

    if (status === 429) {
      message =
        "AI rate limit reached. Please wait a moment and try again.";
    }

    if (
      status === 503 ||
      status === 502 ||
      status === 504
    ) {
      message =
        "Gemini is temporarily busy. Please try again in a few seconds.";
    }

    if (status === 500) {
      message =
        "Gemini server error. Please try again.";
    }

    sendEvent(res, "error", {
      message,
      status,
    });

    return res.end();
  }

  /*
  ---------------------------------------------------------
  Streaming
  ---------------------------------------------------------
  */

  let fullText = "";

  let lastHtmlLength = 0;
  let lastCssLength = 0;
  let lastJsLength = 0;

  let currentStage = "generating";

  sendEvent(res, "status", {
    stage: "generating",
    message: "Generating your website...",
    model: selectedModel,
  });

  try {
    for await (const chunk of successfulStream) {
      const text =
        typeof chunk?.text === "string"
          ? chunk.text
          : "";

      if (!text) continue;

      fullText += text;

      /*
      -----------------------------------------------------
      HTML
      -----------------------------------------------------
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

          if (currentStage !== "html") {
            currentStage = "html";

            sendEvent(res, "status", {
              stage: "html",
              message: "Writing HTML...",
            });
          }

          sendEvent(res, "code", {
            type: "html",
            delta,
            value: html,
            complete: htmlPart.complete,
          });
        }
      }

      /*
      -----------------------------------------------------
      CSS
      -----------------------------------------------------
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

          if (currentStage !== "css") {
            currentStage = "css";

            sendEvent(res, "status", {
              stage: "css",
              message: "Designing CSS...",
            });
          }

          sendEvent(res, "code", {
            type: "css",
            delta,
            value: css,
            complete: cssPart.complete,
          });
        }
      }

      /*
      -----------------------------------------------------
      JavaScript
      -----------------------------------------------------
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

          if (currentStage !== "js") {
            currentStage = "js";

            sendEvent(res, "status", {
              stage: "js",
              message: "Adding interactions...",
            });
          }

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
    -------------------------------------------------------
    Final extraction
    -------------------------------------------------------
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
      html: cleanText(finalHtml).trim(),
      css: cleanText(finalCss).trim(),
      js: cleanText(finalJs).trim(),
    };

    /*
    -------------------------------------------------------
    Validation
    -------------------------------------------------------
    */

    if (
      typeof result.html !== "string" ||
      typeof result.css !== "string" ||
      typeof result.js !== "string"
    ) {
      throw new Error(
        "Invalid website structure."
      );
    }

    if (
      !result.html &&
      !result.css &&
      !result.js
    ) {
      throw new Error(
        "AI returned an empty website."
      );
    }

    /*
    -------------------------------------------------------
    Complete
    -------------------------------------------------------
    */

    sendEvent(res, "complete", {
      success: true,
      model: selectedModel,
      html: result.html,
      css: result.css,
      js: result.js,
    });

    return res.end();
  } catch (error) {
    console.error(
      "[AI] Streaming error:",
      error
    );

    sendEvent(res, "error", {
      message:
        error?.message ||
        "Streaming generation failed.",
    });

    return res.end();
  }
}