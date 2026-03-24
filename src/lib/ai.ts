import { createWorker } from 'tesseract.js';
import type { Page, Word } from 'tesseract.js';

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
  ACCOUNT_NUMBER: /\b\d{8,12}\b/g,
};

export async function performLocalOCR(image: string): Promise<Page> {
  console.log('Starting Local OCR...');
  const worker = await createWorker('eng');
  try {
    const ret = await worker.recognize(image);
    console.log('OCR Result:', ret.data);
    return ret.data;
  } catch (error) {
    console.error('Tesseract Error:', error);
    throw error;
  } finally {
    await worker.terminate();
  }
}

export function detectPIILocal(text: string, words: Word[] = [], sensitivity: number = 0.5): LocalDetectionResult[] {
  const results: LocalDetectionResult[] = [];
  const wordsToUse = Array.isArray(words) ? words : [];

  // Add more patterns if sensitivity is high
  const activePatterns = { ...PII_PATTERNS };
  if (sensitivity > 0.7) {
    (activePatterns as any).GENERIC_ID = /\b[A-Z0-9]{6,12}\b/g;
  }

  for (const [label, pattern] of Object.entries(activePatterns)) {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      // Find words that overlap with this match
      let currentPos = 0;
      const matchedWords: Word[] = [];
      
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

export function detectSensitiveTermsLocal(text: string, words: Word[] = [], terms: string[], sensitivity: number = 0.5): LocalDetectionResult[] {
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
      const matchedWords: Word[] = [];
      
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

export async function detectAdvancedAI(text: string, rules?: any, companyProfile?: any): Promise<any[]> {
  // Offline implementation using regex and local logic
  const detections: any[] = [];
  
  // 1. Detect PII using local patterns
  for (const [label, pattern] of Object.entries(PII_PATTERNS)) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      detections.push({
        text: match[0],
        label: label,
        reason: `Matched local PII pattern for ${label}`
      });
    }
  }

  // 2. Detect sensitive terms from rules
  if (rules?.sensitiveTerms) {
    const terms = Array.isArray(rules.sensitiveTerms) ? rules.sensitiveTerms : rules.sensitiveTerms.split(',');
    for (const term of terms) {
      const cleanTerm = term.trim();
      if (!cleanTerm) continue;
      const regex = new RegExp(`\\b${cleanTerm}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        detections.push({
          text: match[0],
          label: 'SENSITIVE_TERM',
          reason: `Matched sensitive term: ${cleanTerm}`
        });
      }
    }
  }

  // 3. Detect company profile keywords
  if (companyProfile?.keywords) {
    const keywords = Array.isArray(companyProfile.keywords) ? companyProfile.keywords : companyProfile.keywords.split(',');
    for (const kw of keywords) {
      const cleanKw = kw.trim();
      if (!cleanKw) continue;
      const regex = new RegExp(`\\b${cleanKw}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        detections.push({
          text: match[0],
          label: 'COMPANY_KEYWORD',
          reason: `Matched company profile keyword: ${cleanKw}`
        });
      }
    }
  }

  return detections;
}

export async function trainModelFromFiles(originalText: string, redactedText?: string): Promise<{ companyName: string; suggestedRules: any; detectedRedactions: any[] }> {
  // Offline implementation for AI training
  const lines = originalText.split('\n').filter(l => l.trim());
  const companyName = lines[0] ? lines[0].substring(0, 50).trim() : 'Unknown Company';
  
  const suggestedRules = {
    name: `${companyName} Rules`,
    patterns: ['[A-Z]{2,}-\\d{4,}', '\\d{3}-\\d{2}-\\d{4}'],
    sensitiveTerms: ['Confidential', 'Internal', 'Proprietary'],
    description: `Automatically generated rules for ${companyName}`
  };

  const detectedRedactions: any[] = [];

  // If redactedText is provided, find differences
  if (redactedText) {
    // Simple diff logic: find words in original that are NOT in redacted
    const originalWords = originalText.split(/\s+/);
    const redactedWords = redactedText.split(/\s+/);
    const diff = originalWords.filter(w => !redactedWords.includes(w) && w.length > 3);
    
    // Deduplicate and add to suggestions
    const uniqueDiff = Array.from(new Set(diff));
    uniqueDiff.forEach(text => {
      detectedRedactions.push({
        text,
        label: 'LEARNED_REDACTION',
        reason: 'Identified as redacted in training sample'
      });
      if (!suggestedRules.sensitiveTerms.includes(text)) {
        suggestedRules.sensitiveTerms.push(text);
      }
    });
  }

  // Add some standard PII detections as suggestions
  for (const [label, pattern] of Object.entries(PII_PATTERNS)) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(originalText)) !== null) {
      detectedRedactions.push({
        text: match[0],
        label: label,
        reason: `Detected ${label} in training sample`
      });
    }
  }

  return {
    companyName,
    suggestedRules,
    detectedRedactions: detectedRedactions.slice(0, 20) // Limit results
  };
}

export async function unlockPDF(pdfBase64: string): Promise<string | null> {
  try {
    const response = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64 })
    });
    if (!response.ok) throw new Error('Unlock failed');
    const data = await response.json();
    return data.pdf;
  } catch (error) {
    console.error(error);
    return null;
  }
}

