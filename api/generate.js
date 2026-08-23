import { GoogleGenAI } from "@google/genai";

/*
==================================================
WEB AI BUILDER — GENERATION ENGINE
==================================================

Features:
- Secure server-side Gemini API
- Automatic retry with exponential backoff
- Timeout protection
- Existing-code editing
- Strict JSON output
- Response validation
- Prompt length protection
- Basic abuse/safety protection
- Generation metadata
- Clean error handling
- Future-ready architecture
==================================================
*/

// ==================================================
// CONFIG
// ==================================================

const MODEL = "gemini-3.7-flash";

const MAX_RETRIES = 3;

const BASE_RETRY_DELAY = 1200;

const REQUEST_TIMEOUT = 55000;

const MAX_PROMPT_LENGTH = 12000;

const MAX_CODE_LENGTH = 80000;


// ==================================================
// SYSTEM PROMPT
// ==================================================

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

You are simultaneously acting as:

- Senior frontend engineer
- UI/UX designer
- Responsive design specialist
- Accessibility specialist
- Product designer
- Vanilla JavaScript engineer

Your job is to transform a user's request into a polished,
production-quality website.

You may ONLY generate:

- HTML
- CSS
- Vanilla JavaScript

Do not use React.
Do not use Vue.
Do not use Angular.
Do not use external JavaScript frameworks.

==================================================
OUTPUT CONTRACT
==================================================

Return ONLY valid JSON.

Exactly:

{
  "html": "string",
  "css": "string",
  "js": "string"
}

Never return:

- Markdown
- Triple backticks
- Explanations
- Comments outside the requested code

==================================================
HTML
==================================================

The html property must contain ONLY content that belongs
inside the <body>.

Never include:

<html>
<head>
<body>
<style>
<script>

Use semantic HTML:

<header>
<nav>
<main>
<section>
<article>
<footer>

Use meaningful class names.

Use accessible buttons and links.

Avoid meaningless placeholder content.

==================================================
DESIGN QUALITY
==================================================

Every website must look intentionally designed.

Avoid beginner-level layouts such as:

- plain default white pages
- default browser buttons
- random colors
- excessive empty space
- repetitive cards
- weak typography

Use appropriate:

- typography hierarchy
- spacing system
- color system
- border radius
- shadows
- gradients when appropriate
- glass effects when appropriate
- hover states
- focus states
- transitions
- visual depth

The design MUST match the user's request.

Do not force a specific visual style.

==================================================
DESIGN SYSTEM
==================================================

Internally determine:

- primary color
- secondary color
- accent
- background
- surface colors
- text colors
- border colors
- typography
- spacing
- radius
- shadows
- button styles

Use CSS variables.

Example:

:root {
  --primary: ...;
  --background: ...;
  --surface: ...;
  --text: ...;
  --muted: ...;
  --radius: ...;
}

Keep the design system consistent.

==================================================
RESPONSIVE DESIGN
==================================================

Every website MUST work on:

Desktop
Tablet
Mobile

Use:

- CSS Grid
- Flexbox
- fluid widths
- max-width containers
- responsive typography
- media queries

Mobile must be intentionally designed.

Never create accidental horizontal scrolling.

Navigation must adapt to mobile.

Cards must stack when necessary.

Buttons must remain touch-friendly.

==================================================
JAVASCRIPT
==================================================

Use only vanilla JavaScript.

JavaScript must actually work.

Possible functionality:

- mobile navigation
- dropdown
- modal
- tabs
- FAQ accordion
- filters
- counters
- theme toggle
- form validation
- sliders
- interactive cards
- smooth scrolling

Never reference DOM elements that do not exist.

Never create broken event listeners.

If JavaScript is unnecessary:

""

==================================================
NAVIGATION
==================================================

If navigation is requested:

Desktop:

- logo
- links
- CTA when appropriate

Mobile:

- hamburger button
- open/close navigation
- aria-expanded
- accessible controls

==================================================
HERO
==================================================

When appropriate create a strong hero section.

Possible elements:

- badge
- headline
- supporting text
- CTA
- secondary CTA
- statistics
- visual
- mockup
- illustration

Do not use the exact same hero structure every time.

==================================================
CONTENT
==================================================

Only generate sections that make sense.

Possible sections:

- features
- services
- products
- pricing
- testimonials
- portfolio
- gallery
- team
- FAQ
- contact
- newsletter
- CTA
- footer

Do not blindly generate every section.

==================================================
IMAGES
==================================================

Never create obviously broken image URLs.

If imagery is needed, use reliable remote image URLs.

Always include useful alt text.

If imagery is not necessary, use CSS visuals.

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

Never use clickable divs when a button or link is appropriate.

==================================================
SEO
==================================================

Use:

- logical heading hierarchy
- meaningful content
- descriptive links
- semantic structure

The builder will handle document metadata separately.

==================================================
CSS
==================================================

CSS must be clean and maintainable.

Use:

- CSS variables
- logical grouping
- reusable classes
- responsive media queries

Avoid unnecessary duplication.

==================================================
EXISTING WEBSITE EDITING
==================================================

If existing HTML/CSS/JS is provided:

1. Understand the current structure.
2. Preserve useful functionality.
3. Preserve useful content.
4. Modify only what the user requested when possible.
5. Fix obvious broken references.
6. Do not unnecessarily rebuild the website.
7. Return the COMPLETE updated HTML/CSS/JS.

Example:

User:
"Add pricing."

Add pricing without destroying the existing website.

User:
"Make it more premium."

Improve the visual system while preserving functionality.

==================================================
SECURITY
==================================================

Never generate:

- API keys
- passwords
- secret credentials
- credential harvesting
- malware
- destructive scripts
- token theft
- malicious tracking
- hidden data collection

Never expose server-side secrets.

==================================================
QUALITY CONTROL
==================================================

Before returning the JSON, internally verify:

1. HTML renders.
2. CSS selectors match HTML.
3. JavaScript selectors match HTML.
4. Buttons work.
5. Navigation works.
6. Mobile layout works.
7. No accidental horizontal overflow.
8. No obvious missing closing tags.
9. JSON is valid.
10. HTML/CSS/JS work together.

Return ONLY JSON.
`;


// ==================================================
// HELPERS
// ==================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// --------------------------------------------------
// Timeout helper
// --------------------------------------------------

function withTimeout(promise, timeout) {
  return Promise.race([
    promise,

    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(
          "AI request timed out."
        );

        error.code = "AI_TIMEOUT";

        reject(error);
      }, timeout);
    }),
  ]);
}


// --------------------------------------------------
// JSON cleanup
// --------------------------------------------------

function cleanJsonText(text) {
  if (!text) return "";

  let cleaned = String(text).trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return cleaned;
}


// --------------------------------------------------
// Validate generated result
// --------------------------------------------------

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

  // Prevent accidental full-document output
  if (/<html[\s>]/i.test(result.html)) {
    return false;
  }

  if (/<body[\s>]/i.test(result.html)) {
    return false;
  }

  if (/<head[\s>]/i.test(result.html)) {
    return false;
  }

  return true;
}


// --------------------------------------------------
// Retryable errors
// --------------------------------------------------

function isRetryableError(error) {
  const status = Number(
    error?.status ||
    error?.code
  );

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}


// --------------------------------------------------
// Error message
// --------------------------------------------------

function getErrorMessage(error) {
  return (
    error?.message ||
    error?.error?.message ||
    "Website generation failed."
  );
}


// --------------------------------------------------
// Basic unsafe prompt detection
// --------------------------------------------------

function containsDangerousRequest(prompt) {
  const text = prompt.toLowerCase();

  const blockedPatterns = [
    "steal password",
    "steal passwords",
    "steal token",
    "credential theft",
    "keylogger",
    "ransomware",
    "malware",
    "virus",
    "phishing page",
    "phishing website",
    "cookie stealer",
    "session hijacking",
  ];

  return blockedPatterns.some((pattern) =>
    text.includes(pattern)
  );
}


// --------------------------------------------------
// Normalize code
// --------------------------------------------------

function normalizeCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, MAX_CODE_LENGTH);
}


// ==================================================
// GEMINI GENERATION
// ==================================================

async function generateWebsite(
  ai,
  prompt,
  existingCode
) {
  const existingAvailable =
    existingCode.html ||
    existingCode.css ||
    existingCode.js;

  let existingContext = "";

  if (existingAvailable) {
    existingContext = `
==================================================
CURRENT WEBSITE
==================================================

HTML:
${existingCode.html}

CSS:
${existingCode.css}

JAVASCRIPT:
${existingCode.js}

==================================================

This is an existing website.

Treat it as the current source of truth.

Preserve working functionality.

Only change what is necessary for the user's request.

Return the COMPLETE updated website.
`;
  }

  const userPrompt = `
==================================================
USER REQUEST
==================================================

${prompt}

${existingContext}

==================================================
FINAL INSTRUCTION
==================================================

Generate the requested website.

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
                    userPrompt,
                },
              ],
            },
          ],

          config: {
            temperature: 0.7,

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

      const cleaned =
        cleanJsonText(rawText);

      let result;

      try {
        result = JSON.parse(cleaned);
      } catch {
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

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `[AI] Attempt ${attempt} failed:`,
        error
      );

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        const delay =
          BASE_RETRY_DELAY *
          Math.pow(2, attempt - 1);

        console.log(
          `[AI] Retrying in ${delay}ms`
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
      `[AI] Missing GEMINI_API_KEY`
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
    // PROMPT VALIDATION
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
          "Your request is too long. Please shorten it.",

        code:
          "PROMPT_TOO_LONG",

        requestId,
      });
    }


    // ------------------------------------------------
    // BASIC SAFETY
    // ------------------------------------------------

    if (
      containsDangerousRequest(prompt)
    ) {
      return res.status(400).json({
        success: false,

        error:
          "This request cannot be used to generate malicious functionality.",

        code:
          "UNSAFE_REQUEST",

        requestId,
      });
    }


    // ------------------------------------------------
    // EXISTING CODE
    // ------------------------------------------------

    const existingCode = {
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
        existingCode
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
        generatedAt:
          new Date().toISOString(),

        version:
          "2.0",
      },
    });
  } catch (error) {
    // ------------------------------------------------
    // ERROR
    // ------------------------------------------------

    console.error(
      `[AI] Request failed: ${requestId}`,
      error
    );

    const status =
      Number(error?.status);

    // Temporary Gemini problems
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
          "AI is temporarily busy. Please wait a few seconds and try again.",

        code:
          "AI_TEMPORARILY_UNAVAILABLE",

        requestId,
      });
    }


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
          "AI generated an invalid response. Please try again.",

        code:
          "INVALID_AI_RESPONSE",

        requestId,
      });
    }


    // Generic error
    return res.status(500).json({
      success: false,

      error:
        getErrorMessage(error),

      code:
        "AI_GENERATION_FAILED",

      requestId,
    });
  }
}