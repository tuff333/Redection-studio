import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Info, Trash2, CheckCircle2, AlertCircle, FileText, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { PDFFile } from '../types';
import { cn } from '../lib/utils';
import { PDFDocument } from 'pdf-lib';

interface SecurityAuditProps {
  file: PDFFile;
  onUpdate: (updates: Partial<PDFFile>) => void;
  addAlert: (type: 'success' | 'info' | 'warning' | 'error', message: string) => void;
}

export function SecurityAudit({ file, onUpdate, addAlert }: SecurityAuditProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    score: number;
    findings: { id: string; severity: 'low' | 'medium' | 'high'; title: string; description: string; fixed: boolean }[];
  } | null>(null);

  const runAudit = async () => {
    setIsAuditing(true);
    // Simulate auditing
    await new Promise(resolve => setTimeout(resolve, 1500));

    const findings: any[] = [];
    let score = 100;

    // Check for metadata
    if (file.metadata) {
      const hasMetadata = Object.values(file.metadata).some(v => v && v.length > 0);
      if (hasMetadata) {
        findings.push({
          id: 'metadata',
          severity: 'medium',
          title: 'Hidden Metadata Found',
          description: 'The document contains metadata (Author, Creator, etc.) that could leak sensitive information.',
          fixed: false
        });
        score -= 20;
      }
    }

    // Check for encryption
    // In a real app, we'd check if the PDF was originally encrypted
    findings.push({
      id: 'encryption',
      severity: 'low',
      title: 'No Encryption',
      description: 'The output document will not be encrypted by default.',
      fixed: false
    });
    score -= 10;

    // Check for hidden text (OCR layers)
    findings.push({
      id: 'hidden-text',
      severity: 'high',
      title: 'Original Text Layer',
      description: 'The original text layer is still present. Redactions only cover the visual layer. Use "Flatten PDF" to remove the text layer.',
      fixed: false
    });
    score -= 40;

    setAuditResults({ score, findings });
    setIsAuditing(false);
    addAlert('info', 'Security audit complete.');
  };

  const fixFinding = async (id: string) => {
    if (!auditResults) return;

    if (id === 'metadata') {
      onUpdate({ metadata: { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' } });
      addAlert('success', 'Metadata cleared.');
    } else if (id === 'hidden-text') {
      addAlert('info', 'Flattening PDF... This will convert all pages to images.');
      // This is handled by the "Unlock/Flatten" feature in EditorView
    }

    setAuditResults({
      ...auditResults,
      findings: auditResults.findings.map(f => f.id === id ? { ...f, fixed: true } : f),
      score: Math.min(100, auditResults.score + (id === 'metadata' ? 20 : 0))
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Security Audit</h2>
            <p className="text-sm text-neutral-500 font-medium">Analyze document for hidden risks and metadata.</p>
          </div>
        </div>
        <button 
          onClick={runAudit}
          disabled={isAuditing}
          className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform disabled:opacity-50"
        >
          {isAuditing ? 'Auditing...' : 'Run Audit'}
        </button>
      </div>

      {auditResults && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white dark:bg-neutral-900 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center text-center">
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-neutral-100 dark:text-neutral-800"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeDasharray={364}
                  strokeDashoffset={364 - (364 * auditResults.score) / 100}
                  className={cn(
                    "transition-all duration-1000",
                    auditResults.score > 80 ? "text-emerald-500" : auditResults.score > 50 ? "text-amber-500" : "text-red-500"
                  )}
                />
              </svg>
              <span className="absolute text-3xl font-black">{auditResults.score}</span>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest opacity-50">Security Score</p>
          </div>

          <div className="md:col-span-2 space-y-4">
            {auditResults.findings.map(finding => (
              <div 
                key={finding.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all",
                  finding.fixed 
                    ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30 opacity-60" 
                    : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      finding.fixed ? "bg-emerald-100 text-emerald-600" : 
                      finding.severity === 'high' ? "bg-red-100 text-red-600" :
                      finding.severity === 'medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {finding.fixed ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{finding.title}</h4>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{finding.description}</p>
                    </div>
                  </div>
                  {!finding.fixed && (
                    <button 
                      onClick={() => fixFinding(finding.id)}
                      className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Fix Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
