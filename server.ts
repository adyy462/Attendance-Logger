/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger JSON payload limit for base64 image transfers
app.use(express.json({ limit: "20mb" }));

// Initialize Google Gen AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API routes FIRST

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Gemini Monthly Insights Endpoint
app.post("/api/insights", async (req, res) => {
  try {
    const { month, summaries, logs } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    const prompt = `
      You are an HR/Attendance Insights assistant.
      Analyze the attendance data for ${month}. 
      Identify patterns, commend good attendance, or gently highlight frequent absences or patterns like taking every Friday off.
      Be concise, professional, and encouraging. Return a bulleted list of 2-3 key insights.
      
      Summaries data: ${JSON.stringify(summaries)}
      Logs sample (if relevant): ${JSON.stringify(logs)}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });

    res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("Insights error:", error);
    res.status(500).json({ error: error.message || "Failed to generate insights" });
  }
});

async function startServer() {
  // Vite integration for dev server or serving static build files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
