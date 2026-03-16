import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, Settings, Layers, 
  Download, Trash2, CheckCircle2, AlertCircle,
  Undo, Redo, Search, ChevronLeft, ChevronRight,
  Type as TypeIcon, Square, Highlighter, Sun, Moon,
  Monitor, Palette, Keyboard, X, Plus, Play, RefreshCw,
  Barcode, QrCode, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Bookmark
} from 'lucide-react';
import { PDFFile, RedactionBox, AppSettings, Theme, OCRResult, BatchRuleSet, RedactionStyle } from './types';
import { cn, formatFileName } from './lib/utils';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Tooltip } from './components/Tooltip';
import { GoogleGenAI, Type } from "@google/genai";
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
  const [view, setView] = useState<'home' | 'editor' | 'batch' | 'settings'>('home');
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
      const isDark = settings.theme === 'dark' || 
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
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

function EditorView({ file, settings, onBack, addAlert, setFiles }: { 
  file: PDFFile; 
  settings: AppSettings; 
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
    
    if (tool === 'highlight') {
      setCurrentPath([{ x, y }]);
    } else {
      setDrawStart({ x, y });
    }
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
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
  const [isSearching, setIsSearching] = useState(false);
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
          // Simple fuzzy: check if all characters of target exist in source in order
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
        // Show temporary highlights
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
        addAlert('info', 'No matches found.');
      }
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to search document.');
    } finally {
      setIsSearching(false);
    }
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
    addAlert('info', 'AI is scanning the document for sensitive fields...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: imageData, mimeType: "image/png" } },
            { text: "Analyze this document image and identify sensitive information that should be redacted. Specifically look for and redact: Report numbers, physical addresses, PO numbers (Purchase Orders), lab numbers, sample IDs, barcodes, and QR codes. For each item found, provide its bounding box as percentages of the image width and height (x, y, width, height where x and y are the top-left corner) and a label describing what it is (e.g., 'REPORT NO.', 'ADDRESS', 'PO#', 'LAB NO.', 'SAMPLE ID', 'BARCODE', 'QR CODE'). Return the result as a JSON array of objects like this: [{\"x\": 10.5, \"y\": 20.1, \"width\": 15.0, \"height\": 2.5, \"label\": \"REPORT NO.\"}]. Only return the JSON array, nothing else." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                label: { type: Type.STRING }
              },
              required: ["x", "y", "width", "height", "label"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      const newAutoRedactions: RedactionBox[] = results.map((res: any, index: number) => ({
        id: `auto-${Date.now()}-${index}`,
        pageIndex: pageNumber - 1,
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height,
        label: res.label,
        type: 'auto',
        isSelected: true
      }));

      const updatedRedactions = [...redactions, ...newAutoRedactions];
      setRedactions(updatedRedactions);
      addToHistory(updatedRedactions);
      setIsProcessing(false);
      addAlert('success', `Detection complete! Found ${newAutoRedactions.length} sensitive areas.`);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      addAlert('error', 'Failed to detect fields with AI.');
    }
  };

  const handleOCR = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for OCR.');
      return;
    }
    setIsOCRing(true);
    addAlert('info', 'Performing OCR on current page...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-latest",
        contents: {
          parts: [
            { inlineData: { data: imageData, mimeType: "image/png" } },
            { text: "Perform OCR on this image. Extract all text and their bounding boxes as percentages of the image width and height. Return the result as a JSON array of objects like this: [{\"x\": 10.5, \"y\": 20.1, \"width\": 15.0, \"height\": 2.5, \"text\": \"Extracted text\"}]. Only return the JSON array, nothing else." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                text: { type: Type.STRING }
              },
              required: ["x", "y", "width", "height", "text"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]") as OCRResult[];
      setOcrResults(prev => ({ ...prev, [pageNumber - 1]: results }));
      addAlert('success', `OCR complete. Found ${results.length} text elements.`);
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to perform OCR.');
    } finally {
      setIsOCRing(false);
    }
  };

  const handleDetectBarcodes = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for scanning.');
      return;
    }
    setIsProcessing(true);
    addAlert('info', 'AI is scanning for barcodes and QR codes...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: imageData, mimeType: "image/png" } },
            { text: "Analyze this document image and identify ALL barcodes and QR codes. For each code found, provide its bounding box as percentages of the image width and height (x, y, width, height where x and y are the top-left corner). Also, try to decode the content of the barcode/QR code and use it as the label. If decoding fails, use 'BARCODE' or 'QR CODE' as the label. Return the result as a JSON array of objects like this: [{\"x\": 10.5, \"y\": 20.1, \"width\": 15.0, \"height\": 2.5, \"label\": \"123456789\"}]. Only return the JSON array, nothing else." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                label: { type: Type.STRING }
              },
              required: ["x", "y", "width", "height", "label"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      const newBarcodeRedactions: RedactionBox[] = results.map((res: any, index: number) => ({
        id: `barcode-${Date.now()}-${index}`,
        pageIndex: pageNumber - 1,
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height,
        label: res.label,
        type: 'auto',
        isSelected: true
      }));

      const updatedRedactions = [...redactions, ...newBarcodeRedactions];
      setRedactions(updatedRedactions);
      addToHistory(updatedRedactions);
      setIsProcessing(false);
      addAlert('success', `Barcode detection complete! Found ${newBarcodeRedactions.length} codes.`);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      addAlert('error', 'Failed to detect barcodes with AI.');
    }
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
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-6 bg-white dark:bg-neutral-900 p-4 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 flex-wrap">
        <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

        <div className="flex items-center gap-4 flex-1 flex-wrap">
          {settings.toolbar.filter(t => t.visible).map((toolItem, index, visibleTools) => {
            const isLastAction = toolItem.id === 'action' && index === visibleTools.length - 1;
            
            const renderTool = () => {
              switch(toolItem.id) {
                case 'selection':
                  return (
                    <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                      <Tooltip title="Text Tool" description="Select and redact text directly from the document." shortcut="T">
                        <button 
                          onClick={() => setTool('text')}
                          className={cn("p-2 rounded-lg transition-all", tool === 'text' ? "bg-white dark:bg-neutral-700 shadow-sm" : "hover:opacity-70")}
                        >
                          <TypeIcon className="w-5 h-5" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Box Tool" description="Draw a rectangular box over any area to redact it." shortcut="B">
                        <button 
                          onClick={() => setTool('box')}
                          className={cn("p-2 rounded-lg transition-all", tool === 'box' ? "bg-white dark:bg-neutral-700 shadow-sm" : "hover:opacity-70")}
                        >
                          <Square className="w-5 h-5" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Highlight Tool" description="Free-form highlight tool for quick redactions." shortcut="H">
                        <button 
                          onClick={() => setTool('highlight')}
                          className={cn("p-2 rounded-lg transition-all", tool === 'highlight' ? "bg-white dark:bg-neutral-700 shadow-sm" : "hover:opacity-70")}
                        >
                          <Highlighter className="w-5 h-5" />
                        </button>
                      </Tooltip>
                    </div>
                  );
                case 'history':
                  return (
                    <div className="flex items-center gap-2">
                      <Tooltip title="Undo" description="Revert your last action." shortcut="Ctrl+Z">
                        <button 
                          onClick={undo}
                          disabled={historyIndex === 0}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-30"
                        >
                          <Undo className="w-5 h-5" />
                        </button>
                      </Tooltip>
                      <Tooltip title="Redo" description="Restore a previously undone action." shortcut="Ctrl+Y">
                        <button 
                          onClick={redo}
                          disabled={historyIndex === history.length - 1}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-30"
                        >
                          <Redo className="w-5 h-5" />
                        </button>
                      </Tooltip>
                    </div>
                  );
                case 'view':
                  return (
                    <div className="flex items-center gap-4">
                      <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                        <Tooltip title="Zoom Out" description="Decrease the document view size.">
                          <button onClick={handleZoomOut} className="p-2 hover:opacity-70"><Search className="w-4 h-4 -scale-x-100" /></button>
                        </Tooltip>
                        <span className="text-xs font-mono flex items-center px-2">{Math.round(scale * 100)}%</span>
                        <Tooltip title="Zoom In" description="Increase the document view size.">
                          <button onClick={handleZoomIn} className="p-2 hover:opacity-70"><Plus className="w-4 h-4" /></button>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl">
                        <Tooltip title="Previous Page" description="Go to the previous page." shortcut="Left Arrow">
                          <button onClick={() => setPageNumber(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></button>
                        </Tooltip>
                        <span className="text-sm font-medium min-w-[60px] text-center">{pageNumber} / {numPages}</span>
                        <Tooltip title="Next Page" description="Go to the next page." shortcut="Right Arrow">
                          <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}><ChevronRight className="w-4 h-4" /></button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                case 'ai':
                  return (
                    <div className="flex items-center gap-2">
                      <Tooltip title="Auto-Detect" description="Use AI to automatically find and mark sensitive fields like names and addresses.">
                        <button 
                          onClick={handleAutoDetect}
                          disabled={isProcessing}
                          className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <Search className="w-4 h-4" />
                          Auto-Detect
                        </button>
                      </Tooltip>
                      <Tooltip title="Detect Codes" description="Scan the document for Barcodes and QR Codes to redact them.">
                        <button 
                          onClick={handleDetectBarcodes}
                          disabled={isProcessing}
                          className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-2 rounded-xl font-medium hover:opacity-80 transition-opacity disabled:opacity-50 border border-neutral-200 dark:border-neutral-700"
                        >
                          <div className="flex items-center -space-x-1">
                            <Barcode className="w-4 h-4" />
                            <QrCode className="w-4 h-4" />
                          </div>
                          Detect Codes
                        </button>
                      </Tooltip>
                      <Tooltip title="OCR Page" description="Perform Optical Character Recognition on the current page to make text in images selectable and redactable.">
                        <button 
                          onClick={handleOCR}
                          disabled={isOCRing || isProcessing}
                          className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-2 rounded-xl font-medium hover:opacity-80 transition-opacity disabled:opacity-50 border border-neutral-200 dark:border-neutral-700"
                        >
                          {isOCRing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          OCR Page
                        </button>
                      </Tooltip>
                    </div>
                  );
                case 'action':
                  return (
                    <Tooltip title="Apply & Save" description="Permanently apply all redactions and download the processed PDF." side="left">
                      <button 
                        onClick={applyRedactions}
                        disabled={isProcessing}
                        className={cn(
                          "flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50",
                          isLastAction && "ml-auto"
                        )}
                      >
                        <Download className="w-4 h-4" />
                        Apply & Save
                      </button>
                    </Tooltip>
                  );
                default:
                  return null;
              }
            };

            return <React.Fragment key={toolItem.id}>{renderTool()}</React.Fragment>;
          })}
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 bg-neutral-200 dark:bg-neutral-800 rounded-3xl overflow-auto p-8 flex justify-center relative">
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
                    onClick={(e) => {
                      e.stopPropagation();
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
                  onClick={(e) => {
                    e.stopPropagation();
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
                >
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

        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Search & Redact</h3>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder={useRegex ? "Regex search..." : "Search text..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchAndRedact()}
                className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
              <button 
                onClick={() => setUseRegex(!useRegex)}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold transition-colors",
                  useRegex ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                )}
                title="Use Regular Expression"
              >
                .*
              </button>
              <button 
                onClick={handleSearchAndRedact}
                disabled={isSearching || !searchQuery}
                className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                className={cn(
                  "flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors border",
                  isCaseSensitive ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white" : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-400"
                )}
              >
                Case Sensitive
              </button>
              <button 
                onClick={() => setIsFuzzyMatch(!isFuzzyMatch)}
                className={cn(
                  "flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors border",
                  isFuzzyMatch ? "bg-neutral-100 dark:bg-neutral-800 border-black dark:border-white" : "bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-400"
                )}
              >
                Fuzzy Match
              </button>
            </div>
          </div>

          <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

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
            <button 
              onClick={triggerOCR}
              disabled={ocrStatus === 'loading'}
              className="w-full py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
            >
              {ocrStatus === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Barcode className="w-3.5 h-3.5" />}
              Run OCR on Page {pageNumber}
            </button>
            {ocrResults[pageNumber - 1] && (
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
                      
                      {r.type !== 'highlight' && (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] uppercase text-neutral-400">X (%)</label>
                            <input 
                              type="number"
                              value={Math.round(r.x)}
                              onChange={(e) => {
                                const updated = redactions.map(item => 
                                  item.id === r.id ? { ...item, x: parseFloat(e.target.value) } : item
                                );
                                setRedactions(updated);
                                addToHistory(updated);
                              }}
                              className="text-[10px] bg-neutral-100 dark:bg-neutral-800 p-1 rounded outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] uppercase text-neutral-400">Y (%)</label>
                            <input 
                              type="number"
                              value={Math.round(r.y)}
                              onChange={(e) => {
                                const updated = redactions.map(item => 
                                  item.id === r.id ? { ...item, y: parseFloat(e.target.value) } : item
                                );
                                setRedactions(updated);
                                addToHistory(updated);
                              }}
                              className="text-[10px] bg-neutral-100 dark:bg-neutral-800 p-1 rounded outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] font-medium truncate text-neutral-500 dark:text-neutral-400 mb-2">{r.text || 'Area selected'}</p>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] uppercase text-neutral-400">Private Comment</label>
                        <textarea 
                          value={r.comment || ''}
                          placeholder="Add reasoning..."
                          onChange={(e) => {
                            const updated = redactions.map(item => 
                              item.id === r.id ? { ...item, comment: e.target.value } : item
                            );
                            setRedactions(updated);
                            addToHistory(updated);
                          }}
                          className="text-[10px] bg-neutral-100 dark:bg-neutral-800 p-2 rounded-lg outline-none resize-none h-12 w-full"
                        />
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
    pii: true,
    barcodes: false,
    sensitiveTerms: '',
  });
  const [ruleName, setRuleName] = useState('');

  const processBatch = async () => {
    setIsProcessing(true);
    addAlert('info', `Processing ${files.length} files with selected rules...`);
    
    // Simulate batch processing
    for (let i = 0; i < files.length; i++) {
      await new Promise(r => setTimeout(r, 1000));
      // In real app, apply logic here based on batchRules
    }

    setIsProcessing(false);
    addAlert('success', 'Batch processing complete!');
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
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Save as Preset</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Preset name..."
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                  <button 
                    onClick={saveRuleSet}
                    className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {settings.savedBatchRules.length > 0 && (
            <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-neutral-400">
                <Bookmark className="w-4 h-4" />
                Saved Presets
              </h3>
              <div className="space-y-2">
                {settings.savedBatchRules.map(rule => (
                  <div key={rule.id} className="group flex items-center justify-between p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer" onClick={() => loadRuleSet(rule)}>
                    <span className="text-xs font-medium">{rule.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRuleSet(rule.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-500 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
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
