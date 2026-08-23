import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET.",
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const models = [];

    for await (const model of ai.models.list()) {
      models.push({
        name: model.name || "",
        displayName: model.displayName || "",
        description: model.description || "",
        supportedActions:
          model.supportedActions || [],
      });
    }

    return res.status(200).json({
      success: true,
      count: models.length,
      models,
    });
  } catch (error) {
    console.error(
      "Gemini model listing error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Could not retrieve Gemini models.",
    });
  }
}