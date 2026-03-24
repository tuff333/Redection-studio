import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, FileText, Settings, Layers, Globe,
  Download, Trash2, CheckCircle2, AlertCircle,
  Undo, Redo, Undo2, Redo2, Search, SearchX, ChevronLeft, ChevronRight, Zap, ChevronDown, LayoutGrid, Lock, Unlock, FileUp, Files, Settings2, Info, HelpCircle, ExternalLink,
  Type as TypeIcon, Square, Highlighter, Sun, Moon,
  Monitor, Palette, Keyboard, X, Plus, Play, RefreshCw, Sparkles, Check,
  Barcode, QrCode, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown,
  Save, Bookmark, Brain, MousePointer2, Move, ShieldCheck, ShieldAlert, Star, FileJson, Database, History as HistoryIcon
} from 'lucide-react';
import { SecurityAudit } from './components/SecurityAudit';
import { PDFFile, RedactionBox, AppSettings, Theme, OCRResult, BatchRuleSet, RedactionStyle, CompanyRule, TrainingSession } from './types';
import { cn, formatFileName } from './lib/utils';
import { PDFDocument, rgb } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Tooltip } from './components/Tooltip';

import { performLocalOCR, detectPIILocal, detectSensitiveTermsLocal, detectAdvancedAI, unlockPDF, trainModelFromFiles } from './lib/ai';
import { validateDataWithAPI, RECOMMENDED_APIS } from './services/publicApiService';
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
      ? "bg-black text-white dark:bg-white dark:text-black shadow-lg scale-105" 
      : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
    danger: "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
    success: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    ghost: "bg-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
  };

  return (
    <Tooltip title={label} shortcut={shortcut}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "p-3 rounded-xl transition-all duration-200 flex flex-col items-center gap-1 min-w-[64px] group disabled:opacity-30 disabled:cursor-not-allowed",
          variants[variant]
        )}
      >
        <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active && "animate-pulse")} />
        <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">{label}</span>
      </button>
    </Tooltip>
  );
}

function RedactionBoxComponent({ 
  redaction, 
  onUpdate, 
  onDelete, 
  onComment,
  isSelected,
  style = 'solid',
  isReviewMode = false
}: { 
  redaction: RedactionBox; 
  onUpdate: (updates: Partial<RedactionBox>) => void; 
  onDelete: () => void;
  onComment: () => void;
  isSelected: boolean;
  style?: RedactionStyle;
  isReviewMode?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn(
        "absolute transition-all duration-500 group cursor-pointer",
        isSelected ? "z-50 ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-transparent" : "z-10",
        style === 'outline' ? "border-2 border-black dark:border-white bg-transparent" : "bg-black dark:bg-white",
        isReviewMode ? "shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.01]" : ""
      )}
      style={{
        left: `${redaction.x}%`,
        top: `${redaction.y}%`,
        width: `${redaction.width}%`,
        height: `${redaction.height}%`,
        opacity: isSelected ? 1 : 0.85
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onUpdate({ isSelected: !isSelected });
      }}
    >
      {/* Label Overlay */}
      {(redaction.label || redaction.text) && (
        <div className="absolute -top-6 left-0 bg-black dark:bg-white text-white dark:text-black text-[10px] font-black px-2 py-0.5 rounded-t-lg whitespace-nowrap uppercase tracking-widest shadow-lg">
          {redaction.label || redaction.text}
        </div>
      )}

      {/* Controls Overlay */}
      <AnimatePresence>
        {(isHovered || isSelected) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-neutral-900 p-1 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); onComment(); }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pattern Overlay */}
      {style === 'pattern' && (
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)' }} />
      )}
    </div>
  );
}

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
    sensitivity: 0.7,
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
    selectionTool: 'v',
    autoDetect: 'a',
    ocr: 'o',
    applyRedactions: 'Enter',
    toggleReview: 'r',
  }
};

export default function App() {
  const [view, setView] = useState<'home' | 'editor' | 'batch' | 'settings' | 'training' | 'api-hub' | 'stirling-tools'>('home');
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
              className="space-y-12"
            >
              <div className="text-center max-w-3xl mx-auto">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 mb-6"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Grade Privacy</span>
                </motion.div>
                <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tighter leading-[0.9]">
                  The Ultimate <span className="text-neutral-400">PDF</span> Utility
                </h1>
                <p className="text-neutral-500 dark:text-neutral-400 text-lg md:text-xl font-medium leading-relaxed">
                  Redact, analyze, and secure your documents with industry-leading AI. 
                  Everything stays in your browser. No data ever leaves your machine.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Main Upload Card */}
                <label className="lg:col-span-2 group relative flex flex-col items-center justify-center h-80 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] cursor-pointer hover:border-black dark:hover:border-white transition-all duration-500 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-transparent dark:from-neutral-800/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex flex-col items-center justify-center p-8">
                    <div className="w-20 h-20 bg-black dark:bg-white rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl">
                      <FileUp className="w-10 h-10 text-white dark:text-black" />
                    </div>
                    <p className="text-2xl font-black tracking-tight mb-2">Drop your PDF here</p>
                    <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest">or click to browse files</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFileUpload} />
                </label>

                {/* Tool Cards */}
                {[
                  { title: 'PDF Toolbox', desc: 'Metadata, Security, Formatting & more', icon: LayoutGrid, action: () => setView('stirling-tools'), color: 'bg-indigo-500' },
                  { title: 'Batch Process', desc: 'Redact multiple files at once', icon: Files, action: () => setView('batch'), color: 'bg-blue-500' },
                  { title: 'Public API Hub', desc: 'Integrate external data validators', icon: Globe, action: () => setView('api-hub'), color: 'bg-emerald-500' },
                  { title: 'AI Training', desc: 'Improve detection accuracy', icon: Brain, action: () => setView('training'), color: 'bg-purple-500' },
                ].map((tool, i) => (
                  <motion.button
                    key={tool.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    onClick={tool.action}
                    className="group flex flex-col items-start p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] text-left hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
                  >
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg", tool.color)}>
                      <tool.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight mb-2">{tool.title}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">{tool.desc}</p>
                  </motion.button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-8 pt-12 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-neutral-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">100% Client Side</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">AES-256 Encryption</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">GDPR Compliant</span>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'stirling-tools' && (
            <motion.div
              key="stirling-tools"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-black tracking-tight mb-2">PDF Toolbox</h1>
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">Comprehensive tools for document manipulation and security.</p>
                </div>
                <button 
                  onClick={() => setView('home')}
                  className="px-6 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-2xl font-bold transition-colors flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Home
                </button>
              </div>

              <StirlingTools onToolClick={(tool) => {
                setActiveTool(tool);
              }} />

              <AnimatePresence>
                {activeTool && (
                  <ToolDialog 
                    tool={activeTool} 
                    onClose={() => setActiveTool(null)} 
                    addAlert={addAlert}
                  />
                )}
              </AnimatePresence>
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
                setView={setView}
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

function EditorView({ file, settings, setSettings, onBack, setView, addAlert, setFiles }: { 
  file: PDFFile; 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  setView: (view: 'home' | 'editor' | 'batch' | 'settings' | 'training' | 'api-hub') => void;
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
                  pageIndex: mr.pageIndex,
                  x: mr.x,
                  y: mr.y,
                  width: mr.width,
                  height: mr.height,
                  label: mr.label || 'MANUAL'
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

  const generateAISuggestions = async () => {
    if (!canvasRef.current) {
      addAlert('error', 'Document not ready for analysis.');
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
        const ocrData = await performLocalOCR(imageData) as any;
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
      const ocrData = await performLocalOCR(imageData) as any;
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
    addAlert('info', 'Performing Local OCR on current page...');
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      const ocrData = await performLocalOCR(imageData) as any;
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
        addAlert('info', 'Local OCR complete. No text elements found on this page.');
      } else {
        addAlert('success', `Local OCR complete. Found ${results.length} text elements.`);
      }
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
    <div className="flex flex-col h-screen bg-neutral-100 dark:bg-neutral-950 overflow-hidden">
      {/* Top Header - Stirling Style */}
      <header className="h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 md:px-6 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <button 
            onClick={onBack} 
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors flex-shrink-0"
            title="Back to Home"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-sm md:text-base font-bold truncate max-w-[150px] md:max-w-xs">{file.name}</h1>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-neutral-500 font-medium">
              <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded uppercase tracking-wider">PDF</span>
              <span className="truncate">{numPages} Pages • {identifiedCompany || 'Generic PDF'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setIsReviewMode(!isReviewMode)}
            className={cn(
              "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all font-bold text-xs",
              isReviewMode ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
            title="Review Mode (Dim Background)"
          >
            <Eye className="w-4 h-4" />
            {isReviewMode ? "Exit Review" : "Review Mode"}
          </button>
          
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 hidden md:block" />

          {/* Page Navigation - Desktop */}
          <div className="hidden md:flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <button 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
              disabled={pageNumber === 1}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-30"
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
                className="w-8 bg-transparent text-center font-bold text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white rounded"
              />
              <span className="text-sm font-bold text-neutral-400">/ {numPages}</span>
            </div>
            <button 
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
              disabled={pageNumber === numPages}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 hidden md:block" />

          {/* Zoom Controls - Desktop */}
          <div className="hidden md:flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-xl">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><SearchX className="w-4 h-4" /></button>
            <span className="text-xs font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"><Search className="w-4 h-4" /></button>
          </div>

          <button 
            onClick={() => setShowConfirmApply(true)}
            className="bg-black text-white dark:bg-white dark:text-black px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Apply & Download</span>
            <span className="sm:hidden">Apply</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Thumbnails (Stirling Style) */}
        <aside className="hidden lg:flex w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Pages</h2>
            <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full font-bold">{numPages} Total</span>
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
                  "aspect-[1/1.414] rounded-lg border-2 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shadow-sm transition-all",
                  pageNumber === num ? "border-black dark:border-white shadow-md" : "border-transparent group-hover:border-neutral-300 dark:group-hover:border-neutral-700"
                )}>
                  <Document file={file.url} loading={<div className="w-full h-full animate-pulse bg-neutral-200 dark:bg-neutral-700" />}>
                    <Page 
                      pageNumber={num} 
                      width={200} 
                      renderTextLayer={false} 
                      renderAnnotationLayer={false}
                      className="w-full h-full object-cover"
                    />
                  </Document>
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
                    pageNumber === num ? "text-black dark:text-white" : "text-neutral-400"
                  )}>Page {num}</span>
                  {redactions.filter(r => r.pageIndex === num - 1).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Viewer - Stirling Style (Dark Background) */}
        <main className={cn(
          "flex-1 overflow-auto relative flex flex-col items-center p-4 md:p-8 scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 transition-all duration-500",
          isReviewMode ? "bg-neutral-900" : "bg-neutral-200 dark:bg-neutral-950"
        )}>
          <div 
            className={cn(
              "relative shadow-2xl transition-all duration-500 origin-top",
              isReviewMode ? "scale-[1.02] ring-8 ring-white/5" : ""
            )}
            style={{ transform: `scale(${scale})` }}
          >
            <div 
              className="relative bg-white shadow-lg overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{ cursor: tool === 'selection' ? 'default' : 'crosshair' }}
            >
              <Document
                file={file.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={pdfOptions}
                loading={
                  <div className="flex flex-col items-center justify-center p-20 space-y-4">
                    <RefreshCw className="w-10 h-10 animate-spin text-neutral-400" />
                    <p className="text-sm font-medium text-neutral-500">Loading Page {pageNumber}...</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={1.5}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  canvasRef={canvasRef}
                  className="shadow-xl"
                />
              </Document>

              {/* Redaction Overlay */}
              <div className={cn(
                "absolute inset-0 z-10 pointer-events-none select-none transition-all duration-500",
                isReviewMode ? "bg-black/40" : ""
              )}>
                {redactions.filter(r => r.pageIndex === pageNumber - 1).map((redaction) => (
                  <RedactionBoxComponent
                    key={redaction.id}
                    redaction={redaction}
                    onUpdate={(updates) => {
                      const updated = redactions.map(r => r.id === redaction.id ? { ...r, ...updates } : r);
                      setRedactions(updated);
                      addToHistory(updated);
                    }}
                    onDelete={() => {
                      const updated = redactions.filter(r => r.id !== redaction.id);
                      setRedactions(updated);
                      addToHistory(updated);
                    }}
                    onComment={() => setCommentModal({ isOpen: true, redactionId: redaction.id, comment: redaction.comment || '' })}
                    isSelected={redaction.isSelected}
                    style={settings.redactionStyle}
                    isReviewMode={isReviewMode}
                  />
                ))}

                {/* Drawing Preview */}
                {currentBox && (
                  <div 
                    className="absolute border-2 border-dashed border-black dark:border-white bg-black/10 dark:bg-white/10"
                    style={{
                      left: `${currentBox.x}%`,
                      top: `${currentBox.y}%`,
                      width: `${currentBox.width}%`,
                      height: `${currentBox.height}%`
                    }}
                  />
                )}
                
                {/* Highlight Preview */}
                {currentPath.length > 1 && (
                  <svg className="absolute inset-0 w-full h-full overflow-visible">
                    <path
                      d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                      fill="none"
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}

                {/* OCR Hover Highlight */}
                {hoveredOCR && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute border-2 border-emerald-500 bg-emerald-500/10 z-20"
                    style={{
                      left: `${hoveredOCR.x}%`,
                      top: `${hoveredOCR.y}%`,
                      width: `${hoveredOCR.width}%`,
                      height: `${hoveredOCR.height}%`
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded whitespace-nowrap">
                      OCR: {hoveredOCR.text}
                    </div>
                  </motion.div>
                )}

                {/* Search Highlights */}
                {tempHighlights.filter(h => h.pageIndex === pageNumber - 1).map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute border-2 border-yellow-400 bg-yellow-400/20"
                    style={{
                      left: `${h.x}%`,
                      top: `${h.y}%`,
                      width: `${h.width}%`,
                      height: `${h.height}%`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Floating Toolbar - Stirling Style */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 p-1.5 rounded-2xl shadow-2xl z-40">
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
            
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />
            
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

            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />

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
        </main>
        {/* Right Sidebar - Redactions (Stirling Style) */}
        <aside className="hidden xl:flex w-80 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Redactions</h2>
            <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full font-bold">{redactions.length}</span>
          </div>
          
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-x-auto scrollbar-hide">
              {(['redactions', 'ocr', 'suggestions', 'report', 'audit', 'logs', 'templates'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all relative",
                    sidebarTab === tab 
                      ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm" 
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
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
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400 text-center">
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
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page {page}</span>
                        <div className="h-px flex-1 bg-neutral-100 dark:bg-neutral-800" />
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
                            r.isSelected ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800" : "border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">{r.label || 'Redaction'}</span>
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
                          {r.text && <p className="text-[10px] text-neutral-500 truncate italic">"{r.text}"</p>}
                          {r.comment && <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {sidebarTab === 'report' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Redaction Report</h3>
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
                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors"
                    title="Export Report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase mb-1">Total</p>
                      <p className="text-xl font-bold">{redactions.length}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase mb-1">Pages</p>
                      <p className="text-xl font-bold">{new Set(redactions.map(r => r.pageIndex)).size}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Summary by Label</h4>
                    <div className="space-y-2">
                      {Object.entries(
                        redactions.reduce((acc, r) => {
                          const label = r.label || 'Unlabeled';
                          acc[label] = (acc[label] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([label, count]) => (
                        <div key={label} className="flex items-center justify-between text-[10px]">
                          <span className="text-neutral-500">{label}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page Breakdown</h4>
                    <div className="space-y-2">
                      {Object.entries(
                        redactions.reduce((acc, r) => {
                          const page = r.pageIndex + 1;
                          acc[page] = (acc[page] || 0) + 1;
                          return acc;
                        }, {} as Record<number, number>)
                      ).sort(([a], [b]) => Number(a) - Number(b)).map(([page, count]) => (
                        <div key={page} className="flex items-center justify-between text-[10px]">
                          <span className="text-neutral-500">Page {page}</span>
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
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Company Templates</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => document.getElementById('template-import')?.click()}
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors"
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
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors"
                      title="Export Templates"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {settings.companyRules?.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400">
                      <FileJson className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No templates saved yet</p>
                    </div>
                  ) : (
                    settings.companyRules?.map((rule) => (
                      <div key={rule.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">{rule.name}</span>
                          <span className="text-[8px] text-neutral-400 font-mono">{rule.patterns.length} Patterns</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(rule.identifiers || []).slice(0, 3).map((id, i) => (
                            <span key={i} className="text-[8px] bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded uppercase">{id}</span>
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
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Audit Trail</h3>
                  <button 
                    onClick={() => setAuditLogs([])}
                    className="text-[10px] font-bold text-red-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-3">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400">
                      <HistoryIcon className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No activity logged yet</p>
                    </div>
                  ) : (
                    auditLogs.slice().reverse().map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">{log.action}</span>
                          <span className="text-[8px] text-neutral-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 line-clamp-2">{log.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'suggestions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">AI Suggestions</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={generateAISuggestions}
                      disabled={isGeneratingSuggestions}
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 transition-colors disabled:opacity-50"
                      title="Refresh Suggestions"
                    >
                      <RefreshCw className={cn("w-4 h-4", isGeneratingSuggestions && "animate-spin")} />
                    </button>
                    {aiSuggestions.length > 0 && (
                      <button 
                        onClick={() => {
                          const updated = [...redactions, ...aiSuggestions.map(s => ({ ...s, id: `redact-${Date.now()}-${Math.random()}` }))];
                          setRedactions(updated);
                          addToHistory(updated);
                          setAiSuggestions([]);
                          addAlert('success', `Applied all ${aiSuggestions.length} suggestions.`);
                        }}
                        className="text-[10px] font-bold text-emerald-500 hover:underline"
                      >
                        Apply All
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {isGeneratingSuggestions ? (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400 text-center">
                      <div className="w-8 h-8 border-2 border-neutral-200 border-t-black dark:border-t-white rounded-full animate-spin mb-4" />
                      <p className="text-[10px] font-medium">Analyzing page...</p>
                    </div>
                  ) : aiSuggestions.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400">
                      <Sparkles className="w-12 h-12 mb-4 opacity-20 mx-auto" />
                      <p className="text-xs font-medium">No suggestions yet</p>
                      <button
                        onClick={generateAISuggestions}
                        className="mt-4 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                      >
                        Scan Page
                      </button>
                    </div>
                  ) : (
                    aiSuggestions.map((suggestion) => (
                      <div 
                        key={suggestion.id} 
                        className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 group hover:border-emerald-500 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">{suggestion.label}</span>
                            <span className="text-[10px] font-bold truncate max-w-[140px]">"{suggestion.text}"</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                const updated = [...redactions, { ...suggestion, id: `redact-${Date.now()}` }];
                                setRedactions(updated);
                                addToHistory(updated);
                                setAiSuggestions(aiSuggestions.filter(s => s.id !== suggestion.id));
                              }}
                              className="p-1 hover:text-emerald-500 transition-colors"
                              title="Accept"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setAiSuggestions(aiSuggestions.filter(s => s.id !== suggestion.id))}
                              className="p-1 hover:text-red-500 transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {suggestion.comment && (
                          <p className="text-[9px] text-neutral-400 italic leading-tight">{suggestion.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'ocr' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Page Text</h3>
                  <button 
                    onClick={handleOCR}
                    disabled={isOCRing}
                    className="text-[10px] font-bold text-black dark:text-white hover:underline disabled:opacity-50"
                  >
                    {isOCRing ? 'Scanning...' : 'Scan Page'}
                  </button>
                </div>
                <div className="space-y-2">
                  {(ocrResults[pageNumber - 1] || []).length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                      <p className="text-[10px] text-neutral-400">No text detected on this page</p>
                    </div>
                  ) : (
                    ocrResults[pageNumber - 1].map((res, i) => (
                      <div 
                        key={i} 
                        onMouseEnter={() => setHoveredOCR(res)}
                        onMouseLeave={() => setHoveredOCR(null)}
                        className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2 group hover:border-black dark:hover:border-white transition-all cursor-pointer"
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
                          addAuditLog('OCR Redaction', `Redacted text: ${res.text}`);
                        }}
                      >
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-[10px] font-bold truncate">{res.text}</span>
                          <span className="text-[8px] text-neutral-400 font-mono">
                            X: {res.x.toFixed(1)}% Y: {res.y.toFixed(1)}%
                          </span>
                        </div>
                        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'history' && (
              <div className="space-y-3">
                {history.map((state, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setRedactions(state);
                      setHistoryIndex(idx);
                    }}
                    className={cn(
                      "w-full p-3 rounded-xl border text-left transition-all",
                      historyIndex === idx 
                        ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800" 
                        : "border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">
                        {idx === 0 ? 'Original' : `Action ${idx}`}
                      </span>
                      {historyIndex === idx && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </div>
                    <p className="text-[10px] font-medium">{state.length} Redactions</p>
                  </button>
                )).reverse()}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
            <button 
              onClick={() => setShowConfirmApply(true)}
              disabled={isProcessing || redactions.length === 0}
              className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
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
          if (!ocrData) continue;
          const text = ocrData.text || '';
          const words = ocrData.words || [];

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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Batch Redaction</h2>
          <p className="text-neutral-500 dark:text-neutral-400">Apply the same redaction rules to multiple documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleUnlockAll}
            disabled={isProcessing || files.length === 0}
            className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <EyeOff className="w-5 h-5" />
            Unlock All
          </button>
          <button 
            onClick={processBatch}
            disabled={isProcessing || files.length === 0}
            className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            Start Batch Process
          </button>
        </div>
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
                    onClick={saveRuleSet}
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
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const data = JSON.stringify(settings.savedBatchRules, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'batch_rules_export.json';
                  a.click();
                  addAlert('success', 'Batch rules exported.');
                }}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"
                title="Export Rules"
              >
                <Download className="w-4 h-4" />
              </button>
              <label className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors cursor-pointer" title="Import Rules">
                <Upload className="w-4 h-4" />
                <input 
                  type="file" 
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const imported = JSON.parse(event.target?.result as string);
                          if (Array.isArray(imported)) {
                            setSettings(prev => ({ ...prev, savedBatchRules: [...prev.savedBatchRules, ...imported] }));
                            addAlert('success', `Imported ${imported.length} rule sets.`);
                          }
                        } catch (err) {
                          addAlert('error', 'Failed to import rules.');
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
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

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            isOpen ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xl">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5 text-neutral-400" />
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
            <div className="p-6 pt-0 border-t border-neutral-100 dark:border-neutral-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SettingsView({ settings, setSettings, onBack, activeFile, setFiles, addAlert }: { 
  settings: AppSettings; 
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onBack: () => void;
  activeFile?: PDFFile;
  setFiles: React.Dispatch<React.SetStateAction<PDFFile[]>>;
  addAlert: (type: any, msg: string) => void;
}) {
  const [exportOnlySelected, setExportOnlySelected] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    setLastSaved(Date.now());
    const timer = setTimeout(() => setLastSaved(null), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

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
    <div className="max-w-3xl mx-auto relative pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-4xl font-black tracking-tight">Settings</h2>
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
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">{field.label}</label>
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
                  <label className="block text-sm font-bold">Detection Sensitivity</label>
                  <p className="text-xs text-neutral-500">Lower values are more aggressive, higher values are more precise.</p>
                </div>
                <span className="text-lg font-black font-mono bg-black text-white dark:bg-white dark:text-black px-3 py-1 rounded-lg">
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
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-lg"
                    : "bg-neutral-50 dark:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                )}>
                  <item.icon className="w-6 h-6 mb-3" />
                  <span className="text-xs font-bold uppercase tracking-wider text-center">{item.label}</span>
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

        {/* Company Rules */}
        <CollapsibleSection title="Company Rules" icon={ShieldCheck}>
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500 font-medium leading-relaxed max-w-md">
                Define custom rules for automated redaction. These rules can target specific keywords, patterns, or coordinates based on company-specific document layouts.
              </p>
              <button 
                onClick={addCompanyRule}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
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
                          className="text-lg font-black bg-transparent border-none p-0 focus:ring-0 w-full"
                          placeholder="Rule Name"
                        />
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
                          {rule.patterns?.length || 0} Patterns • {rule.learnedCoordinates?.length || 0} Coordinates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateCompanyRule(rule.id, { isActive: !rule.isActive })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
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
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Patterns & Keywords</label>
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
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Rule Type</label>
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
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Theme Mode</label>
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
                        ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-lg scale-105" 
                        : "bg-neutral-50 dark:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    <t.icon className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
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
                ].map(color => (
                  <div key={color.key}>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">{color.label}</label>
                    <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                      <input 
                        type="color" 
                        value={(settings.customTheme as any)?.[color.key]}
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
                  className="py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Files className="w-4 h-4" />
                  CSV Report
                </button>
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <a href="#" className="text-xs font-bold text-neutral-400 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest">Documentation</a>
          <a href="#" className="text-xs font-bold text-neutral-400 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest">Privacy Policy</a>
          <a href="#" className="text-xs font-bold text-neutral-400 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest">Support</a>
        </div>
        <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-[0.2em]">Redactio v2.4.0 • Enterprise Edition</p>
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
  const [zoom, setZoom] = useState(1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'redacted') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSession(prev => ({
      ...prev,
      [type === 'original' ? 'originalFile' : 'redactedFile']: file
    }));
  };

  const runTraining = async () => {
    if (!session.originalFile) {
      addAlert('error', 'Please upload at least the original file.');
      return;
    }

    setSession(prev => ({ ...prev, status: 'analyzing' }));
    setProgress(0);

    try {
      const originalUrl = URL.createObjectURL(session.originalFile);
      const originalPdf = await pdfjs.getDocument(originalUrl).promise;
      
      let originalText = "";
      const detectedRedactions: RedactionBox[] = [];

      // 1. Extract text from all pages for AI analysis
      for (let i = 1; i <= originalPdf.numPages; i++) {
        const page = await originalPdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        originalText += `--- Page ${i} ---\n${pageText}\n\n`;
        setProgress(Math.round((i / originalPdf.numPages) * 30)); // First 30% for text extraction
      }

      let redactedText = "";
      if (session.redactedFile) {
        const redactedUrl = URL.createObjectURL(session.redactedFile);
        const redactedPdf = await pdfjs.getDocument(redactedUrl).promise;
        for (let i = 1; i <= redactedPdf.numPages; i++) {
          const page = await redactedPdf.getPage(i);
          const textContent = await page.getTextContent();
          redactedText += textContent.items.map((item: any) => item.str).join(' ') + "\n";
        }
      }

      // 2. AI Analysis
      setProgress(50);
      const aiResult = await trainModelFromFiles(originalText, redactedText || undefined);
      
      // 3. If we have a redacted file, also do visual comparison to find coordinates
      const learnedCoordinates: any[] = [];
      if (session.redactedFile) {
        const redactedUrl = URL.createObjectURL(session.redactedFile);
        const redactedPdf = await pdfjs.getDocument(redactedUrl).promise;
        
        for (let i = 1; i <= originalPdf.numPages; i++) {
          setProgress(50 + Math.round((i / originalPdf.numPages) * 40));
          const origPage = await originalPdf.getPage(i);
          const redPage = await redactedPdf.getPage(i);
          const vp = origPage.getViewport({ scale: 2.0 });
          const canvasOrig = document.createElement('canvas');
          const canvasRed = document.createElement('canvas');
          canvasOrig.width = vp.width; canvasOrig.height = vp.height;
          canvasRed.width = vp.width; canvasRed.height = vp.height;
          await origPage.render({ canvasContext: canvasOrig.getContext('2d')!, viewport: vp, canvas: canvasOrig }).promise;
          await redPage.render({ canvasContext: canvasRed.getContext('2d')!, viewport: vp, canvas: canvasRed }).promise;
          const imgOrig = canvasOrig.getContext('2d')!.getImageData(0, 0, vp.width, vp.height);
          const imgRed = canvasRed.getContext('2d')!.getImageData(0, 0, vp.width, vp.height);
          const boxes = findRedactedBoxes(imgOrig, imgRed, vp.width, vp.height);
          
          boxes.forEach(box => {
            learnedCoordinates.push({
              pageIndex: i - 1,
              ...box,
              label: 'Learned Area'
            });
          });
        }
      }

      // 4. Convert AI detected redactions to boxes (best effort)
      // This is tricky without coordinates, so we'll mainly use them as "suggested terms"
      // and let the user refine them in the preview.
      
      const suggestedRule: CompanyRule = {
        id: Math.random().toString(36).substring(7),
        name: aiResult.companyName,
        patterns: aiResult.suggestedRules.patterns || [],
        sensitiveTerms: aiResult.suggestedRules.sensitiveTerms || [],
        learnedCoordinates: learnedCoordinates,
        identifiers: [aiResult.companyName],
        description: aiResult.suggestedRules.description
      };

      setSession(prev => ({
        ...prev,
        status: 'preview',
        originalUrl,
        learnedData: {
          companyName: aiResult.companyName,
          suggestedRules: suggestedRule,
          detectedRedactions: aiResult.detectedRedactions.map((r: any) => ({
            id: Math.random().toString(36).substring(7),
            pageIndex: 0, // Default to first page if unknown
            x: 0, y: 0, width: 0, height: 0, // Coordinates will be set by user or search
            text: r.text,
            label: r.label,
            type: 'auto',
            isSelected: true
          }))
        }
      }));

      setProgress(100);
      addAlert('success', `Analysis complete for ${aiResult.companyName}. Please review the preview.`);

    } catch (error) {
      console.error(error);
      setSession(prev => ({ ...prev, status: 'error' }));
      addAlert('error', 'Training failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const saveLearnedRule = () => {
    if (session.learnedData) {
      setSettings(prev => {
        const existingRuleIndex = prev.companyRules.findIndex(r => r.name === session.learnedData!.companyName);
        let updatedRules = [...prev.companyRules];
        
        if (existingRuleIndex >= 0) {
          // Merge with existing rule
          const existing = updatedRules[existingRuleIndex];
          updatedRules[existingRuleIndex] = {
            ...existing,
            patterns: Array.from(new Set([...existing.patterns, ...session.learnedData!.suggestedRules.patterns])),
            sensitiveTerms: Array.from(new Set([...existing.sensitiveTerms, ...session.learnedData!.suggestedRules.sensitiveTerms])),
            learnedCoordinates: [...(existing.learnedCoordinates || []), ...(session.learnedData!.suggestedRules.learnedCoordinates || [])],
            identifiers: Array.from(new Set([...(existing.identifiers || []), ...(session.learnedData!.suggestedRules.identifiers || [])]))
          };
          addAlert('success', `Updated existing rule for ${session.learnedData!.companyName}`);
        } else {
          updatedRules.push(session.learnedData!.suggestedRules);
          addAlert('success', `Created new rule for ${session.learnedData!.companyName}`);
        }
        
        return {
          ...prev,
          companyRules: updatedRules
        };
      });
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
    const step = 5;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
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

            const neighbors = [[cx+step, cy], [cx-step, cy], [cx, cy+step], [cx, cy-step]];
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (diff[nIdx] && !visited.has(nIdx)) {
                  visited.add(nIdx);
                  stack.push([nx, ny]);
                }
              }
            }
          }
          
          if ((maxX - minX) > 10 && (maxY - minY) > 10) {
            boxes.push({
              x: (minX / width) * 100,
              y: (minY / height) * 100,
              width: ((maxX - minX) / width) * 100,
              height: ((maxY - minY) / height) * 100
            });
          }
        }
      }
    }
    return boxes;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
          <Brain className="w-10 h-10" />
          Training Workflow
        </h2>
        <p className="text-neutral-500 font-medium">Teach the AI by providing examples of redacted documents. Compare original vs redacted to learn patterns.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 sticky top-8">
            <h3 className="font-bold text-xl mb-6">1. Upload Samples</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Original PDF (Unredacted)</label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'original')}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "p-6 border-2 border-dashed rounded-2xl flex flex-col items-center gap-3 transition-all",
                    session.originalFile ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-neutral-200 dark:border-neutral-800 group-hover:border-neutral-400"
                  )}>
                    <FileText className={cn("w-8 h-8", session.originalFile ? "text-emerald-500" : "text-neutral-300")} />
                    <span className="text-sm font-bold truncate max-w-full px-2">{session.originalFile ? session.originalFile.name : "Select Original PDF"}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-500 mb-2">Redacted PDF (Reference)</label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'redacted')}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "p-6 border-2 border-dashed rounded-2xl flex flex-col items-center gap-3 transition-all",
                    session.redactedFile ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-neutral-200 dark:border-neutral-800 group-hover:border-neutral-400"
                  )}>
                    <ShieldCheck className={cn("w-8 h-8", session.redactedFile ? "text-red-500" : "text-neutral-300")} />
                    <span className="text-sm font-bold truncate max-w-full px-2">{session.redactedFile ? session.redactedFile.name : "Select Redacted PDF"}</span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-neutral-400 italic">Optional: AI can suggest redactions if you don't have a redacted file.</p>
              </div>
            </div>

            <button 
              onClick={runTraining}
              disabled={session.status === 'analyzing' || !session.originalFile}
              className="w-full mt-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {session.status === 'analyzing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Start AI Training
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 min-h-[600px] flex flex-col">
            <h3 className="font-bold text-xl mb-6">2. Training & Comparison</h3>
            
            {session.status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400 gap-4">
                <Brain className="w-16 h-16 opacity-20" />
                <p className="text-sm font-medium">Upload files and start training to see results here.</p>
              </div>
            )}

            {session.status === 'analyzing' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-neutral-100 dark:text-neutral-800" />
                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * progress) / 100} className="text-black dark:text-white transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">{progress}%</div>
                </div>
                <div className="text-center">
                  <p className="font-bold">Analyzing Documents...</p>
                  <p className="text-xs text-neutral-500">Comparing layouts and identifying patterns</p>
                </div>
              </div>
            )}

            {session.status === 'preview' && session.learnedData && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Identified Company</p>
                      <button 
                        onClick={() => {
                          const newName = prompt("Enter company name:", session.learnedData!.companyName);
                          if (newName) setSession(prev => ({
                            ...prev,
                            learnedData: { ...prev.learnedData!, companyName: newName }
                          }));
                        }}
                        className="text-[10px] font-bold underline"
                      >
                        Edit Name
                      </button>
                    </div>
                    <p className="text-xl font-black">{session.learnedData.companyName}</p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Learned Items</p>
                      <p className="text-xl font-black">{session.learnedData.suggestedRules.learnedCoordinates?.length || 0} Zones</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                        <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-[400px]">
                  {/* Left: Interactive List */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-neutral-500">Suggested Redactions</h4>
                      <button 
                        onClick={() => {
                          const text = prompt("Enter text to redact:");
                          const label = prompt("Enter label (e.g. Name, Address):");
                          if (text) {
                            const updatedTerms = [...(session.learnedData!.suggestedRules.sensitiveTerms || []), text];
                            const newCoord = {
                              pageIndex: 0,
                              x: 0, y: 0, width: 0, height: 0,
                              label: label || 'Manual Label'
                            };
                            setSession(prev => ({
                              ...prev,
                              learnedData: {
                                ...prev.learnedData!,
                                suggestedRules: { 
                                  ...prev.learnedData!.suggestedRules, 
                                  sensitiveTerms: updatedTerms,
                                  learnedCoordinates: [...(prev.learnedData!.suggestedRules.learnedCoordinates || []), newCoord]
                                }
                              }
                            }));
                            addAlert('success', `Added "${text}" with label "${label}" to training model.`);
                          }
                        }}
                        className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                        title="Add Manual Redaction"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[400px]">
                      {session.learnedData.suggestedRules.learnedCoordinates?.map((coord, idx) => (
                        <div key={idx} className="group p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <input 
                              type="text"
                              value={coord.label}
                              onChange={(e) => {
                                const updatedCoords = [...(session.learnedData!.suggestedRules.learnedCoordinates || [])];
                                updatedCoords[idx] = { ...updatedCoords[idx], label: e.target.value };
                                setSession(prev => ({
                                  ...prev,
                                  learnedData: {
                                    ...prev.learnedData!,
                                    suggestedRules: { ...prev.learnedData!.suggestedRules, learnedCoordinates: updatedCoords }
                                  }
                                }));
                              }}
                              className="text-xs font-bold bg-transparent outline-none w-full"
                              placeholder="Add label"
                            />
                            <button 
                              onClick={() => {
                                const updatedCoords = session.learnedData!.suggestedRules.learnedCoordinates?.filter((_, i) => i !== idx);
                                setSession(prev => ({
                                  ...prev,
                                  learnedData: {
                                    ...prev.learnedData!,
                                    suggestedRules: { ...prev.learnedData!.suggestedRules, learnedCoordinates: updatedCoords }
                                  }
                                }));
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                            <span>Page {coord.pageIndex + 1}</span>
                            <span>•</span>
                            <span>{coord.x.toFixed(0)}%, {coord.y.toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}

                      {session.learnedData.detectedRedactions.map((r, idx) => (
                        <div key={`ai-${idx}`} className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">AI Suggestion</span>
                            <button 
                              onClick={() => {
                                const updatedTerms = [...(session.learnedData!.suggestedRules.sensitiveTerms || []), r.text!];
                                const updatedAi = session.learnedData!.detectedRedactions.filter((_, i) => i !== idx);
                                setSession(prev => ({
                                  ...prev,
                                  learnedData: {
                                    ...prev.learnedData!,
                                    suggestedRules: { ...prev.learnedData!.suggestedRules, sensitiveTerms: updatedTerms },
                                    detectedRedactions: updatedAi
                                  }
                                }));
                              }}
                              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 underline"
                            >
                              Accept
                            </button>
                          </div>
                          <p className="text-xs font-medium">{r.text}</p>
                          <p className="text-[10px] text-neutral-500 mt-1 italic">{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Visual Side-by-Side Comparison */}
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden flex flex-col">
                    <div className="p-3 border-bottom border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Visual Comparison</span>
                      <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">
                          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"><SearchX className="w-3 h-3" /></button>
                          <span className="text-[8px] font-bold w-8 text-center">{Math.round(zoom * 100)}%</span>
                          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"><Search className="w-3 h-3" /></button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[8px] font-bold uppercase">Original</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[8px] font-bold uppercase">Redacted</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 relative overflow-auto p-4 flex flex-col items-center gap-8 custom-scrollbar">
                      {session.originalUrl && (
                        <div className="w-full space-y-4">
                          <div className="relative border border-neutral-200 dark:border-neutral-700 rounded shadow-sm overflow-hidden bg-white">
                            <Document file={session.originalUrl}>
                              <Page pageNumber={1} width={300 * zoom} renderTextLayer={false} renderAnnotationLayer={false} />
                            </Document>
                            <div className="absolute inset-0 pointer-events-none">
                              {session.learnedData.suggestedRules.learnedCoordinates?.filter(c => c.pageIndex === 0).map((c, i) => (
                                <div 
                                  key={i}
                                  className="absolute border-2 border-blue-500 bg-blue-500/20"
                                  style={{
                                    left: `${c.x}%`,
                                    top: `${c.y}%`,
                                    width: `${c.width}%`,
                                    height: `${c.height}%`
                                  }}
                                />
                              ))}
                            </div>
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded uppercase">Original</div>
                          </div>

                          {session.redactedFile && (
                            <div className="relative border border-neutral-200 dark:border-neutral-700 rounded shadow-sm overflow-hidden bg-white">
                              <Document file={URL.createObjectURL(session.redactedFile)}>
                                <Page pageNumber={1} width={300 * zoom} renderTextLayer={false} renderAnnotationLayer={false} />
                              </Document>
                              <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded uppercase">Redacted Reference</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 p-3 rounded-xl">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <p>The model will learn these patterns and apply them to future files from <b>{session.learnedData.companyName}</b>.</p>
                  </div>
                  <button 
                    onClick={saveLearnedRule}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Save className="w-5 h-5" />
                    Finalize & Save Model
                  </button>
                </div>
              </motion.div>
            )}

            {session.status === 'completed' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-black mb-2">Model Saved!</h4>
                  <p className="text-sm text-neutral-500 max-w-[240px]">The AI is now trained for this company. You can use it in the editor or batch mode.</p>
                </div>
                <button 
                  onClick={() => setSession({ id: Math.random().toString(36).substring(7), status: 'idle' })}
                  className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm"
                >
                  Train Another File
                </button>
              </div>
            )}

            {session.status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-red-500 gap-4">
                <AlertCircle className="w-16 h-16" />
                <p className="font-bold">Training Failed</p>
                <button onClick={() => setSession(prev => ({ ...prev, status: 'idle' }))} className="text-sm underline">Try Again</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
