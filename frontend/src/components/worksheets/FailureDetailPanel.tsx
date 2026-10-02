'use client';

import React from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle, FileText, ExternalLink, Hash } from 'lucide-react';
import { FailureExplanation } from '@/types/metrology';

interface FailureDetailPanelProps {
  explanation: FailureExplanation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FailureDetailPanel: React.FC<FailureDetailPanelProps> = ({
  explanation,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !explanation) return null;

  const unit = explanation.unit || 'kg';
  const clauseText = explanation.clause_reference || 'Applicable rule reference is not configured.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-editorial-border shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between bg-neutral-900 text-white px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-display font-bold text-sm tracking-wide uppercase">
                {explanation.title}
              </h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">
                CLAUSE-LEVEL FAILURE AUDIT • {explanation.engine_version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1 rounded-sm cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-mono text-xs text-ink-900">
          {/* Level 1 & 2 Summary Alert */}
          <div className="p-4 border border-rose-200 bg-rose-50/70 rounded-none space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-900 uppercase text-[11px] tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{explanation.summary}</span>
            </div>
            <p className="text-ink-700 font-sans text-xs leading-relaxed">
              {explanation.explanation}
            </p>
          </div>

          {/* Metric Comparison Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-editorial-border p-3 bg-alabaster-50">
              <span className="text-[9px] uppercase tracking-wider text-ink-400 block">APPLIED LOAD</span>
              <span className="text-sm font-bold text-ink-950 mt-1 block">
                {explanation.expected_value !== null && explanation.expected_value !== undefined
                  ? `${explanation.expected_value} ${unit}`
                  : '--'}
              </span>
            </div>

            <div className="border border-editorial-border p-3 bg-alabaster-50">
              <span className="text-[9px] uppercase tracking-wider text-ink-400 block">INDICATION (I)</span>
              <span className="text-sm font-bold text-ink-950 mt-1 block">
                {explanation.measured_value !== null && explanation.measured_value !== undefined
                  ? `${explanation.measured_value} ${unit}`
                  : '--'}
              </span>
            </div>

            <div className="border border-editorial-border p-3 bg-alabaster-50">
              <span className="text-[9px] uppercase tracking-wider text-ink-400 block">ERROR (Ec)</span>
              <span className="text-sm font-bold text-rose-700 mt-1 block">
                {explanation.error_value !== null && explanation.error_value !== undefined
                  ? `${explanation.error_value > 0 ? '+' : ''}${explanation.error_value} ${unit}`
                  : '--'}
              </span>
            </div>

            <div className="border border-editorial-border p-3 bg-alabaster-50">
              <span className="text-[9px] uppercase tracking-wider text-ink-400 block">ALLOWED (±MPE)</span>
              <span className="text-sm font-bold text-emerald-800 mt-1 block">
                {explanation.allowed_limit !== null && explanation.allowed_limit !== undefined
                  ? `±${explanation.allowed_limit} ${unit}`
                  : '--'}
              </span>
            </div>
          </div>

          {/* Mathematical Excess Analysis */}
          <div className="border border-editorial-border divide-y divide-editorial-border bg-white">
            <div className="p-3 bg-alabaster-100 flex items-center justify-between text-[11px] font-bold text-ink-950">
              <span>CALCULATED DEVIATION & STATUTORY TOLERANCE</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300">
                {explanation.failure_code}
              </span>
            </div>

            <div className="p-3 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-ink-400 uppercase block">Excess Beyond Allowed Limit</span>
                <span className="text-xs font-bold text-rose-700 mt-0.5 block">
                  {explanation.excess_value !== null && explanation.excess_value !== undefined
                    ? `${explanation.excess_value} ${unit}`
                    : '--'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-400 uppercase block">Tolerance Margin Exceeded</span>
                <span className="text-xs font-bold text-rose-700 mt-0.5 block">
                  {explanation.margin_percentage !== null && explanation.margin_percentage !== undefined
                    ? `+${explanation.margin_percentage}% over allowed MPE`
                    : '--'}
                </span>
              </div>
            </div>

            <div className="p-3 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-ink-400 uppercase block">Test Direction</span>
                <span className="text-xs text-ink-900 mt-0.5 block uppercase">
                  {explanation.direction || 'STATIC'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-400 uppercase block">Receptor Position</span>
                <span className="text-xs text-ink-900 mt-0.5 block uppercase">
                  {explanation.position || 'CENTER'}
                </span>
              </div>
            </div>
          </div>

          {/* Regulatory Clause Mapping */}
          <div className="border border-editorial-border p-4 bg-alabaster-50 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-ink-400 font-bold tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>APPLICABLE OIML R 76-1:2006 CLAUSE</span>
            </div>
            <div className={`text-xs font-bold ${explanation.clause_reference ? 'text-ink-950' : 'text-amber-800 italic'}`}>
              {clauseText}
            </div>
            {explanation.rule_id && (
              <div className="text-[10px] text-ink-500 font-mono">
                Rule ID: {explanation.rule_id} • Version: {explanation.rule_version || '2006'}
              </div>
            )}
          </div>

          {/* Audit & Reproducibility Trace */}
          <div className="text-[10px] text-ink-400 font-mono border-t border-editorial-border pt-4 flex flex-wrap justify-between gap-2">
            <div>
              <span>EXPLANATION ID: </span>
              <span className="text-ink-700">{explanation.id}</span>
            </div>
            <div>
              <span>ENGINE: </span>
              <span className="text-ink-700">{explanation.engine_version}</span>
            </div>
            <div>
              <span>TEMPLATE: </span>
              <span className="text-ink-700">{explanation.explanation_version}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end bg-alabaster-50 border-t border-editorial-border px-6 py-3">
          <button
            onClick={onClose}
            className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

export default FailureDetailPanel;
