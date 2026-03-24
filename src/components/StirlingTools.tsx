import React from 'react';
import { motion } from 'motion/react';
import { 
  FileEdit, BookOpen, Eye, ShieldCheck, Lock, Droplets, Stamp, Eraser, Layers, Unlock, Shield, Info, 
  CheckCircle, Crop, RotateCw, Split, Layout, Maximize, Hash, Grid, Book, FilePlus, Paperclip, 
  Copy, Image as ImageIcon, Trash2, UserX, Key, Wand2, Play, Type, PenTool, Palette, Wrench, 
  Camera, Copy as CopyIcon, Replace, Zap, Code, Terminal, FolderSync, Users, WifiOff
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Tool {
  name: string;
  icon: any;
  description: string;
  category: string;
}

const TOOLS: Tool[] = [
  // Document Review
  { name: 'Change Metadata', icon: FileEdit, description: 'Edit PDF properties like title, author, and keywords.', category: 'Document Review' },
  { name: 'Edit Table of Contents', icon: BookOpen, description: 'Modify bookmarks and document structure.', category: 'Document Review' },
  { name: 'Read', icon: Eye, description: 'View and review document content.', category: 'Document Review' },
  { name: 'Sign with Certificate', icon: ShieldCheck, description: 'Apply digital signatures using certificates.', category: 'Document Review' },
  { name: 'Sign', icon: PenTool, description: 'Add hand-drawn or image signatures.', category: 'Document Review' },

  // Document Security
  { name: 'Add Password', icon: Lock, description: 'Protect your PDF with a password.', category: 'Document Security' },
  { name: 'Add Watermark', icon: Droplets, description: 'Overlay text or images as watermarks.', category: 'Document Security' },
  { name: 'Add Stamp to PDF', icon: Stamp, description: 'Apply predefined or custom stamps.', category: 'Document Security' },
  { name: 'Sanitise', icon: Eraser, description: 'Remove hidden sensitive information.', category: 'Document Security' },
  { name: 'Flatten', icon: Layers, description: 'Merge form fields and annotations into the page.', category: 'Document Security' },
  { name: 'Unlock PDF Forms', icon: Unlock, description: 'Make restricted form fields editable.', category: 'Document Security' },
  { name: 'Change Permissions', icon: Shield, description: 'Restrict printing, copying, or editing.', category: 'Document Security' },

  // Verification
  { name: 'Get ALL Info on PDF', icon: Info, description: 'Detailed technical report of the PDF structure.', category: 'Verification' },
  { name: 'Validate PDF Signature', icon: CheckCircle, description: 'Verify the integrity of digital signatures.', category: 'Verification' },

  // Page Formatting
  { name: 'Crop PDF', icon: Crop, description: 'Adjust page margins and visible area.', category: 'Page Formatting' },
  { name: 'Rotate', icon: RotateCw, description: 'Rotate pages individually or in bulk.', category: 'Page Formatting' },
  { name: 'Split', icon: Split, description: 'Break a PDF into multiple smaller files.', category: 'Page Formatting' },
  { name: 'Reorganize Pages', icon: Layout, description: 'Drag and drop to reorder pages.', category: 'Page Formatting' },
  { name: 'Adjust page size/scale', icon: Maximize, description: 'Resize pages to standard formats like A4.', category: 'Page Formatting' },
  { name: 'Add Page Numbers', icon: Hash, description: 'Insert dynamic page numbering.', category: 'Page Formatting' },
  { name: 'Multi-Page Layout', icon: Grid, description: 'Print multiple pages on a single sheet.', category: 'Page Formatting' },
  { name: 'Booklet Imposition', icon: Book, description: 'Prepare pages for booklet printing.', category: 'Page Formatting' },
  { name: 'PDF to Single Large Page', icon: FilePlus, description: 'Combine all pages into one long canvas.', category: 'Page Formatting' },
  { name: 'Add Attachments', icon: Paperclip, description: 'Embed files directly into the PDF.', category: 'Page Formatting' },

  // Extraction
  { name: 'Extract Pages', icon: Copy, description: 'Save specific pages as a new PDF.', category: 'Extraction' },
  { name: 'Extract Images', icon: ImageIcon, description: 'Pull all embedded images from the document.', category: 'Extraction' },

  // Removal
  { name: 'Remove Pages', icon: Trash2, description: 'Delete unwanted pages from the PDF.', category: 'Removal' },
  { name: 'Remove Blank pages', icon: Eraser, description: 'Automatically detect and remove empty pages.', category: 'Removal' },
  { name: 'Remove Annotations', icon: Eraser, description: 'Clear all comments and highlights.', category: 'Removal' },
  { name: 'Remove image', icon: ImageIcon, description: 'Strip images from the document.', category: 'Removal' },
  { name: 'Remove Password', icon: Key, description: 'Decrypt and remove password protection.', category: 'Removal' },
  { name: 'Remove Certificate Sign', icon: UserX, description: 'Strip digital signatures from the file.', category: 'Removal' },

  // Automation
  { name: 'Auto Rename PDF File', icon: Wand2, description: 'Rename based on content or metadata.', category: 'Automation' },
  { name: 'Automate', icon: Play, description: 'Run custom processing pipelines.', category: 'Automation' },

  // General
  { name: 'Add Text', icon: Type, description: 'Insert new text blocks into the PDF.', category: 'General' },
  { name: 'Add image', icon: ImageIcon, description: 'Place images onto PDF pages.', category: 'General' },
  { name: 'Annotate', icon: PenTool, description: 'Draw, highlight, and comment.', category: 'General' },

  // Advanced Formatting
  { name: 'Adjust Colours/Contrast', icon: Palette, description: 'Modify visual properties of the document.', category: 'Advanced Formatting' },
  { name: 'Repair', icon: Wrench, description: 'Fix corrupted or broken PDF files.', category: 'Advanced Formatting' },
  { name: 'Detect & Split Scanned Photos', icon: Camera, description: 'Identify multiple photos on a single scan.', category: 'Advanced Formatting' },
  { name: 'Overlay PDFs', icon: CopyIcon, description: 'Merge two PDFs by overlaying pages.', category: 'Advanced Formatting' },
  { name: 'Replace & Invert Colour', icon: Replace, description: 'Invert colors or replace specific ones.', category: 'Advanced Formatting' },
  { name: 'Scanner Effect', icon: Zap, description: 'Make digital PDFs look like physical scans.', category: 'Advanced Formatting' },

  // Developer Tools
  { name: 'Show Javascript', icon: Code, description: 'View embedded JavaScript in the PDF.', category: 'Developer Tools' },
  { name: 'API', icon: Terminal, description: 'Access developer API documentation.', category: 'Developer Tools' },
  { name: 'Automated Folder Scanning', icon: FolderSync, description: 'Watch folders for automatic processing.', category: 'Developer Tools' },
  { name: 'SSO Guide', icon: Users, description: 'Integration guide for Single Sign-On.', category: 'Developer Tools' },
  { name: 'Air-gapped Setup', icon: WifiOff, description: 'Instructions for offline deployments.', category: 'Developer Tools' },
];

const CATEGORIES = Array.from(new Set(TOOLS.map(t => t.category)));

export function StirlingTools({ onToolClick }: { onToolClick: (tool: Tool) => void }) {
  return (
    <div className="space-y-12">
      {CATEGORIES.map((category) => (
        <div key={category} className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black tracking-tight uppercase">{category}</h2>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {TOOLS.filter(t => t.category === category).map((tool) => (
              <motion.button
                key={tool.name}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onToolClick(tool)}
                className="group flex flex-col items-start p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl text-left hover:shadow-xl transition-all duration-300 hover:border-black dark:hover:border-white"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4 group-hover:bg-black dark:group-hover:bg-white transition-colors">
                  <tool.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400 group-hover:text-white dark:group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-sm font-black tracking-tight mb-1 group-hover:text-black dark:group-hover:text-white">{tool.name}</h3>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed line-clamp-2">
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
