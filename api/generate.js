import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3-flash-preview";

const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;
const MAX_IMAGE_SIZE = 12 * 1024 * 1024;
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
- Image-to-UI reconstruction expert

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
IMAGE ANALYSIS
==================================================

If a reference image is provided, analyze it carefully before generating code.

The image is a DESIGN REFERENCE.

Recreate the visual design as accurately as reasonably possible.

Pay attention to:

- overall layout
- section structure
- spacing
- typography
- font sizes
- colors
- backgrounds
- gradients
- borders
- border radius
- shadows
- buttons
- cards
- navigation
- hero composition
- image placement
- alignment
- proportions
- responsive behavior
- visual hierarchy

Do NOT merely create a generic website based on the image filename.

The generated website should visually resemble the reference image.

If the user asks to recreate the image/design, prioritize visual similarity.

Do not copy copyrighted logos, trademarks, or protected artwork unnecessarily.
Use appropriate placeholders or CSS recreations when necessary.

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

The design MUST match the user's request and reference image when provided.

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

If a reference image is supplied, use it to understand the intended visual design.

Do not automatically use the reference image itself as a website image.

If website imagery is needed, use reliable image URLs or CSS-based visual elements.

Never use broken image URLs.

Always provide meaningful alt text.

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

function normalizeImage(image) {
  if (!image) return null;

  if (
    typeof image !== "object"
  ) {
    return null;
  }

  const mimeType =
    typeof image.mimeType === "string"
      ? image.mimeType
      : "";

  const data =
    typeof image.data === "string"
      ? image.data
      : "";

  if (!mimeType || !data) {
    return null;
  }

  if (
    !mimeType.startsWith("image/")
  ) {
    return null;
  }

  const cleanData = data
    .replace(/^data:[^;]+;base64,/i, "")
    .trim();

  if (!cleanData) {
    return null;
  }

  const approximateBytes =
    (cleanData.length * 3) / 4;

  if (
    approximateBytes >
    MAX_IMAGE_SIZE
  ) {
    throw new Error(
      "Reference image is too large. Maximum size is 12 MB."
    );
  }

  return {
    mimeType,
    data: cleanData,
  };
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

  try {
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

    const hasExisting =
      hasExistingCode(existing);

    if (
      mode === "edit" &&
      !hasExisting
    ) {
      return res.status(400).json({
        success: false,
        error:
          "There is no existing website to edit. Generate a website first.",
      });
    }

    let image = null;
    let images = [];

    try {
      image = normalizeImage(
        body?.image
      );

      if (Array.isArray(body?.images)) {
        const validImages = body.images
          .filter(
            (item) =>
              item &&
              typeof item.url === "string" &&
              item.url.trim()
          )
          .slice(0, 10);

        for (const item of validImages) {
          try {
            const response = await fetch(
              item.url
            );

            if (!response.ok) {
              throw new Error(
                `Image download failed: ${response.status}`
              );
            }

            const contentType =
              response.headers.get("content-type") ||
              item.fileType ||
              "image/jpeg";

            if (!contentType.startsWith("image/")) {
              throw new Error(
                `URL is not an image: ${contentType}`
              );
            }

            const arrayBuffer =
              await response.arrayBuffer();

            const data =
              Buffer.from(arrayBuffer).toString(
                "base64"
              );

            const approximateBytes =
              (data.length * 3) / 4;

            if (approximateBytes > MAX_IMAGE_SIZE) {
              throw new Error(
                `Reference image "${
                  item.fileName ||
                  "project-image"
                }" is too large.`
              );
            }

            images.push({
              inlineData: {
                mimeType: contentType,
                data,
              },
              metadata: {
                id: item.id || null,
                fileName:
                  item.fileName ||
                  "project-image",
                fileType: contentType,
                url: item.url,
              },
            });
          } catch (error) {
            console.error(
              `[AI] Failed to load image: ${
                item.fileName || "unknown"
              }`,
              error
            );
          }
        }
      }
    } catch (imageError) {
      return res.status(400).json({
        success: false,
        error:
          imageError.message,
      });
    }

    if (image && !images.length) {
      images.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
        metadata: {
          fileName: "reference-image",
          fileType: image.mimeType,
        },
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

==================================================

EDIT MODE: ${
        mode === "edit"
          ? "YES"
          : "NO"
      }

${
  mode === "edit"
    ? `
Treat the existing website as the source of truth.

Apply the user's requested changes while preserving all unrelated
working sections, interactions, layout structure and functionality.

Do not redesign or remove unrelated features.

Return the COMPLETE updated website.
`
    : `
Use the existing website as context.

Preserve useful functionality and structure unless the user's request
requires changes.

Return the COMPLETE updated website.
`
}
`;
    }

    const textPrompt = `
TASK MODE:

${
  mode === "edit"
    ? "EDIT EXISTING WEBSITE"
    : "CREATE / GENERATE WEBSITE"
}

USER REQUEST:

${prompt}

${
  images.length
    ? `
==================================================
REFERENCE IMAGES
==================================================

${images
  .map(
    (item, index) => `Image ${index + 1}: ${
      item.metadata?.fileName ||
      "project-image"
    }`
  )
  .join("\n")}

Analyze the actual reference image inputs carefully.
Use them as the primary visual reference for the requested image-to-website task.
Match their layout, spacing, typography, colors, sections, component structure, visual hierarchy and responsive intent.
Do not ignore the provided images.
`
    : ""
}

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

        const parts = [
          {
            text: textPrompt,
          },
        ];

        if (images.length) {
          parts.push(
            ...images.map(
              (item) => item.inlineData
            )
          );
        }

        const response =
          await withTimeout(
            ai.models.generateContent({
              model: MODEL,

              contents: [
                {
                  role: "user",
                  parts,
                },
              ],

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
          hasImage: images.length > 0,
          imageCount: images.length,
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
      lastError?.message ||
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
  } catch (error) {
    console.error(
      "AI generation error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Website generation failed.",
    });
  }
}