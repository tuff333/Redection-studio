export interface RedactionBox {
  id: string;
  pageIndex: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
  text?: string;
  label?: string;
  type: 'text' | 'box' | 'auto' | 'highlight';
  path?: string; // For freeform shapes (SVG path data in percentages)
  isSelected: boolean;
}

export interface OCRResult {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
}

export interface PDFFile {
  id: string;
  file: File;
  name: string;
  url: string;
  numPages: number;
  redactions: RedactionBox[];
  status: 'idle' | 'processing' | 'ready' | 'redacted';
  metadata?: PDFMetadata;
}

export type Theme = 'light' | 'dark' | 'system' | 'custom';

export type ToolbarToolId = 'selection' | 'history' | 'view' | 'ai' | 'action';

export interface ToolbarToolConfig {
  id: ToolbarToolId;
  visible: boolean;
  label: string;
}

export interface AppSettings {
  theme: Theme;
  redactionColor: string;
  toolbar: ToolbarToolConfig[];
  fileNamePattern: string;
  shortcuts: {
    undo: string;
    redo: string;
    search: string;
    nextPage: string;
    prevPage: string;
    textTool: string;
    boxTool: string;
    highlightTool: string;
  };
}
