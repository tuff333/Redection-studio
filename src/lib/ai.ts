import Tesseract from 'tesseract.js';

export interface LocalDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const PII_PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
  DATE: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
};

export async function performLocalOCR(image: string): Promise<Tesseract.Page> {
  const worker = await Tesseract.createWorker('eng');
  const ret = await worker.recognize(image);
  await worker.terminate();
  return ret.data;
}

export function detectPIILocal(text: string, words: Tesseract.Word[] = [], sensitivity: number = 0.5): LocalDetectionResult[] {
  const results: LocalDetectionResult[] = [];
  const wordsToUse = Array.isArray(words) ? words : [];

  // Add more patterns if sensitivity is high
  const activePatterns = { ...PII_PATTERNS };
  if (sensitivity > 0.7) {
    (activePatterns as any).GENERIC_ID = /\b[A-Z0-9]{6,12}\b/g;
  }

  for (const [label, pattern] of Object.entries(activePatterns)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      // Find words that overlap with this match
      let currentPos = 0;
      const matchedWords: Tesseract.Word[] = [];
      
      for (const word of wordsToUse) {
        const wordStart = currentPos;
        const wordEnd = currentPos + word.text.length;
        
        if (wordEnd > startIndex && wordStart < endIndex) {
          matchedWords.push(word);
        }
        currentPos = wordEnd + 1; // +1 for space
      }

      if (matchedWords.length > 0) {
        const minX = Math.min(...matchedWords.map(w => w.bbox.x0));
        const minY = Math.min(...matchedWords.map(w => w.bbox.y0));
        const maxX = Math.max(...matchedWords.map(w => w.bbox.x1));
        const maxY = Math.max(...matchedWords.map(w => w.bbox.y1));

        results.push({
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          label: label
        });
      }
    }
  }

  return results;
}

export function detectSensitiveTermsLocal(text: string, words: Tesseract.Word[] = [], terms: string[], sensitivity: number = 0.5): LocalDetectionResult[] {
  const results: LocalDetectionResult[] = [];
  const wordsToUse = Array.isArray(words) ? words : [];
  
  for (const term of terms) {
    if (!term.trim()) continue;
    // If sensitivity is high, use more relaxed regex (e.g. partial matches)
    const pattern = sensitivity > 0.8 
      ? new RegExp(`${term.trim()}`, 'gi') 
      : new RegExp(`\\b${term.trim()}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      let currentPos = 0;
      const matchedWords: Tesseract.Word[] = [];
      
      for (const word of wordsToUse) {
        const wordStart = currentPos;
        const wordEnd = currentPos + word.text.length;
        
        if (wordEnd > startIndex && wordStart < endIndex) {
          matchedWords.push(word);
        }
        currentPos = wordEnd + 1;
      }

      if (matchedWords.length > 0) {
        const minX = Math.min(...matchedWords.map(w => w.bbox.x0));
        const minY = Math.min(...matchedWords.map(w => w.bbox.y0));
        const maxX = Math.max(...matchedWords.map(w => w.bbox.x1));
        const maxY = Math.max(...matchedWords.map(w => w.bbox.y1));

        results.push({
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          label: 'SENSITIVE'
        });
      }
    }
  }

  return results;
}
