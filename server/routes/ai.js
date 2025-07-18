import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  const { prompt } = req.body;
  console.log("🧠 Prompt received:", prompt);

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content: `
You are an AI whiteboard assistant.
You respond ONLY with a JSON object describing drawing actions. No markdown, no explanation.

If one shape:
  {
    "action": "add_shape",
    "shape": "rect",
    "x": 100,
    "y": 100,
    "width": 150,
    "height": 100,
    "fill": "#f00"
  }

If multiple shapes:
  {
    "action": "add_shapes",
    "shapes": [
      { "shape": "circle", "x": 100, "y": 100, "radius": 40, "fill": "#f00" },
      { "shape": "text", "x": 100, "y": 160, "text": "Label" }
    ]
  }

Do not include markdown. No commentary. Just JSON.
`,
          },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
        },
      }
    );

    const message = response.data.choices[0].message.content;
    console.log("📨 Raw AI message:", message);

    // Clean AI response
    const match = message.match(/```json([\s\S]*?)```|({[\s\S]*})/);
    if (!match) throw new Error("No JSON found in AI response");

    const jsonText = match[1] || match[2];
    const parsed = JSON.parse(jsonText);

    // Normalize
    if (parsed.action === "add_shapes" && Array.isArray(parsed.shapes)) {
      const shapes = parsed.shapes.map((s) => ({
        shape: s.shape?.toLowerCase() || "rect",
        x: s.x ?? 100,
        y: s.y ?? 100,
        width: s.width,
        height: s.height,
        radius: s.radius,
        radiusX: s.radiusX,
        radiusY: s.radiusY,
        text: s.text,
        fontSize: s.fontSize,
        fill: s.fill || s.color || "#ccc",
      }));

      return res.json({ action: "add_shapes", shapes });
    }

    // Fallback for single shape
    if (parsed.action === "add_shape") {
      return res.json({
        action: "add_shapes",
        shapes: [
          {
            shape: parsed.shape?.toLowerCase() || "rect",
            x: parsed.x ?? 100,
            y: parsed.y ?? 100,
            width: parsed.width,
            height: parsed.height,
            radius: parsed.radius,
            radiusX: parsed.radiusX,
            radiusY: parsed.radiusY,
            text: parsed.text,
            fontSize: parsed.fontSize,
            fill: parsed.fill || parsed.color || "#ccc",
          },
        ],
      });
    }

    throw new Error("Invalid or missing action in response.");
  } catch (error) {
    console.error("❌ AI error:", error.message);
    console.error("📄 Full error:", error.response?.data || error);
    res.status(500).json({ error: "AI assistant failed." });
  }
});

export default router;
