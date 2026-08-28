import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-1.5-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  const { prompt, mode, currentCode, images = [] } = req.body;

  const promptParts = [
    { text: "Output ONLY <WEB_HTML>, <WEB_CSS>, <WEB_JS>." },
    { text: `Request: ${prompt}` },
    { text: `Current HTML: ${currentCode?.html || ""}` }
  ];

  images.forEach((img) => {
    promptParts.push({
      inlineData: { mimeType: img.type, data: img.base64 }
    });
  });

  const ai = new GoogleGenAI(apiKey);
  const model = ai.getGenerativeModel({ model: MODEL });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: promptParts }],
    });

    const text = result.response.text();
    const extract = (t, s, e) => {
      const start = t.indexOf(s) + s.length;
      const end = t.indexOf(e);
      return t.slice(start, end).replace(/```[a-z]*/gi, "").replace(/```/g, "").trim();
    };

    res.status(200).json({
      success: true,
      html: extract(text, "<WEB_HTML>", "</WEB_HTML>"),
      css: extract(text, "<WEB_CSS>", "</WEB_CSS>"),
      js: extract(text, "<WEB_JS>", "</WEB_JS>"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}