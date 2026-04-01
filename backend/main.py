from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import re
import os

# Try to import heavy dependencies, fallback to light mode if not available
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    FULL_AI_MODE = True
except ImportError:
    nlp = None
    FULL_AI_MODE = False

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None

app = FastAPI(
    title="Redaction Studio API",
    description="Offline-first COA redaction system",
    version="1.0.0"
)

# --- Schemas ---

class BBox(BaseModel):
    page: int
    x0: float
    y0: float
    x1: float
    y1: float

class Suggestion(BaseModel):
    text: str
    label: str
    reason: str
    confidence: float
    bbox: Optional[BBox] = None

class TemplateAnchor(BaseModel):
    field_label: str
    page: int
    x_range: List[float]
    y_range: List[float]

class CompanyTemplate(BaseModel):
    company_name: str
    anchors: List[TemplateAnchor]

class RedactionRequest(BaseModel):
    redactions: List[Suggestion]

# --- Regex Rules (Light Mode) ---
EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
PHONE_RE = re.compile(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
BATCH_RE = re.compile(r"(?i)(batch|lot)\s*(no|number|id)?\s*[:#]?\s*([A-Z0-9-]+)")

# --- Endpoints ---

@app.get("/api/status")
def get_status():
    """Check if running in light mode or full AI mode."""
    return {
        "status": "online",
        "mode": "full_ai" if FULL_AI_MODE else "light",
        "spacy_loaded": nlp is not None,
        "pdfplumber_loaded": pdfplumber is not None,
        "tesseract_loaded": pytesseract is not None
    }

@app.post("/api/coa/detect-company")
def detect_company(file: UploadFile = File(...)):
    """Detect company from COA PDF."""
    # Placeholder for company detection logic
    return {"company": "Unknown Labs LLC", "confidence": 0.85}

@app.post("/api/coa/auto-suggest", response_model=List[Suggestion])
async def auto_suggest(
    file: UploadFile = File(...),
    use_light_mode: bool = Form(False)
):
    """Extract text and suggest redactions based on rules and NER."""
    # In a real scenario, we would save the file and process it.
    # Here we simulate the extraction.
    
    # Simulate extracted text
    sample_text = "Contact us at info@example.com or 555-123-4567. Batch ID: BATCH-99821."
    
    suggestions = []
    
    # 1. Regex Rules (Always run)
    for match in EMAIL_RE.finditer(sample_text):
        suggestions.append(Suggestion(
            text=match.group(),
            label="EMAIL",
            reason="Matches email pattern",
            confidence=0.95
        ))
        
    for match in PHONE_RE.finditer(sample_text):
        suggestions.append(Suggestion(
            text=match.group(),
            label="PHONE",
            reason="Matches phone pattern",
            confidence=0.90
        ))
        
    for match in BATCH_RE.finditer(sample_text):
        suggestions.append(Suggestion(
            text=match.group(3),
            label="BATCH_ID",
            reason="Matches batch ID pattern",
            confidence=0.85
        ))

    # 2. Full AI Mode (spaCy NER)
    if FULL_AI_MODE and not use_light_mode:
        doc = nlp(sample_text)
        for ent in doc.ents:
            # Avoid duplicating regex hits
            if not any(s.text == ent.text for s in suggestions):
                suggestions.append(Suggestion(
                    text=ent.text,
                    label=ent.label_,
                    reason="Detected by NER model",
                    confidence=0.80
                ))
                
    return suggestions

@app.post("/api/redact/apply")
def apply_redactions(
    file: UploadFile = File(...),
    redactions: str = Form(...) # JSON string of RedactionRequest
):
    """Apply redactions to the PDF and return the redacted file."""
    try:
        redaction_data = json.loads(redactions)
        # Placeholder for PDF manipulation logic (e.g., using PyMuPDF)
        return {"status": "success", "message": f"Applied {len(redaction_data)} redactions.", "filename": f"{file.filename.split('.')[0]}_Redacted.pdf"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/templates/learn")
def learn_template(template: CompanyTemplate):
    """Save a template for future COA redactions."""
    # Placeholder for saving to SQLite/JSON
    return {"status": "success", "message": f"Learned template for {template.company_name}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
