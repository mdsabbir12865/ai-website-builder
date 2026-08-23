import { GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

Transform the user's request into a polished production-quality website
using ONLY:

- HTML
- CSS
- Vanilla JavaScript

Return ONLY valid JSON:

{
  "html": "string",
  "css": "string",
  "js": "string"
}

IMPORTANT:
- html must contain ONLY content inside <body>
- Never include <html>, <head>, <body>, <style>, or <script>
- css must contain complete CSS
- js must contain complete vanilla JavaScript
- No Markdown
- No code fences
- No explanations outside JSON

QUALITY:
- Premium UI/UX
- Modern typography
- Strong visual hierarchy
- Responsive desktop/tablet/mobile design
- CSS variables
- Flexbox/Grid
- Good spacing
- Hover/focus states
- Accessible semantic HTML
- Functional JavaScript when required
- No horizontal overflow
- No broken selectors
- No fake functionality
- No API keys or secrets

RESPONSIVE:
The website MUST work properly on:
- Desktop
- Tablet
- Mobile

If a navbar exists:
- Desktop navigation
- Functional mobile hamburger menu
- Accessible aria attributes

If JavaScript is not required:
return an empty string for js.

EXISTING WEBSITE:
If existing HTML/CSS/JS is provided:
- Preserve useful functionality
- Modify only what the user requests when possible
- Do not unnecessarily rebuild working sections
- Return the COMPLETE updated HTML/CSS/JS

Before returning the answer, internally verify:
- HTML/CSS/JS work together
- selectors match
- buttons work
- mobile layout works
- JSON is valid
`;

function cleanJson(text) {
  if (!text) return "";

  let value = String(text).trim();

  value = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return value;
}

function isValidResult(result) {
  return (
    result &&
    typeof result === "object" &&
    typeof result.html === "string" &&
    typeof result.css === "string" &&
    typeof result.js === "string"
  );
}

function getErrorStatus(error) {
  return (
    Number(error?.status) ||
    Number(error?.code) ||
    500
  );
}

function getErrorMessage(error) {
  if (!error) return "Unknown AI error.";

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return String(error.message);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown AI error.";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithModel(ai, model, prompt) {
  console.log(`[AI] Starting model: ${model}`);

  const startedAt = Date.now();

  const response = await ai.models.generateContent({
    model,

    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${SYSTEM_PROMPT}

USER REQUEST:
${prompt}`,
          },
        ],
      },
    ],

    config: {
      /*
       * LOW thinking = faster first response.
       * This is important for an interactive website builder.
       */
      thinkingConfig: {
        thinkingLevel: "low",
      },

      responseMimeType: "application/json",

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

        required: ["html", "css", "js"],
      },
    },
  });

  const elapsed = Date.now() - startedAt;

  console.log(
    `[AI] ${model} completed in ${elapsed}ms`
  );

  const rawText = response?.text;

  if (!rawText) {
    throw new Error(
      `${model} returned an empty response.`
    );
  }

  const cleaned = cleanJson(rawText);

  let result;

  try {
    result = JSON.parse(cleaned);
  } catch (error) {
    console.error(
      `[AI] ${model} returned invalid JSON`
    );

    console.error(
      "[AI] Raw response:",
      cleaned.slice(0, 2000)
    );

    throw new Error(
      `${model} returned invalid JSON.`
    );
  }

  if (!isValidResult(result)) {
    throw new Error(
      `${model} returned an invalid website structure.`
    );
  }

  return result;
}

export default async function handler(req, res) {
  const requestId =
    `gen_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  console.log(
    `[AI] Request started: ${requestId}`
  );

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        `[AI] ${requestId}: GEMINI_API_KEY missing`
      );

      return res.status(500).json({
        success: false,
        error:
          "GEMINI_API_KEY is not configured.",
      });
    }

    const body = req.body || {};

    const userPrompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        error:
          "Please enter a website request.",
      });
    }

    const currentCode =
      body.currentCode || {
        html:
          typeof body.html === "string"
            ? body.html
            : "",

        css:
          typeof body.css === "string"
            ? body.css
            : "",

        js:
          typeof body.js === "string"
            ? body.js
            : "",
      };

    let existingCode = "";

    const hasExistingCode =
      currentCode.html ||
      currentCode.css ||
      currentCode.js;

    if (hasExistingCode) {
      existingCode = `

==================================================
EXISTING WEBSITE CODE
==================================================

HTML:
${currentCode.html || ""}

CSS:
${currentCode.css || ""}

JAVASCRIPT:
${currentCode.js || ""}

==================================================

Use this existing website as the starting point.

Preserve useful functionality.

Modify it according to the user's request.

Return the COMPLETE updated website.
`;
    }

    const finalPrompt = `
${userPrompt}

${existingCode}
`;

    const ai = new GoogleGenAI({
      apiKey,
    });

    /*
     * FIRST TRY
     * Gemini 3.7 Flash
     */
    try {
      console.log(
        `[AI] ${requestId}: Trying ${PRIMARY_MODEL}`
      );

      const result =
        await generateWithModel(
          ai,
          PRIMARY_MODEL,
          finalPrompt
        );

      console.log(
        `[AI] ${requestId}: Success with ${PRIMARY_MODEL}`
      );

      return res.status(200).json({
        success: true,
        model: PRIMARY_MODEL,
        requestId,
        html: result.html,
        css: result.css,
        js: result.js,
      });
    } catch (primaryError) {
      const status =
        getErrorStatus(primaryError);

      const message =
        getErrorMessage(primaryError);

      console.error(
        `[AI] ${requestId}: ${PRIMARY_MODEL} failed`
      );

      console.error(
        `[AI] Status: ${status}`
      );

      console.error(
        `[AI] Message: ${message}`
      );

      /*
       * If Gemini 3.7 is temporarily busy,
       * immediately try Gemini 3.6 Flash.
       */
      const shouldFallback =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (!shouldFallback) {
        return res.status(
          status >= 400 && status < 600
            ? status
            : 500
        ).json({
          success: false,
          error: message,
          requestId,
        });
      }

      console.log(
        `[AI] ${requestId}: Falling back to ${FALLBACK_MODEL}`
      );

      /*
       * Tiny delay prevents an immediate
       * hammering retry.
       */
      await sleep(250);

      try {
        const result =
          await generateWithModel(
            ai,
            FALLBACK_MODEL,
            finalPrompt
          );

        console.log(
          `[AI] ${requestId}: Fallback success`
        );

        return res.status(200).json({
          success: true,
          model: FALLBACK_MODEL,
          fallback: true,
          requestId,
          html: result.html,
          css: result.css,
          js: result.js,
        });
      } catch (fallbackError) {
        const fallbackStatus =
          getErrorStatus(
            fallbackError
          );

        const fallbackMessage =
          getErrorMessage(
            fallbackError
          );

        console.error(
          `[AI] ${requestId}: ${FALLBACK_MODEL} failed`
        );

        console.error(
          `[AI] Fallback status: ${fallbackStatus}`
        );

        console.error(
          `[AI] Fallback message: ${fallbackMessage}`
        );

        return res.status(503).json({
          success: false,

          error:
            "Gemini is temporarily unavailable. Please try again in a few seconds.",

          details:
            fallbackMessage,

          requestId,

          primaryModel:
            PRIMARY_MODEL,

          fallbackModel:
            FALLBACK_MODEL,
        });
      }
    }
  } catch (error) {
    const status =
      getErrorStatus(error);

    const message =
      getErrorMessage(error);

    console.error(
      `[AI] ${requestId}: Unexpected server error`
    );

    console.error(
      `[AI] Status: ${status}`
    );

    console.error(
      `[AI] Message: ${message}`
    );

    return res.status(
      status >= 400 && status < 600
        ? status
        : 500
    ).json({
      success: false,
      error: message,
      requestId,
    });
  }
}