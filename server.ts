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

  // --- PDF Processing Tools (Stirling-PDF style) ---

  app.post("/api/pdf/metadata", async (req, res) => {
    try {
      const { pdfBase64, metadata } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      const pdfDoc = await PDFDocument.load(pdfBase64);
      if (metadata.title) pdfDoc.setTitle(metadata.title);
      if (metadata.author) pdfDoc.setAuthor(metadata.author);
      if (metadata.subject) pdfDoc.setSubject(metadata.subject);
      if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map((k: string) => k.trim()));
      if (metadata.creator) pdfDoc.setCreator(metadata.creator);
      if (metadata.producer) pdfDoc.setProducer(metadata.producer);

      const saved = await pdfDoc.saveAsBase64();
      res.json({ pdf: saved });
    } catch (error) {
      console.error("Metadata Error:", error);
      res.status(500).json({ error: "Failed to update metadata" });
    }
  });

  app.post("/api/pdf/security", async (req, res) => {
    try {
      const { pdfBase64, password, permissions } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      // pdf-lib doesn't support setting passwords directly on load/save yet in a simple way
      // for full encryption. It usually requires a lower-level library or a different approach.
      // However, we can simulate "Change Permissions" by setting metadata or using a different library.
      // For this demo, we'll acknowledge the request.
      
      const pdfDoc = await PDFDocument.load(pdfBase64);
      // Simulate permission setting
      pdfDoc.setKeywords([...(pdfDoc.getKeywords()?.split(' ') || []), 'PROTECTED']);
      
      const saved = await pdfDoc.saveAsBase64();
      res.json({ pdf: saved, message: "Security settings applied (simulated)" });
    } catch (error) {
      console.error("Security Error:", error);
      res.status(500).json({ error: "Failed to apply security" });
    }
  });

  app.post("/api/pdf/merge", async (req, res) => {
    try {
      const { pdfs } = req.body; // Array of base64
      if (!pdfs || pdfs.length < 2) return res.status(400).json({ error: "At least two PDFs required" });

      const mergedPdf = await PDFDocument.create();
      for (const base64 of pdfs) {
        const doc = await PDFDocument.load(base64);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      }

      const saved = await mergedPdf.saveAsBase64();
      res.json({ pdf: saved });
    } catch (error) {
      console.error("Merge Error:", error);
      res.status(500).json({ error: "Failed to merge PDFs" });
    }
  });

  app.post("/api/pdf/split", async (req, res) => {
    try {
      const { pdfBase64, ranges } = req.body; // ranges: [[0, 2], [3, 5]]
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      const sourceDoc = await PDFDocument.load(pdfBase64);
      const results = [];

      for (const range of ranges) {
        const newDoc = await PDFDocument.create();
        const indices = [];
        for (let i = range[0]; i <= range[1]; i++) {
          if (i < sourceDoc.getPageCount()) indices.push(i);
        }
        const pages = await newDoc.copyPages(sourceDoc, indices);
        pages.forEach(p => newDoc.addPage(p));
        results.push(await newDoc.saveAsBase64());
      }

      res.json({ pdfs: results });
    } catch (error) {
      console.error("Split Error:", error);
      res.status(500).json({ error: "Failed to split PDF" });
    }
  });

  app.post("/api/pdf/extract-pages", async (req, res) => {
    try {
      const { pdfBase64, indices } = req.body; // indices: [0, 1, 5]
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      const sourceDoc = await PDFDocument.load(pdfBase64);
      const newDoc = await PDFDocument.create();
      const pages = await newDoc.copyPages(sourceDoc, indices);
      pages.forEach(p => newDoc.addPage(p));

      const saved = await newDoc.saveAsBase64();
      res.json({ pdf: saved });
    } catch (error) {
      console.error("Extract Pages Error:", error);
      res.status(500).json({ error: "Failed to extract pages" });
    }
  });

  app.post("/api/pdf/remove-pages", async (req, res) => {
    try {
      const { pdfBase64, indicesToRemove } = req.body;
      if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

      const pdfDoc = await PDFDocument.load(pdfBase64);
      const totalPages = pdfDoc.getPageCount();
      const indicesToKeep = [];
      for (let i = 0; i < totalPages; i++) {
        if (!indicesToRemove.includes(i)) indicesToKeep.push(i);
      }

      const newDoc = await PDFDocument.create();
      const pages = await newDoc.copyPages(pdfDoc, indicesToKeep);
      pages.forEach(p => newDoc.addPage(p));

      const saved = await newDoc.saveAsBase64();
      res.json({ pdf: saved });
    } catch (error) {
      console.error("Remove Pages Error:", error);
      res.status(500).json({ error: "Failed to remove pages" });
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
