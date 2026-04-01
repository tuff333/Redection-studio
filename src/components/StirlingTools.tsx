import React from 'react';
import { motion } from 'motion/react';
import { 
  FileEdit, BookOpen, Eye, ShieldCheck, Lock, Droplets, Stamp, Eraser, Layers, Unlock, Shield, Info, 
  CheckCircle, Crop, RotateCw, Split, Layout, Maximize, Hash, Grid, Book, FilePlus, Paperclip, 
  Copy, Image as ImageIcon, Trash2, UserX, Key, Wand2, Play, Type, PenTool, Palette, Wrench, 
  Camera, Copy as CopyIcon, Replace, Zap, Code, Terminal, FolderSync, Users, WifiOff, FileText,
  FileCheck, RotateCcw, Database, Globe, FileSearch
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface Tool {
  name: string;
  icon: any;
  description: string;
  category: string;
}

export const TOOLS: Tool[] = [
  // Document Review
  { name: 'Change Metadata', icon: FileEdit, description: 'Edit PDF properties like title, author, and keywords.', category: 'Document Review' },
  { name: 'Edit Table of Contents', icon: BookOpen, description: 'Modify bookmarks and document structure.', category: 'Document Review' },
  { name: 'Read', icon: Eye, description: 'View and review document content.', category: 'Document Review' },
  { name: 'Sign with Certificate', icon: ShieldCheck, description: 'Apply digital signatures using certificates.', category: 'Document Review' },
  { name: 'Sign', icon: PenTool, description: 'Add hand-drawn or image signatures.', category: 'Document Review' },
  { name: 'Compare PDF', icon: CopyIcon, description: 'Show side-by-side comparison of two PDFs.', category: 'Document Review' },

  // Document Security
  { name: 'Compress PDF', icon: Maximize, description: 'Reduce PDF file size while optimizing for quality.', category: 'Document Security' },
  { name: 'Add Password', icon: Lock, description: 'Protect your PDF with a password.', category: 'Document Security' },
  { name: 'Remove Password', icon: Unlock, description: 'Decrypt and remove password protection.', category: 'Document Security' },
  { name: 'Add Watermark', icon: Droplets, description: 'Overlay text or images as watermarks.', category: 'Document Security' },
  { name: 'Add Stamp to PDF', icon: Stamp, description: 'Apply predefined or custom stamps.', category: 'Document Security' },
  { name: 'Sanitise', icon: Eraser, description: 'Remove hidden sensitive information.', category: 'Document Security' },
  { name: 'Flatten', icon: Layers, description: 'Merge form fields and annotations into the page.', category: 'Document Security' },
  { name: 'Unlock PDF Forms', icon: Unlock, description: 'Make restricted form fields editable.', category: 'Document Security' },
  { name: 'Change Permissions', icon: Shield, description: 'Restrict printing, copying, or editing.', category: 'Document Security' },
  { name: 'Auto-Redact', icon: ShieldCheck, description: 'Automatically detect and redact sensitive info.', category: 'Document Security' },

  // Verification
  { name: 'Get ALL Info on PDF', icon: Info, description: 'Detailed technical report of the PDF structure.', category: 'Verification' },
  { name: 'Validate PDF Signature', icon: CheckCircle, description: 'Verify the integrity of digital signatures.', category: 'Verification' },
  { name: 'PDF/A Validation', icon: FileCheck, description: 'Check if PDF complies with PDF/A standards.', category: 'Verification' },

  // Page Formatting
  { name: 'Merge PDF', icon: Layers, description: 'Combine multiple PDFs into one document.', category: 'Page Formatting' },
  { name: 'Split', icon: Split, description: 'Break a PDF into multiple smaller files.', category: 'Page Formatting' },
  { name: 'Rotate', icon: RotateCw, description: 'Rotate pages individually or in bulk.', category: 'Page Formatting' },
  { name: 'Crop PDF', icon: Crop, description: 'Adjust page margins and visible area.', category: 'Page Formatting' },
  { name: 'Reorganize Pages', icon: Layout, description: 'Drag and drop to reorder pages.', category: 'Page Formatting' },
  { name: 'Adjust page size/scale', icon: Maximize, description: 'Resize pages to standard formats like A4.', category: 'Page Formatting' },
  { name: 'Add Page Numbers', icon: Hash, description: 'Insert dynamic page numbering.', category: 'Page Formatting' },
  { name: 'Multi-Page Layout', icon: Grid, description: 'Print multiple pages on a single sheet.', category: 'Page Formatting' },
  { name: 'Booklet Imposition', icon: Book, description: 'Prepare pages for booklet printing.', category: 'Page Formatting' },
  { name: 'PDF to Single Large Page', icon: FilePlus, description: 'Combine all pages into one long canvas.', category: 'Page Formatting' },
  { name: 'Add Attachments', icon: Paperclip, description: 'Embed files directly into the PDF.', category: 'Page Formatting' },
  { name: 'Remove Blank Pages', icon: Eraser, description: 'Automatically detect and remove empty pages.', category: 'Page Formatting' },
  { name: 'Reverse PDF', icon: RotateCcw, description: 'Reverse the order of pages in a PDF.', category: 'Page Formatting' },

  // Extraction
  { name: 'PDF to Word', icon: FileText, description: 'Convert PDF documents to editable Word files.', category: 'Extraction' },
  { name: 'PDF to Excel', icon: Database, description: 'Extract tables from PDF to Excel spreadsheets.', category: 'Extraction' },
  { name: 'PDF to PowerPoint', icon: Play, description: 'Convert PDF to PPTX presentation slides.', category: 'Extraction' },
  { name: 'PDF to JPG', icon: ImageIcon, description: 'Convert each PDF page into a JPG image.', category: 'Extraction' },
  { name: 'PDF to PNG', icon: ImageIcon, description: 'Convert each PDF page into a PNG image.', category: 'Extraction' },
  { name: 'PDF to HTML', icon: Globe, description: 'Convert PDF documents to HTML webpages.', category: 'Extraction' },
  { name: 'PDF to XML', icon: Code, description: 'Extract data from PDF to XML format.', category: 'Extraction' },
  { name: 'Extract Pages', icon: Copy, description: 'Save specific pages as a new PDF.', category: 'Extraction' },
  { name: 'Extract Images', icon: ImageIcon, description: 'Pull all embedded images from the document.', category: 'Extraction' },
  { name: 'Extract Text', icon: Type, description: 'Extract all text content from the PDF.', category: 'Extraction' },

  // Removal
  { name: 'Remove Pages', icon: Trash2, description: 'Delete unwanted pages from the PDF.', category: 'Removal' },
  { name: 'Remove Annotations', icon: Eraser, description: 'Clear all comments and highlights.', category: 'Removal' },
  { name: 'Remove image', icon: ImageIcon, description: 'Strip images from the document.', category: 'Removal' },
  { name: 'Remove Certificate Sign', icon: UserX, description: 'Strip digital signatures from the file.', category: 'Removal' },
  { name: 'Remove JavaScript', icon: Code, description: 'Strip embedded JavaScript from the PDF.', category: 'Removal' },

  // Automation
  { name: 'Auto Rename PDF File', icon: Wand2, description: 'Rename based on content or metadata.', category: 'Automation' },
  { name: 'Automate', icon: Play, description: 'Run custom processing pipelines.', category: 'Automation' },
  { name: 'Folder Watcher', icon: FolderSync, description: 'Monitor folders for automatic processing.', category: 'Automation' },

  // General
  { name: 'Word to PDF', icon: FilePlus, description: 'Convert Word documents to PDF format.', category: 'General' },
  { name: 'Excel to PDF', icon: FilePlus, description: 'Convert Excel spreadsheets to PDF.', category: 'General' },
  { name: 'PowerPoint to PDF', icon: FilePlus, description: 'Convert presentations to PDF.', category: 'General' },
  { name: 'JPG to PDF', icon: ImageIcon, description: 'Convert JPG images to PDF documents.', category: 'General' },
  { name: 'HTML to PDF', icon: Globe, description: 'Convert webpages or HTML to PDF.', category: 'General' },
  { name: 'Add Text', icon: Type, description: 'Insert new text blocks into the PDF.', category: 'General' },
  { name: 'Add image', icon: ImageIcon, description: 'Place images onto PDF pages.', category: 'General' },
  { name: 'Annotate', icon: PenTool, description: 'Draw, highlight, and comment.', category: 'General' },
  { name: 'OCR PDF', icon: FileSearch, description: 'Make scanned PDFs searchable and editable.', category: 'General' },
  { name: 'Repair PDF', icon: Wrench, description: 'Fix corrupted or broken PDF files.', category: 'General' },

  // Advanced Formatting
  { name: 'Adjust Colours/Contrast', icon: Palette, description: 'Modify visual properties of the document.', category: 'Advanced Formatting' },
  { name: 'Detect & Split Scanned Photos', icon: Camera, description: 'Identify multiple photos on a single scan.', category: 'Advanced Formatting' },
  { name: 'Overlay PDFs', icon: CopyIcon, description: 'Merge two PDFs by overlaying pages.', category: 'Advanced Formatting' },
  { name: 'Replace & Invert Colour', icon: Replace, description: 'Invert colors or replace specific ones.', category: 'Advanced Formatting' },
  { name: 'Scanner Effect', icon: Zap, description: 'Make digital PDFs look like physical scans.', category: 'Advanced Formatting' },
  { name: 'Grayscale PDF', icon: Palette, description: 'Convert all colors in PDF to grayscale.', category: 'Advanced Formatting' },

  // Developer Tools
  { name: 'Show Javascript', icon: Code, description: 'View embedded JavaScript in the PDF.', category: 'Developer Tools' },
  { name: 'API', icon: Terminal, description: 'Access developer API documentation.', category: 'Developer Tools' },
  { name: 'SSO Guide', icon: Users, description: 'Integration guide for Single Sign-On.', category: 'Developer Tools' },
  { name: 'Air-gapped Setup', icon: WifiOff, description: 'Instructions for offline deployments.', category: 'Developer Tools' },
];

const CATEGORIES = Array.from(new Set(TOOLS.map(t => t.category)));

export function StirlingTools({ onToolClick }: { onToolClick: (tool: Tool) => void }) {
  return (
    <div className="space-y-16">
      {CATEGORIES.map((category) => (
        <div key={category} className="space-y-8">
          <div className="flex items-center gap-6">
            <h2 className="text-xs font-black text-neutral-400 uppercase tracking-[0.3em] font-mono">{category}</h2>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {TOOLS.filter(t => t.category === category).map((tool) => (
              <motion.button
                key={tool.name}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onToolClick(tool)}
                className="group flex flex-col items-start p-6 bg-white dark:bg-neutral-900 tech-border rounded-none text-left hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-none bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-5 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                  <tool.icon className="w-6 h-6 text-neutral-400 transition-colors" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-2 font-mono">{tool.name}</h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 uppercase tracking-tight">
                  {tool.description}
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
