import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileUp, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToolDialogProps {
  tool: any;
  onClose: () => void;
  addAlert: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function ToolDialog({ tool, onClose, addAlert }: ToolDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    author: '',
    subject: '',
    keywords: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processTool = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        let endpoint = '';
        let body: any = { pdfBase64: base64 };

        switch (tool.name) {
          case 'Change Metadata':
            endpoint = '/api/pdf/metadata';
            body.metadata = metadata;
            break;
          case 'Add Password':
          case 'Change Permissions':
            endpoint = '/api/pdf/security';
            body.password = 'demo123'; // Placeholder
            break;
          case 'Split':
            endpoint = '/api/pdf/split';
            body.ranges = [[0, 0]]; // Placeholder: first page only
            break;
          case 'Extract Pages':
            endpoint = '/api/pdf/extract-pages';
            body.indices = [0]; // Placeholder: first page only
            break;
          case 'Remove Pages':
            endpoint = '/api/pdf/remove-pages';
            body.indicesToRemove = [0]; // Placeholder: remove first page
            break;
          default:
            // Generic fallback or simulated success
            await new Promise(resolve => setTimeout(resolve, 1500));
            addAlert('info', `Simulated ${tool.name} processing.`);
            setIsProcessing(false);
            return;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        if (data.pdf) {
          setResult(data.pdf);
          addAlert('success', `${tool.name} completed successfully!`);
        } else if (data.pdfs) {
          setResult(data.pdfs[0]); // Just show the first one for now
          addAlert('success', `${tool.name} completed! (Showing first part)`);
        } else {
          throw new Error(data.error || 'Processing failed');
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      addAlert('error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${result}`;
    link.download = `processed_${file?.name || 'document.pdf'}`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center">
              <tool.icon className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{tool.name}</h2>
              <p className="text-sm text-neutral-500 font-medium">{tool.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {!file ? (
            <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl cursor-pointer hover:border-black dark:hover:border-white transition-all bg-neutral-50 dark:bg-neutral-800/50">
              <FileUp className="w-12 h-12 text-neutral-400 mb-4" />
              <p className="text-lg font-bold">Select a PDF to process</p>
              <p className="text-sm text-neutral-500">or drag and drop here</p>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
            </label>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center">
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-[200px]">{file.name}</p>
                    <p className="text-[10px] text-neutral-500 font-medium tracking-widest uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
              </div>

              {tool.name === 'Change Metadata' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Title</label>
                    <input 
                      type="text" 
                      value={metadata.title}
                      onChange={e => setMetadata({...metadata, title: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="Document Title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Author</label>
                    <input 
                      type="text" 
                      value={metadata.author}
                      onChange={e => setMetadata({...metadata, author: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="Author Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Subject</label>
                    <input 
                      type="text" 
                      value={metadata.subject}
                      onChange={e => setMetadata({...metadata, subject: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="Subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Keywords</label>
                    <input 
                      type="text" 
                      value={metadata.keywords}
                      onChange={e => setMetadata({...metadata, keywords: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="keyword1, keyword2"
                    />
                  </div>
                </div>
              )}

              {result ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">Processing Complete</p>
                    <p className="text-sm text-neutral-500">Your file is ready for download.</p>
                  </div>
                  <button 
                    onClick={downloadResult}
                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF
                  </button>
                </div>
              ) : (
                <button 
                  onClick={processTool}
                  disabled={isProcessing}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <tool.icon className="w-5 h-5" />
                      Run {tool.name}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
