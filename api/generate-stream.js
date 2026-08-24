import OpenAI from "openai";

const MODELS = [
  "gpt-5.6",
  "gpt-5.5",
];

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

Then output ONLY the three WEB sections.
`;

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
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

function extract(
  text,
  start,
  end
) {
  const startIndex =
    text.indexOf(start);

  if (startIndex === -1) {
    return null;
  }

  const contentStart =
    startIndex + start.length;

  const endIndex =
    text.indexOf(
      end,
      contentStart
    );

  return {
    content:
      endIndex === -1
        ? text.slice(
            contentStart
          )
        : text.slice(
            contentStart,
            endIndex
          ),

    complete:
      endIndex !== -1,
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
  ].includes(
    statusOf(error)
  );
}

function sendEvent(
  res,
  event,
  data
) {
  try {
    res.write(
      `event: ${event}\n` +
      `data: ${JSON.stringify(
        data
      )}\n\n`
    );
  } catch {
    // client disconnected
  }
}

function existingCode(body) {
  const code =
    body?.currentCode || {};

  return {
    html:
      typeof code.html === "string"
        ? code.html.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",

    css:
      typeof code.css === "string"
        ? code.css.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",

    js:
      typeof code.js === "string"
        ? code.js.slice(
            0,
            MAX_CODE_LENGTH
          )
        : "",
  };
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error:
        "Method not allowed.",
    });
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error:
        "OPENAI_API_KEY is not configured.",
    });
  }

  const body =
    req.body || {};

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
    typeof res.flushHeaders ===
    "function"
  ) {
    res.flushHeaders();
  }

  const code =
    existingCode(body);

  const hasExisting =
    code.html ||
    code.css ||
    code.js;

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

Preserve useful existing functionality.

Return the COMPLETE updated website.
`;
  }

  const input = `
USER REQUEST:

${prompt}

${existingContext}
`;

  const client =
    new OpenAI({
      apiKey,
    });

  sendEvent(
    res,
    "status",
    {
      stage: "thinking",
      message:
        "Understanding your idea...",
    }
  );

  let stream = null;
  let selectedModel = null;
  let lastError = null;

  /*
  ========================================================
  CONNECT WITH MODEL
  ========================================================
  */

  for (
    const model of MODELS
  ) {
    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        if (attempt > 0) {
          sendEvent(
            res,
            "status",
            {
              stage: "retrying",
              message:
                "Retrying AI connection...",
              attempt,
            }
          );

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

        sendEvent(
          res,
          "status",
          {
            stage: "connecting",
            message:
              "Connecting to AI...",
            model,
          }
        );

        stream =
          await client.responses.create({
            model,

            instructions:
              SYSTEM_PROMPT,

            input,

            stream: true,

            max_output_tokens:
              30000,
          });

        selectedModel =
          model;

        console.log(
          `[AI] Connected to ${model}`
        );

        break;
      } catch (error) {
        lastError = error;

        console.error(
          `[AI] ${model} attempt ${
            attempt + 1
          } failed`,
          error
        );

        if (
          !shouldRetry(error)
        ) {
          break;
        }
      }
    }

    if (stream) break;
  }

  if (!stream) {
    const status =
      statusOf(lastError);

    let message =
      "AI generation failed.";

    if (status === 429) {
      message =
        "AI rate limit reached. Please wait a moment.";
    } else if (
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      message =
        "AI service is temporarily busy. Please try again.";
    } else if (status === 401) {
      message =
        "OpenAI API key is invalid.";
    }

    sendEvent(
      res,
      "error",
      {
        message,
        status,
      }
    );

    return res.end();
  }

  /*
  ========================================================
  STREAM GENERATION
  ========================================================
  */

  let fullText = "";

  let htmlSent = 0;
  let cssSent = 0;
  let jsSent = 0;

  let stage =
    "generating";

  sendEvent(
    res,
    "status",
    {
      stage,
      message:
        "AI is generating your website...",
      model: selectedModel,
    }
  );

  try {
    for await (
      const event of stream
    ) {
      /*
      ------------------------------------------
      TEXT DELTA
      ------------------------------------------
      */

      if (
        event.type ===
        "response.output_text.delta"
      ) {
        const delta =
          event.delta || "";

        if (!delta) continue;

        fullText += delta;

        /*
        ----------------------------------------
        HTML
        ----------------------------------------
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
          const html =
            clean(
              htmlPart.content
            );

          if (
            html.length >
            htmlSent
          ) {
            const newDelta =
              html.slice(
                htmlSent
              );

            htmlSent =
              html.length;

            if (
              stage !== "html"
            ) {
              stage = "html";

              sendEvent(
                res,
                "status",
                {
                  stage: "html",
                  message:
                    "Writing HTML...",
                }
              );
            }

            sendEvent(
              res,
              "code",
              {
                type: "html",
                delta: newDelta,
                value: html,
                complete:
                  htmlPart.complete,
              }
            );
          }
        }

        /*
        ----------------------------------------
        CSS
        ----------------------------------------
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
          const css =
            clean(
              cssPart.content
            );

          if (
            css.length >
            cssSent
          ) {
            const newDelta =
              css.slice(
                cssSent
              );

            cssSent =
              css.length;

            if (
              stage !== "css"
            ) {
              stage = "css";

              sendEvent(
                res,
                "status",
                {
                  stage: "css",
                  message:
                    "Designing CSS...",
                }
              );
            }

            sendEvent(
              res,
              "code",
              {
                type: "css",
                delta: newDelta,
                value: css,
                complete:
                  cssPart.complete,
              }
            );
          }
        }

        /*
        ----------------------------------------
        JAVASCRIPT
        ----------------------------------------
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
          const js =
            clean(
              jsPart.content
            );

          if (
            js.length >
            jsSent
          ) {
            const newDelta =
              js.slice(
                jsSent
              );

            jsSent =
              js.length;

            if (
              stage !== "js"
            ) {
              stage = "js";

              sendEvent(
                res,
                "status",
                {
                  stage: "js",
                  message:
                    "Adding interactions...",
                }
              );
            }

            sendEvent(
              res,
              "code",
              {
                type: "js",
                delta: newDelta,
                value: js,
                complete:
                  jsPart.complete,
              }
            );
          }
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
        "AI returned an empty website."
      );
    }

    sendEvent(
      res,
      "complete",
      {
        success: true,
        model:
          selectedModel,
        html:
          result.html,
        css:
          result.css,
        js:
          result.js,
      }
    );

    return res.end();
  } catch (error) {
    console.error(
      "[AI] Streaming error",
      error
    );

    sendEvent(
      res,
      "error",
      {
        message:
          error?.message ||
          "Streaming generation failed.",
      }
    );

    return res.end();
  }
}