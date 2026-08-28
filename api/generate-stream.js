import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3-flash-preview";

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;
const MAX_RETRIES = 2;
const MAX_IMAGES = 10;

/*
========================================================
SYSTEM PROMPT
========================================================
*/

const SYSTEM_PROMPT = `
You are the core AI engine of a premium AI Website Builder.

Act as:

- Senior frontend engineer
- UI/UX designer
- Product designer
- Accessibility specialist
- Responsive design expert
- JavaScript engineer
- Vision-aware website designer

Generate production-quality websites using ONLY:

HTML
CSS
Vanilla JavaScript

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

Never use Markdown.
Never use triple backticks.
Never include explanations.

HTML must ONLY contain body content.

Never include:

<html>
<head>
<body>
<style>
<script>

==================================================
IMAGE / VISION
==================================================

If images are provided with the request:

- Analyze the actual images.
- Understand their visual content.
- Use them when appropriate for the website.
- Match the requested design to the visual references.
- Use image URLs supplied by the application when creating image elements.
- Do not invent image URLs when a provided project image is suitable.
- Preserve the provided image URL exactly when using it.
- Choose images intelligently based on their content.
- Do not use every image automatically.
- If an image is clearly intended as a logo, hero image, product image,
  background image or gallery image, use it appropriately.
- Maintain good image aspect ratios.
- Use object-fit where appropriate.
- Provide meaningful alt text.

IMPORTANT:

The image information may include:
- filename
- MIME type
- project image URL

The actual image input may also be provided to you as a multimodal image part.

Use both the visual content and the metadata.

==================================================
DESIGN
==================================================

Create a premium, modern and intentionally designed website.

Use:

- strong typography
- spacing system
- color system
- hierarchy
- responsive layouts
- cards when appropriate
- shadows
- borders
- transitions
- hover states
- focus states

Match the requested style.

Do not blindly use gradients or glassmorphism.

==================================================
RESPONSIVE
==================================================

Desktop
Tablet
Mobile

Use Grid, Flexbox, CSS variables and media queries.

Avoid horizontal overflow.

Mobile navigation must work.

==================================================
JAVASCRIPT
==================================================

Use vanilla JavaScript only.

Implement real functionality when appropriate:

mobile menu
tabs
FAQ
modal
filters
theme toggle
forms
counters
interactive controls
smooth navigation

Never reference missing DOM elements.

If JavaScript is unnecessary return empty WEB_JS.

==================================================
ACCESSIBILITY
==================================================

Use semantic HTML.

Use accessible buttons.

Use aria attributes where appropriate.

Use meaningful alt text.

Provide visible focus states.

==================================================
EXISTING CODE
==================================================

If existing code is supplied:

understand it first.

Preserve working features.

Modify only what the user requests when possible.

Fix obvious issues.

Return COMPLETE updated HTML/CSS/JS.

==================================================
SECURITY
==================================================

Never generate:

API keys
password theft
credential harvesting
malware
destructive scripts
secret tokens
data theft

==================================================
QUALITY
==================================================

Internally verify:

HTML matches CSS.
CSS matches HTML.
JavaScript matches HTML.
Buttons work.
Navigation works.
Mobile works.
No horizontal overflow.
No broken references.
Provided images are used correctly when appropriate.

Then output ONLY the three WEB sections.
`;

/*
========================================================
HELPERS
========================================================
*/

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

  if (startIndex === -1) {
    return null;
  }

  const contentStart = startIndex + start.length;

  const endIndex = text.indexOf(end, contentStart);

  return {
    content:
      endIndex === -1
        ? text.slice(contentStart)
        : text.slice(contentStart, endIndex),

    complete: endIndex !== -1,
  };
}

function statusOf(error) {
  return (
    error?.status ||
    error?.response?.status ||
    error?.statusCode ||
    500
  );
}

function shouldRetry(error) {
  return [
    408,
    409,
    429,
    500,
    502,
    503,
    504,
  ].includes(statusOf(error));
}

function sendEvent(res, event, data) {
  try {
    res.write(
      `event: ${event}\n` +
        `data: ${JSON.stringify(data)}\n\n`
    );
  } catch {
    // Client disconnected.
  }
}

function existingCode(body) {
  const code = body?.currentCode || {};

  return {
    html:
      typeof code.html === "string"
        ? code.html.slice(0, MAX_CODE_LENGTH)
        : "",

    css:
      typeof code.css === "string"
        ? code.css.slice(0, MAX_CODE_LENGTH)
        : "",

    js:
      typeof code.js === "string"
        ? code.js.slice(0, MAX_CODE_LENGTH)
        : "",
  };
}

/*
========================================================
IMAGE INPUT BUILDER
========================================================

Builder.jsx sends:

images: [
  {
    id,
    fileName,
    fileType,
    url
  }
]

We convert those URLs into Gemini image parts.

Gemini receives:
- text instructions
- actual image data
*/

async function fetchImageAsBase64(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Image download failed: ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") ||
    "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `URL is not an image: ${contentType}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  const base64 = Buffer.from(arrayBuffer).toString(
    "base64"
  );

  return {
    inlineData: {
      mimeType: contentType,
      data: base64,
    },
  };
}

async function buildImageParts(images = []) {
  if (!Array.isArray(images)) {
    return [];
  }

  const validImages = images
    .filter(
      (image) =>
        image &&
        typeof image.url === "string" &&
        image.url.trim()
    )
    .slice(0, MAX_IMAGES);

  if (!validImages.length) {
    return [];
  }

  const results = [];

  for (const image of validImages) {
    try {
      const imagePart = await fetchImageAsBase64(
        image.url
      );

      results.push({
        part: imagePart,
        metadata: {
          id: image.id || null,
          fileName:
            image.fileName || "project-image",
          fileType:
            image.fileType || "image/*",
          url: image.url,
        },
      });
    } catch (error) {
      console.error(
        `[AI] Failed to load image: ${
          image.fileName || "unknown"
        }`,
        error
      );
    }
  }

  return results;
}

/*
========================================================
IMAGE METADATA TEXT
========================================================
*/

function buildImageMetadata(imageResults) {
  if (!imageResults.length) {
    return "";
  }

  const lines = imageResults.map(
    (item, index) => `
Image ${index + 1}:
ID: ${item.metadata.id || "N/A"}
Filename: ${item.metadata.fileName}
Type: ${item.metadata.fileType}
URL: ${item.metadata.url}
`
  );

  return `
==================================================
PROJECT IMAGES
==================================================

The following project images were supplied by the user.

You can visually inspect the actual image inputs.

${lines.join("\n")}

When using one of these images in HTML,
use its exact URL from the metadata above.

==================================================
`;
}

/*
========================================================
HANDLER
========================================================
*/

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
      error:
        "GEMINI_API_KEY is not configured.",
    });
  }

  const body = req.body || {};

  const mode =
    body?.mode === "edit"
      ? "edit"
      : "generate";

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

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: "Prompt is too long.",
    });
  }

  /*
  ======================================================
  SSE HEADERS
  ======================================================
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

  if (
    typeof res.flushHeaders === "function"
  ) {
    res.flushHeaders();
  }

  /*
  ======================================================
  EXISTING CODE
  ======================================================
  */

  const code = existingCode(body);

  const hasExisting = Boolean(
    code.html ||
      code.css ||
      code.js
  );

  if (
    mode === "edit" &&
    !hasExisting
  ) {
    sendEvent(res, "error", {
      message:
        "There is no existing website to edit. Generate a website first.",
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

==================================================

EDIT MODE: ${
      mode === "edit"
        ? "YES"
        : "NO"
    }

${
  mode === "edit"
    ? "Treat the existing website as the source of truth. Apply only the user's requested changes while preserving unrelated sections, interactions, layout, and working functionality. Do not rebuild unrelated parts. Return the COMPLETE updated website."
    : "Preserve useful existing functionality and structure unless the user's request requires changes. Return the COMPLETE updated website."
}
`;
  }

  /*
  ======================================================
  PROJECT IMAGES
  ======================================================
  */

  const projectImages = Array.isArray(
    body.images
  )
    ? body.images
    : [];

  sendEvent(res, "status", {
    stage: "thinking",
    message:
      mode === "edit"
        ? "Understanding your existing website..."
        : "Understanding your idea...",
  });

  if (projectImages.length > 0) {
    sendEvent(res, "status", {
      stage: "vision",
      message:
        "Analyzing your project images...",
    });
  }

  /*
  ======================================================
  LOAD ACTUAL IMAGE DATA
  ======================================================
  */

  let imageResults = [];

  if (projectImages.length > 0) {
    imageResults =
      await buildImageParts(
        projectImages
      );
  }

  const imageMetadata =
    buildImageMetadata(
      imageResults
    );

  /*
  ======================================================
  FINAL TEXT INPUT
  ======================================================
  */

  const input = `
TASK MODE: ${
    mode === "edit"
      ? "EDIT EXISTING WEBSITE"
      : "CREATE / GENERATE WEBSITE"
  }

USER REQUEST:

${prompt}

${imageMetadata}

${
  imageResults.length
    ? `
IMPORTANT IMAGE-TO-WEBSITE RULE:
The supplied images are real visual references, not merely file metadata.
Inspect the actual image content before writing code. Reconstruct the visible design as closely as reasonably possible: layout, spacing, typography, colors, sizing, borders, shadows, imagery, alignment, section order and responsive behavior.
If the user asks to recreate the image, prioritize visual fidelity over generic design choices.
When a supplied project image is intended to appear in the generated website, use its exact URL from PROJECT IMAGES.
`
    : ""
}

${existingContext}
`;

  /*
  ======================================================
  GEMINI CLIENT
  ======================================================
  */

  const ai = new GoogleGenAI({
    apiKey,
  });

  let stream = null;
  let lastError = null;

  /*
  ======================================================
  CONNECT WITH GEMINI
  ======================================================
  */

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      if (attempt > 0) {
        sendEvent(res, "status", {
          stage: "retrying",
          message:
            "Retrying Gemini connection...",
          attempt,
        });

        await sleep(
          Math.min(
            1000 *
              Math.pow(
                2,
                attempt - 1
              ),
            4000
          )
        );
      }

      sendEvent(res, "status", {
        stage: "connecting",
        message:
          "Connecting to Gemini AI...",
        model: MODEL,
      });

      /*
      ====================================================
      MULTIMODAL CONTENT
      ====================================================

      First part:
      text prompt

      Following parts:
      actual image data
      */

      const contents = [
        {
          role: "user",
          parts: [
            {
              text: input,
            },

            ...imageResults.map(
              (item) => item.part
            ),
          ],
        },
      ];

      stream =
        await ai.models.generateContentStream({
          model: MODEL,

          contents,

          config: {
            systemInstruction:
              SYSTEM_PROMPT,

            maxOutputTokens:
              30000,
          },
        });

      console.log(
        `[AI] Connected to ${MODEL} | Images: ${imageResults.length}`
      );

      break;
    } catch (error) {
      lastError = error;

      console.error(
        `[AI] Gemini attempt ${
          attempt + 1
        } failed`,
        error
      );

      if (!shouldRetry(error)) {
        break;
      }
    }
  }

  /*
  ======================================================
  CONNECTION FAILURE
  ======================================================
  */

  if (!stream) {
    const status =
      statusOf(lastError);

    let message =
      "Gemini generation failed.";

    if (status === 429) {
      message =
        "Gemini rate limit reached. Please wait a moment.";
    } else if (
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      message =
        "Gemini service is temporarily busy. Please try again.";
    } else if (status === 401) {
      message =
        "Gemini API key is invalid.";
    } else if (
      lastError?.message
    ) {
      message =
        lastError.message;
    }

    sendEvent(res, "error", {
      message,
      status,
    });

    return res.end();
  }

  /*
  ======================================================
  STREAM GENERATION
  ======================================================
  */

  let fullText = "";

  let htmlSent = 0;
  let cssSent = 0;
  let jsSent = 0;

  let stage = "generating";

  sendEvent(res, "status", {
    stage,

    message:
      imageResults.length > 0
        ? "Gemini is generating your website using your images..."
        : "Gemini is generating your website...",

    model: MODEL,

    imageCount:
      imageResults.length,
  });

  try {
    for await (
      const chunk of stream
    ) {
      const delta =
        chunk?.text || "";

      if (!delta) {
        continue;
      }

      fullText += delta;

      /*
      ====================================================
      HTML
      ====================================================
      */

      const htmlPart =
        extract(
          fullText,
          "<WEB_HTML>",
          "</WEB_HTML>"
        );

      if (
        htmlPart &&
        htmlPart.content
      ) {
        const html = clean(
          htmlPart.content
        );

        if (html.length > htmlSent) {
          const newDelta =
            html.slice(htmlSent);

          htmlSent = html.length;

          if (stage !== "html") {
            stage = "html";

            sendEvent(res, "status", {
              stage: "html",
              message:
                "Writing HTML...",
            });
          }

          sendEvent(res, "code", {
            type: "html",
            delta: newDelta,
            value: html,
            complete:
              htmlPart.complete,
          });
        }
      }

      /*
      ====================================================
      CSS
      ====================================================
      */

      const cssPart =
        extract(
          fullText,
          "<WEB_CSS>",
          "</WEB_CSS>"
        );

      if (
        cssPart &&
        cssPart.content
      ) {
        const css = clean(
          cssPart.content
        );

        if (css.length > cssSent) {
          const newDelta =
            css.slice(cssSent);

          cssSent = css.length;

          if (stage !== "css") {
            stage = "css";

            sendEvent(res, "status", {
              stage: "css",
              message:
                "Designing CSS...",
            });
          }

          sendEvent(res, "code", {
            type: "css",
            delta: newDelta,
            value: css,
            complete:
              cssPart.complete,
          });
        }
      }

      /*
      ====================================================
      JAVASCRIPT
      ====================================================
      */

      const jsPart =
        extract(
          fullText,
          "<WEB_JS>",
          "</WEB_JS>"
        );

      if (
        jsPart &&
        jsPart.content
      ) {
        const js = clean(
          jsPart.content
        );

        if (js.length > jsSent) {
          const newDelta =
            js.slice(jsSent);

          jsSent = js.length;

          if (stage !== "js") {
            stage = "js";

            sendEvent(res, "status", {
              stage: "js",
              message:
                "Adding interactions...",
            });
          }

          sendEvent(res, "code", {
            type: "js",
            delta: newDelta,
            value: js,
            complete:
              jsPart.complete,
          });
        }
      }
    }

    /*
    ======================================================
    FINAL RESULT
    ======================================================
    */

    const finalHtml =
      extract(
        fullText,
        "<WEB_HTML>",
        "</WEB_HTML>"
      )?.content || "";

    const finalCss =
      extract(
        fullText,
        "<WEB_CSS>",
        "</WEB_CSS>"
      )?.content || "";

    const finalJs =
      extract(
        fullText,
        "<WEB_JS>",
        "</WEB_JS>"
      )?.content || "";

    const result = {
      html: clean(
        finalHtml
      ).trim(),

      css: clean(
        finalCss
      ).trim(),

      js: clean(
        finalJs
      ).trim(),
    };

    if (
      !result.html &&
      !result.css &&
      !result.js
    ) {
      throw new Error(
        "Gemini returned an empty website."
      );
    }

    /*
    ======================================================
    COMPLETE
    ======================================================
    */

    sendEvent(res, "complete", {
      success: true,

      model: MODEL,

      imageCount:
        imageResults.length,

      html: result.html,

      css: result.css,

      js: result.js,
    });

    return res.end();
  } catch (error) {
    console.error(
      "[AI] Gemini streaming error",
      error
    );

    sendEvent(res, "error", {
      message:
        error?.message ||
        "Gemini streaming generation failed.",
    });

    return res.end();
  }
}