import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileText, Settings, Layers, Globe,
  Download, Trash2, CheckCircle2, AlertCircle,
  Undo, Redo, Undo2, Redo2, Search, SearchX, ChevronLeft, ChevronRight, Zap, ChevronDown, LayoutGrid, Lock, Unlock, FileUp, Files, Settings2, Info, HelpCircle, ExternalLink, ArrowLeft,
  Type as TypeIcon, Square, Highlighter, Sun, Moon,
  Monitor, Palette, Keyboard, X, Plus, Play, RefreshCw, Sparkles, Check,
  Barcode, QrCode, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Bookmark, Brain, MousePointer2, Move, ShieldCheck, ShieldAlert, Star, FileJson, Database, History as HistoryIcon, Loader2, Minus, Eraser, ScrollText, Touchpad, RotateCcw,
  Wrench, FileSearch, Shield, ArrowRightLeft, Layout, Scissors, Maximize, Minimize, FilePlus, FileMinus, FileCheck, Languages, Share2
} from 'lucide-react';
import { SecurityAudit } from './components/SecurityAudit';
import { PDFFile, RedactionBox, AppSettings, Theme, OCRResult, BatchRuleSet, RedactionStyle, CompanyRule, TrainingSession, ToolbarToolConfig, ToolbarToolId } from './types';
import { cn, formatFileName } from './lib/utils';
import { PDFDocument, rgb } from 'pdf-lib';
import { PDFViewer } from './components/PDFViewer';
import { RedactionBoxComponent } from './components/RedactionBox';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Tooltip } from './components/Tooltip';

import { 
  performLocalOCR, detectPIILocal, detectSensitiveTermsLocal, detectAdvancedAI, unlockPDF, trainModelFromFiles,
  detectCompanyFromText,
  LocalDetectionResult 
} from './lib/ai';
import { validateDataWithAPI, RECOMMENDED_APIS } from './services/publicApiService';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
// import * as pdfjs from 'pdfjs-dist'; // Use pdfjs from react-pdf instead
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { StirlingTools } from './components/StirlingTools';
import { ToolDialog } from './components/ToolDialog';

// --- Sub-components ---

function ToolbarButton({ 
  icon: Icon, 
  label, 
  onClick, 
  active = false, 
  disabled = false,
  variant = 'default',
  shortcut
}: { 
  icon: any; 
  label: string; 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success' | 'ghost';
  shortcut?: string;
}) {
  const variants = {
    default: active 
      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105" 
      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
    danger: "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
    success: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
  };

  return (
    <Tooltip title={label} shortcut={shortcut}>
      <motion.button
        whileHover={{ scale: 1.05, rotate: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "p-3 rounded-xl transition-all flex flex-col items-center gap-1 min-w-[64px] group disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-800",
          variants[variant]
        )}
      >
        <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active && "animate-pulse")} />
        <span className="text-[10px] font-medium opacity-70">{label}</span>
      </motion.button>
    </Tooltip>
  );
}


// Set up PDF.js worker
console.log('PDF.js version:', pdfjs.version);
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
    sensitivity: 0.7,
  },
  ocrConfig: {
    engine: 'tesseract',
    language: 'eng',
    autoRotate: true,
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
  redactionWordList: [
    'CONFIDENTIAL', 'PROPRIETARY', 'INTERNAL', 'SENSITIVE', 
    'PRIVATE', 'RESTRICTED', 'SECRET', 'CLASSIFIED'
  ],
  customTheme: {
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    accentColor: '#2563eb',
    gradientColor1: '#2563eb',
    gradientColor2: '#22d3ee',
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
    selectionTool: 'v',
    autoDetect: 'a',
    ocr: 'o',
    applyRedactions: 'Enter',
    toggleReview: 'r',
  }
};

export default function App() {
  const [view, setView] = useState<'home' | 'editor' | 'batch' | 'settings' | 'training' | 'api-hub' | 'stirling-tools' | 'rule-studio' | 'split' | 'merge'>('home');
  const [activeTool, setActiveTool] = useState<any>(null);
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
      };

      const checkIsDark = (color: string) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128;
      };

      if (settings.theme === 'custom' && settings.customTheme) {
        const { primaryColor, secondaryColor, accentColor, fontFamily, gradientColor1, gradientColor2 } = settings.customTheme;
        document.documentElement.style.setProperty('--primary', primaryColor);
        document.documentElement.style.setProperty('--secondary', secondaryColor);
        document.documentElement.style.setProperty('--accent', accentColor);
        document.documentElement.style.setProperty('--bg-color', primaryColor);
        
        if (gradientColor1) {
          document.documentElement.style.setProperty('--gradient-1', hexToRgb(gradientColor1));
          document.documentElement.style.setProperty('--bg-color-1', gradientColor1);
        }
        if (gradientColor2) {
          document.documentElement.style.setProperty('--gradient-2', hexToRgb(gradientColor2));
          document.documentElement.style.setProperty('--bg-color-2', gradientColor2);
        }
        if (fontFamily) {
          document.documentElement.style.setProperty('--font-family', fontFamily);
        }
        
        isDark = checkIsDark(primaryColor);
        document.documentElement.style.setProperty('--text-primary', isDark ? '#ffffff' : '#000000');
      } else {
        // Reset to defaults
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--secondary');
        document.documentElement.style.removeProperty('--accent');
        document.documentElement.style.removeProperty('--gradient-1');
        document.documentElement.style.removeProperty('--gradient-2');
        document.documentElement.style.removeProperty('--font-family');
        document.documentElement.style.removeProperty('--text-primary');
        document.documentElement.style.removeProperty('--bg-color');
        document.documentElement.style.removeProperty('--bg-color-1');
        document.documentElement.style.removeProperty('--bg-color-2');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* TOP HEADER (52px) */}
      <header className="fixed top-0 left-0 right-0 h-[52px] border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-500/20">
            <Layers className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-none">Redectio</span>
            <span className="text-[10px] text-slate-500 font-medium leading-none mt-1">AI-Powered Redaction</span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {[
            { id: 'home', label: 'Home', icon: Globe },
            { id: 'editor', label: 'Redaction', icon: FileText },
            { id: 'training', label: 'AI Training', icon: Brain },
            { id: 'rule-studio', label: 'Rule Studio', icon: Database },
            { id: 'stirling-tools', label: 'Toolbox', icon: LayoutGrid },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={cn(
                "px-4 py-2 text-xs font-semibold transition-all flex items-center gap-2 rounded-lg",
                view === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          ))}
          <div className="ml-4 px-2 py-1 bg-cyan-500 text-black text-[9px] font-bold rounded-full">
            BETA
          </div>
        </nav>
      </header>

      <main className="pt-[52px] pb-[32px] min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView 
              onFileSelect={(file) => {
                const newFile = {
                  id: Math.random().toString(36).substring(7),
                  file,
                  name: file.name,
                  url: URL.createObjectURL(file),
                  numPages: 0,
                  redactions: [],
                  status: 'idle' as const,
                };
                setFiles(prev => [...prev, newFile]);
                setActiveFileId(newFile.id);
                setView('editor');
              }}
              onToolSelect={(toolId) => {
                if (toolId === 'stirling-tools' || toolId === 'batch' || toolId === 'training' || toolId === 'settings' || toolId === 'api-hub' || toolId === 'rule-studio' || toolId === 'split' || toolId === 'merge') {
                  setView(toolId as any);
                } else {
                  setView('stirling-tools');
                }
              }}
            />
          )}

          {view === 'editor' && (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              {activeFile ? (
                <EditorView 
                  file={activeFile} 
                  settings={settings} 
                  setSettings={setSettings}
                  onBack={() => setView('home')} 
                  setView={setView}
                  addAlert={addAlert}
                  setFiles={setFiles}
                  isMobile={isMobile}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-12 p-12">
                  <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Redaction Studio</h1>
                    <p className="text-sm font-medium text-slate-400">Upload document for AI analysis</p>
                  </div>
                  
                  <label className="group relative flex flex-col items-center justify-center w-full max-w-2xl h-80 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 bg-white dark:bg-slate-900">
                    <div className="relative flex flex-col items-center justify-center p-8">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                        <FileUp className="w-10 h-10" />
                      </div>
                      <p className="text-sm font-bold mb-2">Select PDF Document</p>
                      <p className="text-xs text-slate-400 font-medium">or drag and drop here</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  </label>

                  {files.length > 0 && (
                    <div className="w-full max-w-2xl space-y-4">
                      <h3 className="text-xs font-bold text-slate-400">Recent Documents</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {files.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setActiveFileId(f.id)}
                            className={cn(
                              "flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all shadow-sm",
                              f.id === activeFileId 
                                ? "bg-blue-600 text-white border-blue-600" 
                                : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <FileText className="w-5 h-5" />
                              <span className="text-sm font-semibold truncate max-w-[300px]">{f.name}</span>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className="text-xs font-medium opacity-60">{f.redactions.length} Redactions</span>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                addAlert={addAlert}
                isMobile={isMobile}
              />
            </motion.div>
          )}

          {view === 'rule-studio' && (
            <motion.div
              key="rule-studio"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <RuleStudioView 
                settings={settings} 
                setSettings={setSettings} 
                addAlert={addAlert}
              />
            </motion.div>
          )}

          {view === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex"
            >
              <TrainingView 
                settings={settings} 
                setSettings={setSettings} 
                addAlert={addAlert}
              />
            </motion.div>
          )}

          {view === 'stirling-tools' && (
            <motion.div
              key="stirling-tools"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex"
            >
              <PDFToolboxView 
                onToolClick={() => {}} 
                addAlert={addAlert}
              />
            </motion.div>
          )}

          {view === 'split' && (
            <motion.div
              key="split"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex"
            >
              <SplitView 
                file={activeFile || undefined} 
                onBack={() => setView('home')} 
                addAlert={addAlert} 
                isMobile={isMobile}
              />
            </motion.div>
          )}

          {view === 'merge' && (
            <motion.div
              key="merge"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex"
            >
              <MergeView 
                onBack={() => setView('home')} 
                addAlert={addAlert} 
                isMobile={isMobile}
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

function EditorView({ file, settings, setSettings, onBack, setView, addAlert, setFiles, isMobile }: { 
  file: PDFFile; 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  setView: (view: 'home' | 'editor' | 'batch' | 'settings' | 'training' | 'api-hub') => void;
  addAlert: (type: any, msg: string) => void;
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
  isMobile: boolean;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [tool, setTool] = useState<'selection' | 'text' | 'box' | 'highlight'>('box');
  const [searchOptions, setSearchOptions] = useState({ caseSensitive: false, fuzzyMatch: false });
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [isTouchEnabled, setIsTouchEnabled] = useState(false);
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
  const selectedRedaction = redactions.find(r => r.isSelected);
  const [identifiedCompany, setIdentifiedCompany] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'redactions' | 'ocr' | 'templates' | 'audit' | 'logs' | 'history' | 'suggestions' | 'report'>('redactions');
  const [aiSuggestions, setAiSuggestions] = useState<RedactionBox[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<{
    type: 'drag' | 'resize';
    redactionId: string;
    handle?: string;
    initialMouse: { x: number; y: number };
    initialRect: { x: number; y: number; width: number; height: number };
    initialRects?: Record<string, { x: number; y: number; width: number; height: number }>;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [hoveredOCR, setHoveredOCR] = useState<OCRResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; timestamp: Date; details?: string }[]>([]);
  const [isContinuousScroll, setIsContinuousScroll] = useState(false);

  const handleSave = () => {
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, redactions } : f));
    addAlert('success', 'Changes saved to document state.');
    addAuditLog('Save', 'Saved current redactions to document state.');
  };

  const handleApplyAndDownload = () => {
    setShowConfirmApply(true);
  };

  const handleAcceptSuggestion = (suggestion: RedactionBox) => {
    const newRedactions = [...redactions, { ...suggestion, id: `redact-${Date.now()}`, type: 'auto' as const }];
    setRedactions(newRedactions);
    addToHistory(newRedactions);
    setAiSuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));
    addAlert('success', `Accepted suggestion: ${suggestion.text || suggestion.label}`);
    addAuditLog('Accept Suggestion', `Accepted AI suggestion: ${suggestion.text || suggestion.label}`);
  };

  const handleDismissSuggestion = (id: string) => {
    setAiSuggestions(aiSuggestions.filter(s => s.id !== id));
    addAlert('info', 'Dismissed AI suggestion');
    addAuditLog('Dismiss Suggestion', `Dismissed AI suggestion: ${id}`);
  };

  const handleComment = (id: string, comment: string) => {
    setCommentModal({ isOpen: true, redactionId: id, comment });
    addAuditLog('Add Comment', `Opened comment modal for ${id}`);
  };

  const addAuditLog = (action: string, details?: string) => {
    setAuditLogs(prev => [{ id: Math.random().toString(36).substring(7), action, timestamp: new Date(), details }, ...prev].slice(0, 100));
  };

  const addToHistory = (newRedactions: RedactionBox[]) => {
    const nextHistory = [...history.slice(0, historyIndex + 1), newRedactions].slice(-50);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    // Continuous Learning: Update company rules based on manual redactions
    if (file && identifiedCompany) {
      const manualRedactions = newRedactions.filter(r => r.type === 'manual');
      if (manualRedactions.length > 0) {
        addAuditLog(`Added ${manualRedactions.length} manual redactions`);
        setSettings(prev => {
          const companyRules = [...prev.companyRules];
          const ruleIndex = companyRules.findIndex(r => r.name === identifiedCompany);
          
          if (ruleIndex !== -1) {
            const rule = companyRules[ruleIndex];
            const newCoordinates = [...(rule.learnedCoordinates || [])];
            
            manualRedactions.forEach(mr => {
              // Avoid duplicates
              const isDuplicate = newCoordinates.some(c => 
                c.pageIndex === mr.pageIndex && 
                Math.abs(c.x - mr.x) < 1 && 
                Math.abs(c.y - mr.y) < 1
              );
              
              if (!isDuplicate) {
                newCoordinates.push({
                  id: `learned-${Date.now()}-${Math.random()}`,
                  pageIndex: mr.pageIndex,
                  x: mr.x,
                  y: mr.y,
                  width: mr.width,
                  height: mr.height,
                  label: mr.label || 'MANUAL',
                  type: 'auto',
                  isSelected: false
                });
              }
            });
            
            companyRules[ruleIndex] = { ...rule, learnedCoordinates: newCoordinates };
          }
          
          return { ...prev, companyRules };
        });
      }
    }
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

  const redactEntirePage = (pageIndex: number) => {
    const newRedaction: RedactionBox = {
      id: Math.random().toString(36).substring(7),
      pageIndex,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      type: 'manual',
      label: `Page ${pageIndex + 1} Full Redaction`,
      isSelected: false
    };
    const nextRedactions = [...redactions, newRedaction];
    setRedactions(nextRedactions);
    addToHistory(nextRedactions);
    addAuditLog(`Redacted entire page ${pageIndex + 1}`);
    addAlert('success', `Page ${pageIndex + 1} has been fully redacted.`);
  };

  const exportTemplates = () => {
    const data = JSON.stringify(settings.companyRules, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redectio-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    addAuditLog('Exported company templates');
  };

  const importTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setSettings(prev => {
            const existingNames = new Set(prev.companyRules.map(r => r.name));
            const newRules = imported.filter(r => !existingNames.has(r.name));
            if (newRules.length === 0) {
              addAlert('info', 'All templates already exist.');
              return prev;
            }
            addAlert('success', `Imported ${newRules.length} new templates successfully.`);
            addAuditLog(`Imported ${newRules.length} templates`);
            return { ...prev, companyRules: [...prev.companyRules, ...newRules] };
          });
        }
      } catch (err) {
        addAlert('error', 'Invalid template file format.');
      }
    };
    reader.readAsText(file);
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
        const isTarget = r.id === activeInteraction.redactionId;
        const isSelectedPart = redactions.find(red => red.id === activeInteraction.redactionId)?.isSelected && r.isSelected;
        
        if (isTarget || isSelectedPart) {
          const initial = activeInteraction.initialRects?.[r.id] || (isTarget ? activeInteraction.initialRect : null);
          if (!initial) return r;

          if (activeInteraction.type === 'drag') {
            return {
              ...r,
              x: initial.x + dx,
              y: initial.y + dy
            };
          } else if (activeInteraction.type === 'resize' && activeInteraction.handle) {
            let { x: rx, y: ry, width: rw, height: rh } = initial;
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const commonSuggestions = [
    'Name', 'Email', 'Phone', 'SSN', 'Address', 'Credit Card', 'Date of Birth', 
    'Password', 'API Key', 'Secret', 'Confidential', 'Internal Only', 
    'Draft', 'Proprietary', 'Trade Secret', 'Financial Data', 'Medical Record',
    'Customer ID', 'Account Number', 'IBAN', 'Passport Number', 'Driver License',
    'Tax ID', 'National ID', 'Social Security', 'Phone Number', 'Email Address',
    'Home Address', 'Work Address', 'Billing Address', 'Shipping Address'
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
  const [isPageRendered, setIsPageRendered] = useState(false);

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

      // Identify Company from first page text
      const firstPage = await pdf.getPage(1);
      const textContent = await firstPage.getTextContent();
      const fullText = textContent.items.map((item: any) => item.str).join(' ');
      
      const matchedRule = settings.companyRules?.find(r => 
        (r.identifiers || []).some(id => fullText.toLowerCase().includes(id.toLowerCase()))
      );
      
      if (matchedRule) {
        setIdentifiedCompany(matchedRule.name);
        addAlert('info', `Identified company: ${matchedRule.name}. Applying learned rules.`);
        
        // Apply learned coordinates if they exist
        if (matchedRule.learnedCoordinates && matchedRule.learnedCoordinates.length > 0) {
          const learnedRedactions: RedactionBox[] = matchedRule.learnedCoordinates.map(coord => ({
            id: Math.random().toString(36).substring(7),
            pageIndex: coord.pageIndex,
            x: coord.x,
            y: coord.y,
            width: coord.width,
            height: coord.height,
            type: 'auto',
            label: coord.label || 'Learned Redaction',
            isSelected: false
          }));
          
          setRedactions(prev => {
            const updated = [...prev, ...learnedRedactions];
            addToHistory(updated);
            return updated;
          });
        }
      }
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
      const result = await performLocalOCR(file.url, { language: 'eng' }) as any;
      
      setOcrResults(prev => ({ ...prev, [pageNumber - 1]: result.words }));
      setOcrStatus('success');
      addAlert('success', `OCR complete for Page ${pageNumber}. Found ${result.words.length} items.`);
    } catch (error: any) {
      setOcrStatus('error');
      let errorMessage = 'OCR failed.';
      let actionAdvice = 'Please try again later.';

      if (error.message === 'FILE_TOO_LARGE') {
        errorMessage = 'File too large for processing.';
        actionAdvice = 'Please upload a smaller file (under 10MB) or process pages individually.';
      } else if (error.message === 'LANGUAGE_PACK_NOT_FOUND') {
        errorMessage = 'Tesseract language pack not found.';
        actionAdvice = 'Please ensure the required language packs are installed or try a different language.';
      } else if (error.message === 'FASTAPI_FAILED') {
        errorMessage = 'OCR service (FastAPI) failed.';
        actionAdvice = 'Please check if the OCR server is running or try a different OCR engine.';
      }

      addAlert('error', `${errorMessage} ${actionAdvice}`);
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

  useEffect(() => {
    if (pdf && !identifiedCompany) {
      const detectCompany = async () => {
        try {
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(' ');
          const matchedRule = detectCompanyFromText(text, settings.companyRules);
          if (matchedRule) {
            setIdentifiedCompany(matchedRule.name);
            addAlert('info', `Detected Company: ${matchedRule.name}. Applying learned patterns...`);
            
            // Apply learned coordinates automatically
            if (matchedRule.learnedCoordinates && matchedRule.learnedCoordinates.length > 0) {
              setRedactions(prev => {
                const newRedactions = [...prev];
                let addedCount = 0;
                matchedRule.learnedCoordinates.forEach((coord, index) => {
                  const exists = newRedactions.some(r => 
                    r.pageIndex === coord.pageIndex && 
                    Math.abs(r.x - coord.x) < 1 && 
                    Math.abs(r.y - coord.y) < 1
                  );
                  if (!exists) {
                    newRedactions.push({
                      id: `learned-${Date.now()}-${index}`,
                      pageIndex: coord.pageIndex,
                      x: coord.x,
                      y: coord.y,
                      width: coord.width,
                      height: coord.height,
                      label: coord.label || 'Learned Area',
                      type: 'auto',
                      isSelected: false
                    });
                    addedCount++;
                  }
                });
                if (addedCount > 0) {
                  addAlert('success', `Applied ${addedCount} learned redactions for ${matchedRule.name}`);
                  // We don't call addToHistory here because it would trigger the learning loop
                  // and we are already in a useEffect. We just update the state.
                }
                return newRedactions;
              });
            }
          }
        } catch (err) {
          console.error('Initial company detection failed:', err);
        }
      };
      detectCompany();
    }
  }, [pdf, settings.companyRules, identifiedCompany]);

  const handleUnlockPDF = async () => {
    setIsProcessing(true);
    addAlert('info', 'Unlocking PDF (Robust image-based rebuild)...');
    try {
      // 1. Load the PDF using pdfjs
      const pdfData = await fetch(file.url).then(res => res.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
      const numPages = pdf.numPages;
      
      // 2. Create a new PDF using pdf-lib
      const newPdfDoc = await PDFDocument.create();
      
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High quality
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        const imageBytes = await fetch(imageData).then(res => res.arrayBuffer());
        const embeddedImage = await newPdfDoc.embedJpg(imageBytes);
        
        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
      }
      
      const unlockedBase64 = await newPdfDoc.saveAsBase64();
      const blob = await fetch(`data:application/pdf;base64,${unlockedBase64}`).then(res => res.blob());
      const url = URL.createObjectURL(blob);
      
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, url, name: f.name.replace('.pdf', '_unlocked.pdf') } : f));
      addAlert('success', 'PDF unlocked and rebuilt successfully via image conversion.');
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to unlock PDF. The document might be heavily protected.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const check = (shortcut: string) => {
        if (!shortcut) return false;
        const parts = shortcut.toLowerCase().split('+');
        const hasCtrl = parts.includes('ctrl') || parts.includes('meta');
        const hasShift = parts.includes('shift');
        const mainKey = parts[parts.length - 1];
        return ctrl === hasCtrl && shift === hasShift && key === mainKey;
      };

      if (check(settings.shortcuts.undo)) {
        e.preventDefault();
        undo();
      } else if (check(settings.shortcuts.redo)) {
        e.preventDefault();
        redo();
      } else if (check(settings.shortcuts.search)) {
        e.preventDefault();
        setShowSearchPopup(true);
      } else if (ctrl && key === 's') {
        e.preventDefault();
        handleSave();
      } else if (ctrl && key === 'd') {
        e.preventDefault();
        handleApplyAndDownload();
      } else if (check(settings.shortcuts.selectionTool)) {
        setTool('selection');
      } else if (check(settings.shortcuts.textTool)) {
        setTool('text');
      } else if (check(settings.shortcuts.boxTool)) {
        setTool('box');
      } else if (check(settings.shortcuts.highlightTool)) {
        setTool('highlight');
      } else if (check(settings.shortcuts.autoDetect)) {
        handleAutoDetect();
      } else if (check(settings.shortcuts.ocr)) {
        handleOCR();
      } else if (check(settings.shortcuts.nextPage)) {
        setPageNumber(p => Math.min(numPages, p + 1));
      } else if (check(settings.shortcuts.prevPage)) {
        setPageNumber(p => Math.max(1, p - 1));
      } else if (check(settings.shortcuts.applyRedactions)) {
        setShowConfirmApply(true);
      } else if (check(settings.shortcuts.toggleReview)) {
        setIsReviewMode(prev => !prev);
      } else if (key === 'escape') {
        setShowSearchPopup(false);
        setTool('selection');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, numPages, isProcessing, ocrStatus, settings.shortcuts]);

  const handleZoomIn = () => setScale(s => Math.min(3, s + 0.1));
  const handleZoomOut = () => setScale(s => Math.max(0.5, s - 0.1));

  const pdfOptions = React.useMemo(() => ({
    password,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  }), [password]);

  useEffect(() => {
    setIsPageRendered(false);
  }, [pageNumber, file.id]);

  const generateAISuggestions = async () => {
    // Ensure canvas is ready, wait up to 3 seconds with more frequent checks
    let attempts = 0;
    while ((!canvasRef.current || !isPageRendered) && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!canvasRef.current || !isPageRendered) {
      addAlert('error', 'Document not ready for analysis. Please wait for the page to render.');
      return;
    }
    setIsGeneratingSuggestions(true);
    addAlert('info', 'AI is analyzing the document for suggestions...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      // 1. Perform OCR if not already done
      let text = (ocrResults[pageNumber - 1] || []).map(r => r.text).join(' ');
      let words = (ocrResults[pageNumber - 1] || []).map(r => ({
        text: r.text,
        bbox: { x0: r.x * canvas.width / 100, y0: r.y * canvas.height / 100, x1: (r.x + r.width) * canvas.width / 100, y1: (r.y + r.height) * canvas.height / 100 }
      })) as any;

      if (text.length === 0) {
        const ocrData = await performLocalOCR(imageData, settings.ocrConfig) as any;
        if (!ocrData) throw new Error('OCR failed');
        text = ocrData.text || '';
        words = ocrData.words || [];
        setOcrResults(prev => ({ ...prev, [pageNumber - 1]: ocrData.words.map((w: any) => ({
          text: w.text,
          x: (w.bbox.x0 / canvas.width) * 100,
          y: (w.bbox.y0 / canvas.height) * 100,
          width: ((w.bbox.x1 - w.bbox.x0) / canvas.width) * 100,
          height: ((w.bbox.y1 - w.bbox.y0) / canvas.height) * 100
        })) }));
      }

      const suggestions: RedactionBox[] = [];

      // 2. Advanced AI Detection
      const advancedDetections = await detectAdvancedAI(text, settings.aiDefaults, settings.companyProfile);
      advancedDetections.forEach((det, index) => {
        const matchedWords = words.filter((w: any) => det.text.toLowerCase().includes(w.text.toLowerCase()));
        if (matchedWords.length > 0) {
          const minX = Math.min(...matchedWords.map((w: any) => w.bbox.x0));
          const minY = Math.min(...matchedWords.map((w: any) => w.bbox.y0));
          const maxX = Math.max(...matchedWords.map((w: any) => w.bbox.x1));
          const maxY = Math.max(...matchedWords.map((w: any) => w.bbox.y1));

          suggestions.push({
            id: `suggest-ai-${Date.now()}-${index}`,
            pageIndex: pageNumber - 1,
            x: (minX / canvas.width) * 100,
            y: (minY / canvas.height) * 100,
            width: ((maxX - minX) / canvas.width) * 100,
            height: ((maxY - minY) / canvas.height) * 100,
            label: det.label,
            comment: det.reason,
            type: 'auto',
            isSelected: false,
            text: det.text
          });
        }
      });

      // 3. Apply Custom AI Rules from Settings
      if (settings.companyRules?.length > 0) {
        settings.companyRules.filter(r => r.isActive).forEach((rule, ruleIdx) => {
          // Regex Patterns
          (rule.patterns || []).forEach((patternStr, patIdx) => {
            try {
              const regex = new RegExp(patternStr, 'gi');
              let match;
              while ((match = regex.exec(text)) !== null) {
                const matchedText = match[0];
                const startIndex = match.index;
                const endIndex = startIndex + matchedText.length;

                // Find words that overlap with this match
                let currentPos = 0;
                const matchedWords: any[] = [];
                for (const word of words) {
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

                  suggestions.push({
                    id: `suggest-rule-${rule.id}-${patIdx}-${Date.now()}`,
                    pageIndex: pageNumber - 1,
                    x: (minX / canvas.width) * 100,
                    y: (minY / canvas.height) * 100,
                    width: ((maxX - minX) / canvas.width) * 100,
                    height: ((maxY - minY) / canvas.height) * 100,
                    label: rule.name,
                    comment: `Matched rule: ${rule.name} (Regex)`,
                    type: 'auto',
                    isSelected: false,
                    text: matchedText
                  });
                }
              }
            } catch (e) {
              console.error('Invalid regex:', patternStr);
            }
          });

          // Sensitive Terms
          (rule.sensitiveTerms || []).forEach((term, termIdx) => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
              const matchedText = match[0];
              const startIndex = match.index;
              const endIndex = startIndex + matchedText.length;

              let currentPos = 0;
              const matchedWords: any[] = [];
              for (const word of words) {
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

                suggestions.push({
                  id: `suggest-term-${rule.id}-${termIdx}-${Date.now()}`,
                  pageIndex: pageNumber - 1,
                  x: (minX / canvas.width) * 100,
                  y: (minY / canvas.height) * 100,
                  width: ((maxX - minX) / canvas.width) * 100,
                  height: ((maxY - minY) / canvas.height) * 100,
                  label: rule.name,
                  comment: `Matched rule: ${rule.name} (Term)`,
                  type: 'auto',
                  isSelected: false,
                  text: matchedText
                });
              }
            }
          });
        });
      }

      // Remove duplicates
      const uniqueSuggestions = suggestions.filter((s, index, self) =>
        index === self.findIndex((t) => (
          Math.abs(t.x - s.x) < 0.5 && Math.abs(t.y - s.y) < 0.5 && t.text === s.text
        ))
      );

      setAiSuggestions(uniqueSuggestions);
      setSidebarTab('suggestions');
      addAlert('success', `Found ${uniqueSuggestions.length} suggestions.`);
      addAuditLog('AI Suggestions', `Generated ${uniqueSuggestions.length} suggestions for page ${pageNumber}`);
    } catch (error) {
      console.error('Suggestion Error:', error);
      addAlert('error', 'Failed to generate suggestions.');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };
  const handleAutoDetect = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for scanning.');
      return;
    }
    setIsProcessing(true);
    addAlert('info', 'AI is scanning the document for sensitive fields...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      // 1. Perform OCR
      const ocrData = await performLocalOCR(imageData, settings.ocrConfig) as any;
      if (!ocrData) {
        throw new Error('OCR failed to return any data');
      }
      const text = ocrData.text || '';
      const words = ocrData.words || [];

      // 2. Advanced AI Detection (Local Engine)
      const advancedDetections = await detectAdvancedAI(text, settings.aiDefaults, settings.companyProfile);
      
      // 3. Company Identification
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

      // 4. Apply Advanced Detections
      advancedDetections.forEach((det, index) => {
        // Find coordinates for the detected text
        const matchedWords = words.filter((w: any) => det.text.toLowerCase().includes(w.text.toLowerCase()));
        if (matchedWords.length > 0) {
          const minX = Math.min(...matchedWords.map((w: any) => w.bbox.x0));
          const minY = Math.min(...matchedWords.map((w: any) => w.bbox.y0));
          const maxX = Math.max(...matchedWords.map((w: any) => w.bbox.x1));
          const maxY = Math.max(...matchedWords.map((w: any) => w.bbox.y1));

          newAutoRedactions.push({
            id: `advanced-${Date.now()}-${index}`,
            pageIndex: pageNumber - 1,
            x: (minX / canvas.width) * 100,
            y: (minY / canvas.height) * 100,
            width: ((maxX - minX) / canvas.width) * 100,
            height: ((maxY - minY) / canvas.height) * 100,
            label: det.label,
            comment: det.reason,
            type: 'auto',
            isSelected: true
          });
        }
      });

      // 5. Apply Learned Coordinates
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

      // 6. Local PII Detection (Fallback/Complementary)
      if (settings.aiDefaults?.piiEnabled) {
        const piiResults = detectPIILocal(text, words, settings.aiDefaults.sensitivity);
        piiResults.forEach((res, index) => {
          // Avoid duplicates from advanced detection
          if (!newAutoRedactions.some(r => Math.abs(r.x - (res.x / canvas.width) * 100) < 1 && Math.abs(r.y - (res.y / canvas.height) * 100) < 1)) {
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
          }
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
    addAlert('info', `Performing OCR using ${settings.ocrConfig?.engine || 'Tesseract'} (${settings.ocrConfig?.language || 'eng'})...`);
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      const ocrData = await performLocalOCR(imageData, { 
        language: settings.ocrConfig?.language, 
        engine: settings.ocrConfig?.engine 
      }) as any;
      
      if (!ocrData) {
        throw new Error('OCR failed to return any data');
      }
      
      const words = ocrData.words || [];
      const results: OCRResult[] = words.map((word: any) => ({
        text: word.text,
        x: (word.bbox.x0 / canvas.width) * 100,
        y: (word.bbox.y0 / canvas.height) * 100,
        width: ((word.bbox.x1 - word.bbox.x0) / canvas.width) * 100,
        height: ((word.bbox.y1 - word.bbox.y0) / canvas.height) * 100
      }));

      setOcrResults(prev => ({ ...prev, [pageNumber - 1]: results }));
      if (results.length === 0) {
        addAlert('info', 'OCR complete. No text elements found on this page.');
      } else {
        addAlert('success', `OCR complete. Found ${results.length} text elements.`);
      }
    } catch (error: any) {
      console.error(error);
      addAlert('error', error.message || 'OCR failed.');
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

      redactions.forEach(redaction => {
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Mobile Top Bar */}
      {isMobile && (
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-black truncate max-w-[120px]">{file.name}</span>
              <span className="text-[10px] font-bold text-slate-400">Page {pageNumber} of {numPages}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setView('settings')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowConfirmApply(true)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-lg shadow-blue-500/20"
            >
              Save
            </button>
          </div>
        </header>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ x: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex flex-col">
              <h1 className="text-sm font-black tracking-tight truncate max-w-[200px]">{file.name}</h1>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>{Math.round(file.file.size / 1024)} KB</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span>{numPages} Pages</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Page Controls - Desktop */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
                disabled={pageNumber === 1}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 min-w-[60px] justify-center">
                <input 
                  type="number"
                  min="1"
                  max={numPages}
                  value={pageNumber}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= numPages) setPageNumber(val);
                  }}
                  className="w-8 bg-transparent text-center font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 rounded"
                />
                <span className="text-sm font-bold text-slate-400">/ {numPages}</span>
              </div>
              <button 
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
                disabled={pageNumber === numPages}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

            {/* Zoom Controls - Desktop */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
              <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"><SearchX className="w-4 h-4" /></button>
              <span className="text-xs font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"><Search className="w-4 h-4" /></button>
            </div>

            <button 
              onClick={() => setView('settings')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400"
              title="Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowConfirmApply(true)}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Apply & Download</span>
              <span className="sm:hidden">Apply</span>
            </button>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Thumbnails (Stirling Style) */}
        <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400">Pages</h2>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">{numPages} Total</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPageNumber(num)}
                className={cn(
                  "w-full group relative transition-all duration-200",
                  pageNumber === num ? "scale-105" : "hover:scale-102"
                )}
              >
                <div className={cn(
                  "aspect-[1/1.414] rounded-lg border-2 overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm transition-all",
                  pageNumber === num ? "border-blue-600 shadow-md" : "border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-700"
                )}>
                  <PdfDocument 
                    file={file.url} 
                    onLoadError={(error) => console.error('Thumbnail PDF Load Error:', error)}
                    loading={<div className="w-full h-full animate-pulse bg-slate-200 dark:bg-slate-700" />}
                  >
                    <PdfPage 
                      pageNumber={num} 
                      width={200} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false}
                      className="w-full h-full object-cover"
                    />
                  </PdfDocument>
                  {/* Redaction Indicators on Thumbnails */}
                  <div className="absolute inset-0 pointer-events-none">
                    {redactions.filter(r => r.pageIndex === num - 1).map((r, idx) => (
                      <div 
                        key={idx}
                        className="absolute bg-black/40 dark:bg-white/40"
                        style={{
                          left: `${r.x}%`,
                          top: `${r.y}%`,
                          width: `${r.width}%`,
                          height: `${r.height}%`
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className={cn(
                    "text-[10px] font-bold",
                    pageNumber === num ? "text-blue-600" : "text-slate-400"
                  )}>Page {num}</span>
                  {redactions.filter(r => r.pageIndex === num - 1).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 relative flex flex-col overflow-hidden">
          <PDFViewer
            fileUrl={file.url}
            redactions={redactions}
            onRedactionsChange={(newRedactions) => {
              setRedactions(newRedactions);
              addToHistory(newRedactions);
            }}
            tool={tool}
            scale={scale}
            onScaleChange={setScale}
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            isReviewMode={isReviewMode}
            redactionStyle={settings.redactionStyle}
            aiSuggestions={aiSuggestions}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onComment={handleComment}
            isContinuous={isContinuousScroll}
            onContinuousChange={setIsContinuousScroll}
            canvasRef={canvasRef}
            onRenderSuccess={() => setIsPageRendered(true)}
          />

          {/* Floating Toolbar - Stirling Style (Desktop Only) */}
          {!isMobile && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl shadow-2xl z-40">
              <div className="flex items-center gap-1 px-1">
                <ToolbarButton 
                  active={tool === 'selection'} 
                  onClick={() => setTool('selection')} 
                  icon={MousePointer2} 
                  label="Select" 
                  shortcut="V"
                />
                <ToolbarButton 
                  active={tool === 'text'} 
                  onClick={() => setTool('text')} 
                  icon={TypeIcon} 
                  label="Text" 
                  shortcut="T"
                />
                <ToolbarButton 
                  active={tool === 'box'} 
                  onClick={() => setTool('box')} 
                  icon={Square} 
                  label="Box" 
                  shortcut="B"
                />
                <ToolbarButton 
                  active={tool === 'highlight'} 
                  onClick={() => setTool('highlight')} 
                  icon={Highlighter} 
                  label="Draw" 
                  shortcut="H"
                />
                <ToolbarButton 
                  onClick={() => redactEntirePage(pageNumber - 1)} 
                  icon={ShieldAlert} 
                  label="Page" 
                  shortcut="P"
                />
              </div>
              
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
              
              <div className="flex items-center gap-1 px-1">
                <ToolbarButton 
                  onClick={generateAISuggestions} 
                  icon={Sparkles} 
                  label="AI Suggest" 
                  shortcut="A"
                  disabled={isGeneratingSuggestions}
                />
                <ToolbarButton 
                  onClick={handleOCR} 
                  icon={FileText} 
                  label="OCR" 
                  shortcut="O"
                  disabled={isOCRing}
                />
                <ToolbarButton 
                  onClick={() => setShowSearchPopup(true)} 
                  icon={Search} 
                  label="Find" 
                  shortcut="Ctrl+F"
                />
                <ToolbarButton 
                  onClick={handleUnlockPDF} 
                  icon={Unlock} 
                  label="Unlock" 
                  disabled={isProcessing}
                />
              </div>
              
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
              
              <div className="flex items-center gap-1 px-1">
                <ToolbarButton 
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  icon={Undo2}
                  label="Undo"
                />
                <ToolbarButton 
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  icon={Redo2}
                  label="Redo"
                />
              </div>
            </div>
          )}

          {/* Mobile Bottom Navigation */}
          {isMobile && (
            <>
              <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around h-16 px-2 z-50">
                <button 
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="flex flex-col items-center gap-1 text-slate-500 disabled:opacity-30"
                >
                  <Undo2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Undo</span>
                </button>
                <button 
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="flex flex-col items-center gap-1 text-slate-500 disabled:opacity-30"
                >
                  <Redo2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Redo</span>
                </button>
                <button 
                  onClick={() => setShowMobileTools(true)}
                  className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 -translate-y-4 border-4 border-white dark:border-slate-950"
                >
                  <Wrench className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleZoomIn}
                  className="flex flex-col items-center gap-1 text-slate-500"
                >
                  <Search className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Zoom</span>
                </button>
                <button 
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber === numPages}
                  className="flex flex-col items-center gap-1 text-slate-500 disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Next</span>
                </button>
              </div>

              {/* Mobile Tool Selection Overlay */}
              <AnimatePresence>
                {showMobileTools && (
                  <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end"
                    onClick={() => setShowMobileTools(false)}
                  >
                    <motion.div 
                      className="w-full bg-white dark:bg-slate-900 rounded-t-[2.5rem] p-8 space-y-8"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black tracking-tight">Tools</h3>
                        <button onClick={() => setShowMobileTools(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-6">
                        {[
                          { id: 'selection', icon: MousePointer2, label: 'Select' },
                          { id: 'text', icon: TypeIcon, label: 'Text' },
                          { id: 'box', icon: Square, label: 'Box' },
                          { id: 'highlight', icon: Highlighter, label: 'Draw' },
                          { id: 'ai', icon: Sparkles, label: 'AI' },
                          { id: 'ocr', icon: FileSearch, label: 'OCR' },
                          { id: 'search', icon: Search, label: 'Find' },
                          { id: 'unlock', icon: Unlock, label: 'Unlock' }
                        ].map(t => (
                          <button 
                            key={t.id}
                            onClick={() => {
                              if (t.id === 'ai') generateAISuggestions();
                              else if (t.id === 'ocr') handleOCR();
                              else if (t.id === 'search') setShowSearchPopup(true);
                              else if (t.id === 'unlock') handleUnlockPDF();
                              else setTool(t.id as any);
                              setShowMobileTools(false);
                            }}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                              tool === t.id ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-active:bg-blue-50"
                            )}>
                              <t.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </main>
        {/* Right Sidebar - Redactions (Stirling Style) */}
        <aside className="hidden xl:flex w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400">Redactions</h2>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">{redactions.length}</span>
          </div>
          
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
              {(['redactions', 'ocr', 'suggestions', 'report', 'audit', 'logs', 'templates'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all relative",
                    sidebarTab === tab 
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  {tab}
                  {tab === 'suggestions' && aiSuggestions.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full">
                      {aiSuggestions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
            {sidebarTab === 'redactions' && (
              <div className="space-y-4">
                {redactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                    <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-xs font-medium">No redactions yet</p>
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
                    <div key={page} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">Page {page}</span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      </div>
                      {pageRedactions.map(r => (
                        <div 
                          key={r.id}
                          onClick={() => {
                            setPageNumber(r.pageIndex + 1);
                            setRedactions(redactions.map(item => ({ ...item, isSelected: item.id === r.id })));
                          }}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer group",
                            r.isSelected ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20" : "border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-[10px] font-bold truncate max-w-[120px]">{r.label || 'Redaction'}</span>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = redactions.filter(item => item.id !== r.id);
                                setRedactions(updated);
                                addToHistory(updated);
                              }}
                              className="p-1 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {r.text && <p className="text-[10px] text-slate-500 truncate italic">"{r.text}"</p>}
                          {r.comment && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ))
                )}

                {selectedRedaction && (
                  <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold">Edit Redaction</h3>
                      <button 
                        onClick={() => setRedactions(redactions.map(r => ({ ...r, isSelected: false })))}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Label</label>
                        <input 
                          type="text"
                          value={selectedRedaction.label || ''}
                          onChange={(e) => {
                            const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, label: e.target.value } : r);
                            setRedactions(updated);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Page</label>
                        <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 text-slate-500">
                          {selectedRedaction.pageIndex + 1}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">X (%)</label>
                        <input 
                          type="number"
                          value={Math.round(selectedRedaction.x)}
                          onChange={(e) => {
                            const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, x: parseFloat(e.target.value) } : r);
                            setRedactions(updated);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Y (%)</label>
                        <input 
                          type="number"
                          value={Math.round(selectedRedaction.y)}
                          onChange={(e) => {
                            const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, y: parseFloat(e.target.value) } : r);
                            setRedactions(updated);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Width (%)</label>
                        <input 
                          type="number"
                          value={Math.round(selectedRedaction.width)}
                          onChange={(e) => {
                            const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, width: parseFloat(e.target.value) } : r);
                            setRedactions(updated);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Height (%)</label>
                        <input 
                          type="number"
                          value={Math.round(selectedRedaction.height)}
                          onChange={(e) => {
                            const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, height: parseFloat(e.target.value) } : r);
                            setRedactions(updated);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">Comment</label>
                      <textarea 
                        value={selectedRedaction.comment || ''}
                        onChange={(e) => {
                          const updated = redactions.map(r => r.id === selectedRedaction.id ? { ...r, comment: e.target.value } : r);
                          setRedactions(updated);
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                        placeholder="Add a reason for redaction..."
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => {
                          const updated = redactions.filter(r => r.id !== selectedRedaction.id);
                          setRedactions(updated);
                          addToHistory(updated);
                          addAlert('success', 'Redaction removed');
                        }}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'ocr' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <Globe className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs font-bold">OCR Engine</p>
                        <p className="text-[10px] text-slate-500 font-bold">Local Processing</p>
                      </div>
                    </div>
                    <select 
                      value={settings.ocrConfig?.engine || 'tesseract'}
                      onChange={(e) => setSettings(prev => ({ ...prev, ocrConfig: { ...prev.ocrConfig, engine: e.target.value as any } }))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="tesseract">Tesseract.js (Fast)</option>
                      <option value="python-bridge">Python Bridge (Accurate)</option>
                    </select>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 mb-4">
                        <Languages className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-xs font-bold">OCR Language</p>
                          <p className="text-[10px] text-slate-500 font-bold">Multi-language support</p>
                        </div>
                      </div>
                      <select 
                        value={settings.ocrConfig?.language || 'eng'}
                        onChange={(e) => setSettings(prev => ({ ...prev, ocrConfig: { ...prev.ocrConfig, language: e.target.value } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="eng">English</option>
                        <option value="fra">French</option>
                        <option value="deu">German</option>
                        <option value="spa">Spanish</option>
                        <option value="ita">Italian</option>
                        <option value="jpn">Japanese</option>
                        <option value="chi_sim">Chinese (Simp)</option>
                      </select>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 mb-4">
                        <Database className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-xs font-bold">OCR Engine</p>
                          <p className="text-[10px] text-slate-500 font-bold">Choose processing method</p>
                        </div>
                      </div>
                      <select 
                        value={settings.ocrConfig?.engine || 'tesseract'}
                        onChange={(e) => setSettings(prev => ({ ...prev, ocrConfig: { ...prev.ocrConfig, engine: e.target.value as any } }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="tesseract">Tesseract.js (Local)</option>
                        <option value="python">Advanced Engine (Cloud/Python)</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={triggerOCR}
                    disabled={ocrStatus === 'loading'}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {ocrStatus === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {ocrStatus === 'loading' ? 'Processing...' : 'Run OCR on Current Page'}
                  </button>
                </div>

                {ocrResults[pageNumber - 1] && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">OCR Results (Page {pageNumber})</span>
                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-hide">
                      {ocrResults[pageNumber - 1].map((res, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 italic">"{res.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'suggestions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400">AI Suggestions</h3>
                  <div className="flex items-center gap-2">
                    {aiSuggestions.length > 0 && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            const updated = [...redactions, ...aiSuggestions.map(s => ({ ...s, id: `redact-${Date.now()}-${Math.random()}` }))];
                            setRedactions(updated);
                            addToHistory(updated);
                            setAiSuggestions([]);
                            addAlert('success', `Accepted ${aiSuggestions.length} suggestions.`);
                          }}
                          className="p-1.5 hover:bg-green-50 dark:hover:bg-green-950/20 rounded-lg text-green-500 transition-colors"
                          title="Accept All Suggestions"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setAiSuggestions([]);
                            addAlert('info', 'All suggestions cleared.');
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-red-500 transition-colors"
                          title="Clear All Suggestions"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={generateAISuggestions}
                      disabled={isGeneratingSuggestions}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors disabled:opacity-50"
                      title="Refresh Suggestions"
                    >
                      <RefreshCw className={cn("w-4 h-4", isGeneratingSuggestions && "animate-spin")} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {aiSuggestions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Sparkles className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No suggestions yet. Run analysis to find sensitive data.</p>
                      <button 
                        onClick={generateAISuggestions}
                        className="mt-4 text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Start AI Analysis
                      </button>
                    </div>
                  ) : (
                    aiSuggestions.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-bold truncate max-w-[120px]">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setRedactions(prev => [...prev, { ...s, id: Math.random().toString(36).substring(7), isSelected: false }]);
                                setAiSuggestions(prev => prev.filter(item => item.id !== s.id));
                                addAlert('success', 'Suggestion applied');
                              }}
                              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1"
                              title="Apply Redaction"
                            >
                              <Check className="w-3 h-3" />
                              <span className="text-[8px] font-bold">Apply</span>
                            </button>
                            <button 
                              onClick={() => setAiSuggestions(prev => prev.filter(item => item.id !== s.id))}
                              className="p-1 hover:text-red-500 transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">"{s.text}"</p>
                        {s.comment && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{s.comment}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'report' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400">Redaction Report</h3>
                  <button 
                    onClick={() => {
                      const report = {
                        fileName: file.name,
                        totalRedactions: redactions.length,
                        pages: Array.from(new Set(redactions.map(r => r.pageIndex + 1))).sort((a, b) => a - b),
                        redactions: redactions.map(r => ({
                          page: r.pageIndex + 1,
                          label: r.label,
                          text: r.text,
                          reason: r.comment
                        }))
                      };
                      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${file.name.replace('.pdf', '')}_redaction_report.json`;
                      a.click();
                      addAlert('success', 'Report exported successfully.');
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                    title="Export Report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Total</p>
                      <p className="text-xl font-bold">{redactions.length}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Pages</p>
                      <p className="text-xl font-bold">{new Set(redactions.map(r => r.pageIndex)).size}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Summary by Label</h4>
                    <div className="space-y-2">
                      {Object.entries(
                        redactions.reduce((acc, r) => {
                          const label = r.label || 'Unlabeled';
                          acc[label] = (acc[label] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([label, count]) => (
                        <div key={label} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page Breakdown</h4>
                    <div className="space-y-2">
                      {Object.entries(
                        redactions.reduce((acc, r) => {
                          const page = r.pageIndex + 1;
                          acc[page] = (acc[page] || 0) + 1;
                          return acc;
                        }, {} as Record<number, number>)
                      ).sort(([a], [b]) => Number(a) - Number(b)).map(([page, count]) => (
                        <div key={page} className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Page {page}</span>
                          <span className="font-bold">{count} redactions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {sidebarTab === 'templates' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400">Company Templates</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => document.getElementById('template-import')?.click()}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      title="Import Templates"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <input 
                      id="template-import"
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={importTemplates}
                    />
                    <button 
                      onClick={exportTemplates}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      title="Export Templates"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Active Company Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Company</p>
                    {identifiedCompany && (
                      <button 
                        onClick={() => setIdentifiedCompany(null)}
                        className="text-[8px] text-red-500 hover:underline font-bold uppercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  
                  {identifiedCompany ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold">{identifiedCompany}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 italic">No company identified. Manual redactions will not be learned.</p>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Enter company name..."
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs p-2 outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const name = (e.target as HTMLInputElement).value;
                              if (name) {
                                setIdentifiedCompany(name);
                                // Check if rule exists, if not create a basic one
                                setSettings(prev => {
                                  if (!prev.companyRules.some(r => r.name === name)) {
                                    const newRule: CompanyRule = {
                                      id: Math.random().toString(36).substring(7),
                                      name,
                                      identifiers: [name],
                                      patterns: [],
                                      sensitiveTerms: [],
                                      learnedCoordinates: []
                                    };
                                    return { ...prev, companyRules: [...prev.companyRules, newRule] };
                                  }
                                  return prev;
                                });
                                addAlert('success', `Identified as ${name}. Future manual redactions will be learned.`);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {identifiedCompany && (
                    <button 
                      onClick={() => {
                        const manualRedactions = redactions.filter(r => r.type === 'manual');
                        if (manualRedactions.length === 0) {
                          addAlert('warning', 'No manual redactions to save as template.');
                          return;
                        }
                        
                        setSettings(prev => {
                          const companyRules = [...prev.companyRules];
                          const ruleIndex = companyRules.findIndex(r => r.name === identifiedCompany);
                          
                          if (ruleIndex !== -1) {
                            const rule = companyRules[ruleIndex];
                            const newCoordinates = [...(rule.learnedCoordinates || [])];
                            
                            manualRedactions.forEach(mr => {
                              const exists = newCoordinates.some(c => 
                                c.pageIndex === mr.pageIndex && 
                                Math.abs(c.x - mr.x) < 1 && 
                                Math.abs(c.y - mr.y) < 1
                              );
                              if (!exists) {
                                newCoordinates.push({
                                  id: `learned-${Date.now()}-${Math.random()}`,
                                  pageIndex: mr.pageIndex,
                                  x: mr.x,
                                  y: mr.y,
                                  width: mr.width,
                                  height: mr.height,
                                  label: mr.label || 'MANUAL',
                                  type: 'auto',
                                  isSelected: false
                                });
                              }
                            });
                            
                            companyRules[ruleIndex] = { ...rule, learnedCoordinates: newCoordinates };
                            addAlert('success', `Updated template for ${identifiedCompany}`);
                          }
                          return { ...prev, companyRules };
                        });
                      }}
                      className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
                    >
                      Save Current as Template
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {settings.companyRules?.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <FileJson className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No templates saved yet</p>
                    </div>
                  ) : (
                    (settings.companyRules || []).map((rule) => (
                      <div 
                        key={rule.id} 
                        onClick={() => setIdentifiedCompany(rule.name)}
                        className={cn(
                          "p-3 rounded-xl border transition-all cursor-pointer group",
                          identifiedCompany === rule.name ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">{rule.name}</span>
                          <span className="text-[8px] text-slate-400 font-mono">{rule.patterns.length} Patterns</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(rule.identifiers || []).slice(0, 3).map((id, i) => (
                            <span key={i} className="text-[8px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase">{id}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'audit' && (
              <SecurityAudit 
                file={file} 
                onUpdate={(updates) => setFiles(prev => prev.map(f => f.id === file.id ? { ...f, ...updates } : f))}
                addAlert={addAlert}
              />
            )}

            {sidebarTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400">Audit Trail</h3>
                  <button 
                    onClick={() => setAuditLogs([])}
                    className="text-[10px] font-bold text-red-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <HistoryIcon className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No activity logged yet</p>
                    </div>
                  ) : (
                    auditLogs.slice().reverse().map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">{log.action}</span>
                          <span className="text-[8px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{log.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => setShowConfirmApply(true)}
              disabled={isProcessing || redactions.length === 0}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" />
              Apply & Download
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Layout (Google Docs/Drive like) */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950">
        {/* Mobile Header */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-bold text-sm truncate max-w-[150px]">{file.name}</h2>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Page {pageNumber} of {numPages}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowSearchPopup(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowConfirmApply(true)}
              disabled={isProcessing || redactions.length === 0}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Mobile PDF Viewer - Continuous Scroll */}
        <div className="flex-1 overflow-hidden relative">
          <PDFViewer
            fileUrl={file.url}
            redactions={redactions}
            onRedactionsChange={setRedactions}
            tool={tool}
            scale={scale}
            onScaleChange={setScale}
            pageNumber={pageNumber}
            onPageChange={setPageNumber}
            isReviewMode={isReviewMode}
            redactionStyle={settings.redactionStyle}
            aiSuggestions={aiSuggestions}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onComment={handleComment}
            isContinuous={true}
            showToolbar={false}
            canvasRef={canvasRef}
          />

          {/* Floating Action Button for Tools */}
          <button 
            onClick={() => setShowMobileTools(true)}
            className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 flex items-center justify-center z-[60] active:scale-90 transition-all"
          >
            <Wrench className="w-6 h-6" />
          </button>

          {/* Mobile Tool Selection Overlay */}
          <AnimatePresence>
            {showMobileTools && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end"
                onClick={() => setShowMobileTools(false)}
              >
                <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="w-full bg-white dark:bg-slate-900 rounded-t-[32px] p-8 pb-12 space-y-8 shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-2" />
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight">Redaction Tools</h3>
                    <button onClick={() => setShowMobileTools(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-y-8 gap-x-4">
                    <MobileToolItem 
                      active={tool === 'selection'} 
                      onClick={() => { setTool('selection'); setShowMobileTools(false); }} 
                      icon={MousePointer2} 
                      label="Select" 
                    />
                    <MobileToolItem 
                      active={tool === 'text'} 
                      onClick={() => { setTool('text'); setShowMobileTools(false); }} 
                      icon={TypeIcon} 
                      label="Text" 
                    />
                    <MobileToolItem 
                      active={tool === 'box'} 
                      onClick={() => { setTool('box'); setShowMobileTools(false); }} 
                      icon={Square} 
                      label="Box" 
                    />
                    <MobileToolItem 
                      active={tool === 'highlight'} 
                      onClick={() => { setTool('highlight'); setShowMobileTools(false); }} 
                      icon={Highlighter} 
                      label="Draw" 
                    />
                    <MobileToolItem 
                      onClick={() => { handleAutoDetect(); setShowMobileTools(false); }} 
                      icon={Zap} 
                      label="Auto" 
                      color="text-amber-500"
                    />
                    <MobileToolItem 
                      onClick={() => { generateAISuggestions(); setShowMobileTools(false); }} 
                      icon={Sparkles} 
                      label="AI Suggest" 
                      color="text-purple-500"
                    />
                    <MobileToolItem 
                      onClick={() => { handleOCR(); setShowMobileTools(false); }} 
                      icon={FileText} 
                      label="OCR" 
                    />
                    <MobileToolItem 
                      onClick={() => { setShowSearchPopup(true); setShowMobileTools(false); }} 
                      icon={Search} 
                      label="Search" 
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-6 py-3 pb-8 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-2">
            <button 
              disabled={historyIndex === 0}
              onClick={undo}
              className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl disabled:opacity-30 active:scale-90 transition-all"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button 
              disabled={historyIndex === history.length - 1}
              onClick={redo}
              className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl disabled:opacity-30 active:scale-90 transition-all"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl">
            <button onClick={handleZoomOut} className="p-1 active:scale-75 transition-all"><Minus className="w-4 h-4" /></button>
            <span className="text-[10px] font-black w-8 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={handleZoomIn} className="p-1 active:scale-75 transition-all"><Plus className="w-4 h-4" /></button>
          </div>

          <button 
            onClick={() => setSidebarTab('redactions')}
            className="flex flex-col items-center gap-1 text-slate-500"
          >
            <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <Layout className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Pages</span>
          </button>
        </div>
      </div>

      {/* Search Popup */}
      <AnimatePresence>
        {showSearchPopup && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSearchPopup(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg tracking-tight">Search & Redact</h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Bulk text identification</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSearchPopup(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Search Query</label>
                  <div className="relative">
                    <input 
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAndRedact()}
                      placeholder="Enter text to search for..."
                      className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl px-5 py-4 font-bold focus:ring-2 ring-indigo-500 outline-none pr-12"
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setSearchOptions(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex items-center gap-3",
                      searchOptions.caseSensitive 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900" 
                        : "bg-neutral-50 border-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:border-neutral-700"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center border", searchOptions.caseSensitive ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600")}>
                      {searchOptions.caseSensitive && <Check className="w-3 h-3" />}
                    </div>
                    <span className="text-xs font-bold">Case Sensitive</span>
                  </button>

                  <button 
                    onClick={() => setSearchOptions(prev => ({ ...prev, fuzzyMatch: !prev.fuzzyMatch }))}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex items-center gap-3",
                      searchOptions.fuzzyMatch 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900" 
                        : "bg-neutral-50 border-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:border-neutral-700"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center border", searchOptions.fuzzyMatch ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600")}>
                      {searchOptions.fuzzyMatch && <Check className="w-3 h-3" />}
                    </div>
                    <span className="text-xs font-bold">Fuzzy Match</span>
                  </button>
                </div>

                {isSearching && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-blue-500">Searching...</span>
                      <span className="text-slate-400">{searchProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${searchProgress}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSearchPopup(false)}
                  className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSearchAndRedact}
                  disabled={!searchQuery || isSearching}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search & Redact
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmApply && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmApply(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Apply Redactions?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                You are about to permanently redact {redactions.length} areas in this document. This action cannot be undone after the file is saved.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmApply(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowConfirmApply(false);
                    applyRedactions();
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Redaction Reasoning</h3>
                <button 
                  onClick={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
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
                  className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button 
                  onClick={() => setCommentModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
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
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
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
  const [progress, setProgress] = useState(0);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(files[0]?.id || null);
  const [zoom, setZoom] = useState(0.6);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);

  const selectedFile = files.find(f => f.id === selectedFileId);

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
    setProgress(0);
    addAlert('info', `Processing ${files.length} files with local AI...`);
    
    try {
      const updatedFiles = [...files];
      
      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        file.status = 'processing';
        setFiles([...updatedFiles]);
        setProgress(((i + 1) / updatedFiles.length) * 100);

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
          const ocrData = await performLocalOCR(imageData, settings.ocrConfig) as any;
          if (!ocrData) continue;
          const text = ocrData.text || '';
          const words = ocrData.words || [];

          // Company Detection (Local)
          let matchedRule: CompanyRule | null = null;
          if (batchRules.companyDetection && settings.companyRules?.length > 0) {
            matchedRule = detectCompanyFromText(text, settings.companyRules);
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
            const piiResults = detectPIILocal(text, words, settings.aiDefaults?.sensitivity || 0.5);
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
            const termResults = detectSensitiveTermsLocal(text, words, termsToSearch, settings.aiDefaults?.sensitivity || 0.5);
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

          // Advanced AI Detection
          const advancedDetections = await detectAdvancedAI(text, settings.aiDefaults, settings.companyProfile);
          advancedDetections.forEach((det, idx) => {
            const matchedWords = words.filter((w: any) => det.text.toLowerCase().includes(w.text.toLowerCase()));
            if (matchedWords.length > 0) {
              const minX = Math.min(...matchedWords.map((w: any) => w.bbox.x0));
              const minY = Math.min(...matchedWords.map((w: any) => w.bbox.y0));
              const maxX = Math.max(...matchedWords.map((w: any) => w.bbox.x1));
              const maxY = Math.max(...matchedWords.map((w: any) => w.bbox.y1));

              allRedactions.push({
                id: `advanced-${Date.now()}-${idx}`,
                pageIndex: pageNum - 1,
                x: (minX / canvas.width) * 100,
                y: (minY / canvas.height) * 100,
                width: ((maxX - minX) / canvas.width) * 100,
                height: ((maxY - minY) / canvas.height) * 100,
                label: det.label,
                comment: det.reason,
                type: 'auto',
                isSelected: true
              });
            }
          });
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
      setProgress(0);
    }
  };

  const handleUnlockAll = async () => {
    setIsProcessing(true);
    addAlert('info', 'Unlocking all PDFs in batch...');
    try {
      const updatedFiles = [...files];
      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        const pdfBytes = await fetch(file.url).then(res => res.arrayBuffer());
        const uint8Array = new Uint8Array(pdfBytes);
        let binary = '';
        uint8Array.forEach(b => binary += String.fromCharCode(b));
        const base64 = btoa(binary);
        const unlockedBase64 = await unlockPDF(base64);
        if (unlockedBase64) {
          const blob = await fetch(`data:application/pdf;base64,${unlockedBase64}`).then(res => res.blob());
          const url = URL.createObjectURL(blob);
          updatedFiles[i] = { ...file, url, name: file.name.replace('.pdf', '_unlocked.pdf') };
        }
      }
      setFiles(updatedFiles);
      addAlert('success', 'All PDFs unlocked successfully.');
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to unlock some PDFs.');
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
      id: editingPresetId || Math.random().toString(36).substring(7),
      name: ruleName,
      ...batchRules
    };
    setSettings(prev => ({
      ...prev,
      savedBatchRules: editingPresetId 
        ? prev.savedBatchRules.map(r => r.id === editingPresetId ? newRule : r)
        : [...prev.savedBatchRules, newRule]
    }));
    setRuleName('');
    setEditingPresetId(null);
    addAlert('success', `Rule set "${ruleName}" ${editingPresetId ? 'updated' : 'saved'}.`);
  };

  const loadRuleSet = (rule: BatchRuleSet) => {
    setBatchRules({
      pii: rule.pii,
      barcodes: rule.barcodes,
      companyDetection: rule.companyDetection || false,
      sensitiveTerms: rule.sensitiveTerms
    });
    setRuleName(rule.name);
    setEditingPresetId(rule.id);
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
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Batch Redaction</h2>
          <p className="text-slate-500">Apply the same redaction rules to multiple documents simultaneously.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleUnlockAll}
            disabled={isProcessing || files.length === 0}
            className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 shadow-sm"
          >
            <EyeOff className="w-5 h-5 mr-2 inline-block" />
            Unlock All
          </button>
          <button 
            onClick={processBatch}
            disabled={isProcessing || files.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play className="w-5 h-5" />
            Start Batch Process
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="font-bold text-slate-900 dark:text-white">Processing Batch...</span>
            </div>
            <span className="font-bold text-blue-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
            <h3 className="font-bold mb-6 flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest">
              <Settings className="w-4 h-4" />
              Detection Rules
            </h3>
            <div className="space-y-5">
              <label className="flex items-center justify-between cursor-pointer group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">PII Detection</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.pii}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, pii: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Barcodes & QR</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.barcodes}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, barcodes: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Company Detection</span>
                <input 
                  type="checkbox" 
                  checked={batchRules.companyDetection}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, companyDetection: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sensitive Terms (CSV)</label>
                <textarea 
                  placeholder="e.g. Confidential, Internal, Draft"
                  value={batchRules.sensitiveTerms}
                  onChange={(e) => setBatchRules(prev => ({ ...prev, sensitiveTerms: e.target.value }))}
                  className="w-full h-28 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  {editingPresetId ? 'Update Preset' : 'Save as Preset'}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Preset name..."
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    onClick={saveRuleSet}
                    className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  {editingPresetId && (
                    <button 
                      onClick={() => {
                        setEditingPresetId(null);
                        setRuleName('');
                      }}
                      className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* File List */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-slate-900/5">
            <h3 className="font-bold mb-6 flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest">
              <FileText className="w-4 h-4" />
              Queue ({files.length})
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {files.map(file => (
                <div 
                  key={file.id} 
                  onClick={() => setSelectedFileId(file.id)}
                  className={cn(
                    "group flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer border",
                    selectedFileId === file.id 
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      file.status === 'ready' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20" : 
                      file.status === 'processing' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/20" :
                      file.status === 'error' ? "bg-red-100 text-red-600 dark:bg-red-900/20" :
                      "bg-slate-100 text-slate-400 dark:bg-slate-800"
                    )}>
                      {file.status === 'ready' ? <CheckCircle2 className="w-5 h-5" /> : 
                       file.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                       file.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
                       <FileText className="w-5 h-5" />}
                    </div>
                    <div className="truncate">
                      <p className={cn(
                        "text-sm font-bold truncate",
                        selectedFileId === file.id ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                      )}>{file.name}</p>
                      <div className="flex items-center gap-2">
                        <motion.span 
                          initial={file.status === 'processing' ? { opacity: 0.5 } : { opacity: 1 }}
                          animate={file.status === 'processing' ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                          transition={file.status === 'processing' ? { repeat: Infinity, duration: 1.5 } : {}}
                          className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md flex items-center gap-1",
                            file.status === 'ready' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                            file.status === 'processing' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                            file.status === 'error' ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" :
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          {file.status === 'processing' && <Loader2 className="w-2 h-2 animate-spin" />}
                          {file.status || 'pending'}
                        </motion.span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(prev => prev.filter(f => f.id !== file.id));
                    }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Preview Pane */}
        <div className="lg:col-span-8 space-y-8">
          {selectedFile ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[850px] shadow-2xl shadow-slate-900/10">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
                    <button 
                      onClick={() => {
                        const currentIndex = files.findIndex(f => f.id === selectedFileId);
                        if (currentIndex > 0) setSelectedFileId(files[currentIndex - 1].id);
                      }}
                      disabled={files.findIndex(f => f.id === selectedFileId) <= 0}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
                      title="Previous File"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const currentIndex = files.findIndex(f => f.id === selectedFileId);
                        if (currentIndex < files.length - 1) setSelectedFileId(files[currentIndex + 1].id);
                      }}
                      disabled={files.findIndex(f => f.id === selectedFileId) >= files.length - 1}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
                      title="Next File"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[250px] uppercase tracking-widest">{selectedFile.name}</h3>
                  <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
                    <button 
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {pageNumber} / {numPages || '?'}
                    </span>
                    <button 
                      onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))}
                      disabled={pageNumber >= (numPages || 1)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-[10px] font-bold w-14 text-center text-slate-900 dark:text-white uppercase tracking-widest">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <PDFViewer
                  fileUrl={selectedFile.url}
                  redactions={selectedFile.redactions || []}
                  onRedactionsChange={(newRedactions) => {
                    setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, redactions: newRedactions } : f));
                  }}
                  tool="selection"
                  scale={zoom}
                  onScaleChange={setZoom}
                  pageNumber={pageNumber}
                  onPageChange={setPageNumber}
                  isReviewMode={false}
                  redactionStyle={settings.redactionStyle}
                  isContinuous={false}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center h-[850px] flex flex-col items-center justify-center shadow-xl shadow-slate-900/5">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-8">
                <FileText className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-widest">Select a file to preview</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">Click on a file from the queue to see its content and redactions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden transition-all duration-300 shadow-xl shadow-slate-900/5">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            isOpen ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SortableToolbarItem({ id, tool, onToggle }: { id: string, tool: ToolbarToolConfig, onToggle: (id: ToolbarToolId) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl transition-all",
        isDragging ? "shadow-2xl scale-105 border-black dark:border-white" : "hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm">{tool.label}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-widest">{tool.id}</span>
        </div>
      </div>
      <button
        onClick={() => onToggle(tool.id)}
        className={cn(
          "w-12 h-6 rounded-full transition-all relative",
          tool.visible ? "bg-black dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 rounded-full transition-all",
          tool.visible ? "right-1 bg-white dark:bg-black" : "left-1 bg-neutral-400"
        )} />
      </button>
    </div>
  );
}

function SplitView({ file: initialFile, onBack, addAlert, isMobile }: { file?: PDFFile; onBack: () => void; addAlert: any; isMobile: boolean }) {
  const [file, setFile] = useState<PDFFile | null>(initialFile || null);
  const [range, setRange] = useState('');
  const [mode, setMode] = useState<'range' | 'extract'>('range');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSplit = async () => {
    if (!file) return;
    if (!range) {
      addAlert('error', 'Please enter pages or a range.');
      return;
    }
    setIsProcessing(true);
    try {
      const existingPdfBytes = await fetch(file.url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      
      const parseRange = (r: string) => {
        return r.split(',').flatMap(part => {
          const clean = part.trim();
          if (clean.includes('-')) {
            const [start, end] = clean.split('-').map(Number);
            if (isNaN(start) || isNaN(end)) return [];
            return Array.from({ length: Math.abs(end - start) + 1 }, (_, i) => Math.min(start, end) + i - 1);
          }
          const num = Number(clean);
          return isNaN(num) ? [] : [num - 1];
        }).filter(p => p >= 0 && p < pdfDoc.getPageCount());
      };

      if (mode === 'range') {
        const newPdf = await PDFDocument.create();
        const pages = parseRange(range);
        if (pages.length === 0) throw new Error('Invalid range');
        const copiedPages = await newPdf.copyPages(pdfDoc, pages);
        copiedPages.forEach(page => newPdf.addPage(page));
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `split_${file.name}`;
        a.click();
      } else {
        const newPdf = await PDFDocument.create();
        const pages = parseRange(range);
        if (pages.length === 0) throw new Error('Invalid pages');
        const copiedPages = await newPdf.copyPages(pdfDoc, pages);
        copiedPages.forEach(page => newPdf.addPage(page));
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted_${file.name}`;
        a.click();
      }
      
      addAlert('success', 'PDF split successfully!');
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to split PDF. Check your format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile({
        id: Math.random().toString(36).substring(7),
        file: uploadedFile,
        name: uploadedFile.name,
        url: URL.createObjectURL(uploadedFile),
        numPages: 0,
        redactions: [],
        status: 'idle'
      });
    }
  };

  return (
    <div className={cn("mx-auto space-y-8", isMobile ? "p-4 w-full" : "p-8 max-w-2xl")}>
      <div className="flex items-center gap-4">
        <motion.button 
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack} 
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <h2 className={cn("font-black tracking-tight", isMobile ? "text-2xl" : "text-3xl")}>Split PDF</h2>
      </div>
      
      {!file ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-6",
            isMobile ? "p-8 rounded-[2rem]" : "p-12 rounded-[3rem]"
          )}
        >
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
            <FileUp className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Select PDF to split</h3>
            <p className="text-sm text-slate-500">Choose the file you want to extract pages from</p>
          </div>
          <label className="inline-block bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest cursor-pointer hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
            Choose File
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 shadow-xl",
            isMobile ? "rounded-[1.5rem]" : "rounded-[2rem]"
          )}
        >
          <div className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate max-w-[150px] md:max-w-[200px]">{file.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{file.numPages || '?'} Pages</p>
                </div>
              </div>
              <button onClick={() => setFile(null)} className="text-xs font-bold text-red-500 hover:underline">Change</button>
            </div>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button 
                onClick={() => setMode('range')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  mode === 'range' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-400"
                )}
              >
                Split Range
              </button>
              <button 
                onClick={() => setMode('extract')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  mode === 'extract' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-400"
                )}
              >
                Extract Pages
              </button>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {mode === 'range' ? 'Custom Ranges' : 'Pages to Extract'}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder={mode === 'range' ? "e.g. 1-5, 8-10" : "e.g. 1, 3, 5, 7"}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-4 font-bold outline-none transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                  <Scissors className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium px-2">
                {mode === 'range' 
                  ? "Example: '1-5, 10-12' will create a PDF with those page ranges." 
                  : "Example: '1, 3, 5' will extract only those specific pages."}
              </p>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSplit}
              disabled={isProcessing || !range}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {isMobile ? 'Download' : (mode === 'range' ? 'Split & Download' : 'Extract & Download')}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function SortableFileItem({ f, i, onRemove }: { f: File; i: number; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: f.name + i });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-blue-500/30 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <FileText className="w-5 h-5 text-blue-500" />
        <span className="text-sm font-bold truncate max-w-[200px]">{f.name}</span>
      </div>
      <button onClick={onRemove} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function MergeView({ onBack, addAlert, isMobile }: { onBack: () => void; addAlert: any; isMobile: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((_, i) => items[i].name + i === active.id);
        const newIndex = items.findIndex((_, i) => items[i].name + i === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      addAlert('error', 'Please select at least 2 PDF files to merge.');
      return;
    }
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        const pdfBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      a.click();
      addAlert('success', 'PDFs merged and downloaded successfully!');
    } catch (error) {
      console.error(error);
      addAlert('error', 'Failed to merge PDFs.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn("mx-auto space-y-8", isMobile ? "p-4 w-full" : "p-8 max-w-2xl")}>
      <div className="flex items-center gap-4">
        <motion.button 
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack} 
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
        <h2 className={cn("font-black tracking-tight", isMobile ? "text-2xl" : "text-3xl")}>Merge PDFs</h2>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl",
          isMobile ? "rounded-[1.5rem] p-4" : "rounded-[2rem] p-8"
        )}
      >
        <div className="space-y-6">
          <div className="relative group cursor-pointer">
            <input 
              type="file" 
              multiple 
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
            />
            <motion.div 
              whileHover={{ scale: 1.01, rotate: 0.2 }}
              className="p-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center gap-4 group-hover:border-blue-500 transition-colors"
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-2xl flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <p className="font-bold text-slate-500">Add more PDFs</p>
            </motion.div>
          </div>

          <div className="space-y-3">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={files.map((f, i) => f.name + i)}
                strategy={verticalListSortingStrategy}
              >
                <AnimatePresence>
                  {files.map((f, i) => (
                    <SortableFileItem 
                      key={f.name + i} 
                      f={f} 
                      i={i} 
                      onRemove={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} 
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </DndContext>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, rotate: -0.5 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleMerge}
            disabled={isProcessing || files.length < 2}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
            Merge & Download
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function SettingsView({ settings, setSettings, onBack, activeFile, setFiles, addAlert, isMobile }: { 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  activeFile?: PDFFile;
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
  addAlert: (type: any, msg: string) => void;
  isMobile: boolean;
}) {
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [newWord, setNewWord] = useState('');
  const [exportOnlySelected, setExportOnlySelected] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setLastSaved(Date.now());
    const timer = setTimeout(() => setLastSaved(null), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSettings((prev) => {
        const oldIndex = prev.toolbar.findIndex((t) => t.id === active.id);
        const newIndex = prev.toolbar.findIndex((t) => t.id === over.id);
        return {
          ...prev,
          toolbar: arrayMove(prev.toolbar, oldIndex, newIndex),
        };
      });
    }
  };

  const toggleToolbarItem = (id: ToolbarToolId) => {
    setSettings(prev => ({
      ...prev,
      toolbar: prev.toolbar.map(t => t.id === id ? { ...t, visible: !t.visible } : t)
    }));
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    if (settings.redactionWordList.includes(newWord.trim().toUpperCase())) {
      addAlert('warning', 'Word already in list');
      return;
    }
    setSettings(prev => ({
      ...prev,
      redactionWordList: [...prev.redactionWordList, newWord.trim().toUpperCase()]
    }));
    setNewWord('');
  };

  const removeWord = (word: string) => {
    setSettings(prev => ({
      ...prev,
      redactionWordList: prev.redactionWordList.filter(w => w !== word)
    }));
  };

  const clearAllWords = () => {
    if (confirm('Are you sure you want to clear all words?')) {
      setSettings(prev => ({ ...prev, redactionWordList: [] }));
    }
  };

  const exportWords = () => {
    const blob = new Blob([JSON.stringify(settings.redactionWordList)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redaction-word-list.json';
    a.click();
  };

  const importWords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const words = JSON.parse(event.target?.result as string);
        if (Array.isArray(words)) {
          setSettings(prev => ({
            ...prev,
            redactionWordList: Array.from(new Set([...prev.redactionWordList, ...words.map(w => String(w).toUpperCase())]))
          }));
          addAlert('success', `Imported ${words.length} words`);
        }
      } catch (err) {
        addAlert('error', 'Failed to import words');
      }
    };
    reader.readAsText(file);
  };

  const addCommonWords = () => {
    const common = ['CONFIDENTIAL', 'PROPRIETARY', 'INTERNAL', 'SENSITIVE', 'PRIVATE', 'RESTRICTED', 'SECRET', 'CLASSIFIED'];
    setSettings(prev => ({
      ...prev,
      redactionWordList: Array.from(new Set([...prev.redactionWordList, ...common]))
    }));
    addAlert('success', 'Added common redaction words');
  };

  const addCompanyRule = () => {
    const newRule: CompanyRule = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Rule',
      patterns: [],
      sensitiveTerms: [],
      type: 'keyword',
      isActive: true
    };
    setSettings(prev => ({
      ...prev,
      companyRules: [...(prev.companyRules || []), newRule]
    }));
  };

  const removeCompanyRule = (id: string) => {
    setSettings(prev => ({
      ...prev,
      companyRules: (prev.companyRules || []).filter(r => r.id !== id)
    }));
  };

  const updateCompanyRule = (id: string, updates: Partial<CompanyRule>) => {
    setSettings(prev => ({
      ...prev,
      companyRules: (prev.companyRules || []).map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  return (
    <div className={cn("mx-auto relative pb-20", isMobile ? "p-4 w-full" : "max-w-3xl")}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className={cn("font-bold tracking-tight", isMobile ? "text-2xl" : "text-4xl")}>Settings</h2>
        </div>
        <AnimatePresence>
          {lastSaved && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 text-emerald-500 text-sm font-bold bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Auto-saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        {/* Document Metadata */}
        {activeFile && (
          <CollapsibleSection title="Document Metadata" icon={FileText} defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {[
                { label: 'Title', key: 'title' },
                { label: 'Author', key: 'author' },
                { label: 'Subject', key: 'subject' },
                { label: 'Keywords', key: 'keywords' },
                { label: 'Creator', key: 'creator' },
                { label: 'Producer', key: 'producer' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-neutral-500 mb-2">{field.label}</label>
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
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all"
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* AI Defaults */}
        <CollapsibleSection title="AI Defaults" icon={Zap}>
          <div className="space-y-8 pt-4">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-semibold">Detection Sensitivity</label>
                  <p className="text-xs text-neutral-500">Lower values are more aggressive, higher values are more precise.</p>
                </div>
                <span className="text-lg font-bold font-mono bg-blue-600 text-white px-3 py-1 rounded-lg shadow-sm">
                  {(settings.aiDefaults?.sensitivity || 0.7).toFixed(2)}
                </span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.aiDefaults?.sensitivity || 0.7}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  aiDefaults: { ...prev.aiDefaults, sensitivity: parseFloat(e.target.value) }
                }))}
                className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'PII Detection', key: 'piiEnabled', icon: ShieldCheck },
                { label: 'Barcodes', key: 'barcodesEnabled', icon: Barcode },
                { label: 'Company Data', key: 'companyDataEnabled', icon: Brain },
              ].map(item => (
                <label key={item.key} className={cn(
                  "flex flex-col items-center justify-center p-6 rounded-2xl cursor-pointer transition-all border-2",
                  (settings.aiDefaults as any)?.[item.key]
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                    : "bg-neutral-50 dark:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                )}>
                  <item.icon className="w-6 h-6 mb-3" />
                  <span className="text-xs font-semibold text-center">{item.label}</span>
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={(settings.aiDefaults as any)?.[item.key]}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      aiDefaults: { ...prev.aiDefaults, [item.key]: e.target.checked }
                    }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* OCR Configuration */}
        <CollapsibleSection title="OCR Configuration" icon={FileSearch}>
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-widest">OCR Engine</label>
                <select 
                  value={settings.ocrConfig?.engine || 'tesseract'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    ocrConfig: { 
                      engine: e.target.value as any,
                      language: prev.ocrConfig?.language || 'eng',
                      autoRotate: prev.ocrConfig?.autoRotate || false
                    }
                  }))}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold"
                >
                  <option value="tesseract">Tesseract.js (Local)</option>
                  <option value="python">Python Engine (Advanced)</option>
                  <option value="fastapi">FastAPI OCR (Cloud)</option>
                  <option value="python-bridge">Python Bridge (Enterprise)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-widest">Primary Language</label>
                <select 
                  value={settings.ocrConfig?.language || 'eng'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    ocrConfig: { 
                      engine: prev.ocrConfig?.engine || 'tesseract',
                      language: e.target.value,
                      autoRotate: prev.ocrConfig?.autoRotate || false
                    }
                  }))}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-bold"
                >
                  <option value="eng">English</option>
                  <option value="spa">Spanish</option>
                  <option value="fra">French</option>
                  <option value="deu">German</option>
                  <option value="ita">Italian</option>
                  <option value="por">Portuguese</option>
                  <option value="chi_sim">Chinese (Simplified)</option>
                  <option value="jpn">Japanese</option>
                  <option value="kor">Korean</option>
                  <option value="hin">Hindi</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl cursor-pointer">
              <input 
                type="checkbox"
                checked={settings.ocrConfig?.autoRotate || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  ocrConfig: { 
                    engine: prev.ocrConfig?.engine || 'tesseract',
                    language: prev.ocrConfig?.language || 'eng',
                    autoRotate: e.target.checked 
                  }
                }))}
                className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-bold">Auto-Rotate Pages</span>
                <p className="text-[10px] text-neutral-500">Automatically correct page orientation before OCR</p>
              </div>
            </label>
          </div>
        </CollapsibleSection>

        {/* Company Rules */}
        <CollapsibleSection title="Company Rules" icon={ShieldCheck}>
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500 font-medium leading-relaxed max-w-md">
                Define custom rules for automated redaction. These rules can target specific keywords, patterns, or coordinates based on company-specific document layouts.
              </p>
              <button 
                onClick={addCompanyRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(settings.companyRules || []).map(rule => (
                <div key={rule.id} className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-800 group hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-neutral-900 rounded-2xl flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-800">
                        <Bookmark className="w-6 h-6 text-neutral-400" />
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          value={rule.name}
                          onChange={(e) => updateCompanyRule(rule.id, { name: e.target.value })}
                          className="text-lg font-bold bg-transparent border-none p-0 focus:ring-0 w-full"
                          placeholder="Rule Name"
                        />
                        <p className="text-xs font-semibold text-neutral-400 mt-1">
                          {rule.patterns?.length || 0} Patterns • {rule.learnedCoordinates?.length || 0} Coordinates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateCompanyRule(rule.id, { isActive: !rule.isActive })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                          rule.isActive 
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" 
                            : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
                        )}
                      >
                        {rule.isActive ? 'Active' : 'Disabled'}
                      </button>
                      <button 
                        onClick={() => removeCompanyRule(rule.id)}
                        className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Patterns & Keywords</label>
                      <div className="flex flex-wrap gap-2">
                        {(rule.patterns || []).map((p, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold flex items-center gap-2 group/tag">
                            {p}
                            <button onClick={() => {
                              const updatedPatterns = (rule.patterns || []).filter((_, i) => i !== idx);
                              updateCompanyRule(rule.id, { patterns: updatedPatterns });
                            }} className="opacity-0 group-hover/tag:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                        <button 
                          onClick={() => {
                            const val = prompt('Enter new pattern or keyword:');
                            if (val) {
                              updateCompanyRule(rule.id, { patterns: [...(rule.patterns || []), val] });
                            }
                          }}
                          className="px-3 py-1 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg text-xs font-bold text-neutral-400 hover:border-neutral-500 transition-all"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Rule Type</label>
                      <select 
                        value={rule.type || 'keyword'}
                        onChange={(e) => updateCompanyRule(rule.id, { type: e.target.value as any })}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold focus:ring-black dark:focus:ring-white"
                      >
                        <option value="keyword">Keyword Match</option>
                        <option value="regex">Regex Pattern</option>
                        <option value="coordinate">Coordinate Based</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
        <CollapsibleSection title="Appearance" icon={Palette}>
          <div className="space-y-8 pt-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-4">Theme Mode</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'light', icon: Sun, label: 'Light' },
                  { id: 'dark', icon: Moon, label: 'Dark' },
                  { id: 'system', icon: Monitor, label: 'System' },
                  { id: 'custom', icon: Palette, label: 'Custom' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSettings(prev => ({ ...prev, theme: t.id as Theme }))}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                      settings.theme === t.id 
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20 scale-105" 
                        : "bg-neutral-50 dark:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    <t.icon className="w-6 h-6" />
                    <span className="text-[10px] font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {settings.theme === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
              >
                {[
                  { label: 'Primary', key: 'primaryColor' },
                  { label: 'Secondary', key: 'secondaryColor' },
                  { label: 'Accent', key: 'accentColor' },
                  { label: 'Gradient 1', key: 'gradientColor1' },
                  { label: 'Gradient 2', key: 'gradientColor2' },
                ].map(color => (
                  <div key={color.key}>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">{color.label}</label>
                    <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                      <input 
                        type="color" 
                        value={(settings.customTheme as any)?.[color.key] || '#000000'}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          customTheme: { ...prev.customTheme!, [color.key]: e.target.value }
                        }))}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
                      />
                      <span className="text-xs font-mono font-bold">{(settings.customTheme as any)?.[color.key]}</span>
                    </div>
                  </div>
                ))}
                <div className="md:col-span-3 flex justify-end gap-4">
                  <button 
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default Theme
                  </button>
                  <button 
                    onClick={() => setSettings(prev => ({
                      ...prev,
                      customTheme: DEFAULT_SETTINGS.customTheme
                    }))}
                    className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Custom Colors
                  </button>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Redaction Color</label>
                <div className="flex items-center gap-4 bg-neutral-50 dark:bg-neutral-800 p-4 rounded-2xl">
                  <input 
                    type="color" 
                    value={settings.redactionColor}
                    onChange={(e) => setSettings(prev => ({ ...prev, redactionColor: e.target.value }))}
                    className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none"
                  />
                  <div>
                    <span className="text-sm font-black font-mono block">{settings.redactionColor}</span>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold">Hex Code</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Redaction Style</label>
                <select 
                  value={settings.redactionStyle}
                  onChange={(e) => setSettings(prev => ({ ...prev, redactionStyle: e.target.value as RedactionStyle }))}
                  className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-800 border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 rounded-2xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-bold"
                >
                  <option value="solid">Solid Fill</option>
                  <option value="outline">Outline Only</option>
                  <option value="pattern">Hatched Pattern</option>
                </select>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Company Profile */}
        <CollapsibleSection title="Company Profile" icon={Brain}>
          <div className="space-y-6 pt-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                Providing company context helps the AI identify internal project names, proprietary codes, and specific identifiers unique to your organization.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Organization Name</label>
                <input 
                  type="text" 
                  value={settings.companyProfile?.name}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    companyProfile: { ...prev.companyProfile!, name: e.target.value }
                  }))}
                  className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-medium"
                  placeholder="e.g. Acme Global Industries"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Contact Details</label>
                <input 
                  type="text" 
                  value={settings.companyProfile?.contactDetails}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    companyProfile: { ...prev.companyProfile!, contactDetails: e.target.value }
                  }))}
                  className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-medium"
                  placeholder="e.g. legal@acme.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Internal Identifiers & Keywords</label>
              <textarea 
                value={settings.companyProfile?.content}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  companyProfile: { ...prev.companyProfile!, content: e.target.value }
                }))}
                className="w-full h-40 px-4 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all resize-none font-medium leading-relaxed"
                placeholder="List internal project names, proprietary codes, or specific identifiers (one per line)..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Upload Profile (PDF/DOCX)</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="w-8 h-8 text-neutral-400 mb-2" />
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Click to upload company profile</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.docx" />
                </label>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Output File Name */}
        <CollapsibleSection title="Output File Name" icon={Settings2}>
          <div className="space-y-6 pt-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">File Naming Pattern</label>
              <input 
                type="text" 
                value={settings.fileNamePattern}
                onChange={(e) => setSettings(prev => ({ ...prev, fileNamePattern: e.target.value }))}
                className="w-full px-4 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white outline-none transition-all font-mono"
                placeholder="{name}_redacted"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {['{name}', '{date}', '{time}', '{id}'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setSettings(prev => ({ ...prev, fileNamePattern: prev.fileNamePattern + tag }))}
                    className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-[10px] font-black font-mono transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Preview</label>
              <p className="text-sm font-bold font-mono truncate">
                {formatFileName(activeFile?.name || 'document.pdf', settings.fileNamePattern)}.pdf
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Toolbar Customization */}
        <CollapsibleSection title="Toolbar Customization" icon={LayoutGrid}>
          <div className="space-y-6 pt-4">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Customize the visibility and order of tools in the editor toolbar.
            </p>
            <div className="space-y-2">
              {settings.toolbar.map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 bg-neutral-50 dark:bg-neutral-800 p-4 rounded-2xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all group">
                  <div className="cursor-grab active:cursor-grabbing text-neutral-300 group-hover:text-neutral-500 transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm font-bold">{item.label}</span>
                  <button 
                    onClick={() => {
                      const newToolbar = [...settings.toolbar];
                      newToolbar[index] = { ...item, visible: !item.visible };
                      setSettings(prev => ({ ...prev, toolbar: newToolbar }));
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      item.visible ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "text-neutral-400 bg-neutral-100 dark:bg-neutral-900"
                    )}
                  >
                    {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <div className="flex flex-col gap-1">
                    <button 
                      disabled={index === 0}
                      onClick={() => {
                        const newToolbar = [...settings.toolbar];
                        [newToolbar[index - 1], newToolbar[index]] = [newToolbar[index], newToolbar[index - 1]];
                        setSettings(prev => ({ ...prev, toolbar: newToolbar }));
                      }}
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-20"
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
                      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded disabled:opacity-20"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Keyboard Shortcuts */}
        <CollapsibleSection title="Keyboard Shortcuts" icon={Keyboard}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {[
              { label: 'Undo', key: 'undo' },
              { label: 'Redo', key: 'redo' },
              { label: 'Search', key: 'search' },
              { label: 'Next Page', key: 'nextPage' },
              { label: 'Prev Page', key: 'prevPage' },
              { label: 'Selection Tool', key: 'selectionTool' },
              { label: 'Text Tool', key: 'textTool' },
              { label: 'Box Tool', key: 'boxTool' },
              { label: 'Highlight Tool', key: 'highlightTool' },
              { label: 'Auto Detect', key: 'autoDetect' },
              { label: 'OCR', key: 'ocr' },
              { label: 'Apply Redactions', key: 'applyRedactions' },
              { label: 'Toggle Review', key: 'toggleReview' },
            ].map(shortcut => (
              <div key={shortcut.key} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{shortcut.label}</span>
                <input 
                  type="text"
                  value={(settings.shortcuts as any)[shortcut.key]}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    shortcuts: { ...prev.shortcuts, [shortcut.key]: e.target.value }
                  }))}
                  className="w-24 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-black font-mono shadow-sm text-center focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Custom AI Redaction Rules */}
        <CollapsibleSection title="Custom AI Redaction Rules" icon={Brain}>
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">Define custom rules for automated redaction based on keywords, regex, or company identifiers.</p>
              <button 
                onClick={addCompanyRule}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            <div className="space-y-4">
              {(settings.companyRules || []).map(rule => (
                <div key={rule.id} className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={rule.name}
                        onChange={(e) => updateCompanyRule(rule.id, { name: e.target.value })}
                        className="bg-transparent border-none font-black text-lg outline-none focus:ring-2 focus:ring-black dark:focus:ring-white rounded-lg px-2"
                      />
                      <button 
                        onClick={() => updateCompanyRule(rule.id, { isActive: !rule.isActive })}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                          rule.isActive ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                        )}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <button 
                      onClick={() => removeCompanyRule(rule.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Sensitive Terms (comma separated)</label>
                      <textarea 
                        value={(rule.sensitiveTerms || []).join(', ')}
                        onChange={(e) => updateCompanyRule(rule.id, { sensitiveTerms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-24"
                        placeholder="e.g. Secret, Confidential, Internal"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Regex Patterns (comma separated)</label>
                      <textarea 
                        value={(rule.patterns || []).join(', ')}
                        onChange={(e) => updateCompanyRule(rule.id, { patterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-24"
                        placeholder="e.g. \\d{3}-\\d{2}-\\d{4}, [A-Z]{2}\\d{6}"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Company Identifiers (Keywords to trigger this rule)</label>
                    <input 
                      type="text" 
                      value={(rule.identifiers || []).join(', ')}
                      onChange={(e) => updateCompanyRule(rule.id, { identifiers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="e.g. Acme Corp, Global Tech"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Export Redaction Report */}
        {activeFile && (
          <CollapsibleSection title="Export Report" icon={Download}>
            <div className="space-y-6 pt-4">
              <p className="text-sm text-neutral-500 leading-relaxed">
                Download a detailed audit trail of all redactions in this document, including page numbers, coordinates, labels, and comments.
              </p>
              
              <label className="flex items-center gap-3 cursor-pointer group bg-neutral-50 dark:bg-neutral-800 p-4 rounded-2xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
                <input 
                  type="checkbox" 
                  checked={exportOnlySelected}
                  onChange={(e) => setExportOnlySelected(e.target.checked)}
                  className="w-5 h-5 accent-black dark:accent-white"
                />
                <span className="text-sm font-bold text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">Export only selected redactions</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
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
                  className="py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  JSON Report
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
                  className="py-4 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Files className="w-4 h-4" />
                  CSV Report
                </button>
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <a href="#" className="text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest">Documentation</a>
          <a href="#" className="text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest">Privacy Policy</a>
          <a href="#" className="text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest">Support</a>
        </div>
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Redactio v2.4.0 • Enterprise Edition</p>
      </div>
    </div>
  );
}
function PDFToolboxView({ onToolClick, addAlert }: { onToolClick: (tool: any) => void; addAlert: any }) {
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [pageNumber, setPageNumber] = useState(1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileUrl(URL.createObjectURL(f));
    }
  };

  if (selectedTool) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex h-full bg-slate-50 dark:bg-slate-950"
      >
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col p-6 gap-6">
          <div className="space-y-4">
            <button 
              onClick={() => setSelectedTool(null)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              Back to Toolbox
            </button>
            <div className="flex items-center gap-2">
              <selectedTool.icon className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{selectedTool.name}</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{selectedTool.description}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Upload Document</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-950/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-6 h-6 mb-2 text-slate-400" />
                  <p className="text-xs font-medium text-slate-400">Select PDF</p>
                </div>
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div className="mt-auto">
            <button
              disabled={!file}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl text-xs font-bold hover:bg-blue-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Zap className="w-4 h-4" />
              Process with {selectedTool.name}
            </button>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
          <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <selectedTool.icon className="w-4 h-4 text-blue-600" />
              <h1 className="text-xs font-bold text-slate-900 dark:text-white">{selectedTool.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setScale(s => s + 0.1)}><Plus className="w-4 h-4" /></button>
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><Minus className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 flex justify-center">
            {fileUrl ? (
              <PDFViewer
                fileUrl={fileUrl}
                redactions={[]}
                onRedactionsChange={() => {}}
                tool="selection"
                scale={scale}
                onScaleChange={setScale}
                pageNumber={pageNumber}
                onPageChange={setPageNumber}
              />
            ) : (
              <div className="flex flex-col items-center justify-center opacity-20">
                <selectedTool.icon className="w-24 h-24 mb-4" />
                <p className="text-sm font-semibold">Upload a document to use this tool</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-12 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold tracking-tight text-slate-900 dark:text-white">PDF Toolbox</h1>
          <p className="text-lg text-slate-500 font-medium">Advanced document manipulation utilities.</p>
        </div>
        <StirlingTools onToolClick={(tool) => setSelectedTool(tool)} />
      </div>
    </div>
  );
}

function RuleStudioView({ settings, setSettings, addAlert }: { 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  addAlert: (type: 'success' | 'info' | 'warning' | 'error', message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedCompany, setDetectedCompany] = useState<CompanyRule | null>(null);
  const [suggestedName, setSuggestedName] = useState('');
  const [redactions, setRedactions] = useState<RedactionBox[]>([]);
  const [selectedRedactionId, setSelectedRedactionId] = useState<string | null>(null);
  const [saveManualAsRules, setSaveManualAsRules] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPdfUrl(URL.createObjectURL(f));
    setIsAnalyzing(true);
    setRedactions([]);
    setDetectedCompany(null);
    setSuggestedName('');

    try {
      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => (item as any).str).join(' ');

      const found = detectCompanyFromText(text, settings.companyRules);
      if (found) {
        setDetectedCompany(found);
        addAlert('success', `Detected company: ${found.name}`);
        const initialRedactions: RedactionBox[] = (found.learnedCoordinates || []).map(c => ({
          id: `rule-${Math.random()}`,
          ...c,
          type: 'auto',
          isSelected: false
        }));
        setRedactions(initialRedactions);
      } else {
        const lines = text.split('\n').filter(l => l.trim().length > 3);
        if (lines[0]) setSuggestedName(lines[0].substring(0, 30).trim());
        addAlert('info', 'No existing rule found for this company.');
      }
    } catch (err) {
      console.error(err);
      addAlert('error', 'Failed to analyze PDF.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveRule = () => {
    const companyName = detectedCompany ? detectedCompany.name : suggestedName;
    if (!companyName) {
      addAlert('error', 'Please provide a company name.');
      return;
    }

    const newRule: CompanyRule = {
      id: detectedCompany?.id || Math.random().toString(36).substring(7),
      name: companyName,
      identifiers: detectedCompany?.identifiers || [companyName],
      patterns: detectedCompany?.patterns || [],
      sensitiveTerms: detectedCompany?.sensitiveTerms || [],
      learnedCoordinates: redactions
        .filter(r => saveManualAsRules || r.type !== 'manual'),
      isActive: true
    };

    const updatedRules = detectedCompany 
      ? settings.companyRules.map(r => r.id === detectedCompany.id ? newRule : r)
      : [...settings.companyRules, newRule];

    setSettings(prev => ({ ...prev, companyRules: updatedRules }));
    addAlert('success', `Rule for ${companyName} saved successfully!`);
  };

  return (
    <div className="flex-1 flex h-full bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col p-6 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Company Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Company Name</label>
              <input
                type="text"
                value={detectedCompany ? detectedCompany.name : suggestedName}
                onChange={(e) => detectedCompany ? setDetectedCompany({...detectedCompany, name: e.target.value}) : setSuggestedName(e.target.value)}
                placeholder="Enter company name..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Upload Unredacted</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-950/50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                   <Upload className="w-6 h-6 mb-2 text-slate-400" />
                   <p className="text-xs font-medium text-slate-400">Select PDF</p>
                </div>
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500">Save Manual as Rules</span>
            <button 
              onClick={() => setSaveManualAsRules(!saveManualAsRules)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                saveManualAsRules ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <div className={cn(
                "absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all",
                saveManualAsRules ? "left-6" : "left-1"
              )} />
            </button>
          </div>
          <button
            onClick={saveRule}
            disabled={!file || isAnalyzing}
            className="w-full bg-blue-600 text-white p-4 rounded-2xl text-xs font-bold hover:bg-blue-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Rule
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Toolbar */}
        <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xs font-bold text-slate-900 dark:text-white">Rule Define Studio</h1>
            {file && <span className="text-[10px] font-medium text-slate-400">{file.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><Search className="w-4 h-4" /></button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setPageNumber(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">PAGE {pageNumber}</span>
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setPageNumber(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setZoom(z => z + 0.1)}><Plus className="w-4 h-4" /></button>
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}><Minus className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-12 flex justify-center">
          {pdfUrl ? (
            <div className="relative">
              <PDFViewer
                fileUrl={pdfUrl}
                redactions={redactions}
                onRedactionsChange={setRedactions}
                tool="box"
                scale={zoom}
                onScaleChange={setZoom}
                pageNumber={pageNumber}
                onPageChange={setPageNumber}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-20">
              <Database className="w-24 h-24 mb-4" />
              <p className="text-sm font-semibold">Upload a document to define rules</p>
            </div>
          )}
        </div>
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
  const [learnedData, setLearnedData] = useState<{
    suggestedRules: CompanyRule[];
    detectedRedactions: RedactionBox[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'redacted') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSession(prev => ({
      ...prev,
      [type === 'original' ? 'originalFile' : 'redactedFile']: file,
      [type === 'original' ? 'originalUrl' : 'redactedUrl']: URL.createObjectURL(file)
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
      // Simulate analysis steps
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        await new Promise(r => setTimeout(r, 100));
      }

      // Simulated learned data
      setLearnedData({
        suggestedRules: [
          {
            id: 'rule-1',
            name: 'Learned Template A',
            description: 'Automatically identified from training session',
            patterns: ['[A-Z]{2}\\d{6}'],
            sensitiveTerms: [],
            learnedCoordinates: [
              { id: 'c1', pageIndex: 0, x: 10, y: 15, width: 20, height: 5, type: 'box', isSelected: false }
            ]
          }
        ],
        detectedRedactions: [
          { id: 'dr1', pageIndex: 0, x: 10, y: 15, width: 20, height: 5, type: 'box', isSelected: false, label: 'Pattern Match' }
        ]
      });

      setSession(prev => ({ ...prev, status: 'preview' }));
      addAlert('success', 'AI Training completed successfully.');
    } catch (err) {
      setSession(prev => ({ ...prev, status: 'error' }));
      addAlert('error', 'Training failed. Please try again.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-bold tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
          <Brain className="w-10 h-10 text-blue-600" />
          Training Workflow
        </h2>
        <p className="text-slate-500 font-medium">Teach Redectio your specific redaction patterns by providing examples.</p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Step 1: Upload */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <h3 className="font-bold text-slate-900 dark:text-white">Upload Examples</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Original (Unredacted)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-950/50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileUp className="w-6 h-6 mb-2 text-slate-400" />
                    <p className="text-xs font-medium text-slate-400">Select PDF</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileChange(e, 'original')} />
                </label>
                {session.originalFile && (
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">{session.originalFile.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Redacted (Reference)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-all bg-slate-50 dark:bg-slate-950/50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ShieldCheck className="w-6 h-6 mb-2 text-slate-400" />
                    <p className="text-xs font-medium text-slate-400">Select PDF</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileChange(e, 'redacted')} />
                </label>
                {session.redactedFile && (
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">{session.redactedFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={runTraining}
              disabled={!session.originalFile || !session.redactedFile || session.status === 'analyzing'}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {session.status === 'analyzing' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              Start Training
            </button>
          </div>
        </div>

        {/* Step 2: Analysis & Preview */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            {session.status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ready for Training</h3>
                  <p className="text-slate-500">Upload an original document and its redacted counterpart. Our AI will analyze the differences to learn your specific redaction rules.</p>
                </div>
              </div>
            )}

            {session.status === 'analyzing' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-8">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-slate-100 dark:border-slate-800 rounded-full" />
                  <div 
                    className="absolute inset-0 border-4 border-blue-600 rounded-full transition-all duration-300"
                    style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{progress}%</span>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Analyzing Differences</h3>
                  <p className="text-slate-500 animate-pulse">Identifying patterns, coordinates, and sensitive data types...</p>
                </div>
              </div>
            )}

            {session.status === 'preview' && learnedData && (
              <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full">Analysis Complete</div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Learned Results</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"><RefreshCw className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                  <div className="p-6 space-y-6">
                    <h4 className="text-xs font-semibold text-slate-400">Suggested Rules</h4>
                    <div className="space-y-3">
                      {learnedData.suggestedRules.map(rule => (
                        <div key={rule.id} className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 group hover:border-blue-500 dark:hover:border-blue-400 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{rule.name}</span>
                            <Plus className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                          </div>
                          <p className="text-xs text-neutral-500 font-serif italic mb-3">{rule.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {rule.patterns?.map((p, i) => (
                              <span key={i} className="px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded text-[10px] font-mono">{p}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <h4 className="text-xs font-semibold text-slate-400">Detected Redactions</h4>
                    <div className="space-y-3">
                      {learnedData.detectedRedactions.map(redaction => (
                        <div key={redaction.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <span className="text-xs font-semibold">{redaction.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">Page {redaction.pageIndex + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button className="px-6 py-3 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-600 dark:text-slate-400">Discard</button>
                  <button className="px-8 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20">Save to Model</button>
                </div>
              </div>
            )}

            {session.status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Training Failed</h3>
                  <p className="text-slate-500 mb-6">Something went wrong during the analysis. Please ensure both files are valid PDFs and try again.</p>
                  <button 
                    onClick={() => setSession(prev => ({ ...prev, status: 'idle' }))}
                    className="px-8 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeView({ onFileSelect, onToolSelect }: { onFileSelect: (file: File) => void; onToolSelect: (view: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const categories = [
    {
      title: "Organize PDF",
      icon: LayoutGrid,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      tools: [
        { id: 'merge', name: 'Merge PDF', icon: Files, desc: 'Combine multiple PDFs into one' },
        { id: 'split', name: 'Split PDF', icon: Scissors, desc: 'Extract pages or ranges' },
        { id: 'organize', name: 'Organize PDF', icon: Layout, desc: 'Sort, add, or delete pages' },
        { id: 'remove-pages', name: 'Remove Pages', icon: FileMinus, desc: 'Delete specific pages' }
      ]
    },
    {
      title: "Optimize PDF",
      icon: Maximize,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      tools: [
        { id: 'compress', name: 'Compress PDF', icon: Minimize, desc: 'Reduce file size' },
        { id: 'repair', name: 'Repair PDF', icon: Wrench, desc: 'Fix damaged documents' },
        { id: 'unlock', name: 'Unlock PDF', icon: Unlock, desc: 'Remove passwords' },
        { id: 'protect', name: 'Protect PDF', icon: Lock, desc: 'Add password security' }
      ]
    },
    {
      title: "Convert from PDF",
      icon: ArrowRightLeft,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      tools: [
        { id: 'pdf-to-word', name: 'PDF to Word', icon: FileText, desc: 'Convert to editable DOCX' },
        { id: 'pdf-to-excel', name: 'PDF to Excel', icon: Database, desc: 'Extract tables to XLSX' },
        { id: 'pdf-to-ppt', name: 'PDF to PowerPoint', icon: Monitor, desc: 'Convert to slides' },
        { id: 'pdf-to-jpg', name: 'PDF to JPG', icon: Palette, desc: 'Extract images' }
      ]
    },
    {
      title: "Convert to PDF",
      icon: FilePlus,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/20",
      tools: [
        { id: 'word-to-pdf', name: 'Word to PDF', icon: FileText, desc: 'Convert DOCX to PDF' },
        { id: 'jpg-to-pdf', name: 'JPG to PDF', icon: Palette, desc: 'Convert images to PDF' },
        { id: 'html-to-pdf', name: 'HTML to PDF', icon: Globe, desc: 'Webpage to PDF' },
        { id: 'ocr', name: 'OCR PDF', icon: FileSearch, desc: 'Make scanned PDFs searchable' }
      ]
    },
    {
      title: "Edit PDF",
      icon: Settings2,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      tools: [
        { id: 'watermark', name: 'Watermark', icon: Shield, desc: 'Add image or text overlay' },
        { id: 'page-numbers', name: 'Page Numbers', icon: ScrollText, desc: 'Add page numbering' },
        { id: 'rotate', name: 'Rotate PDF', icon: RefreshCw, desc: 'Rotate pages' },
        { id: 'edit', name: 'Edit PDF', icon: TypeIcon, desc: 'Add text, images, or shapes' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full -z-10" />
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">The Ultimate PDF Toolkit</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9]"
          >
            EVERY TOOL YOU NEED <br />
            <span className="text-blue-600">TO WORK WITH PDFS</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-500 max-w-2xl mx-auto font-medium"
          >
            100% free, secure, and runs entirely in your browser. No files ever leave your device.
          </motion.p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto w-full px-6 pb-24 grid grid-cols-12 gap-8">
        {/* Upload Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="col-span-12 lg:col-span-12"
        >
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "relative group cursor-pointer transition-all duration-500",
              "bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed",
              isDragging 
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.02]" 
                : "border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50"
            )}
          >
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
              accept=".pdf"
            />
            <div className="p-12 md:p-20 flex flex-col items-center text-center space-y-8">
              <div className="relative">
                <div className="w-32 h-32 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/40 group-hover:scale-110 transition-transform duration-500">
                  <FileUp className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-900">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Select PDF file</h2>
                <p className="text-slate-500 font-medium">or drop PDF here</p>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  SECURE & PRIVATE
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
                  <Zap className="w-4 h-4 text-amber-500" />
                  LIGHTNING FAST
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
                  <Brain className="w-4 h-4 text-purple-500" />
                  AI POWERED
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Categories */}
        {categories.map((category, idx) => (
          <motion.div 
            key={category.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (idx * 0.1) }}
            className="col-span-12 md:col-span-4 space-y-6"
          >
            <div className="flex items-center gap-3 px-2">
              <div className={cn("p-2 rounded-xl", category.bg)}>
                <category.icon className={cn("w-5 h-5", category.color)} />
              </div>
              <h3 className="font-black tracking-tight text-slate-900 dark:text-white uppercase text-sm">{category.title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {category.tools.map(tool => (
                <motion.button 
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  key={tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  className="group p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-left flex items-start gap-4"
                >
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors">
                    <tool.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tool.name}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{tool.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-12 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="font-black tracking-tighter text-xl">PDF<span className="text-blue-600">GUARD</span></span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-400">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Contact Us</a>
            <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <Globe className="w-3 h-3" /> English
            </a>
          </div>
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:text-blue-600 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onToolSelect('settings')}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:text-blue-600 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileToolItem({ active, onClick, icon: Icon, label, color }: { active?: boolean; onClick: () => void; icon: any; label: string; color?: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-3 group"
    >
      <div className={cn(
        "w-16 h-16 rounded-[24px] flex items-center justify-center transition-all duration-300 shadow-lg",
        active 
          ? "bg-blue-600 text-white scale-110 shadow-blue-500/40" 
          : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-700"
      )}>
        <Icon className={cn("w-7 h-7", color)} />
      </div>
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-widest transition-colors",
        active ? "text-blue-600" : "text-slate-400"
      )}>{label}</span>
    </button>
  );
}

