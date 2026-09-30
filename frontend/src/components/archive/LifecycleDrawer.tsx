'use client';

import React from 'react';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Download,
  ShieldCheck,
  TrendingUp,
  User,
  Calendar
} from 'lucide-react';
import { TestReportSummary } from '@/types/metrology';
import { formatDate } from '@/lib/utils';
import { getReportPdfUrl } from '@/lib/api';

interface LifecycleAttempt {
  attemptNumber: number;
  reportNumber: string;
  reportId: string;
  date: string;
  technician: string;
  approver?: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING_APPROVAL' | 'DRAFT';
  verdict: boolean;
  maxErrorObserved: number;
  criticalMarginRatio: number;
  rejectionReason?: string;
}

interface LifecycleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: string | null;
  modelName: string;
  manufacturerName: string;
  accuracyClass: string;
}

export default function LifecycleDrawer({
  isOpen,
  onClose,
  serialNumber,
  modelName,
  manufacturerName,
  accuracyClass,
}: LifecycleDrawerProps) {
  if (!isOpen || !serialNumber) return null;

  // Mock multi-attempt history progression for the selected serial number
  const attempts: LifecycleAttempt[] = [
    {
      attemptNumber: 1,
      reportNumber: 'OIML-2026-TR-0038',
      reportId: 'rep-098',
      date: '2026-09-20T10:30:00Z',
      technician: 'A. Verma (Testing Metrologist)',
      status: 'REJECTED',
      verdict: false,
      maxErrorObserved: 0.0038,
      criticalMarginRatio: 126.7,
      rejectionReason: 'Exceeded statutory ±1.0e mpe limit at 10.0kg step (+0.0038 kg vs ±0.0030 kg allowed).',
    },
    {
      attemptNumber: 2,
      reportNumber: 'OIML-2026-TR-0041',
      reportId: 'rep-100',
      date: '2026-09-28T14:15:00Z',
      technician: 'A. Verma (Testing Metrologist)',
      approver: 'Dr. R. K. Mukherjee (Director of Metrology)',
      status: 'APPROVED',
      verdict: true,
      maxErrorObserved: 0.0018,
      criticalMarginRatio: 60.0,
    },
  ];

  // Calculate comparative error delta between Attempt #1 and Attempt #2
  const initialError = attempts[0].maxErrorObserved;
  const finalError = attempts[1].maxErrorObserved;
  const deltaReductionPct = (((initialError - finalError) / initialError) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-editorial-border">
        {/* Header */}
        <div className="p-6 border-b border-editorial-border bg-alabaster-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-ink-950 text-white shadow-editorial">
                <History className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-display font-black text-sm uppercase tracking-wider text-ink-950">
                  LIFECYCLE & AUDIT HISTORY
                </h2>
                <p className="text-[11px] text-ink-500 font-mono mt-0.5">
                  SERIAL NUMBER: <span className="font-bold text-ink-950">{serialNumber}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-ink-400 hover:text-ink-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Instrument Specs Tag Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs font-mono">
            <div className="p-2.5 bg-white border border-editorial-border">
              <span className="text-[9px] text-ink-400 uppercase font-bold block">MODEL</span>
              <span className="font-bold text-ink-950 truncate block mt-0.5">{modelName}</span>
            </div>
            <div className="p-2.5 bg-white border border-editorial-border">
              <span className="text-[9px] text-ink-400 uppercase font-bold block">MANUFACTURER</span>
              <span className="font-bold text-ink-950 truncate block mt-0.5">{manufacturerName}</span>
            </div>
            <div className="p-2.5 bg-white border border-editorial-border">
              <span className="text-[9px] text-ink-400 uppercase font-bold block">ACCURACY CLASS</span>
              <span className="font-bold text-ink-950 block mt-0.5">{accuracyClass}</span>
            </div>
          </div>
        </div>

        {/* Content Body: Progression Timeline */}
        <div className="p-6 space-y-6 flex-1">
          {/* Progression Delta Banner */}
          <div className="p-4 bg-white border border-editorial-border shadow-editorial flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ink-950 text-white">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-ink-950 uppercase tracking-wider block">
                  CALIBRATION IMPROVEMENT DELTA
                </span>
                <p className="text-[11px] text-ink-500 uppercase mt-0.5">
                  MAX METROLOGICAL ERROR REDUCED BY{' '}
                  <span className="font-bold text-ink-950">{deltaReductionPct}%</span> AFTER ADJUSTMENT.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-ink-950 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
              RUN #1 ➔ #2
            </span>
          </div>

          {/* Timeline Sequence */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold text-ink-500 uppercase tracking-widest">
              AUDIT PROGRESSION ({attempts.length} EVALUATIONS)
            </h3>

            <div className="relative border-l border-editorial-border ml-4 space-y-6 pl-6">
              {attempts.map((att) => {
                const isPass = att.status === 'APPROVED';
                return (
                  <div key={att.attemptNumber} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-[31px] top-1.5 w-3 h-3 border-2 border-white shadow-xs ${
                        isPass ? 'bg-ink-950 ring-2 ring-ink-950/20' : 'bg-rose-600 ring-2 ring-rose-600/20'
                      }`}
                    />

                    {/* Attempt Card */}
                    <div className="bg-white border border-editorial-border p-4 space-y-3 shadow-editorial transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-ink-950 uppercase">
                            Attempt #{att.attemptNumber}
                          </span>
                          <span className="text-[10px] font-mono text-ink-400">
                            ({att.reportNumber})
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                            isPass
                              ? 'bg-ink-950 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {att.status}
                        </span>
                      </div>

                      {/* Metrological Performance Stats */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-alabaster-50 p-3 border border-editorial-border font-mono">
                        <div>
                          <span className="text-[9px] text-ink-400 block uppercase">
                            PEAK ERROR OBSERVED
                          </span>
                          <span className="font-bold text-ink-950 mt-0.5 block">
                            {att.maxErrorObserved} kg
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-ink-400 block uppercase">
                            CRITICAL MARGIN RATIO
                          </span>
                          <span
                            className={`font-bold mt-0.5 block ${
                              att.criticalMarginRatio > 100 ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {att.criticalMarginRatio}%
                          </span>
                        </div>
                      </div>

                      {/* Rejection Reason if Failed */}
                      {att.rejectionReason && (
                        <div className="p-3 bg-white border border-rose-300 text-[11px] font-mono text-rose-800 space-y-1">
                          <span className="font-bold block uppercase tracking-wider text-[10px]">
                            REJECTION REMARKS:
                          </span>
                          <p>{att.rejectionReason}</p>
                        </div>
                      )}

                      {/* Footer Details: Technician & Approver */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-ink-400 pt-2 border-t border-editorial-border uppercase">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          <span>{att.technician}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(att.date)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {isPass && (
                        <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                          <a
                            href={getReportPdfUrl(att.reportId)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-ink-950 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-1.5"
                          >
                            <Download className="w-3 h-3" />
                            PDF CERTIFICATE
                          </a>
                          <a
                            href={`/verify/${att.reportId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-white text-ink-950 border border-editorial-border text-[10px] font-bold uppercase tracking-wider hover:border-ink-950 flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            VERIFY SEAL
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-editorial-border bg-alabaster-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider shadow-editorial transition-all"
          >
            CLOSE LIFECYCLE PANEL
          </button>
        </div>
      </div>
    </div>
  );
}
