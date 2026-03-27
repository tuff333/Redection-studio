import React, { useState, useEffect, useRef } from 'react';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
// import * as pdfjs from 'pdfjs-dist'; // Use pdfjs from react-pdf instead

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { cn } from '../lib/utils';
import { RedactionBox, RedactionStyle } from '../types';
import { RedactionBoxComponent } from './RedactionBox';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  SearchX, 
  RefreshCw, 
  Sparkles, 
  X,
  ScrollText,
  Touchpad
} from 'lucide-react';

// Ensure pdfjs worker is loaded
// pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  fileUrl: string;
  redactions: RedactionBox[];
  onRedactionsChange: (redactions: RedactionBox[]) => void;
  tool: 'selection' | 'box' | 'text' | 'highlight';
  scale: number;
  onScaleChange: (scale: number) => void;
  pageNumber: number;
  onPageChange: (page: number) => void;
  isReviewMode?: boolean;
  redactionStyle?: RedactionStyle;
  aiSuggestions?: RedactionBox[];
  onAcceptSuggestion?: (suggestion: RedactionBox) => void;
  onDismissSuggestion?: (id: string) => void;
  onComment?: (id: string, comment: string) => void;
  isContinuous?: boolean;
  onContinuousChange?: (isContinuous: boolean) => void;
  showToolbar?: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onRenderSuccess?: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  fileUrl,
  redactions,
  onRedactionsChange,
  tool,
  scale,
  onScaleChange,
  pageNumber,
  onPageChange,
  isReviewMode = false,
  redactionStyle,
  aiSuggestions = [],
  onAcceptSuggestion,
  onDismissSuggestion,
  onComment,
  isContinuous = false,
  onContinuousChange,
  showToolbar = true,
  canvasRef,
  onRenderSuccess
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [activeInteraction, setActiveInteraction] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Intersection Observer for continuous scroll
  useEffect(() => {
    if (!isContinuous) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = pageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              onPageChange(index + 1);
            }
          }
        });
      },
      { threshold: 0.5, root: containerRef.current }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [isContinuous, numPages]);

  const handleMouseDown = (e: React.MouseEvent, pageIdx: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (tool === 'selection') {
      setDrawStart({ x, y });
      setIsDrawing(true);
      return;
    }

    setDrawStart({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent, pageIdx: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeInteraction) {
      // Handle drag/resize logic here (simplified for now)
      return;
    }

    if (!isDrawing) return;

    if (drawStart) {
      setCurrentBox({
        x: Math.min(x, drawStart.x),
        y: Math.min(y, drawStart.y),
        width: Math.abs(x - drawStart.x),
        height: Math.abs(y - drawStart.y),
      });
    }
  };

  const handleMouseUp = (pageIdx: number) => {
    if (isDrawing && currentBox && currentBox.width > 0.5 && currentBox.height > 0.5) {
      const newRedaction: RedactionBox = {
        id: Math.random().toString(36).substring(7),
        pageIndex: pageIdx,
        ...currentBox,
        type: tool === 'text' ? 'text' : 'box',
        isSelected: true,
        label: tool === 'text' ? 'Text Redaction' : 'Box Redaction'
      };
      onRedactionsChange([...redactions, newRedaction]);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentBox(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
      {/* Viewer Toolbar */}
      {showToolbar && (
        <div className="h-12 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded-lg">
              <button onClick={() => onScaleChange(Math.max(0.5, scale - 0.1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"><SearchX className="w-4 h-4" /></button>
              <span className="text-xs font-black w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => onScaleChange(Math.min(3, scale + 0.1))} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"><Search className="w-4 h-4" /></button>
            </div>
            
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded-lg">
              <button 
                onClick={() => {
                  const newPage = Math.max(1, pageNumber - 1);
                  onPageChange(newPage);
                  if (isContinuous) {
                    pageRefs.current[newPage - 1]?.scrollIntoView({ behavior: 'smooth' });
                  }
                }} 
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black w-16 text-center">{pageNumber} / {numPages || '?'}</span>
              <button 
                onClick={() => {
                  const newPage = Math.min(numPages, pageNumber + 1);
                  onPageChange(newPage);
                  if (isContinuous) {
                    pageRefs.current[newPage - 1]?.scrollIntoView({ behavior: 'smooth' });
                  }
                }} 
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => onContinuousChange?.(!isContinuous)}
              className={cn(
                "p-1.5 rounded-lg transition-all flex items-center gap-2",
                isContinuous ? "bg-black text-white dark:bg-white dark:text-black" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
              )}
            >
              <ScrollText className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Continuous</span>
            </button>
          </div>
        </div>
      )}

      {/* Viewer Content */}
      <div 
        ref={containerRef}
        className={cn(
          "flex-1 overflow-auto p-8 flex flex-col items-center custom-scrollbar",
          isContinuous ? "gap-8" : "justify-start"
        )}
      >
        <PdfDocument
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => console.error('PDF Load Error:', error)}
          loading={<RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />}
        >
          {isContinuous ? (
            Array.from({ length: numPages }).map((_, i) => (
              <div 
                key={i}
                ref={el => { pageRefs.current[i] = el; }}
                className="relative shadow-2xl bg-white mb-8"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                onMouseDown={(e) => handleMouseDown(e, i)}
                onMouseMove={(e) => handleMouseMove(e, i)}
                onMouseUp={() => handleMouseUp(i)}
              >
                <PdfPage 
                  pageNumber={i + 1} 
                  width={600} 
                  renderTextLayer={true} 
                  renderAnnotationLayer={true} 
                  canvasRef={pageNumber === i + 1 ? canvasRef : undefined}
                  onRenderSuccess={pageNumber === i + 1 ? onRenderSuccess : undefined}
                />
                {/* Overlays */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  {redactions.filter(r => r.pageIndex === i).map((r) => (
                    <RedactionBoxComponent
                      key={r.id}
                      redaction={r}
                      isSelected={r.isSelected}
                      style={redactionStyle}
                      isReviewMode={isReviewMode}
                      onUpdate={(updates) => {
                        onRedactionsChange(redactions.map(item => item.id === r.id ? { ...item, ...updates } : item));
                      }}
                      onDelete={() => {
                        onRedactionsChange(redactions.filter(item => item.id !== r.id));
                      }}
                      onComment={() => onComment?.(r.id, r.comment || '')}
                    />
                  ))}
                  {aiSuggestions.filter(s => s.pageIndex === i).map((s) => (
                    <div 
                      key={s.id}
                      className="absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10 group pointer-events-auto"
                      style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: `${s.width}%`,
                        height: `${s.height}%`
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        AI Suggestion: {s.label}
                      </div>
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onAcceptSuggestion?.(s)}
                          className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => onDismissSuggestion?.(s.id)}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div 
              ref={el => { pageRefs.current[pageNumber - 1] = el; }}
              className="relative shadow-2xl bg-white"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
              onMouseDown={(e) => handleMouseDown(e, pageNumber - 1)}
              onMouseMove={(e) => handleMouseMove(e, pageNumber - 1)}
              onMouseUp={() => handleMouseUp(pageNumber - 1)}
            >
              <PdfPage 
                pageNumber={pageNumber} 
                width={600} 
                renderTextLayer={true} 
                renderAnnotationLayer={true} 
                canvasRef={canvasRef}
                onRenderSuccess={onRenderSuccess}
              />
              {/* Overlays */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {redactions.filter(r => r.pageIndex === pageNumber - 1).map((r) => (
                  <RedactionBoxComponent
                    key={r.id}
                    redaction={r}
                    isSelected={r.isSelected}
                    style={redactionStyle}
                    isReviewMode={isReviewMode}
                    onUpdate={(updates) => {
                      onRedactionsChange(redactions.map(item => item.id === r.id ? { ...item, ...updates } : item));
                    }}
                    onDelete={() => {
                      onRedactionsChange(redactions.filter(item => item.id !== r.id));
                    }}
                    onComment={() => onComment?.(r.id, r.comment || '')}
                  />
                ))}
                {aiSuggestions.filter(s => s.pageIndex === pageNumber - 1).map((s) => (
                  <div 
                    key={s.id}
                    className="absolute border-2 border-dashed border-emerald-500 bg-emerald-500/10 group pointer-events-auto"
                    style={{
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: `${s.width}%`,
                      height: `${s.height}%`
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[8px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      AI Suggestion: {s.label}
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onAcceptSuggestion?.(s)}
                        className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => onDismissSuggestion?.(s.id)}
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {currentBox && (
                  <div 
                    className="absolute border-2 border-orange-500 bg-orange-500/20"
                    style={{
                      left: `${currentBox.x}%`,
                      top: `${currentBox.y}%`,
                      width: `${currentBox.width}%`,
                      height: `${currentBox.height}%`
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </PdfDocument>
      </div>
    </div>
  );
};
