import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { RedactionBox, RedactionStyle } from '../types';

export function RedactionBoxComponent({ 
  redaction, 
  onUpdate, 
  onDelete, 
  onComment,
  onStartInteraction,
  isSelected,
  style = 'solid',
  isReviewMode = false
}: { 
  redaction: RedactionBox; 
  onUpdate: (updates: Partial<RedactionBox>) => void; 
  onDelete: () => void;
  onComment: () => void;
  onStartInteraction?: (type: 'drag' | 'resize', mouseX: number, mouseY: number, handle?: string) => void;
  isSelected: boolean;
  style?: RedactionStyle;
  isReviewMode?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn(
        "absolute transition-all duration-500 group cursor-pointer pointer-events-auto",
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
      onMouseDown={(e) => {
        if (!isSelected) {
          onUpdate({ isSelected: true });
        }
        if (onStartInteraction) {
          e.stopPropagation();
          onStartInteraction('drag', e.clientX, e.clientY);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Resize Handles */}
      {isSelected && !isReviewMode && (
        <>
          <div 
            className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-black dark:border-white cursor-nw-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'nw'); }}
          />
          <div 
            className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-black dark:border-white cursor-ne-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'ne'); }}
          />
          <div 
            className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-black dark:border-white cursor-sw-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'sw'); }}
          />
          <div 
            className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-black dark:border-white cursor-se-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'se'); }}
          />
          <div 
            className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-white border border-black dark:border-white cursor-w-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'w'); }}
          />
          <div 
            className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-white border border-black dark:border-white cursor-e-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'e'); }}
          />
          <div 
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-black dark:border-white cursor-n-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 'n'); }}
          />
          <div 
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border border-black dark:border-white cursor-s-resize z-50"
            onMouseDown={(e) => { e.stopPropagation(); onStartInteraction?.('resize', e.clientX, e.clientY, 's'); }}
          />
        </>
      )}
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
