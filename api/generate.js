import { GoogleGenAI } from "@google/genai";

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

Never include:

<html>
<head>
<body>
<style>
<script>

==================================================
DESIGN
==================================================

Create a professional, premium and intentionally designed interface.

Use an appropriate visual system:

- typography
- spacing
- colors
- hierarchy
- cards
- borders
- shadows
- gradients when appropriate
- responsive layouts
- hover states
- focus states
- transitions

Do not blindly use the same design for every project.

The design MUST match the user's request.

==================================================
RESPONSIVE
==================================================

Every website must work on:

Desktop
Tablet
Mobile

Use:

- CSS Grid
- Flexbox
- fluid sizing
- max-width containers
- CSS variables
- media queries

Never create accidental horizontal scrolling.

Mobile navigation must work.

==================================================
JAVASCRIPT
==================================================

Use ONLY vanilla JavaScript.

Implement real interactions when appropriate:

- mobile menu
- tabs
- FAQ
- modal
- filters
- theme switch
- counters
- forms
- navigation
- buttons
- interactive UI

Do not create fake functionality.

Never attach events to elements that do not exist.

If JavaScript is unnecessary return an empty WEB_JS section.

==================================================
ACCESSIBILITY
==================================================

Use:

- semantic HTML
- accessible buttons
- aria attributes when appropriate
- meaningful labels
- alt text
- keyboard-friendly controls
- visible focus states

==================================================
SEO
==================================================

Use:

- logical headings
- semantic structure
- meaningful content
- descriptive links

Do not include meta tags because the builder supplies the document shell.

==================================================
IMAGES
==================================================

Do not use broken image URLs.

If images are useful, use reliable remote image URLs and meaningful alt text.

If images are unnecessary, create visual elements with CSS.

==================================================
EXISTING CODE
==================================================

If existing website code is supplied:

- understand it first
- preserve useful functionality
- preserve useful structure
- modify only what is requested when possible
- fix obvious bugs
- do not unnecessarily destroy working sections

Always return COMPLETE updated HTML/CSS/JS.

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
- hidden tracking intended to steal data

==================================================
FINAL QUALITY CHECK
==================================================

Internally verify:

HTML selectors match CSS.
JavaScript selectors match HTML.
Buttons work.
Navigation works.
Mobile layout works.
No horizontal overflow.
No broken references.
No secrets.
No malicious code.

Then return ONLY the three WEB sections.
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

  if (startIndex === -1) {
    return "";
  }

  const contentStart =
    startIndex + start.length;

  const endIndex =
    text.indexOf(end, contentStart);

  if (endIndex === -1) {
    return text.slice(contentStart);
  }

  return text.slice(
    contentStart,
    endIndex
  );
}

function getStatus(error) {
  return (
    error?.status ||
    error?.response?.status ||
    error?.statusCode ||
    500
  );
}

function retryable(error) {
  const status = getStatus(error);

  return [
    408,
    409,
    429,
    500,
    502,
    503,
    504,
  ].includes(status);
}

function getExistingCode(body) {
  const current =
    body?.currentCode || {
      html: body?.html || "",
      css: body?.css || "",
      js: body?.js || "",
    };

  return {
    html:
      typeof current.html === "string"
        ? current.html.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",

    css:
      typeof current.css === "string"
        ? current.css.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",

    js:
      typeof current.js === "string"
        ? current.js.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",
  };
}

function hasExistingCode(code) {
  return Boolean(
    code.html ||
    code.css ||
    code.js
  );
}

async function withTimeout(
  promise,
  ms
) {
  let timer;

  const timeout =
    new Promise(
      (_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              "Gemini request timed out."
            )
          );
        }, ms);
      }
    );

  try {
    return await Promise.race([
      promise,
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error:
        "GEMINI_API_KEY is not configured.",
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
      error:
        "Please enter a website request.",
    });
  }

  if (
    prompt.length >
    MAX_PROMPT_LENGTH
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Prompt is too long.",
    });
  }

  const existing =
    getExistingCode(body);

  let existingContext = "";

  if (hasExistingCode(existing)) {
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

==================================================

Modify the existing website intelligently.

Preserve useful functionality.

Return the COMPLETE updated website.
`;
  }

  const input = `
USER REQUEST:

${prompt}

${existingContext}
`;

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  let lastError = null;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      if (attempt > 0) {
        await sleep(
          Math.min(
            1000 *
              Math.pow(
                2,
                attempt - 1
              ),
            5000
          )
        );
      }

      console.log(
        `[AI] ${MODEL} attempt ${
          attempt + 1
        }`
      );

      const response =
        await withTimeout(
          ai.models.generateContent({
            model: MODEL,

            contents: input,

            config: {
              systemInstruction:
                SYSTEM_PROMPT,

              maxOutputTokens:
                30000,
            },
          }),

          REQUEST_TIMEOUT
        );

      const text =
        response.text || "";

      if (!text) {
        throw new Error(
          "Gemini returned an empty response."
        );
      }

      const html =
        clean(
          extract(
            text,
            "<WEB_HTML>",
            "</WEB_HTML>"
          )
        );

      const css =
        clean(
          extract(
            text,
            "<WEB_CSS>",
            "</WEB_CSS>"
          )
        );

      const js =
        clean(
          extract(
            text,
            "<WEB_JS>",
            "</WEB_JS>"
          )
        );

      if (
        !html &&
        !css &&
        !js
      ) {
        throw new Error(
          "Gemini returned invalid website sections."
        );
      }

      console.log(
        `[AI] ${MODEL} generation successful`
      );

      return res.status(200).json({
        success: true,

        model: MODEL,

        html,

        css,

        js,
      });
    } catch (error) {
      lastError = error;

      console.error(
        `[AI] ${MODEL} attempt ${
          attempt + 1
        } failed`,
        error
      );

      if (
        !retryable(error)
      ) {
        break;
      }
    }
  }

  const status =
    getStatus(lastError);

  let message =
    "AI generation failed. Please try again.";

  if (status === 429) {
    message =
      "Gemini rate limit reached. Please wait a moment and try again.";
  }

  if (
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    message =
      "Gemini service is temporarily busy. Please try again in a few seconds.";
  }

  if (status === 401) {
    message =
      "Gemini API key is invalid or unavailable.";
  }

  return res.status(
    status >= 400 &&
    status < 600
      ? status
      : 500
  ).json({
    success: false,
    error: message,
  });
}