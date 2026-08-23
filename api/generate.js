import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.7-flash";

const MAX_RETRIES = 4;
const BASE_DELAY = 1500;
const REQUEST_TIMEOUT = 55000;

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

Your job is to transform a user's natural-language request into a
high-quality production-ready website.

You are simultaneously:

- Senior frontend engineer
- UI/UX designer
- Responsive design specialist
- Accessibility specialist
- Product designer

Use ONLY:

- HTML
- CSS
- Vanilla JavaScript

==================================================
OUTPUT
==================================================

Return ONLY valid JSON:

{
  "html": "string",
  "css": "string",
  "js": "string"
}

Never return Markdown.
Never use triple backticks.
Never return explanations outside JSON.

==================================================
HTML
==================================================

The html field must contain ONLY content inside <body>.

Never include:

<html>
<head>
<body>
<style>
<script>

Use semantic HTML.

Use meaningful class names.

Use accessible buttons, links and labels.

==================================================
DESIGN
==================================================

Create an intentionally designed interface.

Avoid:

- default browser styling
- plain beginner layouts
- random colors
- excessive empty space
- repetitive cards

Use appropriate:

- typography hierarchy
- spacing
- colors
- shadows
- borders
- radius
- gradients when appropriate
- hover states
- focus states
- subtle animations

Match the user's requested visual style.

Do not force gradients or glassmorphism.

==================================================
RESPONSIVE
==================================================

Every website must work on:

Desktop
Tablet
Mobile

Use:

- Flexbox
- CSS Grid
- responsive containers
- fluid sizing
- media queries

Never create accidental horizontal overflow.

==================================================
JAVASCRIPT
==================================================

Use vanilla JavaScript only.

Implement real functionality when appropriate:

- mobile menu
- FAQ accordion
- tabs
- modal
- filters
- counters
- theme toggle
- form validation
- interactive UI

Never reference elements that do not exist.

If JavaScript is unnecessary:

""

==================================================
ACCESSIBILITY
==================================================

Use:

- semantic HTML
- accessible labels
- meaningful buttons
- useful alt text
- keyboard-friendly controls
- visible focus states
- reasonable contrast

==================================================
EXISTING WEBSITE
==================================================

If existing code is provided:

- understand it first
- preserve working functionality
- preserve useful content
- modify only what the user requested
- fix obvious broken references
- do not unnecessarily rebuild the website
- return COMPLETE updated HTML/CSS/JS

==================================================
SECURITY
==================================================

Never generate:

- API keys
- passwords
- secret credentials
- credential theft
- malware
- destructive scripts
- token theft
- malicious tracking

==================================================
FINAL CHECK
==================================================

Before returning:

1. HTML should render.
2. CSS selectors must match HTML.
3. JS selectors must match HTML.
4. Buttons should work.
5. Mobile layout should work.
6. No accidental horizontal overflow.
7. JSON must be valid.

Return ONLY JSON.
`;


// ==================================================
// HELPERS
// ==================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function withTimeout(promise, timeout) {
  return Promise.race([
    promise,

    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          "Gemini request timed out."
        );

        error.code = "AI_TIMEOUT";

        reject(error);
      }, timeout);
    }),
  ]);
}


function cleanJson(text) {
  if (!text) return "";

  return String(text)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}


function validateResult(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  if (
    typeof result.html !== "string" ||
    typeof result.css !== "string" ||
    typeof result.js !== "string"
  ) {
    return false;
  }

  // HTML must not contain document shell.
  if (/<html[\s>]/i.test(result.html)) {
    return false;
  }

  if (/<head[\s>]/i.test(result.html)) {
    return false;
  }

  if (/<body[\s>]/i.test(result.html)) {
    return false;
  }

  return true;
}


function normalizeCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, MAX_CODE_LENGTH);
}


function getStatus(error) {
  return Number(
    error?.status ||
    error?.statusCode ||
    error?.code ||
    0
  );
}


function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error?.message ||
    "Gemini generation failed."
  );
}


function isRetryable(error) {
  const status = getStatus(error);

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}


// ==================================================
// GENERATE
// ==================================================

async function generateWebsite(
  ai,
  prompt,
  currentCode
) {
  const hasExistingCode =
    currentCode.html ||
    currentCode.css ||
    currentCode.js;

  let existingContext = "";

  if (hasExistingCode) {
    existingContext = `
==================================================
EXISTING WEBSITE
==================================================

HTML:
${currentCode.html}

CSS:
${currentCode.css}

JAVASCRIPT:
${currentCode.js}

==================================================

This website already exists.

Preserve useful functionality.

Only make changes required by the user.

Return the COMPLETE updated website.
`;
  }

  const finalPrompt = `
USER REQUEST:

${prompt}

${existingContext}

Generate the website now.

Return ONLY:

{
  "html": "...",
  "css": "...",
  "js": "..."
}
`;

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `[AI] Generation attempt ${attempt}/${MAX_RETRIES}`
      );

      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL,

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
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                html: {
                  type: "string",
                },

                css: {
                  type: "string",
                },

                js: {
                  type: "string",
                },
              },

              required: [
                "html",
                "css",
                "js",
              ],
            },
          },
        }),

        REQUEST_TIMEOUT
      );

      const rawText = response?.text;

      if (!rawText) {
        throw new Error(
          "Gemini returned an empty response."
        );
      }

      const cleaned = cleanJson(rawText);

      let result;

      try {
        result = JSON.parse(cleaned);
      } catch (jsonError) {
        console.error(
          "[AI] JSON parse error:",
          jsonError
        );

        const error = new Error(
          "Gemini returned invalid JSON."
        );

        error.code = "INVALID_JSON";

        throw error;
      }

      if (!validateResult(result)) {
        const error = new Error(
          "Gemini returned an invalid website structure."
        );

        error.code =
          "INVALID_WEBSITE_STRUCTURE";

        throw error;
      }

      console.log(
        `[AI] Generation successful on attempt ${attempt}`
      );

      return result;

    } catch (error) {
      lastError = error;

      const status = getStatus(error);
      const message = getErrorMessage(error);

      console.error(
        `[AI] Attempt ${attempt} failed`
      );

      console.error(
        `[AI] Status: ${status}`
      );

      console.error(
        `[AI] Message: ${message}`
      );

      // Do not retry invalid JSON or invalid structure.
      if (
        error?.code === "INVALID_JSON" ||
        error?.code ===
          "INVALID_WEBSITE_STRUCTURE"
      ) {
        throw error;
      }

      if (!isRetryable(error)) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        const delay =
          BASE_DELAY *
          Math.pow(2, attempt - 1);

        console.log(
          `[AI] Retrying after ${delay}ms`
        );

        await sleep(delay);
      }
    }
  }

  throw lastError;
}


// ==================================================
// API HANDLER
// ==================================================

export default async function handler(
  req,
  res
) {
  const requestId =
    `gen_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  console.log(
    `[AI] Request started: ${requestId}`
  );

  // ------------------------------------------------
  // METHOD
  // ------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error:
        "Method not allowed. Use POST.",
      requestId,
    });
  }


  // ------------------------------------------------
  // API KEY
  // ------------------------------------------------

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      "[AI] GEMINI_API_KEY missing"
    );

    return res.status(500).json({
      success: false,
      error:
        "AI service is not configured.",
      code:
        "MISSING_GEMINI_API_KEY",
      requestId,
    });
  }


  try {
    // ------------------------------------------------
    // BODY
    // ------------------------------------------------

    const body =
      req.body || {};

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";


    // ------------------------------------------------
    // VALIDATE PROMPT
    // ------------------------------------------------

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error:
          "Please describe what you want to build.",
        code:
          "EMPTY_PROMPT",
        requestId,
      });
    }


    if (
      prompt.length >
      MAX_PROMPT_LENGTH
    ) {
      return res.status(413).json({
        success: false,
        error:
          "Your request is too long.",
        code:
          "PROMPT_TOO_LONG",
        requestId,
      });
    }


    // ------------------------------------------------
    // EXISTING CODE
    // ------------------------------------------------

    const currentCode = {
      html: normalizeCode(
        body.html
      ),

      css: normalizeCode(
        body.css
      ),

      js: normalizeCode(
        body.js
      ),
    };


    // ------------------------------------------------
    // GEMINI CLIENT
    // ------------------------------------------------

    const ai =
      new GoogleGenAI({
        apiKey,
      });


    // ------------------------------------------------
    // GENERATE
    // ------------------------------------------------

    const result =
      await generateWebsite(
        ai,
        prompt,
        currentCode
      );


    // ------------------------------------------------
    // SUCCESS
    // ------------------------------------------------

    console.log(
      `[AI] Request completed: ${requestId}`
    );

    return res.status(200).json({
      success: true,

      requestId,

      model: MODEL,

      html: result.html,

      css: result.css,

      js: result.js,

      metadata: {
        version: "3.0",

        generatedAt:
          new Date().toISOString(),
      },
    });

  } catch (error) {
    // ------------------------------------------------
    // FINAL ERROR
    // ------------------------------------------------

    const status =
      getStatus(error);

    const message =
      getErrorMessage(error);

    console.error(
      `[AI] FINAL ERROR ${requestId}`
    );

    console.error(
      `[AI] Status: ${status}`
    );

    console.error(
      `[AI] Message: ${message}`
    );


    // Timeout
    if (
      error?.code ===
      "AI_TIMEOUT"
    ) {
      return res.status(504).json({
        success: false,

        error:
          "AI took too long to respond. Please try again.",

        code:
          "AI_TIMEOUT",

        requestId,
      });
    }


    // Invalid JSON
    if (
      error?.code ===
      "INVALID_JSON"
    ) {
      return res.status(502).json({
        success: false,

        error:
          "AI returned an invalid response. Please try again.",

        code:
          "INVALID_AI_RESPONSE",

        requestId,
      });
    }


    // Temporary Gemini problem
    if (
      status === 408 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      return res.status(503).json({
        success: false,

        error:
          "Gemini is temporarily unavailable. Please try again in a few seconds.",

        code:
          "AI_TEMPORARILY_UNAVAILABLE",

        providerStatus:
          status,

        requestId,
      });
    }


    // Generic
    return res.status(500).json({
      success: false,

      error: message,

      code:
        "AI_GENERATION_FAILED",

      providerStatus:
        status || null,

      requestId,
    });
  }
}