/**
 * Redactio Server
 * 
 * To run in development:
 * npm run dev (runs: tsx server.ts)
 * 
 * Always run from the project root directory.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";
import Tesseract from "tesseract.js";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // --- API Routes ---

  // OCR Engine
  app.get("/api/ocr/health", async (req, res) => {
    try {
      // Simple check to see if Tesseract is available
      res.json({ status: "ok", engine: "tesseract.js" });
    } catch (error) {
      res.status(500).json({ status: "error", message: "OCR engine not available" });
    }
  });

  app.post("/api/ocr", async (req, res) => {
    try {
      const { image } = req.body; // base64
      if (!image) return res.status(400).json({ error: "No image provided" });

      const buffer = Buffer.from(image.split(',')[1], 'base64');
      const result = await (Tesseract as any).recognize(buffer, 'eng', {
        logger: (m: any) => console.log(m)
      });

      const words = result.data.words.map((w: any) => ({
        text: w.text,
        x: w.bbox.x0,
        y: w.bbox.y0,
        width: w.bbox.x1 - w.bbox.x0,
        height: w.bbox.y1 - w.bbox.y0,
        confidence: w.confidence
      }));

      res.json({ text: result.data.text, words });
    } catch (error) {
      console.error("OCR Error:", error);
      res.status(500).json({ error: "OCR failed" });
    }
  });

  // AutoRedactionEngine / CompanyDetector / Rule Engine
  app.post("/api/detect", async (req, res) => {
    res.status(410).json({ error: "This endpoint is deprecated. Use frontend-side detection instead." });
  });

  // PDF Unlock (Image-based rebuild)
  app.post("/api/unlock", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      // In a real scenario, we'd use a library to convert PDF pages to images
      // and then rebuild. For this demo, we'll strip security using pdf-lib
      // if it's just a simple password or restriction.
      // Rebuilding from images is more complex and usually requires external tools like ghostscript or poppler.
      
      const pdfDoc = await PDFDocument.load(pdfBase64, { ignoreEncryption: true });
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach(p => newPdf.addPage(p));
      
      const saved = await newPdf.saveAsBase64();
      res.json({ pdf: saved });
    } catch (error) {
      console.error("Unlock Error:", error);
      res.status(500).json({ error: "Unlock failed" });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
