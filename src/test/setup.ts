import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking some browser APIs that might be missing in jsdom
global.URL.createObjectURL = vi.fn();
global.URL.revokeObjectURL = vi.fn();

// Mocking PDF.js
vi.mock('react-pdf', () => ({
  Document: ({ children }: any) => children,
  Page: () => null,
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    version: '1.0.0',
  },
}));

// Mocking pdf-lib
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(),
    create: vi.fn(),
  },
  rgb: vi.fn(),
}));

// Mocking tesseract.js
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}));
