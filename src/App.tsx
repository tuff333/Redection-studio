import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, Settings, Layers, 
  Download, Trash2, CheckCircle2, AlertCircle,
  Undo, Redo, Search, ChevronLeft, ChevronRight, Zap,
  Type as TypeIcon, Square, Highlighter, Sun, Moon,
  Monitor, Palette, Keyboard, X, Plus, Play, RefreshCw,
  Barcode, QrCode, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Bookmark, Brain, MousePointer2, Move
} from 'lucide-react';
import { PDFFile, RedactionBox, AppSettings, Theme, OCRResult, BatchRuleSet, RedactionStyle, CompanyRule, TrainingSession } from './types';
import { cn, formatFileName } from './lib/utils';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Tooltip } from './components/Tooltip';
import { GoogleGenAI, Type } from "@google/genai";
import { performLocalOCR, detectPIILocal, detectSensitiveTermsLocal } from './lib/ai';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  redactionColor: '#000000',
  redactionStyle: 'solid',
  toolbar: [
    { id: 'selection', visible: true, label: 'Selection Tools' },
    { id: 'history', visible: true, label: 'Undo/Redo' },
    { id: 'view', visible: true, label: 'Zoom & Navigation' },
    { id: 'ai', visible: true, label: 'AI Detection' },
    { id: 'action', visible: true, label: 'Apply & Save' },
  ],
  fileNamePattern: '{name}_redacted',
  savedBatchRules: [],
  companyRules: [],
  aiDefaults: {
    piiEnabled: true,
    barcodesEnabled: true,
    companyDataEnabled: true,
  },
  companyProfile: {
    name: '',
    contactDetails: '',
    content: '',
  },
  searchHistory: [
    'Confidential', 'Internal', 'Draft', 'Proprietary', 'Private', 
    'Sensitive', 'Restricted', 'Classified', 'Top Secret', 'Eyes Only'
  ],
  customTheme: {
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    accentColor: '#ef4444',
    fontFamily: 'Inter',
    canvasBgColor: '#f5f5f5'
  },
  shortcuts: {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    search: 'Ctrl+F',
    nextPage: 'ArrowRight',
    prevPage: 'ArrowLeft',
    textTool: 't',
    boxTool: 'b',
    highlightTool: 'h',
  }
};

export default function App() {
  const [view, setView] = useState<'home' | 'editor' | 'batch' | 'settings' | 'training'>('home');
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('redactio-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          shortcuts: {
            ...DEFAULT_SETTINGS.shortcuts,
            ...(parsed.shortcuts || {})
          }
        };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [alerts, setAlerts] = useState<{ id: string; type: 'success' | 'info' | 'warning' | 'error'; message: string }[]>([]);

  const addAlert = (type: 'success' | 'info' | 'warning' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(7);
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  useEffect(() => {
    localStorage.setItem('redactio-settings', JSON.stringify(settings));
    
    const updateTheme = () => {
      let isDark = settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (settings.theme === 'custom' && settings.customTheme) {
        const { primaryColor, secondaryColor, accentColor, fontFamily } = settings.customTheme;
        document.documentElement.style.setProperty('--primary', primaryColor);
        document.documentElement.style.setProperty('--secondary', secondaryColor);
        document.documentElement.style.setProperty('--accent', accentColor);
        if (fontFamily) {
          document.documentElement.style.setProperty('--font-family', fontFamily);
        }
        
        const checkIsDark = (color: string) => {
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          return brightness < 128;
        };
        
        isDark = checkIsDark(primaryColor);
        document.documentElement.style.setProperty('--text-primary', isDark ? '#ffffff' : '#000000');
        document.documentElement.style.setProperty('--bg-color', primaryColor);
      } else {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--secondary');
        document.documentElement.style.removeProperty('--accent');
        document.documentElement.style.removeProperty('--font-family');
        document.documentElement.style.removeProperty('--text-primary');
        document.documentElement.style.removeProperty('--bg-color');
      }

      document.documentElement.classList.toggle('dark', isDark);
    };

    updateTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = (Array.from(e.target.files) as File[]).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      numPages: 0,
      redactions: [],
      status: 'idle' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length === 1) {
      setActiveFileId(newFiles[0].id);
      setView('editor');
    } else if (newFiles.length > 1) {
      setView('batch');
    }
  };

  const activeFile = files.find(f => f.id === activeFileId);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
            <Layers className="text-white dark:text-black w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight leading-none">Redactio</span>
            <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-widest mt-1">Developed by Rasesh</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip title="AI Training Lab" description="Train the AI with original and redacted documents." side="bottom">
            <button 
              onClick={() => setView('training')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                view === 'training' ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
              )}
            >
              <Brain className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip title="Batch Processing" description="Process multiple documents at once using AI." side="bottom">
            <button 
              onClick={() => setView('batch')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                view === 'batch' ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
              )}
            >
              <Play className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip title="Settings" description="Configure application theme, shortcuts, and toolbar." side="bottom">
            <button 
              onClick={() => setView('settings')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                view === 'settings' ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <h1 className="text-5xl font-bold mb-6 tracking-tight">
                Professional PDF Redaction
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-2xl mb-12 text-lg">
                Securely redact sensitive information from COA documents using AI-powered detection. 
                Batch process multiple files and customize your workflow.
              </p>

              <label className="group relative flex flex-col items-center justify-center w-full max-w-xl h-64 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-3xl cursor-pointer hover:border-black dark:hover:border-white transition-all duration-300 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-xl">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-neutral-500" />
                  </div>
                  <p className="mb-2 text-lg font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-neutral-500">PDF files only (max. 50MB)</p>
                </div>
                <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFileUpload} />
              </label>
            </motion.div>
          )}

          {view === 'editor' && activeFile && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <EditorView 
                file={activeFile} 
                settings={settings} 
                setSettings={setSettings}
                onBack={() => setView('home')} 
                addAlert={addAlert}
                setFiles={setFiles}
              />
            </motion.div>
          )}

          {view === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <BatchView 
                files={files} 
                setFiles={setFiles} 
                settings={settings} 
                setSettings={setSettings}
                addAlert={addAlert} 
              />
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SettingsView 
                settings={settings} 
                setSettings={setSettings} 
                onBack={() => setView(activeFileId ? 'editor' : 'home')} 
                activeFile={activeFile}
                setFiles={setFiles}
              />
            </motion.div>
          )}

          {view === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <TrainingView 
                settings={settings} 
                setSettings={setSettings} 
                addAlert={addAlert}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Alert System */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[300px]",
                alert.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400",
                alert.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-400",
                alert.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400",
                alert.type === 'error' && "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400"
              )}
            >
              {alert.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {alert.type === 'info' && <AlertCircle className="w-5 h-5" />}
              {alert.type === 'warning' && <AlertCircle className="w-5 h-5" />}
              {alert.type === 'error' && <AlertCircle className="w-5 h-5" />}
              <span className="flex-1 font-medium">{alert.message}</span>
              <button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}>
                <X className="w-4 h-4 opacity-50 hover:opacity-100" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EditorView({ file, settings, setSettings, onBack, addAlert, setFiles }: { 
  file: PDFFile; 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  addAlert: (type: any, msg: string) => void;
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [tool, setTool] = useState<'selection' | 'text' | 'box' | 'highlight'>('box');
  const [redactions, setRedactions] = useState<RedactionBox[]>(file.redactions);
  const [history, setHistory] = useState<RedactionBox[][]>([file.redactions]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [ocrResults, setOcrResults] = useState<Record<number, OCRResult[]>>({});
  const [isOCRing, setIsOCRing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [tempHighlights, setTempHighlights] = useState<{ x: number; y: number; width: number; height: number; pageIndex: number }[]>([]);
  const [commentModal, setCommentModal] = useState<{ isOpen: boolean, redactionId: string, comment: string }>({ isOpen: false, redactionId: '', comment: '' });
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [showConfirmApply, setShowConfirmApply] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<{
    type: 'drag' | 'resize';
    redactionId: string;
    handle?: string;
    initialMouse: { x: number; y: number };
    initialRect: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const addToHistory = (newRedactions: RedactionBox[]) => {
    const nextHistory = [...history.slice(0, historyIndex + 1), newRedactions].slice(-50);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setRedactions(history[prevIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setRedactions(history[nextIndex]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const redactionId = e.dataTransfer.getData('redactionId');
    if (!redactionId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    // Calculate drop position as percentages
    const dropX = ((e.clientX - rect.left) / rect.width) * 100;
    const dropY = ((e.clientY - rect.top) / rect.height) * 100;

    const updated = redactions.map(r => {
      if (r.id === redactionId) {
        return {
          ...r,
          x: dropX - (r.width / 2),
          y: dropY - (r.height / 2),
          pageIndex: pageNumber - 1
        };
      }
      return r;
    });

    setRedactions(updated);
    addToHistory(updated);
    addAlert('success', 'Redaction repositioned');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (tool === 'selection') {
      // Check if we clicked a handle or a redaction
      // This is handled by the elements themselves via stopPropagation
      // But we need a fallback for drag-selection box
      setDrawStart({ x, y });
      setIsDrawing(true);
      return;
    }

    if (tool === 'highlight') {
      setCurrentPath([{ x, y }]);
    } else {
      setDrawStart({ x, y });
    }
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeInteraction) {
      const dx = x - activeInteraction.initialMouse.x;
      const dy = y - activeInteraction.initialMouse.y;

      const updated = redactions.map(r => {
        if (r.id === activeInteraction.redactionId) {
          if (activeInteraction.type === 'drag') {
            return {
              ...r,
              x: activeInteraction.initialRect.x + dx,
              y: activeInteraction.initialRect.y + dy
            };
          } else if (activeInteraction.type === 'resize' && activeInteraction.handle) {
            let { x: rx, y: ry, width: rw, height: rh } = activeInteraction.initialRect;
            const h = activeInteraction.handle;

            if (h.includes('e')) rw += dx;
            if (h.includes('w')) { rx += dx; rw -= dx; }
            if (h.includes('s')) rh += dy;
            if (h.includes('n')) { ry += dy; rh -= dy; }

            return { ...r, x: rx, y: ry, width: Math.max(1, rw), height: Math.max(1, rh) };
          }
        }
        return r;
      });
      setRedactions(updated);
      return;
    }

    if (!isDrawing) return;
    
    if (tool === 'highlight') {
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (drawStart) {
      setCurrentBox({
        x: Math.min(x, drawStart.x),
        y: Math.min(y, drawStart.y),
        width: Math.abs(x - drawStart.x),
        height: Math.abs(y - drawStart.y),
      });
    }
  };

  const handleMouseUp = () => {
    if (activeInteraction) {
      addToHistory(redactions);
      setActiveInteraction(null);
      return;
    }

    if (isDrawing) {
      if (tool === 'selection' && currentBox) {
        const updated = redactions.map(r => {
          if (r.pageIndex === pageNumber - 1) {
            const isInside = 
              r.x >= currentBox.x && 
              r.y >= currentBox.y && 
              r.x + r.width <= currentBox.x + currentBox.width && 
              r.y + r.height <= currentBox.y + currentBox.height;
            if (isInside) return { ...r, isSelected: true };
          }
          return r;
        });
        setRedactions(updated);
        addToHistory(updated);
      } else if (tool === 'highlight' && currentPath.length > 1) {
        const xs = currentPath.map(p => p.x);
        const ys = currentPath.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const pathData = currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        
        const newRedaction: RedactionBox = {
          id: Math.random().toString(36).substring(7),
          pageIndex: pageNumber - 1,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          type: 'highlight',
          path: pathData,
          isSelected: true,
          label: 'Freeform Highlight'
        };
        const updatedRedactions = [...redactions, newRedaction];
        setRedactions(updatedRedactions);
        addToHistory(updatedRedactions);
      } else if (currentBox && currentBox.width > 1 && currentBox.height > 1) {
        const newRedaction: RedactionBox = {
          id: Math.random().toString(36).substring(7),
          pageIndex: pageNumber - 1,
          ...currentBox,
          type: tool === 'text' ? 'text' : 'box',
          isSelected: true,
          label: tool === 'text' ? 'Text Redaction' : 'Box Redaction'
        };
        const updatedRedactions = [...redactions, newRedaction];
        setRedactions(updatedRedactions);
        addToHistory(updatedRedactions);
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentBox(null);
    setCurrentPath([]);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'ArrowRight') setPageNumber(p => Math.min(numPages, p + 1));
      if (e.key === 'ArrowLeft') setPageNumber(p => Math.max(1, p - 1));
      if (e.key === 't') setTool('text');
      if (e.key === 'b') setTool('box');
      if (e.key === 'h') setTool('highlight');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, historyIndex, history]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const commonSuggestions = [
    'Name', 'Email', 'Phone', 'SSN', 'Address', 'Credit Card', 'Date of Birth', 
    'Password', 'API Key', 'Secret', 'Confidential', 'Internal Only', 
    'Draft', 'Proprietary', 'Trade Secret', 'Financial Data', 'Medical Record',
    'Customer ID', 'Account Number', 'IBAN', 'Passport Number', 'Driver License'
  ];
  const allSuggestions = Array.from(new Set([...commonSuggestions, ...(settings.searchHistory || [])]));
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [useRegex, setUseRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isFuzzyMatch, setIsFuzzyMatch] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [password, setPassword] = useState<string>('');
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    setPdf(pdf);

    try {
      const metadata = await pdf.getMetadata();
      const info = metadata.info;
      const pdfMetadata = {
        title: info.Title || '',
        author: info.Author || '',
        subject: info.Subject || '',
        keywords: info.Keywords || '',
        creator: info.Creator || '',
        producer: info.Producer || '',
      };
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, metadata: pdfMetadata } : f
      ));
    } catch (e) {
      console.error('Error loading metadata:', e);
    }
  };

  const handleSearchAndRedact = async () => {
    if (!pdf || !searchQuery) return;
    setIsSearching(true);
    setSearchProgress(0);
    addAlert('info', `Searching for "${searchQuery}"...`);
    
    try {
      const newRedactions: RedactionBox[] = [];
      let regex: RegExp | null = null;
      
      if (useRegex) {
        try {
          regex = new RegExp(searchQuery, isCaseSensitive ? 'g' : 'gi');
        } catch (e) {
          addAlert('error', 'Invalid regular expression.');
          setIsSearching(false);
          return;
        }
      }

      const checkMatch = (text: string) => {
        if (useRegex && regex) return regex.test(text);
        
        const source = isCaseSensitive ? text : text.toLowerCase();
        const target = isCaseSensitive ? searchQuery : searchQuery.toLowerCase();
        
        if (isFuzzyMatch) {
          let i = 0;
          for (const char of source) {
            if (char === target[i]) i++;
            if (i === target.length) return true;
          }
          return false;
        }
        
        return source.includes(target);
      };

      for (let i = 1; i <= numPages; i++) {
        setSearchProgress(Math.round((i / numPages) * 100));
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        
        textContent.items.forEach((item: any) => {
          if (checkMatch(item.str)) {
            const [scaleX, , , scaleY, tx, ty] = item.transform;
            
            const x = (tx / viewport.width) * 100;
            const y = 100 - ((ty + (item.height || scaleY)) / viewport.height) * 100;
            const width = (item.width / viewport.width) * 100;
            const height = ((item.height || scaleY) / viewport.height) * 100;

            newRedactions.push({
              id: Math.random().toString(36).substring(7),
              pageIndex: i - 1,
              x,
              y,
              width,
              height,
              text: item.str,
              label: 'Text Match',
              type: 'text',
              isSelected: true,
            });
          }
        });

        // Search in OCR results
        const pageOCR = ocrResults[i - 1] || [];
        pageOCR.forEach(item => {
          if (checkMatch(item.text)) {
            newRedactions.push({
              id: Math.random().toString(36).substring(7),
              pageIndex: i - 1,
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              text: item.text,
              label: 'OCR Match',
              type: 'text',
              isSelected: true,
            });
          }
        });
      }
      
      if (newRedactions.length > 0) {
        setTempHighlights(newRedactions.map(r => ({ 
          x: r.x, 
          y: r.y, 
          width: r.width, 
          height: r.height, 
          pageIndex: r.pageIndex 
        })));
        
        setTimeout(() => {
          setTempHighlights([]);
          const updatedRedactions = [...redactions, ...newRedactions];
          setRedactions(updatedRedactions);
          addToHistory(updatedRedactions);
          addAlert('success', `Found and redacted ${newRedactions.length} occurrences.`);
        }, 1000);
      } else {
        addAlert('warning', `No matches found for "${searchQuery}". Try adjusting your search settings.`);
      }
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to search document.');
    } finally {
      setIsSearching(false);
      setSearchProgress(0);
    }
  };

  const clearSearchMatches = () => {
    setTempHighlights([]);
    setSearchQuery('');
    setRedactions(prev => prev.filter(r => r.type !== 'text' || !r.label?.includes('Search')));
    addAlert('info', 'Search matches cleared');
  };

  const triggerOCR = async () => {
    if (!pdf) return;
    setOcrStatus('loading');
    addAlert('info', `Running OCR on Page ${pageNumber}...`);
    
    try {
      // Simulate OCR process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results for demonstration
      const mockResults: OCRResult[] = [
        { text: "CONFIDENTIAL", x: 10, y: 10, width: 20, height: 5 },
        { text: "SSN: 000-00-0000", x: 10, y: 20, width: 30, height: 5 },
      ];
      
      setOcrResults(prev => ({ ...prev, [pageNumber - 1]: mockResults }));
      setOcrStatus('success');
      addAlert('success', `OCR complete for Page ${pageNumber}. Found ${mockResults.length} items.`);
    } catch (error) {
      setOcrStatus('error');
      addAlert('error', 'OCR failed.');
    }
  };

  const onDocumentLoadError = (error: Error) => {
    if (error.message.includes('password')) {
      setIsPasswordRequired(true);
      addAlert('warning', 'This PDF is password protected.');
    } else {
      addAlert('error', 'Failed to load PDF.');
    }
  };

  useEffect(() => {
    setFiles(prev => prev.map(f => 
      f.id === file.id ? { ...f, redactions } : f
    ));
    
    // Save session state to localStorage
    const sessionKey = `redactio-session-${file.id}`;
    localStorage.setItem(sessionKey, JSON.stringify({
      redactions,
      historyIndex,
      history
    }));
  }, [redactions, historyIndex, history, file.id, setFiles]);

  useEffect(() => {
    // Load session state if exists
    const sessionKey = `redactio-session-${file.id}`;
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.redactions) setRedactions(parsed.redactions);
        if (parsed.history) setHistory(parsed.history);
        if (parsed.historyIndex !== undefined) setHistoryIndex(parsed.historyIndex);
      } catch (e) {
        console.error('Failed to load session:', e);
      }
    }
  }, [file.id]);

  const handleZoomIn = () => setScale(s => Math.min(3, s + 0.1));
  const handleZoomOut = () => setScale(s => Math.max(0.5, s - 0.1));

  const pdfOptions = React.useMemo(() => ({
    password,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }), [password]);

  const handleAutoDetect = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for scanning.');
      return;
    }
    setIsProcessing(true);
    addAlert('info', 'Local AI is scanning the document for sensitive fields...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      // 1. Perform Local OCR
      const ocrData = await performLocalOCR(imageData) as any;
      const text = ocrData.text;
      const words = ocrData.words;

      // 2. Company Identification (Local)
      let matchedRule: CompanyRule | null = null;
      if (settings.companyRules?.length > 0) {
        for (const rule of settings.companyRules) {
          const identifiers = rule.identifiers || [];
          if (identifiers.some(id => text.toLowerCase().includes(id.toLowerCase()))) {
            matchedRule = rule;
            break;
          }
        }
        if (matchedRule) {
          addAlert('info', `Detected Company: ${matchedRule.name}. Applying learned patterns...`);
        }
      }
      
      const newAutoRedactions: RedactionBox[] = [];

      // 3. Apply Learned Coordinates
      if (matchedRule?.learnedCoordinates) {
        matchedRule.learnedCoordinates
          .filter(c => c.pageIndex === pageNumber - 1)
          .forEach((coord, index) => {
            newAutoRedactions.push({
              id: `learned-${Date.now()}-${index}`,
              pageIndex: pageNumber - 1,
              x: coord.x,
              y: coord.y,
              width: coord.width,
              height: coord.height,
              label: coord.label || 'Learned Area',
              type: 'auto',
              isSelected: true
            });
          });
      }

      // 4. Local PII Detection
      if (settings.aiDefaults?.piiEnabled) {
        const piiResults = detectPIILocal(text, words, settings.aiDefaults.sensitivity);
        piiResults.forEach((res, index) => {
          newAutoRedactions.push({
            id: `pii-${Date.now()}-${index}`,
            pageIndex: pageNumber - 1,
            x: (res.x / canvas.width) * 100,
            y: (res.y / canvas.height) * 100,
            width: (res.width / canvas.width) * 100,
            height: (res.height / canvas.height) * 100,
            label: res.label,
            type: 'auto',
            isSelected: true
          });
        });
      }

      // 5. Local Sensitive Terms & Regex Patterns Detection
      const termsToSearch = [...(matchedRule?.sensitiveTerms || [])];
      const patternsToSearch = [...(matchedRule?.patterns || [])];
      
      if (settings.aiDefaults?.companyDataEnabled && (termsToSearch.length > 0 || patternsToSearch.length > 0)) {
        const termResults = detectSensitiveTermsLocal(text, words, termsToSearch, settings.aiDefaults.sensitivity);
        termResults.forEach((res, index) => {
          newAutoRedactions.push({
            id: `term-${Date.now()}-${index}`,
            pageIndex: pageNumber - 1,
            x: (res.x / canvas.width) * 100,
            y: (res.y / canvas.height) * 100,
            width: (res.width / canvas.width) * 100,
            height: (res.height / canvas.height) * 100,
            label: 'SENSITIVE TERM',
            type: 'auto',
            isSelected: true
          });
        });

        // Regex Pattern Matching
        patternsToSearch.forEach((pattern, pIndex) => {
          try {
            const regex = new RegExp(pattern, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
              const matchedText = match[0];
              const matchIndex = match.index;
              
              // Find coordinates for this match (approximate by matching words)
              const matchedWords = words.filter((w: any) => matchedText.includes(w.text));
              if (matchedWords.length > 0) {
                const minX = Math.min(...matchedWords.map((w: any) => w.bbox.x0));
                const minY = Math.min(...matchedWords.map((w: any) => w.bbox.y0));
                const maxX = Math.max(...matchedWords.map((w: any) => w.bbox.x1));
                const maxY = Math.max(...matchedWords.map((w: any) => w.bbox.y1));

                newAutoRedactions.push({
                  id: `regex-${Date.now()}-${pIndex}-${matchIndex}`,
                  pageIndex: pageNumber - 1,
                  x: (minX / canvas.width) * 100,
                  y: (minY / canvas.height) * 100,
                  width: ((maxX - minX) / canvas.width) * 100,
                  height: ((maxY - minY) / canvas.height) * 100,
                  label: 'REGEX MATCH',
                  type: 'auto',
                  isSelected: true
                });
              }
            }
          } catch (e) {
            console.error('Invalid regex:', pattern);
          }
        });
      }

      const updatedRedactions = [...redactions, ...newAutoRedactions];
      setRedactions(updatedRedactions);
      addToHistory(updatedRedactions);
      setIsProcessing(false);
      addAlert('success', `Local detection complete! Found ${newAutoRedactions.length} sensitive areas.`);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      addAlert('error', 'Local detection failed.');
    }
  };

  const handleOCR = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for OCR.');
      return;
    }
    setIsOCRing(true);
    addAlert('info', 'Performing Local OCR on current page...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      const ocrData = await performLocalOCR(imageData) as any;
      
      const results: OCRResult[] = ocrData.words.map((word: any) => ({
        text: word.text,
        x: (word.bbox.x0 / canvas.width) * 100,
        y: (word.bbox.y0 / canvas.height) * 100,
        width: ((word.bbox.x1 - word.bbox.x0) / canvas.width) * 100,
        height: ((word.bbox.y1 - word.bbox.y0) / canvas.height) * 100
      }));

      setOcrResults(prev => ({ ...prev, [pageNumber - 1]: results }));
      addAlert('success', `Local OCR complete. Found ${results.length} text elements.`);
    } catch (error) {
      console.error(error);
      addAlert('error', 'Local OCR failed.');
    } finally {
      setIsOCRing(false);
    }
  };

  const handleDetectBarcodes = async () => {
    addAlert('info', 'Local barcode detection is limited in this version. Please use manual box tools for barcodes.');
  };

  const applyRedactions = async () => {
    setIsProcessing(true);
    addAlert('info', 'Applying redactions and generating PDF...');
    
    try {
      const existingPdfBytes = await fetch(file.url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      redactions.filter(r => r.isSelected).forEach(redaction => {
        const page = pages[redaction.pageIndex];
        const { width, height } = page.getSize();
        
        // Convert percentages to PDF coordinates (bottom-left origin)
        const rectX = (redaction.x / 100) * width;
        const rectY = height - ((redaction.y / 100) * height) - ((redaction.height / 100) * height);
        const rectWidth = (redaction.width / 100) * width;
        const rectHeight = (redaction.height / 100) * height;

        page.drawRectangle({
          x: rectX,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          color: rgb(0, 0, 0),
        });
      });

      if (file.metadata) {
        pdfDoc.setTitle(file.metadata.title || '');
        pdfDoc.setAuthor(file.metadata.author || '');
        pdfDoc.setSubject(file.metadata.subject || '');
        pdfDoc.setKeywords((file.metadata.keywords || '').split(',').map(k => k.trim()));
        pdfDoc.setCreator(file.metadata.creator || '');
        pdfDoc.setProducer(file.metadata.producer || '');
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = formatFileName(file.name, settings.fileNamePattern);
      link.click();

      setIsProcessing(false);
      addAlert('success', 'Redaction applied successfully!');
    } catch (error) {
      setIsProcessing(false);
      addAlert('error', 'Failed to apply redactions.');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] relative overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 gap-4 overflow-hidden">
        {/* Left Toolbar (Photoshop-like) */}
        <div className="w-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col items-center py-6 gap-6 shadow-sm">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />
          
          <div className="flex flex-col gap-4">
            <Tooltip title="Select Tool" description="Select, move, and resize redactions." shortcut="V">
              <button 
                onClick={() => setTool('selection')}
                className={cn("p-3 rounded-xl transition-all", tool === 'selection' ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
              >
                <MousePointer2 className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="Text Tool" description="Select and redact text directly from the document." shortcut="T">
              <button 
                onClick={() => setTool('text')}
                className={cn("p-3 rounded-xl transition-all", tool === 'text' ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
              >
                <TypeIcon className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="Box Tool" description="Draw a rectangular box over any area to redact it." shortcut="B">
              <button 
                onClick={() => setTool('box')}
                className={cn("p-3 rounded-xl transition-all", tool === 'box' ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
              >
                <Square className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="Highlight Tool" description="Free-form highlight tool for quick redactions." shortcut="H">
              <button 
                onClick={() => setTool('highlight')}
                className={cn("p-3 rounded-xl transition-all", tool === 'highlight' ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
              >
                <Highlighter className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />

          <div className="flex flex-col gap-4">
            <Tooltip title="Auto-Detect" description="Automatically find PII and sensitive terms." shortcut="A">
              <button 
                onClick={handleAutoDetect}
                disabled={isProcessing}
                className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <Zap className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="OCR Document" description="Extract text from the current page." shortcut="O">
              <button 
                onClick={handleOCR}
                disabled={ocrStatus === 'loading'}
                className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <FileText className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="Search & Redact" description="Open search bar to find and redact text." shortcut="Ctrl+F">
              <button 
                onClick={() => setShowSearchPopup(!showSearchPopup)}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  showSearchPopup ? "bg-black text-white dark:bg-white dark:text-black shadow-lg" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                <Search className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <Tooltip title="Undo" description="Revert your last action." shortcut="Ctrl+Z">
              <button 
                onClick={undo}
                disabled={historyIndex === 0}
                className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30"
              >
                <Undo className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip title="Redo" description="Restore a previously undone action." shortcut="Ctrl+Y">
              <button 
                onClick={redo}
                disabled={historyIndex === history.length - 1}
                className="p-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30"
              >
                <Redo className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Top Info Bar */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl">
                <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-bold min-w-[60px] text-center">{pageNumber} / {numPages}</span>
                <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl">
                <button onClick={handleZoomOut} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><Search className="w-4 h-4 -scale-x-100" /></button>
                <span className="text-xs font-mono font-bold">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowConfirmApply(true)}
                disabled={isProcessing || redactions.length === 0}
                className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Apply & Download
              </button>
            </div>
          </div>

          {/* PDF Viewer Container */}
          <div className="flex-1 bg-neutral-200 dark:bg-neutral-800 rounded-3xl overflow-auto p-8 flex justify-center relative shadow-inner">
            {/* Search Popup Bar */}
          <AnimatePresence>
            {showSearchPopup && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex gap-2 relative">
                  <div className="flex-1 relative">
                    <input 
                      autoFocus
                      type="text"
                      placeholder={useRegex ? "Regex search..." : "Search text..."}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchAndRedact();
                          setShowSuggestions(false);
                        }
                      }}
                      className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white pr-10"
                    />
                    <AnimatePresence>
                      {showSuggestions && searchQuery && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-[60] overflow-hidden"
                        >
                          {allSuggestions.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(s => (
                            <button
                              key={s}
                              onClick={() => {
                                setSearchQuery(s);
                                setShowSuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {searchQuery && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setShowSuggestions(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3 text-neutral-400" />
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => setUseRegex(!useRegex)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold transition-colors border",
                      useRegex ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                    )}
                    title="Use Regular Expression"
                  >
                    .*
                  </button>
                  <button 
                    onClick={() => {
                      handleSearchAndRedact();
                      if (searchQuery && !settings.searchHistory.includes(searchQuery)) {
                        setSettings(prev => ({ ...prev, searchHistory: [searchQuery, ...prev.searchHistory].slice(0, 20) }));
                      }
                    }}
                    disabled={isSearching || !searchQuery}
                    className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 relative overflow-hidden flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" 
                          style={{ width: `${searchProgress}%` }}
                        />
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span className="text-xs font-bold">Search</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setShowSearchPopup(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2 flex-1">
                    <button 
                      onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors border",
                        isCaseSensitive ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white" : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-400"
                      )}
                    >
                      Case Sensitive
                    </button>
                    <button 
                      onClick={() => setIsFuzzyMatch(!isFuzzyMatch)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors border",
                        isFuzzyMatch ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white" : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-400"
                      )}
                    >
                      Fuzzy Match
                    </button>
                  </div>
                  <div className="h-4 w-px bg-neutral-200 dark:border-neutral-800" />
                  <button 
                    onClick={clearSearchMatches}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 transition-colors border border-red-200 dark:border-red-900/50 flex items-center gap-2"
                    title="Clear all search matches"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Matches
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isPasswordRequired && (
            <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Password Protected</h3>
                <p className="text-neutral-500 mb-6 text-sm">This document is encrypted. Please enter the password to unlock it.</p>
                <input 
                  type="password" 
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-4 focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                />
                <button 
                  onClick={() => setIsPasswordRequired(false)}
                  className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Unlock Document
                </button>
              </div>
            </div>
          )}
          <div 
            className="relative shadow-2xl cursor-crosshair"
            style={{ backgroundColor: settings.customTheme?.canvasBgColor || '#f5f5f5' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <ErrorBoundary>
              <Document 
                file={file.url} 
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={pdfOptions}
                loading={
                  <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-neutral-900 rounded-xl shadow-lg">
                    <RefreshCw className="w-8 h-8 animate-spin text-neutral-400 mb-4" />
                    <p className="text-sm text-neutral-500">Loading document...</p>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale} 
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                  canvasRef={canvasRef}
                />
                {/* OCR Text Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {(ocrResults[pageNumber - 1] || []).map((res, i) => (
                    <div
                      key={i}
                      className="absolute text-transparent select-text hover:bg-red-500/10 transition-colors pointer-events-auto cursor-text"
                      style={{
                        left: `${res.x}%`,
                        top: `${res.y}%`,
                        width: `${res.width}%`,
                        height: `${res.height}%`,
                        fontSize: `${res.height * 0.8}%`,
                        lineHeight: 1,
                      }}
                      title={res.text}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newRedaction: RedactionBox = {
                          id: Math.random().toString(36).substring(7),
                          pageIndex: pageNumber - 1,
                          x: res.x,
                          y: res.y,
                          width: res.width,
                          height: res.height,
                          text: res.text,
                          label: 'OCR Redaction',
                          type: 'text',
                          isSelected: true,
                        };
                        const updatedRedactions = [...redactions, newRedaction];
                        setRedactions(updatedRedactions);
                        addToHistory(updatedRedactions);
                        addAlert('success', `Redacted: ${res.text}`);
                      }}
                    >
                      {res.text}
                    </div>
                  ))}
                </div>
              </Document>
            </ErrorBoundary>
            
            {/* Redaction Overlays */}
            <div className="absolute inset-0 pointer-events-none">
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {redactions.filter(r => r.pageIndex === pageNumber - 1 && r.type === 'highlight').map(r => (
                  <path
                    key={r.id}
                    d={r.path}
                    fill="none"
                    stroke={r.isSelected ? "rgba(239, 68, 68, 0.5)" : "rgba(163, 163, 163, 0.3)"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-pointer transition-all"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (tool !== 'selection') return;
                      
                      const updated = redactions.map(item => {
                        if (item.id === r.id) {
                          return { ...item, isSelected: !item.isSelected };
                        }
                        if (!e.shiftKey && item.id !== r.id) {
                          return { ...item, isSelected: false };
                        }
                        return item;
                      });
                      setRedactions(updated);
                      addToHistory(updated);
                    }}
                  />
                ))}
                {isDrawing && tool === 'highlight' && currentPath.length > 1 && (
                  <path
                    d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.5)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {redactions.filter(r => r.pageIndex === pageNumber - 1 && r.type !== 'highlight').map(r => (
                <div 
                  key={r.id}
                  className={cn(
                    "absolute border-2 transition-all cursor-pointer pointer-events-auto",
                    r.isSelected ? "border-red-500 z-10" : "border-neutral-400 opacity-50"
                  )}
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.width}%`,
                    height: `${r.height}%`,
                    backgroundColor: settings.redactionStyle === 'outline' ? 'transparent' : (r.isSelected ? 'rgba(239, 68, 68, 0.2)' : settings.redactionColor),
                    borderColor: r.isSelected ? '#ef4444' : settings.redactionColor,
                    borderWidth: settings.redactionStyle === 'outline' ? '3px' : '1px',
                    backgroundImage: settings.redactionStyle === 'pattern' && !r.isSelected ? `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)` : 'none'
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (tool !== 'selection') return;
                    
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!rect) return;
                    const mx = ((e.clientX - rect.left) / rect.width) * 100;
                    const my = ((e.clientY - rect.top) / rect.height) * 100;

                    if (e.shiftKey) {
                      const updated = redactions.map(item => 
                        item.id === r.id ? { ...item, isSelected: !item.isSelected } : item
                      );
                      setRedactions(updated);
                      addToHistory(updated);
                      return;
                    }

                    if (!r.isSelected) {
                      const updated = redactions.map(item => 
                        item.id === r.id ? { ...item, isSelected: true } : { ...item, isSelected: false }
                      );
                      setRedactions(updated);
                    }

                    setActiveInteraction({
                      type: 'drag',
                      redactionId: r.id,
                      initialMouse: { x: mx, y: my },
                      initialRect: { x: r.x, y: r.y, width: r.width, height: r.height }
                    });
                  }}
                >
                  {r.isSelected && tool === 'selection' && (
                    <>
                      {/* Resize Handles */}
                      {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(handle => (
                        <div
                          key={handle}
                          className={cn(
                            "absolute w-2 h-2 bg-white border border-red-500 z-20",
                            handle === 'nw' && "-top-1 -left-1 cursor-nw-resize",
                            handle === 'ne' && "-top-1 -right-1 cursor-ne-resize",
                            handle === 'sw' && "-bottom-1 -left-1 cursor-sw-resize",
                            handle === 'se' && "-bottom-1 -right-1 cursor-se-resize",
                            handle === 'n' && "-top-1 left-1/2 -translate-x-1/2 cursor-n-resize",
                            handle === 's' && "-bottom-1 left-1/2 -translate-x-1/2 cursor-s-resize",
                            handle === 'e' && "top-1/2 -right-1 -translate-y-1/2 cursor-e-resize",
                            handle === 'w' && "top-1/2 -left-1 -translate-y-1/2 cursor-w-resize",
                          )}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                            if (!rect) return;
                            const mx = ((e.clientX - rect.left) / rect.width) * 100;
                            const my = ((e.clientY - rect.top) / rect.height) * 100;

                            setActiveInteraction({
                              type: 'resize',
                              redactionId: r.id,
                              handle,
                              initialMouse: { x: mx, y: my },
                              initialRect: { x: r.x, y: r.y, width: r.width, height: r.height }
                            });
                          }}
                        />
                      ))}
                    </>
                  )}
                  {r.label && (
                    <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold whitespace-nowrap">
                      {r.label}
                    </span>
                  )}
                </div>
              ))}

              {/* Temporary Highlights for Search Feedback */}
              {tempHighlights.filter(h => h.pageIndex === pageNumber - 1).map((h, i) => (
                <motion.div 
                  key={`temp-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute bg-amber-400/40 border-2 border-amber-500 z-50 pointer-events-none"
                  style={{
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    width: `${h.width}%`,
                    height: `${h.height}%`,
                  }}
                />
              ))}

              {/* Current Drawing Box */}
              {currentBox && (
                <div 
                  className="absolute border-2 border-dashed border-red-500 bg-red-500/10"
                  style={{
                    left: `${currentBox.x}%`,
                    top: `${currentBox.y}%`,
                    width: `${currentBox.width}%`,
                    height: `${currentBox.height}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar (Redaction List) */}
        <div className="w-80 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Page OCR</h3>
              {ocrStatus !== 'idle' && (
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                  ocrStatus === 'loading' ? "bg-amber-100 text-amber-600" : 
                  ocrStatus === 'success' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  {ocrStatus}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={triggerOCR}
                disabled={ocrStatus === 'loading'}
                className="flex-1 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
              >
                {ocrStatus === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Barcode className="w-3.5 h-3.5" />}
                Run OCR on Page {pageNumber}
              </button>
              {ocrResults[pageNumber - 1] && (
                <button 
                  onClick={() => {
                    setOcrResults(prev => {
                      const next = { ...prev };
                      delete next[pageNumber - 1];
                      return next;
                    });
                    setOcrStatus('idle');
                  }}
                  className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 transition-colors"
                  title="Clear OCR Results"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {ocrResults[pageNumber - 1] && (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    const results = ocrResults[pageNumber - 1];
                    const newReds = results.map(res => ({
                      id: Math.random().toString(36).substring(7),
                      pageIndex: pageNumber - 1,
                      x: res.x,
                      y: res.y,
                      width: res.width,
                      height: res.height,
                      text: res.text,
                      label: 'OCR Detected',
                      type: 'text' as const,
                      isSelected: true,
                    }));
                    const updated = [...redactions, ...newReds];
                    setRedactions(updated);
                    addToHistory(updated);
                    addAlert('success', `Redacted ${newReds.length} items from OCR.`);
                  }}
                  className="w-full py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  Redact All OCR Text
                </button>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {ocrResults[pageNumber - 1].map((res, i) => (
                    <div key={i} className="group p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium truncate flex-1">{res.text}</span>
                      <button 
                        onClick={() => {
                          const newRedaction: RedactionBox = {
                            id: Math.random().toString(36).substring(7),
                            pageIndex: pageNumber - 1,
                            x: res.x,
                            y: res.y,
                            width: res.width,
                            height: res.height,
                            text: res.text,
                            label: 'OCR',
                            type: 'text',
                            isSelected: true,
                          };
                          const updated = [...redactions, newRedaction];
                          setRedactions(updated);
                          addToHistory(updated);
                          addAlert('success', `Redacted: ${res.text}`);
                        }}
                        className="p-1 bg-neutral-200 dark:bg-neutral-700 rounded hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-all opacity-0 group-hover:opacity-100"
                        title="Redact this"
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Redactions</h3>
            <span className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-full font-mono">
              {redactions.filter(r => r.isSelected).length} Active
            </span>
          </div>

          <div className="flex-1 overflow-auto flex flex-col gap-6 pr-2">
            {redactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-center">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">No redactions detected yet. Use Search or draw manually.</p>
              </div>
            ) : (
              Object.entries(
                redactions.reduce((acc, r) => {
                  const page = r.pageIndex + 1;
                  if (!acc[page]) acc[page] = [];
                  acc[page].push(r);
                  return acc;
                }, {} as Record<number, RedactionBox[]>)
              ).sort(([a], [b]) => Number(a) - Number(b)).map(([page, pageRedactions]) => (
                <div key={page} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page {page}</span>
                    <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                  {pageRedactions.map(r => (
                    <div 
                      key={r.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('redactionId', r.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={cn(
                        "p-3 rounded-xl border transition-all group cursor-grab active:cursor-grabbing",
                        r.isSelected ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20" : "border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-neutral-300" />
                          {r.type === 'highlight' ? <Highlighter className="w-3 h-3 text-neutral-400" /> : <Square className="w-3 h-3 text-neutral-400" />}
                          <input 
                            type="text"
                            value={r.label || ''}
                            placeholder="Label"
                            onChange={(e) => {
                              const updated = redactions.map(item => 
                                item.id === r.id ? { ...item, label: e.target.value } : item
                              );
                              setRedactions(updated);
                              addToHistory(updated);
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider bg-transparent outline-none w-24"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              const updated = redactions.map(item => 
                                item.id === r.id ? { ...item, isSelected: !item.isSelected } : item
                              );
                              setRedactions(updated);
                              addToHistory(updated);
                            }}
                            className={cn("p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors", r.isSelected ? "text-red-500" : "text-neutral-400")}
                          >
                            {r.isSelected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = redactions.filter(item => item.id !== r.id);
                              setRedactions(updated);
                              addToHistory(updated);
                            }}
                            className="p-1 hover:text-red-500 transition-all text-neutral-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[8px] uppercase text-neutral-400">Private Comment / Reason</label>
                          <button 
                            onClick={() => {
                              setCommentModal({
                                isOpen: true,
                                redactionId: r.id,
                                comment: r.comment || ""
                              });
                            }}
                            className="text-[8px] font-bold text-indigo-500 hover:underline"
                          >
                            Expand / Edit
                          </button>
                        </div>
                        {r.comment && (
                          <p className="text-[10px] text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-lg line-clamp-2">
                            {r.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const updated = redactions.map(r => ({ ...r, isSelected: true }));
                  setRedactions(updated);
                  addToHistory(updated);
                }}
                className="flex-1 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Select All
              </button>
              <button 
                onClick={() => {
                  const updated = redactions.map(r => ({ ...r, isSelected: false }));
                  setRedactions(updated);
                  addToHistory(updated);
                }}
                className="flex-1 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Deselect All
              </button>
            </div>
            <button 
              onClick={() => {
                const updated = redactions.filter(r => !r.isSelected);
                setRedactions(updated);
                addToHistory(updated);
                addAlert('success', 'Deleted selected redactions');
              }}
              disabled={!redactions.some(r => r.isSelected)}
              className="w-full py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Selected
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Layout (Google Docs/Drive like) */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950">
        {/* Mobile Header */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="font-bold truncate max-w-[200px]">{file.name}</h2>
          <button 
            onClick={() => setShowConfirmApply(true)}
            disabled={isProcessing || redactions.length === 0}
            className="p-2 text-indigo-500 disabled:opacity-50"
          >
            <CheckCircle2 className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile PDF Viewer - Continuous Scroll */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4 scroll-smooth">
          <Document
            file={file.url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={pdfOptions}
            loading={<div className="p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-xs">Loading document...</p></div>}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_${index + 1}`} 
                className="relative shadow-lg bg-white dark:bg-neutral-900 rounded-sm overflow-hidden mb-4"
                style={{ width: 'fit-content' }}
              >
                <Page 
                  pageNumber={index + 1} 
                  width={window.innerWidth - 32} 
                  scale={scale}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                />
                
                {/* Mobile Redaction Overlay for this page */}
                <div className="absolute inset-0 pointer-events-none">
                  {redactions.filter(r => r.pageIndex === index).map(redaction => (
                    <div
                      key={redaction.id}
                      className={cn(
                        "absolute border transition-all",
                        redaction.type === 'highlight' ? "bg-yellow-400/30 border-yellow-400" : "bg-black border-black"
                      )}
                      style={{
                        left: `${redaction.x}%`,
                        top: `${redaction.y}%`,
                        width: `${redaction.width}%`,
                        height: `${redaction.height}%`,
                        backgroundColor: redaction.type === 'highlight' ? 'rgba(250, 204, 21, 0.3)' : 'black'
                      }}
                    />
                  ))}
                  
                  {isDrawing && currentBox && pageNumber === index + 1 && (
                    <div 
                      className="absolute border-2 border-dashed border-red-500 bg-red-500/10"
                      style={{
                        left: `${currentBox.x}%`,
                        top: `${currentBox.y}%`,
                        width: `${currentBox.width}%`,
                        height: `${currentBox.height}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </Document>
        </div>

        {/* Mobile Floating Action Button for Tools */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
          <AnimatePresence>
            {showMobileTools && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                className="flex flex-col gap-3 mb-3"
              >
                <button 
                  onClick={() => { setTool('text'); setShowMobileTools(false); }}
                  className={cn("w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all", tool === 'text' ? "bg-black text-white" : "bg-white text-neutral-600")}
                >
                  <TypeIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setTool('box'); setShowMobileTools(false); }}
                  className={cn("w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all", tool === 'box' ? "bg-black text-white" : "bg-white text-neutral-600")}
                >
                  <Square className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { handleAutoDetect(); setShowMobileTools(false); }}
                  className="w-12 h-12 bg-white text-neutral-600 rounded-full shadow-xl flex items-center justify-center"
                >
                  <Zap className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setShowSearchPopup(true); setShowMobileTools(false); }}
                  className="w-12 h-12 bg-white text-neutral-600 rounded-full shadow-xl flex items-center justify-center"
                >
                  <Search className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setShowMobileTools(!showMobileTools)}
            className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
          >
            {showMobileTools ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Zoom Controls */}
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800">
          <button onClick={handleZoomOut} className="p-2 hover:bg-neutral-100 rounded-lg"><Search className="w-4 h-4 -scale-x-100" /></button>
          <span className="text-[10px] font-bold min-w-[30px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 hover:bg-neutral-100 rounded-lg"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmApply && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmApply(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Apply Redactions?</h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-8">
                You are about to permanently redact {redactions.length} areas in this document. This action cannot be undone after the file is saved.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmApply(false)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowConfirmApply(false);
                    applyRedactions();
                  }}
                  className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Yes, Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comment Modal */}
      <AnimatePresence>
        {commentModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <h3 className="font-bold text-lg">Redaction Reasoning</h3>
                <button 
                  onClick={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <textarea 
                  autoFocus
                  value={commentModal.comment}
                  onChange={(e) => setCommentModal(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder="Enter detailed reasoning for this redaction..."
                  className="w-full h-48 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>
              <div className="p-6 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end gap-3">
                <button 
                  onClick={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-sm font-medium hover:text-indigo-500 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const updated = redactions.map(r => 
                      r.id === commentModal.redactionId ? { ...r, comment: commentModal.comment } : r
                    );
                    setRedactions(updated);
                    addToHistory(updated);
                    addAlert('success', 'Comment updated');
                    setCommentModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Save Comment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BatchView({ files, setFiles, settings, setSettings, addAlert }: { 
  files: PDFFile[]; 
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  addAlert: (type: any, msg: string) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchRules, setBatchRules] = useState({
    pii: settings.aiDefaults?.piiEnabled ?? true,
    barcodes: settings.aiDefaults?.barcodesEnabled ?? false,
    companyDetection: settings.aiDefaults?.companyDataEnabled ?? false,
    sensitiveTerms: '',
  });
  const [ruleName, setRuleName] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  const filteredPresets = settings.savedBatchRules.filter(r => 
    r.name.toLowerCase().includes(presetSearch.toLowerCase())
  );

  const processBatch = async () => {
    setIsProcessing(true);
    addAlert('info', `Processing ${files.length} files with local AI...`);
    
    try {
      const updatedFiles = [...files];
      
      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        file.status = 'processing';
        setFiles([...updatedFiles]);

        const pdfBytes = await fetch(file.url).then(res => res.arrayBuffer());
        const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;
        const numPages = pdfDoc.numPages;
        const allRedactions: RedactionBox[] = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context!, viewport, canvas }).promise;
          const imageData = canvas.toDataURL('image/png');

          // Local OCR
          const ocrData = await performLocalOCR(imageData) as any;
          const text = ocrData.text;
          const words = ocrData.words;

          // Company Detection (Local)
          let matchedRule: CompanyRule | null = null;
          if (batchRules.companyDetection && settings.companyRules?.length > 0) {
            for (const rule of settings.companyRules) {
              const identifiers = rule.identifiers || [];
              if (identifiers.some(id => text.toLowerCase().includes(id.toLowerCase()))) {
                matchedRule = rule;
                break;
              }
            }
          }

          // Apply Learned Coordinates
          if (matchedRule?.learnedCoordinates) {
            matchedRule.learnedCoordinates
              .filter(c => c.pageIndex === pageNum - 1)
              .forEach((coord, idx) => {
                allRedactions.push({
                  id: `learned-${Date.now()}-${idx}`,
                  pageIndex: pageNum - 1,
                  x: coord.x,
                  y: coord.y,
                  width: coord.width,
                  height: coord.height,
                  label: coord.label || 'Learned Area',
                  type: 'auto',
                  isSelected: true
                });
              });
          }

          // Local PII
          if (batchRules.pii) {
            const piiResults = detectPIILocal(text, words);
            piiResults.forEach((res, idx) => {
              allRedactions.push({
                id: `pii-${Date.now()}-${idx}`,
                pageIndex: pageNum - 1,
                x: (res.x / canvas.width) * 100,
                y: (res.y / canvas.height) * 100,
                width: (res.width / canvas.width) * 100,
                height: (res.height / canvas.height) * 100,
                label: res.label,
                type: 'auto',
                isSelected: true
              });
            });
          }

          // Local Sensitive Terms
          const termsToSearch = [
            ...(batchRules.sensitiveTerms.split(',').map(t => t.trim())),
            ...(matchedRule?.sensitiveTerms || [])
          ];
          if (termsToSearch.length > 0) {
            const termResults = detectSensitiveTermsLocal(text, words, termsToSearch);
            termResults.forEach((res, idx) => {
              allRedactions.push({
                id: `term-${Date.now()}-${idx}`,
                pageIndex: pageNum - 1,
                x: (res.x / canvas.width) * 100,
                y: (res.y / canvas.height) * 100,
                width: (res.width / canvas.width) * 100,
                height: (res.height / canvas.height) * 100,
                label: 'SENSITIVE TERM',
                type: 'auto',
                isSelected: true
              });
            });
          }
        }

        updatedFiles[i] = { ...file, redactions: allRedactions, status: 'ready' };
        setFiles([...updatedFiles]);
      }

      addAlert('success', 'Batch processing complete!');
    } catch (error) {
      console.error(error);
      addAlert('error', 'Batch processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveRuleSet = () => {
    if (!ruleName) {
      addAlert('error', 'Please enter a name for the rule set.');
      return;
    }
    const newRule: BatchRuleSet = {
      id: Math.random().toString(36).substring(7),
      name: ruleName,
      ...batchRules
    };
    setSettings(prev => ({
      ...prev,
      savedBatchRules: [...prev.savedBatchRules, newRule]
    }));
    setRuleName('');
    addAlert('success', `Rule set "${newRule.name}" saved.`);
  };

  const loadRuleSet = (rule: BatchRuleSet) => {
    setBatchRules({
      pii: rule.pii,
      barcodes: rule.barcodes,
      companyDetection: rule.companyDetection || false,
      sensitiveTerms: rule.sensitiveTerms
    });
    addAlert('info', `Loaded rule set "${rule.name}".`);
  };

  const deleteRuleSet = (id: string) => {
    setSettings(prev => ({
      ...prev,
      savedBatchRules: prev.savedBatchRules.filter(r => r.id !== id)
    }));
    addAlert('info', 'Rule set deleted.');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Batch Redaction</h2>
          <p className="text-neutral-500 dark:text-neutral-400">Apply the same redaction rules to multiple documents.</p>
        </div>
        <button 
          onClick={processBatch}
          disabled={isProcessing || files.length === 0}
          className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Play className="w-5 h-5" />
          Start Batch Process
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-1 space-y-6">
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-neutral-400">
              <Settings className="w-4 h-4" />
              Detection Rules
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">PII Detection</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.pii}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, pii: e.target.checked }))}
                  className="w-4 h-4 accent-black dark:accent-white"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">Barcodes & QR</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.barcodes}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, barcodes: e.target.checked }))}
                  className="w-4 h-4 accent-black dark:accent-white"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">Company Detection</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.companyDetection}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, companyDetection: e.target.checked }))}
                  className="w-4 h-4 accent-black dark:accent-white"
                />
              </label>
              <div className="pt-2">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Sensitive Terms (CSV)</label>
                <textarea 
                  placeholder="e.g. Confidential, Internal, Draft"
                  value={batchRules.sensitiveTerms}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, sensitiveTerms: e.target.value }))}
                  className="w-full h-24 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  {editingPresetId ? 'Update Preset' : 'Save as Preset'}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Preset name..."
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                  <button 
                    onClick={() => {
                      if (editingPresetId) {
                        const updated = settings.savedBatchRules.map(r => 
                          r.id === editingPresetId ? { ...r, name: ruleName, ...batchRules } : r
                        );
                        setSettings(prev => ({ ...prev, savedBatchRules: updated }));
                        setEditingPresetId(null);
                        setRuleName('');
                        addAlert('success', `Preset "${ruleName}" updated.`);
                      } else {
                        saveRuleSet();
                      }
                    }}
                    className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  {editingPresetId && (
                    <button 
                      onClick={() => {
                        setEditingPresetId(null);
                        setRuleName('');
                      }}
                      className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {settings.savedBatchRules.length > 0 && (
            <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-neutral-400">
                  <Bookmark className="w-4 h-4" />
                  Saved Presets
                </h3>
              </div>
              
              <div className="mb-4 relative">
                <input 
                  type="text"
                  placeholder="Filter presets..."
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white pr-8"
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {filteredPresets.length === 0 ? (
                  <p className="text-center py-4 text-xs text-neutral-400">No presets match your search.</p>
                ) : (
                  filteredPresets.map(rule => (
                    <div 
                      key={rule.id} 
                      className={cn(
                        "group flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer border border-transparent",
                        editingPresetId === rule.id ? "border-indigo-500 bg-indigo-50/10" : ""
                      )} 
                      onClick={() => loadRuleSet(rule)}
                    >
                      <span className="text-xs font-medium">{rule.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPresetId(rule.id);
                            setRuleName(rule.name);
                            setBatchRules({
                              pii: rule.pii,
                              barcodes: rule.barcodes,
                              companyDetection: rule.companyDetection || false,
                              sensitiveTerms: rule.sensitiveTerms
                            });
                          }}
                          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-indigo-500 rounded transition-all"
                          title="Edit Preset"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRuleSet(rule.id);
                          }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 rounded transition-all"
                          title="Delete Preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-neutral-400 uppercase text-[10px] tracking-widest">Processing Queue ({files.length})</h3>
          </div>
          <div className="grid gap-4">
            {files.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-500">No files uploaded yet.</p>
              </div>
            ) : (
              files.map(file => (
                <div key={file.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-neutral-500" />
                    </div>
                    <div>
                      <h4 className="font-bold">{file.name}</h4>
                      <p className="text-xs text-neutral-400">Ready to process</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ settings, setSettings, onBack, activeFile, setFiles }: { 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  activeFile?: PDFFile;
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
}) {
  const [exportOnlySelected, setExportOnlySelected] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    setLastSaved(Date.now());
    const timer = setTimeout(() => setLastSaved(null), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  return (
    <div className="max-w-2xl mx-auto relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        </div>
        <AnimatePresence>
          {lastSaved && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 text-emerald-500 text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Changes saved automatically
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-8">
        {/* Document Metadata */}
        {activeFile && (
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-5 h-5 text-neutral-400" />
              <h3 className="font-bold text-xl">Document Metadata</h3>
            </div>
            
            <div className="grid gap-4">
              {[
                { label: 'Title', key: 'title' },
                { label: 'Author', key: 'author' },
                { label: 'Subject', key: 'subject' },
                { label: 'Keywords', key: 'keywords' },
                { label: 'Creator', key: 'creator' },
                { label: 'Producer', key: 'producer' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-neutral-500 mb-2">{field.label}</label>
                  <input 
                    type="text" 
                    value={(activeFile.metadata as any)?.[field.key] || ''}
                    onChange={(e) => {
                      setFiles(prev => prev.map(f => 
                        f.id === activeFile.id 
                          ? { ...f, metadata: { ...(f.metadata || {}), [field.key]: e.target.value } } 
                          : f
                      ));
                    }}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Export Redaction Report */}
        {activeFile && (
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Download className="w-5 h-5 text-neutral-400" />
              <h3 className="font-bold text-xl">Export Redaction Report</h3>
            </div>
            
            <p className="text-sm text-neutral-500 mb-6">Download a detailed report of redactions in this document, including coordinates, labels, and private comments.</p>
            
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={exportOnlySelected}
                  onChange={(e) => setExportOnlySelected(e.target.checked)}
                  className="w-4 h-4 accent-black dark:accent-white"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">Export only selected redactions</span>
              </label>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  const redactionsToExport = exportOnlySelected 
                    ? activeFile.redactions.filter(r => r.isSelected)
                    : activeFile.redactions;

                  const data = redactionsToExport.map(r => ({
                    page: r.pageIndex + 1,
                    type: r.type,
                    label: r.label || 'N/A',
                    text: r.text || 'N/A',
                    x: `${r.x.toFixed(2)}%`,
                    y: `${r.y.toFixed(2)}%`,
                    width: `${r.width.toFixed(2)}%`,
                    height: `${r.height.toFixed(2)}%`,
                    comment: r.comment || ''
                  }));
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeFile.name}_redaction_report.json`;
                  a.click();
                }}
                className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                Export as JSON
              </button>
              <button 
                onClick={() => {
                  const redactionsToExport = exportOnlySelected 
                    ? activeFile.redactions.filter(r => r.isSelected)
                    : activeFile.redactions;

                  const headers = ['Page', 'Type', 'Label', 'Matched Text', 'X', 'Y', 'Width', 'Height', 'Comment'];
                  const rows = redactionsToExport.map(r => [
                    r.pageIndex + 1,
                    r.type,
                    `"${(r.label || '').replace(/"/g, '""')}"`,
                    `"${(r.text || '').replace(/"/g, '""')}"`,
                    `${r.x.toFixed(2)}%`,
                    `${r.y.toFixed(2)}%`,
                    `${r.width.toFixed(2)}%`,
                    `${r.height.toFixed(2)}%`,
                    `"${(r.comment || '').replace(/"/g, '""')}"`
                  ]);
                  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeFile.name}_redaction_report.csv`;
                  a.click();
                }}
                className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                Export as CSV
              </button>
            </div>
          </section>
        )}

        {/* Theme Customization */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Theme Customization</h3>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-500 mb-4">Theme Mode</label>
              <div className="grid grid-cols-4 gap-4">
                {(['light', 'dark', 'system', 'custom'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSettings(prev => ({ ...prev, theme: mode }))}
                    className={cn(
                      "py-3 rounded-xl border-2 transition-all capitalize font-medium",
                      settings.theme === mode 
                        ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black" 
                        : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {settings.theme === 'custom' && settings.customTheme && (
              <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-500 mb-2">Primary Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={settings.customTheme.primaryColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, primaryColor: e.target.value } 
                        }))}
                        className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none"
                      />
                      <input 
                        type="text" 
                        value={settings.customTheme.primaryColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, primaryColor: e.target.value } 
                        }))}
                        className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-500 mb-2">Secondary Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={settings.customTheme.secondaryColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, secondaryColor: e.target.value } 
                        }))}
                        className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none"
                      />
                      <input 
                        type="text" 
                        value={settings.customTheme.secondaryColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, secondaryColor: e.target.value } 
                        }))}
                        className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-500 mb-2">Accent Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={settings.customTheme.accentColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, accentColor: e.target.value } 
                        }))}
                        className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none"
                      />
                      <input 
                        type="text" 
                        value={settings.customTheme.accentColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, accentColor: e.target.value } 
                        }))}
                        className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-500 mb-2">Canvas Background Color</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={settings.customTheme.canvasBgColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, canvasBgColor: e.target.value } 
                        }))}
                        className="w-10 h-10 rounded-lg cursor-pointer overflow-hidden border-none"
                      />
                      <input 
                        type="text" 
                        value={settings.customTheme.canvasBgColor}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, canvasBgColor: e.target.value } 
                        }))}
                        className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-500 mb-2">Custom Font</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="e.g. 'Open Sans', sans-serif"
                        value={settings.customTheme.fontFamily || ''}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          customTheme: { ...prev.customTheme!, fontFamily: e.target.value } 
                        }))}
                        className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm"
                      />
                      <label className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center transition-colors">
                        Upload Font
                        <input 
                          type="file" 
                          accept=".ttf,.woff,.woff2"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const fontData = event.target?.result as string;
                                const fontName = file.name.split('.')[0];
                                const newStyle = document.createElement('style');
                                newStyle.appendChild(document.createTextNode(`
                                  @font-face {
                                    font-family: '${fontName}';
                                    src: url('${fontData}');
                                  }
                                `));
                                document.head.appendChild(newStyle);
                                setSettings(prev => ({ 
                                  ...prev, 
                                  customTheme: { ...prev.customTheme!, fontFamily: `'${fontName}', sans-serif` } 
                                }));
                                addAlert('success', `Font "${fontName}" uploaded and applied.`);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* AI Detection Section */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">AI Detection Defaults</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">PII Detection</p>
                <p className="text-xs text-neutral-500">Enable PII scanning by default</p>
              </div>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, aiDefaults: { ...prev.aiDefaults, piiEnabled: !prev.aiDefaults.piiEnabled } }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  settings.aiDefaults?.piiEnabled ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full transition-all",
                  settings.aiDefaults?.piiEnabled ? "right-1 bg-white dark:bg-black" : "left-1 bg-neutral-400"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Barcode & QR Detection</p>
                <p className="text-xs text-neutral-500">Enable code scanning by default</p>
              </div>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, aiDefaults: { ...prev.aiDefaults, barcodesEnabled: !prev.aiDefaults.barcodesEnabled } }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  settings.aiDefaults?.barcodesEnabled ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full transition-all",
                  settings.aiDefaults?.barcodesEnabled ? "right-1 bg-white dark:bg-black" : "left-1 bg-neutral-400"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Company-Specific Data</p>
                <p className="text-xs text-neutral-500">Enable company rule scanning by default</p>
              </div>
              <button 
                onClick={() => setSettings(prev => ({ ...prev, aiDefaults: { ...prev.aiDefaults, companyDataEnabled: !prev.aiDefaults.companyDataEnabled } }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  settings.aiDefaults?.companyDataEnabled ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-800"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full transition-all",
                  settings.aiDefaults?.companyDataEnabled ? "right-1 bg-white dark:bg-black" : "left-1 bg-neutral-400"
                )} />
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-neutral-500">Detection Sensitivity</label>
                <span className="text-xs font-bold px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  {Math.round((settings.aiDefaults?.sensitivity || 0.5) * 100)}%
                </span>
              </div>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.aiDefaults?.sensitivity || 0.5}
                onChange={(e) => setSettings(prev => ({ ...prev, aiDefaults: { ...prev.aiDefaults, sensitivity: parseFloat(e.target.value) } }))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                <span>Strict</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-neutral-500">Detection Sensitivity</label>
                <span className="text-xs font-bold px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  {Math.round((settings.aiDefaults?.sensitivity || 0.5) * 100)}%
                </span>
              </div>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.aiDefaults?.sensitivity || 0.5}
                onChange={(e) => setSettings(prev => ({ ...prev, aiDefaults: { ...prev.aiDefaults, sensitivity: parseFloat(e.target.value) } }))}
                className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                <span>Strict</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
              <label className="block text-sm font-medium text-neutral-500 mb-2">Company Profile</label>
              
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Company Name</label>
                <input 
                  type="text"
                  value={settings.companyProfile?.name || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    companyProfile: { ...(prev.companyProfile || { name: '', content: '' }), name: e.target.value }
                  }))}
                  placeholder="Enter company name"
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Contact Details</label>
                <textarea 
                  value={settings.companyProfile?.contactDetails || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    companyProfile: { ...(prev.companyProfile || { name: '', content: '' }), contactDetails: e.target.value }
                  }))}
                  placeholder="Enter contact details (email, phone, address, etc.)"
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl hover:border-black dark:hover:border-white transition-all cursor-pointer">
                  <Upload className="w-5 h-5 text-neutral-400" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {settings.companyProfile?.content ? 'Profile uploaded' : 'Upload Profile (PDF/DOCX)'}
                  </span>
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSettings(prev => ({ 
                          ...prev, 
                          companyProfile: { 
                            ...(prev.companyProfile || { name: '', content: '' }), 
                            name: prev.companyProfile?.name || file.name, 
                            content: 'Profile uploaded' 
                          } 
                        }));
                      }
                    }}
                  />
                </label>
                {settings.companyProfile?.content && (
                  <button 
                    onClick={() => setSettings(prev => ({ 
                      ...prev, 
                      companyProfile: { ...(prev.companyProfile || { name: '', content: '' }), content: '' } 
                    }))}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Company Rules Section */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bookmark className="w-5 h-5 text-neutral-400" />
              <h3 className="font-bold text-xl">Company Rules</h3>
            </div>
            <button 
              onClick={() => {
                const newRule: CompanyRule = {
                  id: Math.random().toString(36).substring(7),
                  name: 'New Rule Template',
                  patterns: [],
                  sensitiveTerms: []
                };
                setSettings(prev => ({ ...prev, companyRules: [...(prev.companyRules || []), newRule] }));
              }}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Template
            </button>
          </div>

          <div className="space-y-4">
            {(settings.companyRules || []).length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-2xl">
                <p className="text-neutral-400 text-sm">No company rules defined yet.</p>
              </div>
            ) : (
              settings.companyRules.map(rule => (
                <div key={rule.id} className="p-6 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text"
                        value={rule.name}
                        onChange={(e) => {
                          const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, name: e.target.value } : r);
                          setSettings(prev => ({ ...prev, companyRules: updated }));
                        }}
                        className="font-bold bg-transparent outline-none focus:ring-2 focus:ring-black dark:focus:ring-white rounded px-2 text-lg"
                      />
                      {rule.description && <p className="text-[10px] text-neutral-400 px-2">{rule.description}</p>}
                    </div>
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, companyRules: prev.companyRules.filter(r => r.id !== rule.id) }))}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Company Identifiers</label>
                    <input 
                      type="text"
                      placeholder="Add identifier (Enter)..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val) {
                            const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, identifiers: [...(r.identifiers || []), val] } : r);
                            setSettings(prev => ({ ...prev, companyRules: updated }));
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(rule.identifiers || []).map((id, i) => (
                        <span key={i} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] font-medium border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
                          {id}
                          <button onClick={() => {
                            const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, identifiers: (r.identifiers || []).filter((_, idx) => idx !== i) } : r);
                            setSettings(prev => ({ ...prev, companyRules: updated }));
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Sensitive Terms</label>
                    <input 
                      type="text"
                      placeholder="Add term (Enter)..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val) {
                            const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, sensitiveTerms: [...(r.sensitiveTerms || []), val] } : r);
                            setSettings(prev => ({ ...prev, companyRules: updated }));
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(rule.sensitiveTerms || []).map((term, i) => (
                        <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-medium border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1">
                          {term}
                          <button onClick={() => {
                            const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, sensitiveTerms: (r.sensitiveTerms || []).filter((_, idx) => idx !== i) } : r);
                            setSettings(prev => ({ ...prev, companyRules: updated }));
                          }}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {rule.learnedCoordinates && rule.learnedCoordinates.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Learned Redaction Areas ({rule.learnedCoordinates.length})</label>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {rule.learnedCoordinates.map((coord, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-100 dark:border-neutral-800 text-[10px]">
                            <div className="flex flex-col">
                              <span className="font-bold text-neutral-500">Page {coord.pageIndex + 1}</span>
                              <span className="font-medium">{coord.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-neutral-400 font-mono">[{Math.round(coord.x)}%, {Math.round(coord.y)}%]</span>
                              <button 
                                onClick={() => {
                                  const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, learnedCoordinates: r.learnedCoordinates?.filter((_, idx) => idx !== i) } : r);
                                  setSettings(prev => ({ ...prev, companyRules: updated }));
                                }}
                                className="text-neutral-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Regex Patterns</label>
                      <input 
                        type="text"
                        placeholder="Add regex (Enter)..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, patterns: [...r.patterns, val] } : r);
                              setSettings(prev => ({ ...prev, companyRules: updated }));
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        {rule.patterns.map((pattern, i) => (
                          <span key={i} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] font-medium flex items-center gap-1">
                            {pattern}
                            <button onClick={() => {
                              const updated = settings.companyRules.map(r => r.id === rule.id ? { ...r, patterns: r.patterns.filter((_, idx) => idx !== i) } : r);
                              setSettings(prev => ({ ...prev, companyRules: updated }));
                            }}><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Appearance */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Sun className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Appearance</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {(['light', 'dark', 'system'] as Theme[]).map(t => (
              <button
                key={t}
                onClick={() => setSettings(prev => ({ ...prev, theme: t }))}
                className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                  settings.theme === t ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800" : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200"
                )}
              >
                {t === 'light' && <Sun className="w-6 h-6" />}
                {t === 'dark' && <Moon className="w-6 h-6" />}
                {t === 'system' && <Monitor className="w-6 h-6" />}
                <span className="text-sm font-medium capitalize">{t}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Output File Name */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Output File Name</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-500 mb-2">Pattern</label>
              <input 
                type="text" 
                value={settings.fileNamePattern}
                onChange={(e) => setSettings(prev => ({ ...prev, fileNamePattern: e.target.value }))}
                placeholder="{name}_redacted"
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Original Name', value: '{name}' },
                { label: 'Date', value: '{date}' },
                { label: 'Time', value: '{time}' },
                { label: 'Redacted Suffix', value: '_redacted' },
                { label: 'Rejected Suffix', value: '_rejected' },
              ].map(tag => (
                <button
                  key={tag.value}
                  onClick={() => setSettings(prev => ({ ...prev, fileNamePattern: prev.fileNamePattern + tag.value }))}
                  className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors"
                >
                  + {tag.label}
                </button>
              ))}
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <span className="text-xs text-neutral-500 block mb-1 uppercase font-bold tracking-wider">Preview</span>
              <span className="font-mono text-sm">
                {settings.fileNamePattern
                  .replace('{name}', 'document')
                  .replace('{date}', new Date().toISOString().split('T')[0])
                  .replace('{time}', new Date().toLocaleTimeString().replace(/:/g, '-'))
                }.pdf
              </span>
            </div>
          </div>
        </section>

        {/* Redaction Style */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Redaction Style</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Redaction Color</span>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={settings.redactionColor}
                  onChange={(e) => setSettings(prev => ({ ...prev, redactionColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent"
                />
                <span className="font-mono text-sm uppercase">{settings.redactionColor}</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-500 mb-2">Fill Style</label>
              <div className="grid grid-cols-3 gap-3">
                {(['solid', 'pattern', 'outline'] as RedactionStyle[]).map(style => (
                  <button
                    key={style}
                    onClick={() => setSettings(prev => ({ ...prev, redactionStyle: style }))}
                    className={cn(
                      "py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      settings.redactionStyle === style 
                        ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800" 
                        : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    <div 
                      className="w-8 h-8 rounded border border-neutral-200 dark:border-neutral-700"
                      style={{
                        backgroundColor: style === 'outline' ? 'transparent' : settings.redactionColor,
                        borderWidth: style === 'outline' ? '2px' : '1px',
                        borderColor: settings.redactionColor,
                        backgroundImage: style === 'pattern' ? `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)` : 'none'
                      }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{style}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Toolbar Customization */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Toolbar Customization</h3>
          </div>
          
          <div className="space-y-3">
            {settings.toolbar.map((tool, index) => (
              <div 
                key={tool.id} 
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <button 
                      disabled={index === 0}
                      onClick={() => {
                        const newToolbar = [...settings.toolbar];
                        [newToolbar[index - 1], newToolbar[index]] = [newToolbar[index], newToolbar[index - 1]];
                        setSettings(prev => ({ ...prev, toolbar: newToolbar }));
                      }}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button 
                      disabled={index === settings.toolbar.length - 1}
                      onClick={() => {
                        const newToolbar = [...settings.toolbar];
                        [newToolbar[index + 1], newToolbar[index]] = [newToolbar[index], newToolbar[index + 1]];
                        setSettings(prev => ({ ...prev, toolbar: newToolbar }));
                      }}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-medium">{tool.label}</span>
                </div>
                <button 
                  onClick={() => {
                    const newToolbar = settings.toolbar.map(t => 
                      t.id === tool.id ? { ...t, visible: !t.visible } : t
                    );
                    setSettings(prev => ({ ...prev, toolbar: newToolbar }));
                  }}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    tool.visible ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                  )}
                >
                  {tool.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Shortcuts */}
        <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Keyboard className="w-5 h-5 text-neutral-400" />
            <h3 className="font-bold text-xl">Keyboard Shortcuts</h3>
          </div>
          
          <div className="space-y-4">
            {Object.entries(settings.shortcuts).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-neutral-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <kbd className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg font-mono text-xs border border-neutral-200 dark:border-neutral-700">
                  {value}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TrainingView({ settings, setSettings, addAlert }: {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  addAlert: (type: any, msg: string) => void;
}) {
  const [session, setSession] = useState<TrainingSession>({
    id: Math.random().toString(36).substring(7),
    status: 'idle'
  });
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'redacted') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSession(prev => ({
      ...prev,
      [type === 'original' ? 'originalFile' : 'redactedFile']: file
    }));
  };

  const runTraining = async () => {
    if (!session.originalFile || !session.redactedFile) {
      addAlert('error', 'Please upload both original and redacted files.');
      return;
    }

    setSession(prev => ({ ...prev, status: 'analyzing' }));
    setProgress(0);

    try {
      const originalUrl = URL.createObjectURL(session.originalFile);
      const redactedUrl = URL.createObjectURL(session.redactedFile);

      const originalPdf = await pdfjs.getDocument(originalUrl).promise;
      const redactedPdf = await pdfjs.getDocument(redactedUrl).promise;

      if (originalPdf.numPages !== redactedPdf.numPages) {
        throw new Error('PDFs must have the same number of pages.');
      }

      let companyName = "Unknown Company";
      const learnedCoordinates: any[] = [];
      const identifiers: string[] = [];
      const sensitiveTerms: string[] = [];

      // 1. Identify Company from first page (Local OCR)
      const firstPage = await originalPdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await firstPage.render({ canvasContext: ctx!, viewport, canvas }).promise;
      const firstPageImage = canvas.toDataURL('image/png');

      const ocrData = await performLocalOCR(firstPageImage) as any;
      const text = ocrData.text;
      const words = ocrData.words;

      // Try to match existing company
      const matchedRule = settings.companyRules?.find(r => 
        (r.identifiers || []).some(id => text.toLowerCase().includes(id.toLowerCase()))
      );

      if (matchedRule) {
        companyName = matchedRule.name;
        identifiers.push(...(matchedRule.identifiers || []));
        sensitiveTerms.push(...(matchedRule.sensitiveTerms || []));
      } else {
        // If no match, try to guess name from first line or common patterns
        companyName = text.split('\n')[0].substring(0, 30) || "New Company";
        // Extract some potential identifiers (long words, unique strings)
        const potentialIds = words
          .filter(w => w.text.length > 5 && /^[A-Z0-9]+$/.test(w.text))
          .map(w => w.text)
          .slice(0, 5);
        identifiers.push(...potentialIds);
      }

      // 2. Compare pages to find redactions
      for (let i = 1; i <= originalPdf.numPages; i++) {
        setProgress(Math.round((i / originalPdf.numPages) * 100));
        
        const origPage = await originalPdf.getPage(i);
        const redPage = await redactedPdf.getPage(i);
        
        const vp = origPage.getViewport({ scale: 2.0 }); // Use higher scale for better OCR alignment
        const canvasOrig = document.createElement('canvas');
        const canvasRed = document.createElement('canvas');
        canvasOrig.width = vp.width; canvasOrig.height = vp.height;
        canvasRed.width = vp.width; canvasRed.height = vp.height;
        
        await origPage.render({ canvasContext: canvasOrig.getContext('2d')!, viewport: vp, canvas: canvasOrig }).promise;
        await redPage.render({ canvasContext: canvasRed.getContext('2d')!, viewport: vp, canvas: canvasRed }).promise;

        const imgOrig = canvasOrig.getContext('2d')!.getImageData(0, 0, vp.width, vp.height);
        const imgRed = canvasRed.getContext('2d')!.getImageData(0, 0, vp.width, vp.height);
        
        const boxes = findRedactedBoxes(imgOrig, imgRed, vp.width, vp.height);
        
        if (boxes.length > 0) {
          // Perform OCR on the original page to label boxes
          const pageOcr = await performLocalOCR(canvasOrig.toDataURL('image/png')) as any;
          
          boxes.forEach(box => {
            // Find words inside this box
            const boxWords = pageOcr.words.filter(w => {
              const wx = (w.x / vp.width) * 100;
              const wy = (w.y / vp.height) * 100;
              const ww = (w.width / vp.width) * 100;
              const wh = (w.height / vp.height) * 100;
              
              // Simple overlap check
              return wx >= box.x - 1 && wx + ww <= box.x + box.width + 1 &&
                     wy >= box.y - 1 && wy + wh <= box.y + box.height + 1;
            });

            const label = boxWords.map(w => w.text).join(' ') || "Redacted Area";
            learnedCoordinates.push({
              pageIndex: i - 1,
              ...box,
              label
            });
          });
        }
      }

      const newRule: CompanyRule = {
        id: Math.random().toString(36).substring(7),
        name: companyName,
        patterns: [],
        sensitiveTerms: sensitiveTerms,
        learnedCoordinates,
        identifiers,
        description: `Learned from training session ${session.id}`
      };

      setSession(prev => ({
        ...prev,
        status: 'completed',
        learnedData: {
          companyName,
          suggestedRules: newRule
        }
      }));

      addAlert('success', `Training complete! Detected: ${companyName}`);

    } catch (error) {
      console.error(error);
      setSession(prev => ({ ...prev, status: 'error' }));
      addAlert('error', 'Training failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const saveLearnedRule = () => {
    if (session.learnedData) {
      setSettings(prev => ({
        ...prev,
        companyRules: [...prev.companyRules, session.learnedData!.suggestedRules]
      }));
      addAlert('success', 'Company rule saved to library.');
      setSession({ id: Math.random().toString(36).substring(7), status: 'idle' });
    }
  };

  function findRedactedBoxes(orig: ImageData, red: ImageData, width: number, height: number) {
    const diff: boolean[] = new Array(width * height).fill(false);
    let hasDiff = false;

    for (let i = 0; i < orig.data.length; i += 4) {
      const r1 = orig.data[i], g1 = orig.data[i+1], b1 = orig.data[i+2];
      const r2 = red.data[i], g2 = red.data[i+1], b2 = red.data[i+2];
      
      const isBlack = r2 < 30 && g2 < 30 && b2 < 30;
      const wasNotBlack = r1 > 50 || g1 > 50 || b1 > 50;

      if (isBlack && wasNotBlack) {
        diff[i / 4] = true;
        hasDiff = true;
      }
    }

    if (!hasDiff) return [];

    const boxes: { x: number, y: number, width: number, height: number }[] = [];
    const visited = new Set<number>();

    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const idx = y * width + x;
        if (diff[idx] && !visited.has(idx)) {
          let minX = x, maxX = x, minY = y, maxY = y;
          const stack = [[x, y]];
          visited.add(idx);

          while (stack.length > 0) {
            const [cx, cy] = stack.pop()!;
            minX = Math.min(minX, cx);
            maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy);
            maxY = Math.max(maxY, cy);

            const neighbors = [[cx+10, cy], [cx-10, cy], [cx, cy+10], [cx, cy-10]];
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (diff[nidx] && !visited.has(nidx)) {
                  visited.add(nidx);
                  stack.push([nx, ny]);
                }
              }
            }
          }

          const w = maxX - minX;
          const h = maxY - minY;
          if (w > 20 && h > 10) {
            boxes.push({
              x: (minX / width) * 100,
              y: (minY / height) * 100,
              width: (w / width) * 100,
              height: (h / height) * 100
            });
          }
        }
      }
    }

    return boxes;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12">
        <h2 className="text-4xl font-bold tracking-tight mb-4">AI Training Lab</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">
          Train the AI by providing examples of original and redacted documents. 
          The AI will learn the company's layout and specific redaction requirements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider text-neutral-500">1. Original Document (Unredacted)</label>
          <div className={cn(
            "relative h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all",
            session.originalFile ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : "border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white"
          )}>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'original')}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {session.originalFile ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <span className="text-sm font-medium">{session.originalFile.name}</span>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-sm text-neutral-500">Upload Original PDF</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider text-neutral-500">2. Rejected Document (Redacted)</label>
          <div className={cn(
            "relative h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all",
            session.redactedFile ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" : "border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white"
          )}>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => handleFileChange(e, 'redacted')}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {session.redactedFile ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <span className="text-sm font-medium">{session.redactedFile.name}</span>
              </>
            ) : (
              <>
                <EyeOff className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-sm text-neutral-500">Upload Redacted PDF</span>
              </>
            )}
          </div>
        </div>
      </div>

      {session.status === 'analyzing' ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-6 text-neutral-400" />
          <h3 className="text-2xl font-bold mb-2">Analyzing Documents...</h3>
          <p className="text-neutral-500 mb-8">Comparing layouts and identifying redaction patterns.</p>
          <div className="w-full max-w-md mx-auto h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-black dark:bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-4 text-sm font-mono">{progress}% Complete</p>
        </div>
      ) : session.status === 'completed' && session.learnedData ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold mb-1">Training Results</h3>
              <p className="text-neutral-500">The AI has successfully learned from your examples.</p>
            </div>
            <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-bold uppercase tracking-wider">
              Success
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Detected Company</label>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-xl font-bold">{session.learnedData.companyName}</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Learned Patterns</label>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-xl font-bold">{session.learnedData.suggestedRules.learnedCoordinates?.length || 0} Fixed Areas</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Sensitive Terms</label>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-xl font-bold">{session.learnedData.suggestedRules.sensitiveTerms?.length || 0} Terms</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">Company Identifiers</label>
            <div className="flex flex-wrap gap-2">
              {session.learnedData.suggestedRules.identifiers?.map((id, idx) => (
                <span key={idx} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700">
                  {id}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={saveLearnedRule}
              className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save to Company Library
            </button>
            <button 
              onClick={() => setSession({ id: Math.random().toString(36).substring(7), status: 'idle' })}
              className="px-8 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Discard
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center">
          <button 
            onClick={runTraining}
            disabled={!session.originalFile || !session.redactedFile}
            className="w-full max-w-md py-6 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-bold text-xl hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center gap-3 shadow-xl"
          >
            <Play className="w-6 h-6" />
            Analyze & Train AI
          </button>
          <p className="mt-6 text-neutral-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            This process uses AI to compare document layouts and identify sensitive fields.
          </p>
        </div>
      )}
    </div>
  );
}
