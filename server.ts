import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { PDFDocument, rgb, degrees as pdfDegrees } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Setup storage for uploads
const UPLOADS_DIR = "uploads";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
const upload = multer({ dest: UPLOADS_DIR });

// API Routes
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// AI Suggestions using Gemini or Local Regex (Light Mode)
app.post("/api/ai/suggest", async (req, res) => {
  try {
    const { text, context } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const isLightMode = context?.aiDefaults?.lightMode;

    if (isLightMode) {
      // Light Mode: Use Regex only (Fully Local, Low Resource)
      const suggestions: any[] = [];
      
      const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
      const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
      
      let match;
      while ((match = emailRegex.exec(text)) !== null) {
        suggestions.push({ text: match[0], label: "EMAIL", reason: "Matches email pattern", confidence: 0.95 });
      }
      while ((match = phoneRegex.exec(text)) !== null) {
        suggestions.push({ text: match[0], label: "PHONE", reason: "Matches phone pattern", confidence: 0.90 });
      }
      while ((match = ssnRegex.exec(text)) !== null) {
        suggestions.push({ text: match[0], label: "SSN", reason: "Matches SSN pattern", confidence: 0.99 });
      }

      return res.json({ suggestions });
    }

    // Full AI Mode (Gemini)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert document redaction assistant. 
      Analyze the following text and identify all sensitive information that MUST be redacted for privacy compliance (GDPR, HIPAA, PII).
      
      Context: ${JSON.stringify(context || "General document")}
      
      Identify:
      - Names of individuals
      - Phone numbers, Email addresses
      - Physical addresses
      - Social Security Numbers, Tax IDs
      - Credit card numbers, Bank account details
      - Proprietary project names or trade secrets
      - Health information
      
      Return a JSON array of objects with 'text', 'label', 'reason', and 'confidence' (0.0 to 1.0).
      
      Text:
      ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  label: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["text", "label", "reason", "confidence"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"suggestions": []}');
    res.json(result);
  } catch (error) {
    console.error("AI Suggestion error:", error);
    res.status(500).json({ error: "AI Suggestion failed" });
  }
});

// Stirling-compatible Redaction API
app.post("/api/v1/redact", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const redactions = JSON.parse(req.body.redactions || "[]");
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const r of redactions) {
      const pageIndex = (r.page || 1) - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;
      
      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      const pw = r.pageWidth || width;
      const ph = r.pageHeight || height;
      
      const x = (r.x / pw) * width;
      const y = height - ((r.y + r.height) / ph) * height;
      const w = (r.width / pw) * width;
      const h = (r.height / ph) * height;

      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: rgb(0, 0, 0),
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_redacted.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, file.originalname.replace(".pdf", "_redacted.pdf"), () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("Redaction error:", error);
    res.status(500).json({ error: "Redaction failed" });
  }
});

// Merge PDFs
app.post("/api/pdf/merge", upload.array("files"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_merged.pdf`);
    fs.writeFileSync(outputPath, mergedPdfBytes);

    res.download(outputPath, "merged.pdf", () => {
      files.forEach(f => fs.unlinkSync(f.path));
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Merge failed" });
  }
});

// Split PDF
app.post("/api/pdf/split", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Split into individual pages (returning first page for now as example)
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdfDoc, [0]);
    newPdf.addPage(page);

    const splitPdfBytes = await newPdf.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_split.pdf`);
    fs.writeFileSync(outputPath, splitPdfBytes);

    res.download(outputPath, "split_page_1.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Split failed" });
  }
});

// Rotate PDF
app.post("/api/pdf/rotate", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const degrees = parseInt(req.body.rotation || "90");
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    pages.forEach(page => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(pdfDegrees(currentRotation + degrees));
    });

    const rotatedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_rotated.pdf`);
    fs.writeFileSync(outputPath, rotatedPdfBytes);

    res.download(outputPath, "rotated.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Rotation failed" });
  }
});

// Remove Pages
app.post("/api/pdf/remove-pages", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const pagesToRemove = JSON.parse(req.body.pages || "[]"); // Array of 1-based page numbers
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Sort descending to avoid index shift
    const sortedPages = pagesToRemove.map((p: number) => p - 1).sort((a: number, b: number) => b - a);
    sortedPages.forEach((index: number) => {
      if (index >= 0 && index < pdfDoc.getPageCount()) {
        pdfDoc.removePage(index);
      }
    });

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_removed.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "modified.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Page removal failed" });
  }
});

// Reorder Pages
app.post("/api/pdf/reorder-pages", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const newOrder = JSON.parse(req.body.order || "[]"); // Array of 1-based page numbers
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    const indices = newOrder.map((p: number) => p - 1).filter((i: number) => i >= 0 && i < pdfDoc.getPageCount());
    const copiedPages = await newPdf.copyPages(pdfDoc, indices);
    copiedPages.forEach(page => newPdf.addPage(page));

    const modifiedPdfBytes = await newPdf.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_reordered.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "reordered.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Page reordering failed" });
  }
});

// Metadata Update
app.post("/api/document/metadata/update", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    if (req.body.title) pdfDoc.setTitle(req.body.title);
    if (req.body.author) pdfDoc.setAuthor(req.body.author);
    if (req.body.subject) pdfDoc.setSubject(req.body.subject);
    if (req.body.keywords) pdfDoc.setKeywords(req.body.keywords.split(","));
    if (req.body.creator) pdfDoc.setCreator(req.body.creator);
    if (req.body.producer) pdfDoc.setProducer(req.body.producer);

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_metadata.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, file.originalname.replace(".pdf", "_metadata.pdf"), () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Metadata update failed" });
  }
});

// Images to PDF
app.post("/api/images/to-pdf", upload.array("files"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const pdfDoc = await PDFDocument.create();
    for (const file of files) {
      const imgBytes = fs.readFileSync(file.path);
      let img;
      if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
        img = await pdfDoc.embedJpg(imgBytes);
      } else if (file.mimetype === "image/png") {
        img = await pdfDoc.embedPng(imgBytes);
      } else {
        continue;
      }

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, {
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_images.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    res.download(outputPath, "images_to_pdf.pdf", () => {
      files.forEach(f => fs.unlinkSync(f.path));
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Images to PDF conversion failed" });
  }
});

// Add Password (Placeholder)
app.post("/api/security/password/add", upload.single("file"), async (req, res) => {
  res.status(501).json({ error: "Password protection requires specialized libraries like qpdf or similar, not yet implemented." });
});

// OCR Placeholder
app.post("/api/ocr", upload.single("file"), async (req, res) => {
  res.json({ message: "OCR started (placeholder)" });
});

// Add Watermark
app.post("/api/pdf/add-watermark", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const text = req.body.text || "WATERMARK";
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(text, {
        x: width / 4,
        y: height / 2,
        size: 50,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.3,
        rotate: pdfDegrees(45),
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_watermarked.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "watermarked.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Watermark failed" });
  }
});

// Add Page Numbers
app.post("/api/pdf/add-page-numbers", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    pages.forEach((page, i) => {
      const { width } = page.getSize();
      page.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: width / 2 - 20,
        y: 20,
        size: 10,
        color: rgb(0, 0, 0),
      });
    });

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_numbered.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "numbered.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Page numbering failed" });
  }
});

// Flatten PDF
app.post("/api/pdf/flatten", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Flatten forms if any
    const form = pdfDoc.getForm();
    form.flatten();

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_flattened.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "flattened.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Flatten failed" });
  }
});

// Optimize PDF (Basic version: just re-save)
app.post("/api/pdf/optimize", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_optimized.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "optimized.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Optimization failed" });
  }
});

// Repair PDF (Basic version: load and save)
app.post("/api/pdf/repair", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_repaired.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "repaired.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Repair failed" });
  }
});

// Remove Annotations
app.post("/api/pdf/remove-annotations", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    pages.forEach(page => {
      // Annotations are in the Annots entry of the page dictionary
      page.node.set(page.node.context.obj('Annots'), page.node.context.obj([]));
    });

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_no_annots.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "no_annotations.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Annotation removal failed" });
  }
});

// Reverse PDF
app.post("/api/pdf/reverse", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    
    const pageIndices = pdfDoc.getPageIndices().reverse();
    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    const modifiedPdfBytes = await newPdf.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_reversed.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "reversed.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Reverse failed" });
  }
});

// Sanitise PDF
app.post("/api/pdf/sanitise", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Clear metadata
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    
    // Remove annotations
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      page.node.set(page.node.context.obj('Annots'), page.node.context.obj([]));
    });

    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(UPLOADS_DIR, `${uuidv4()}_sanitised.pdf`);
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    res.download(outputPath, "sanitised.pdf", () => {
      fs.unlinkSync(file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: "Sanitisation failed" });
  }
});

// Vite middleware setup
async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
