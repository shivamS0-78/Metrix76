'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  Download,
  KeyRound,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Layers,
  Thermometer,
  Droplets,
  Gauge,
  Eye,
  QrCode
} from 'lucide-react';
import { getReportDetail, submitVerificationAction, getReportPdfUrl, getReportDocxUrl } from '@/lib/api';
import ToleranceCorridor from '@/components/worksheets/ToleranceCorridor';
import { formatDate } from '@/lib/utils';

export default function ApproverReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;
  const router = useRouter();

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [officerPin, setOfficerPin] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Post Approval State
  const [sealData, setSealData] = useState<any>(null);

  useEffect(() => {
    if (reportId) {
      getReportDetail(reportId)
        .then(setReport)
        .catch((err) => setError(err.message || 'Failed to load report for review'))
        .finally(() => setLoading(false));
    }
  }, [reportId]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerPin || officerPin.length < 4) {
      setActionError('Please enter a valid 4+ digit Approving Officer PIN.');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await submitVerificationAction(reportId, 'APPROVE', officerPin);
      setSealData(res);
      setReport((prev: any) => ({
        ...prev,
        status: 'APPROVED',
        sha256_hash: res.sha256_hash,
        approved_at: res.approved_at,
      }));
      setShowApproveModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to authorize and approve report.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRemarks.trim()) {
      setActionError('Mandatory technical remarks are required for rejection.');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      await submitVerificationAction(reportId, 'REJECT', undefined, rejectRemarks);
      setReport((prev: any) => ({
        ...prev,
        status: 'REJECTED',
        rejection_reason: rejectRemarks,
      }));
      setShowRejectModal(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject report.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center">
        <div className="inline-block p-4 border border-editorial-border bg-white shadow-editorial">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-600">
            Loading cryptographic evaluation dossier...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4">
        <div className="bg-white border border-editorial-border p-8 shadow-editorial text-center space-y-4">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <span className="font-mono text-[10px] text-ink-500 uppercase tracking-widest">
              REPORT NOT FOUND
            </span>
            <span className="text-[10px] font-mono text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5">
              UNRESOLVED ID
            </span>
          </div>
          <h3 className="font-display font-black text-xl text-ink-950 uppercase tracking-tight">
            Evaluation Record Not Found
          </h3>
          <p className="font-mono text-xs text-ink-500 leading-relaxed">
            {error || 'The requested evaluation report could not be retrieved from the metrology ledger.'}
          </p>
          <div className="pt-4 border-t border-editorial-border flex justify-center gap-3">
            <button
              onClick={() => router.push('/verification')}
              className="bg-ink-950 hover:bg-neutral-800 text-white font-semibold px-4 py-2 text-xs uppercase tracking-wider transition-colors shadow-editorial cursor-pointer"
            >
              Go to Verification Queue
            </button>
            <button
              onClick={() => router.push('/evaluations')}
              className="bg-alabaster-200 hover:bg-alabaster-300 text-ink-900 border border-editorial-border font-semibold px-4 py-2 text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Evaluations Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inst = report.instrument;
  const std = report.reference_standard;
  const env = report.environment;
  const isApproved = report.status === 'APPROVED';
  const isRejected = report.status === 'REJECTED';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-editorial-border pb-6 bg-white p-6 shadow-editorial border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/verification')}
            className="p-2 border border-editorial-border hover:bg-neutral-100 text-ink-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-black text-xl text-ink-950 uppercase tracking-tight">
                TWO-MAN VERIFICATION & REVIEW DOSSIER
              </h1>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isApproved
                    ? 'bg-ink-950 text-white'
                    : isRejected
                    ? 'bg-rose-600 text-white'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {report.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-ink-500 font-mono uppercase mt-1">
              REPORT: {report.report_number} • SERIAL: {inst.serial_number} • STANDARD: {report.standard_version}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 font-mono">
          {!isApproved && !isRejected && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setShowRejectModal(true);
                }}
                className="px-4 py-2.5 bg-white text-rose-800 hover:bg-rose-50 border border-rose-300 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                REJECT & RETURN
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setShowApproveModal(true);
                }}
                className="px-5 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider shadow-editorial transition-all flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-white" />
                AUTHORIZE & SIGN (PIN)
              </button>
            </>
          )}

          {isApproved && (
            <div className="flex items-center gap-2">
              <a
                href={getReportPdfUrl(report.id)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-ink-950 text-white text-xs font-bold uppercase tracking-wider shadow-editorial hover:bg-neutral-800 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                PDF CERTIFICATE
              </a>
              <a
                href={getReportDocxUrl(report.id)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white text-ink-950 border border-editorial-border text-xs font-bold uppercase tracking-wider hover:border-ink-950 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                DOCX
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Post-Approval Tamper-Evident SHA-256 Banner */}
      {isApproved && (
        <div className="p-5 bg-white border border-editorial-border shadow-editorial flex flex-wrap items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-ink-950 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-950 uppercase tracking-wider">
                CRYPTOGRAPHICALLY SEALED & VERIFIED
              </h3>
              <p className="text-[11px] text-ink-500 uppercase mt-0.5">
                SHA-256 DIGEST: {report.sha256_hash || sealData?.sha256_hash || 'COMPUTED & LOCKED'}
              </p>
            </div>
          </div>
          <a
            href={`/verify/${report.id}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-ink-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-1.5 shadow-editorial"
          >
            <Eye className="w-3.5 h-3.5" />
            PUBLIC SEAL VERIFICATION
          </a>
        </div>
      )}

      {/* Rejection Notice Banner */}
      {isRejected && (
        <div className="p-5 bg-white border border-rose-300 text-xs font-mono space-y-1">
          <div className="flex items-center gap-2 text-rose-900 font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>EVALUATION RETURNED FOR RE-TESTING</span>
          </div>
          <p className="text-[11px] text-rose-800 uppercase mt-1">
            REMARKS: {report.rejection_reason || 'TECHNICAL NON-COMPLIANCE NOTED DURING AUDIT.'}
          </p>
        </div>
      )}

      {/* Metadata Grids: Instrument + Standard + Ambient */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        {/* Instrument Passport Card */}
        <div className="bg-white p-5 border border-editorial-border shadow-editorial space-y-3">
          <div className="flex items-center gap-2 font-bold text-ink-950 border-b border-editorial-border pb-3 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-ink-950" />
            <span>INSTRUMENT PASSPORT</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">MODEL</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{inst.model_name}</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">ACCURACY CLASS</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{inst.accuracy_class}</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">CAPACITY (MAX)</span>
              <span className="font-bold text-ink-950 mt-0.5 block">
                {inst.max_capacity} {inst.unit}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">INTERVAL (e)</span>
              <span className="font-bold text-ink-950 mt-0.5 block">
                {inst.verification_interval_e} {inst.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Reference Standard Card */}
        <div className="bg-white p-5 border border-editorial-border shadow-editorial space-y-3">
          <div className="flex items-center gap-2 font-bold text-ink-950 border-b border-editorial-border pb-3 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-ink-950" />
            <span>STANDARD WEIGHT SET</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">SET IDENTIFIER</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{std.set_identifier}</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">ACCURACY CLASS</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{std.accuracy_class}</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">CERTIFICATE</span>
              <span className="font-bold text-ink-950 mt-0.5 block truncate">{std.certificate_number}</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">EXPIRY DATE</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{formatDate(std.expiry_date)}</span>
            </div>
          </div>
        </div>

        {/* Ambient Conditions Card */}
        <div className="bg-white p-5 border border-editorial-border shadow-editorial space-y-3">
          <div className="flex items-center gap-2 font-bold text-ink-950 border-b border-editorial-border pb-3 uppercase tracking-wider">
            <Thermometer className="w-4 h-4 text-ink-950" />
            <span>AMBIENT METEOROLOGY</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">TEMP</span>
              <span className="font-bold text-ink-950 mt-0.5 block">
                {env.ambient_temperature_celsius}°C
              </span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">HUMIDITY</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{env.relative_humidity_pct}%</span>
            </div>
            <div>
              <span className="text-[9px] text-ink-400 block uppercase font-bold">PRESSURE</span>
              <span className="font-bold text-ink-950 mt-0.5 block">
                {env.atmospheric_pressure_hpa || 1013.25} hPa
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Recharts Tolerance Corridor Envelope */}
      <ToleranceCorridor
        instrument={inst}
        results={report.weighing_observations || []}
      />

      {/* Weighing Performance Observation Table */}
      <div className="bg-white border border-editorial-border shadow-editorial p-6 space-y-4">
        <h3 className="font-display font-black text-xs uppercase tracking-wider text-ink-950">
          WEIGHING TEST OBSERVATIONS & ERROR VECTOR DATA (OIML R 76-1 CLAUSE A.4.4)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-alabaster-50 border-b border-editorial-border text-[10px] uppercase font-bold text-ink-500">
                <th className="p-3">DIRECTION</th>
                <th className="p-3">LOAD APPLIED (L)</th>
                <th className="p-3">INDICATION (I)</th>
                <th className="p-3">DELTA LOAD (ΔL)</th>
                <th className="p-3">TURNING POINT (P)</th>
                <th className="p-3">CORRECTED ERROR (Ec)</th>
                <th className="p-3">STATUTORY (±mpe)</th>
                <th className="p-3">VERDICT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-editorial-border">
              {(report.weighing_observations || []).map((obs: any, idx: number) => (
                <tr key={idx} className="hover:bg-alabaster-50/80 transition-colors">
                  <td className="p-3 font-bold text-ink-950">
                    {obs.direction === 'INCREASING' ? '▲ INC' : '▼ DEC'}
                  </td>
                  <td className="p-3 font-bold text-ink-950">
                    {obs.load_applied} {inst.unit}
                  </td>
                  <td className="p-3 text-ink-700">
                    {obs.indication_observed} {inst.unit}
                  </td>
                  <td className="p-3 text-ink-700">
                    {obs.delta_load} {inst.unit}
                  </td>
                  <td className="p-3 text-ink-700">
                    {obs.calculated_p?.toFixed(4)} {inst.unit}
                  </td>
                  <td className="p-3 font-bold text-ink-950">
                    {obs.corrected_error_ec > 0 ? '+' : ''}
                    {obs.corrected_error_ec?.toFixed(4)} {inst.unit}
                  </td>
                  <td className="p-3 text-ink-500">
                    ±{obs.mpe_allowed?.toFixed(4)} {inst.unit}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        obs.is_compliant
                          ? 'bg-ink-950 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {obs.is_compliant ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal (PIN Input) */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl space-y-4 border border-editorial-border font-mono">
            <div className="flex items-center gap-3 border-b border-editorial-border pb-3">
              <div className="p-2.5 bg-ink-950 text-white">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase text-ink-950 tracking-wider">
                  OFFICER AUTHORIZATION SIGN-OFF
                </h3>
                <p className="text-[11px] text-ink-500 uppercase mt-0.5">
                  ENTER PIN TO ISSUE CRYPTOGRAPHIC SHA-256 SEAL.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-white border border-rose-300 text-rose-800 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <form onSubmit={handleApprove} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-500 block uppercase tracking-widest">
                  OFFICER AUTHORIZATION PIN
                </label>
                <input
                  type="password"
                  value={officerPin}
                  onChange={(e) => setOfficerPin(e.target.value)}
                  placeholder="••••"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-editorial-border text-sm font-mono tracking-widest outline-none focus:border-ink-950"
                  autoFocus
                  required
                />
              </div>

              <div className="p-3 bg-alabaster-50 border border-editorial-border text-[10px] text-ink-500 uppercase">
                BY APPROVING, YOU CERTIFY THAT ALL TESTS COMPLY STRICTLY WITH OIML R 76-1:2006.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold uppercase text-ink-500 hover:text-ink-950 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2.5 bg-ink-950 text-white text-xs font-bold uppercase tracking-wider shadow-editorial hover:bg-neutral-800 transition-all flex items-center gap-2"
                >
                  {submittingAction ? 'SEALING RECORD...' : 'CONFIRM & AUTHORIZE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal (Mandatory Remarks) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl space-y-4 border border-editorial-border font-mono">
            <div className="flex items-center gap-3 border-b border-editorial-border pb-3">
              <div className="p-2.5 bg-ink-950 text-white">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase text-ink-950 tracking-wider">
                  RETURN EVALUATION FOR RE-TESTING
                </h3>
                <p className="text-[11px] text-ink-500 uppercase mt-0.5">
                  SPECIFY STATUTORY CRITERIA OR DEFECT DETAILS.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 bg-white border border-rose-300 text-rose-800 text-xs font-semibold">
                {actionError}
              </div>
            )}

            <form onSubmit={handleReject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-500 block uppercase tracking-widest">
                  MANDATORY TECHNICAL REMARKS
                </label>
                <textarea
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="e.g. Weighing points at 10kg breached statutory ±1.0e mpe limit..."
                  rows={4}
                  className="w-full px-3 py-2 border border-editorial-border text-xs outline-none focus:border-ink-950"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-bold uppercase text-ink-500 hover:text-ink-950 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2.5 bg-rose-600 text-white text-xs font-bold uppercase tracking-wider shadow-editorial hover:bg-rose-700 transition-all"
                >
                  {submittingAction ? 'RETURNING...' : 'REJECT & RETURN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
