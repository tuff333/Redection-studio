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
  const [files, setFiles] = useState<File[]>([]); // For multi-file tools like Merge
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    author: '',
    subject: '',
    keywords: ''
  });
  const [security, setSecurity] = useState({
    password: '',
    permissions: 'read-only'
  });
  const [watermark, setWatermark] = useState({
    text: 'CONFIDENTIAL',
    opacity: 0.3
  });
  const [pageRange, setPageRange] = useState('1-5');
  const [rotation, setRotation] = useState(90);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (tool.name === 'Merge PDF' || tool.name === 'JPG to PDF' || tool.name === 'PNG to PDF') {
        setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      } else if (e.target.files[0]) {
        setFile(e.target.files[0]);
      }
    }
  };

  const parsePageRange = (rangeStr: string): number[] => {
    const pages = new Set<number>();
    const parts = rangeStr.split(',').map(p => p.trim());
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            pages.add(i - 1); // 0-indexed
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page)) {
          pages.add(page - 1); // 0-indexed
        }
      }
    });
    
    return Array.from(pages).sort((a, b) => a - b);
  };

  const processTool = async () => {
    if (!file && files.length === 0) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      let endpoint = '';

      if (tool.name === 'Merge PDF' || tool.name === 'JPG to PDF' || tool.name === 'PNG to PDF') {
        if (files.length === 0) return;
        endpoint = tool.name === 'Merge PDF' ? '/api/pdf/merge' : '/api/images/to-pdf';
        files.forEach(f => formData.append('files', f));
      } else {
        if (!file) return;
        formData.append('file', file);

        switch (tool.name) {
          case 'Change Metadata':
            endpoint = '/api/document/metadata/update';
            formData.append('title', metadata.title);
            formData.append('author', metadata.author);
            formData.append('subject', metadata.subject);
            formData.append('keywords', metadata.keywords);
            break;
          case 'Add Password':
            endpoint = '/api/security/password/add';
            formData.append('password', security.password || 'demo123');
            break;
          case 'Change Metadata':
            endpoint = '/api/pdf/update-metadata';
            formData.append('metadata', JSON.stringify(metadata));
            break;
          case 'Sanitise':
            endpoint = '/api/pdf/sanitise';
            break;
          case 'Remove Annotations':
            endpoint = '/api/pdf/remove-annotations';
            break;
          case 'Reverse PDF':
            endpoint = '/api/pdf/reverse';
            break;
          case 'Add Watermark':
            endpoint = '/api/pdf/add-watermark';
            formData.append('text', watermark.text);
            formData.append('opacity', watermark.opacity.toString());
            break;
          case 'Add Page Numbers':
            endpoint = '/api/pdf/add-page-numbers';
            break;
          case 'Flatten':
            endpoint = '/api/pdf/flatten';
            break;
          case 'Repair PDF':
            endpoint = '/api/pdf/repair';
            break;
          case 'Rotate':
            endpoint = '/api/pdf/rotate';
            formData.append('rotation', rotation.toString());
            break;
          case 'Split':
            endpoint = '/api/pdf/split';
            break;
          case 'Extract Pages':
            endpoint = '/api/extraction/pages';
            formData.append('page_range', pageRange);
            break;
          case 'Remove Pages':
            endpoint = '/api/pdf/remove-pages';
            formData.append('pages', JSON.stringify(parsePageRange(pageRange).map(i => i + 1)));
            break;
          case 'Reorganize Pages':
            endpoint = '/api/pdf/reorder-pages';
            formData.append('order', JSON.stringify(parsePageRange(pageRange).map(i => i + 1)));
            break;
          case 'OCR PDF':
            endpoint = '/api/ocr';
            break;
          case 'Compress PDF':
            endpoint = '/api/pdf/optimize';
            break;
          case 'Merge PDF':
            endpoint = '/api/pdf/merge';
            files.forEach(f => formData.append('files', f));
            break;
          case 'JPG to PDF':
          case 'PNG to PDF':
            endpoint = '/api/images/to-pdf';
            files.forEach(f => formData.append('files', f));
            break;
          default:
            // Generic fallback
            await new Promise(resolve => setTimeout(resolve, 1500));
            addAlert('info', `Simulated ${tool.name} processing.`);
            setIsProcessing(false);
            return;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Processing failed' }));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        setResult(base64data);
        addAlert('success', `${tool.name} completed successfully!`);
      };
      reader.readAsDataURL(blob);

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

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {!file && files.length === 0 ? (
            <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl cursor-pointer hover:border-black dark:hover:border-white transition-all bg-neutral-50 dark:bg-neutral-800/50">
              <FileUp className="w-12 h-12 text-neutral-400 mb-4" />
              <p className="text-lg font-bold">
                {tool.name === 'Merge PDF' ? 'Select PDFs to merge' : 
                 (tool.name === 'JPG to PDF' || tool.name === 'PNG to PDF') ? 'Select images to convert' : 
                 'Select a PDF to process'}
              </p>
              <p className="text-sm text-neutral-500">or drag and drop here</p>
              <input 
                type="file" 
                className="hidden" 
                accept={tool.name.includes('JPG') || tool.name.includes('PNG') || tool.name.includes('image') ? 'image/*' : '.pdf'} 
                multiple={tool.name === 'Merge PDF' || tool.name === 'JPG to PDF' || tool.name === 'PNG to PDF'} 
                onChange={handleFileUpload} 
              />
            </label>
          ) : (
            <div className="space-y-6">
              {(tool.name === 'Merge PDF' || tool.name === 'JPG to PDF' || tool.name === 'PNG to PDF') ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Selected Files ({files.length})</h3>
                    <button 
                      onClick={() => document.getElementById('multi-upload')?.click()}
                      className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest hover:underline"
                    >
                      Add More
                    </button>
                    <input 
                      id="multi-upload" 
                      type="file" 
                      className="hidden" 
                      accept={tool.name.includes('JPG') || tool.name.includes('PNG') || tool.name.includes('image') ? 'image/*' : '.pdf'} 
                      multiple 
                      onChange={handleFileUpload} 
                    />
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                            <tool.icon className="w-4 h-4" />
                          </div>
                          <p className="text-xs font-bold truncate">{f.name}</p>
                        </div>
                        <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center">
                      <tool.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[200px]">{file?.name}</p>
                      <p className="text-[10px] text-neutral-500 font-medium tracking-widest uppercase">{(file?.size || 0 / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setFile(null)} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
                </div>
              )}

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
                </div>
              )}

              {(tool.name === 'Add Password' || tool.name === 'Change Permissions') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Password</label>
                    <input 
                      type="password" 
                      value={security.password}
                      onChange={e => setSecurity({...security, password: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      placeholder="Enter password"
                    />
                  </div>
                </div>
              )}

              {tool.name === 'Add Watermark' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Watermark Text</label>
                    <input 
                      type="text" 
                      value={watermark.text}
                      onChange={e => setWatermark({...watermark, text: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Opacity (0-1)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="1"
                      value={watermark.opacity}
                      onChange={e => setWatermark({...watermark, opacity: parseFloat(e.target.value)})}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    />
                  </div>
                </div>
              )}

              {tool.name === 'Rotate' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Rotation Angle</label>
                  <select 
                    value={rotation}
                    onChange={e => setRotation(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  >
                    <option value={90}>90° Clockwise</option>
                    <option value={180}>180°</option>
                    <option value={270}>90° Counter-clockwise</option>
                  </select>
                </div>
              )}

              {(tool.name === 'Split' || tool.name === 'Extract Pages' || tool.name === 'Remove Pages') && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Page Ranges (e.g. 1-2, 5)</label>
                  <input 
                    type="text" 
                    value={pageRange}
                    onChange={e => setPageRange(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    placeholder="1-3, 5"
                  />
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
