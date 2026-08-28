import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-1.5-flash"; // Switched to vision-capable model
const MAX_PROMPT_LENGTH = 12000;
const MAX_CODE_LENGTH = 70000;

const SYSTEM_PROMPT = `
You are a senior frontend engineer and UI/UX designer.
Generate production-quality websites using ONLY HTML, CSS, and Vanilla JavaScript.

If an image is provided:
- It is a DESIGN REFERENCE (screenshot).
- Analyze the layout, spacing, colors, and typography.
- Recreate the design exactly using real code.
- DO NOT just put the image on the page.

OUTPUT FORMAT:
Return ONLY three sections: <WEB_HTML>, <WEB_CSS>, <WEB_JS>.
Do not use backticks or markdown.
HTML must contain only content inside <body>.
`;

function clean(val = "") {
  return String(val).replace(/```(html|css|javascript|js)?/gi, "").replace(/```/g, "").trim();
}

function extract(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return null;
  const contentStart = startIndex + start.length;
  const endIndex = text.indexOf(end, contentStart);
  return {
    content: endIndex === -1 ? text.slice(contentStart) : text.slice(contentStart, endIndex),
    complete: endIndex !== -1,
  };
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API Key missing." });

  const { prompt, mode, currentCode, images = [] } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Construct Gemini Parts
  const promptParts = [
    { text: `SYSTEM: ${SYSTEM_PROMPT}` },
    { text: `USER REQUEST: ${prompt}` },
    { text: `MODE: ${mode}` },
    { text: `EXISTING HTML: ${currentCode?.html || ""}` },
    { text: `EXISTING CSS: ${currentCode?.css || ""}` },
    { text: `EXISTING JS: ${currentCode?.js || ""}` }
  ];

  // Add Images if provided
  images.forEach((img) => {
    promptParts.push({
      inlineData: {
        mimeType: img.type || "image/png",
        data: img.base64,
      },
    });
  });

  const ai = new GoogleGenAI(apiKey);
  const model = ai.getGenerativeModel({ model: MODEL });

  try {
    sendEvent(res, "status", { stage: "connecting", message: "Contacting Gemini Vision..." });

    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: promptParts }],
    });

    let fullText = "";
    let hSent = 0, cSent = 0, jSent = 0;

    for await (const chunk of result.stream) {
      const delta = chunk.text();
      fullText += delta;

      const htmlPart = extract(fullText, "<WEB_HTML>", "</WEB_HTML>");
      const cssPart = extract(fullText, "<WEB_CSS>", "</WEB_CSS>");
      const jsPart = extract(fullText, "<WEB_JS>", "</WEB_JS>");

      if (htmlPart && htmlPart.content.length > hSent) {
        sendEvent(res, "code", { type: "html", value: clean(htmlPart.content) });
        hSent = htmlPart.content.length;
      }
      if (cssPart && cssPart.content.length > cSent) {
        sendEvent(res, "code", { type: "css", value: clean(cssPart.content) });
        cSent = cssPart.content.length;
      }
      if (jsPart && jsPart.content.length > jSent) {
        sendEvent(res, "code", { type: "js", value: clean(jsPart.content) });
        jSent = jsPart.content.length;
      }
    }

    sendEvent(res, "complete", {
      html: clean(extract(fullText, "<WEB_HTML>", "</WEB_HTML>")?.content || ""),
      css: clean(extract(fullText, "<WEB_CSS>", "</WEB_CSS>")?.content || ""),
      js: clean(extract(fullText, "<WEB_JS>", "</WEB_JS>")?.content || ""),
    });

    res.end();
  } catch (error) {
    sendEvent(res, "error", { message: error.message });
    res.end();
  }
}