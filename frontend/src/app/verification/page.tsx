'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  FileCheck2, 
  CheckCircle2, 
  XCircle, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  Award,
  Search,
  Filter,
  Eye,
  FileText
} from 'lucide-react';
import { submitVerificationAction, searchArchive, getReportDetail, getReportPdfUrl } from '@/lib/api';
import { TestReportSummary, TestReportDetail } from '@/types/metrology';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';

export default function VerificationConsolePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [allReports, setAllReports] = useState<TestReportSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<TestReportDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [pin, setPin] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; hash?: string } | null>(null);

  const fetchReports = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await searchArchive(undefined);
      setAllReports(data);
      
      const filtered = activeFilter === 'PENDING' 
        ? data.filter(r => r.status === 'PENDING_APPROVAL')
        : activeFilter === 'APPROVED'
        ? data.filter(r => r.status === 'APPROVED')
        : data;

      if (filtered.length > 0) {
        setSelectedReportId(prev => {
          if (!prev || !filtered.some(r => r.id === prev)) {
            return filtered[0].id;
          }
          return prev;
        });
      } else {
        setSelectedReportId(null);
        setReportDetail(null);
      }
    } catch (err) {
      console.error('Failed to load verification reports:', err);
    } finally {
      setLoadingList(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!selectedReportId) {
      setReportDetail(null);
      return;
    }
    setLoadingDetail(true);
    getReportDetail(selectedReportId)
      .then(setReportDetail)
      .catch((err) => {
        console.error('Failed to load report detail:', err);
        setReportDetail(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedReportId]);

  const displayedReports = activeFilter === 'PENDING'
    ? allReports.filter(r => r.status === 'PENDING_APPROVAL')
    : activeFilter === 'APPROVED'
    ? allReports.filter(r => r.status === 'APPROVED')
    : allReports;

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedReportId) return;

    if (action === 'APPROVE' && (!pin || pin.length < 4)) {
      setStatusMessage({ type: 'error', text: 'Valid Approving Officer PIN (at least 4 digits) is required to approve.' });
      return;
    }

    if (action === 'REJECT' && !remarks.trim()) {
      setStatusMessage({ type: 'error', text: 'Mandatory rejection remarks are required when returning report.' });
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await submitVerificationAction(selectedReportId, action, pin, remarks);
      setStatusMessage({
        type: 'success',
        text: res.message,
        hash: res.sha256_hash,
      });
      setPin('');
      setRemarks('');

      // Refresh reports list
      await fetchReports();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Verification action failed',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  if (!authLoading && role === 'TECHNICIAN') {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4">
        <div className="bg-white border border-editorial-border p-8 shadow-editorial text-center space-y-4">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <span className="font-mono text-[10px] text-ink-500 uppercase tracking-widest">
              ACCESS RESTRICTED // ISO/IEC 17025
            </span>
            <span className="text-[10px] font-mono text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5">
              DUAL-CUSTODY VIOLATION
            </span>
          </div>
          <h3 className="font-display font-black text-xl text-ink-950 uppercase tracking-tight">
            Verification Queue Restricted
          </h3>
          <p className="font-mono text-xs text-ink-500 leading-relaxed">
            Testing Metrologists (TECHNICIAN) are prohibited from accessing verification queues or issuing approvals under statutory dual-custody governance.
          </p>
          <div className="pt-4 border-t border-editorial-border flex justify-center gap-3">
            <Link
              href="/evaluations"
              className="bg-ink-950 hover:bg-neutral-800 text-white font-semibold px-4 py-2 text-xs uppercase tracking-wider transition-colors shadow-editorial"
            >
              Go to Evaluations Worksheet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white p-6 border border-editorial-border shadow-editorial flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight uppercase text-ink-950 flex items-center gap-2">
              <FileCheck2 className="w-6 h-6 text-ink-950" />
              <span>DUAL-CUSTODY AUDIT & VERIFICATION GATEWAY</span>
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              OFFICER DISPATCH
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1 uppercase">
            AUTHORIZED LEGAL METROLOGY OFFICER AUDIT • CRYPTOGRAPHIC SEAL ISSUANCE • TAMPER-PROOF ARCHIVE
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 border text-xs font-mono flex items-start gap-3 shadow-editorial ${
          statusMessage.type === 'success'
            ? 'bg-white border-emerald-300 text-emerald-950'
            : 'bg-neutral-900 border-neutral-900 text-white'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-wider">{statusMessage.text}</p>
            {statusMessage.hash && (
              <p className="text-[11px] text-ink-500 break-all">
                DIGITAL SEAL DIGEST: {statusMessage.hash}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Report Queue & Filters */}
        <div className="bg-white border border-editorial-border p-5 shadow-editorial space-y-4">
          <div className="flex border border-editorial-border bg-alabaster-50 p-1 text-[11px] font-mono font-bold">
            <button
              type="button"
              onClick={() => setActiveFilter('PENDING')}
              className={`flex-1 py-2 uppercase tracking-wider transition-all text-center cursor-pointer ${
                activeFilter === 'PENDING' ? 'bg-ink-950 text-white shadow-editorial' : 'text-ink-500 hover:text-ink-950'
              }`}
            >
              PENDING ({allReports.filter(r => r.status === 'PENDING_APPROVAL').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('APPROVED')}
              className={`flex-1 py-2 uppercase tracking-wider transition-all text-center cursor-pointer ${
                activeFilter === 'APPROVED' ? 'bg-ink-950 text-white shadow-editorial' : 'text-ink-500 hover:text-ink-950'
              }`}
            >
              APPROVED ({allReports.filter(r => r.status === 'APPROVED').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`flex-1 py-2 uppercase tracking-wider transition-all text-center cursor-pointer ${
                activeFilter === 'ALL' ? 'bg-ink-950 text-white shadow-editorial' : 'text-ink-500 hover:text-ink-950'
              }`}
            >
              ALL ({allReports.length})
            </button>
          </div>

          {loadingList ? (
            <div className="py-8 text-center text-xs font-mono text-ink-400 uppercase tracking-widest">LOADING AUDIT QUEUE...</div>
          ) : displayedReports.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2 border border-dashed border-editorial-border">
              <ShieldCheck className="w-8 h-8 text-ink-950 mx-auto" />
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-ink-950">
                {activeFilter === 'PENDING' ? 'PENDING QUEUE IS CLEAR' : 'NO RECORDS FOUND'}
              </p>
              <p className="text-[11px] font-mono text-ink-400 uppercase">
                {activeFilter === 'PENDING' 
                  ? 'NO EVALUATION PACKETS WAITING FOR OFFICER AUDIT.' 
                  : 'NO REPORTS MATCH THE SELECTED FILTER.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[550px] overflow-y-auto">
              {displayedReports.map((item) => {
                const isSelected = item.id === selectedReportId;
                const isPending = item.status === 'PENDING_APPROVAL';
                const isApproved = item.status === 'APPROVED';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedReportId(item.id);
                      setStatusMessage(null);
                    }}
                    className={`w-full text-left p-3.5 border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'border-ink-950 bg-ink-950 text-white shadow-editorial'
                        : 'border-editorial-border hover:border-ink-400 bg-white text-ink-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold mb-1">
                      <span className={isSelected ? 'text-white' : 'text-ink-950'}>{item.report_number}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-bold ${
                        isSelected
                          ? 'bg-white text-ink-950'
                          : isPending 
                          ? 'bg-amber-100 text-amber-900' 
                          : isApproved 
                          ? 'bg-emerald-100 text-emerald-900' 
                          : 'bg-neutral-100 text-neutral-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className={`font-semibold truncate text-[11px] ${isSelected ? 'text-neutral-200' : 'text-ink-800'}`}>
                      {item.instrument_model || 'Instrument'}
                    </div>
                    <div className={`text-[10px] font-mono truncate mt-0.5 ${isSelected ? 'text-neutral-400' : 'text-ink-500'}`}>
                      SN: {item.instrument_serial || 'N/A'} • {item.accuracy_class}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Report Audit Card */}
        <div className="lg:col-span-2">
          {loadingDetail ? (
            <div className="bg-white border border-editorial-border p-12 text-center text-ink-400 text-xs font-mono uppercase tracking-widest shadow-editorial">
              RETRIEVING EVALUATION DOSSIER...
            </div>
          ) : reportDetail ? (
            <div className="bg-white border border-editorial-border shadow-editorial p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-border pb-4 gap-2">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-black text-ink-950">{reportDetail.report_number}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider ${
                      reportDetail.status === 'PENDING_APPROVAL'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : reportDetail.status === 'APPROVED'
                        ? 'bg-ink-950 text-white'
                        : 'bg-neutral-100 text-ink-900 border border-editorial-border'
                    }`}>
                      {reportDetail.status}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-ink-500 block mt-1 uppercase">
                    {reportDetail.instrument?.model_name ?? 'Instrument'} • SERIAL: {reportDetail.instrument?.serial_number ?? 'N/A'} ({reportDetail.instrument?.accuracy_class ?? 'CLASS_III'})
                  </span>
                </div>
                <div className="text-left sm:text-right text-xs font-mono text-ink-600">
                  <div>MAX: <span className="font-bold text-ink-950">{reportDetail.instrument?.max_capacity ?? 15} {reportDetail.instrument?.unit ?? 'kg'}</span></div>
                  <div>STANDARD: <span className="font-bold text-ink-950">{reportDetail.reference_standard?.set_identifier ?? 'N/A'}</span></div>
                </div>
              </div>

              {/* Compliance Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-alabaster-50 border border-editorial-border p-3.5">
                  <span className="text-[10px] font-bold text-ink-400 uppercase block">3.5.1: Weighing</span>
                  <span className="font-bold text-ink-950 text-xs mt-1 block">PASS (Ec ≤ ±mpe)</span>
                </div>
                <div className="bg-alabaster-50 border border-editorial-border p-3.5">
                  <span className="text-[10px] font-bold text-ink-400 uppercase block">3.6.1: Repeat</span>
                  <span className="font-bold text-ink-950 text-xs mt-1 block">PASS (ΔE ≤ mpe)</span>
                </div>
                <div className="bg-alabaster-50 border border-editorial-border p-3.5">
                  <span className="text-[10px] font-bold text-ink-400 uppercase block">3.6.2: Eccentric</span>
                  <span className="font-bold text-ink-950 text-xs mt-1 block">PASS (4 CORNERS)</span>
                </div>
                <div className="bg-alabaster-50 border border-editorial-border p-3.5">
                  <span className="text-[10px] font-bold text-ink-400 uppercase block">A.4.4: Tare/Zero</span>
                  <span className="font-bold text-ink-950 text-xs mt-1 block">PASS (E₀ ≤ 0.25e)</span>
                </div>
              </div>

              {/* Detail Review Link */}
              <div className="flex items-center justify-between p-4 bg-alabaster-50 border border-editorial-border text-xs font-mono">
                <span className="text-ink-600 uppercase">INSPECT FULL ERROR CORRIDOR CURVES & PHOTOGRAPHIC EVIDENCE</span>
                <Link
                  href={`/evaluations/${reportDetail.id}/review`}
                  className="bg-ink-950 hover:bg-neutral-800 text-white font-bold px-4 py-2 uppercase tracking-wider text-[11px] flex items-center gap-1.5 transition-all shadow-editorial"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>DEEP AUDIT DOSSIER</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Status Info or Sign-off Box */}
              {reportDetail.status === 'APPROVED' ? (
                <div className="p-5 bg-white border border-editorial-border shadow-editorial space-y-3 font-mono">
                  <div className="flex items-center gap-2 text-ink-950 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>TYPE APPROVAL CERTIFICATE ISSUED</span>
                  </div>
                  {reportDetail.sha256_hash && (
                    <p className="text-[11px] text-ink-500 break-all">
                      INTEGRITY SEAL: {reportDetail.sha256_hash}
                    </p>
                  )}
                  <div className="pt-2 flex items-center gap-3">
                    <a
                      href={getReportPdfUrl(reportDetail.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-ink-950 hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-editorial"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>DOWNLOAD OFFICIAL PDF</span>
                    </a>
                    <Link
                      href={`/verify/${reportDetail.id}`}
                      className="text-xs font-bold text-ink-950 uppercase tracking-wider underline hover:text-neutral-600"
                    >
                      PUBLIC VERIFICATION PORTAL →
                    </Link>
                  </div>
                </div>
              ) : reportDetail.status === 'REJECTED' ? (
                <div className="p-5 bg-white border border-rose-300 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-2 text-rose-900 font-bold uppercase tracking-wider">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>REPORT REJECTED / RETURNED FOR RE-TESTING</span>
                  </div>
                  {reportDetail.rejection_reason && (
                    <p className="text-rose-700 uppercase mt-1">Remarks: {reportDetail.rejection_reason}</p>
                  )}
                </div>
              ) : (
                /* Officer Authorization Sign-off Box for PENDING / DRAFT */
                <div className="border-t border-editorial-border pt-6 space-y-4 font-mono">
                  <h4 className="text-xs font-bold text-ink-950 uppercase tracking-wider flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-ink-950" />
                    <span>APPROVING OFFICER AUTHORIZATION</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-ink-500 block mb-1 uppercase font-bold text-[10px] tracking-wider">
                        DIGITAL AUTHORIZATION PIN (REQUIRED FOR APPROVAL)
                      </label>
                      <input
                        type="password"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="border border-editorial-border bg-white px-3 py-2 w-full font-mono outline-none focus:border-ink-950"
                      />
                    </div>
                    <div>
                      <label className="text-ink-500 block mb-1 uppercase font-bold text-[10px] tracking-wider">
                        AUDIT REMARKS (MANDATORY IF REJECTING)
                      </label>
                      <input
                        type="text"
                        placeholder="AUDIT FINDINGS OR ADJUSTMENT NOTES"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="border border-editorial-border bg-white px-3 py-2 w-full font-mono outline-none focus:border-ink-950"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-3 pt-3">
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleAction('REJECT')}
                      className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      REJECT / RETURN FOR RE-TEST
                    </button>
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleAction('APPROVE')}
                      className="px-6 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-editorial transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>APPROVE & ISSUE SEAL</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-editorial-border p-12 text-center text-ink-400 text-xs font-mono uppercase tracking-widest shadow-editorial">
              SELECT AN EVALUATION PACKET FROM THE QUEUE TO COMMENCE OFFICER AUDIT.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
