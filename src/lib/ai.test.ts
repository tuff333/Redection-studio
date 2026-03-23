import { describe, it, expect, vi } from 'vitest';
import { detectPIILocal, detectSensitiveTermsLocal } from '../lib/ai';

describe('AI Detection Logic', () => {
  it('should detect email PII', () => {
    const text = 'Contact me at test@example.com';
    const words = [
      { text: 'Contact', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
      { text: 'me', bbox: { x0: 60, y0: 0, x1: 80, y1: 20 } },
      { text: 'at', bbox: { x0: 90, y0: 0, x1: 110, y1: 20 } },
      { text: 'test@example.com', bbox: { x0: 120, y0: 0, x1: 250, y1: 20 } },
    ] as any;
    
    const results = detectPIILocal(text, words);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe('EMAIL');
  });

  it('should detect sensitive terms', () => {
    const text = 'This is a Confidential document';
    const words = [
      { text: 'This', bbox: { x0: 0, y0: 0, x1: 40, y1: 20 } },
      { text: 'is', bbox: { x0: 50, y0: 0, x1: 70, y1: 20 } },
      { text: 'a', bbox: { x0: 80, y0: 0, x1: 90, y1: 20 } },
      { text: 'Confidential', bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: 'document', bbox: { x0: 210, y0: 0, x1: 300, y1: 20 } },
    ] as any;
    
    const results = detectSensitiveTermsLocal(text, words, ['Confidential']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe('SENSITIVE');
  });
});
