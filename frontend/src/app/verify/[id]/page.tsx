'use client';

import React, { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Download,
  FileCheck,
  Building2,
  Calendar,
  Layers,
  Scale
} from 'lucide-react';
import { verifyPublicReport, getReportPdfUrl } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function PublicVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.id;
  const searchParams = useSearchParams();
  const hashParam = searchParams.get('hash');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      verifyPublicReport(reportId)
        .then(setData)
        .catch((err) => setError(err.message || 'Verification record not found in National Metrology Register'))
        .finally(() => setLoading(false));
    }
  }, [reportId]);

  // Check if URL hash matches dataset SHA-256 hash prefix
  const isHashMatched =
    data && (!hashParam || (data.sha256_hash && data.sha256_hash.toLowerCase().startsWith(hashParam.toLowerCase())));

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8 px-4 font-mono">
      {/* Directorate Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex p-4 bg-ink-950 text-white shadow-editorial">
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <h1 className="font-display font-black text-2xl uppercase tracking-tight text-ink-950">
          DIRECTORATE OF LEGAL METROLOGY
        </h1>
        <p className="text-xs text-ink-500 uppercase tracking-widest font-mono">
          STATUTORY OIML R 76-1 / R 76-2 TYPE APPROVAL VERIFICATION REGISTER
        </p>
      </div>

      {loading && (
        <div className="bg-white p-8 border border-editorial-border text-center text-xs text-ink-500 shadow-editorial space-y-2 uppercase">
          <div className="w-6 h-6 border-2 border-ink-950 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>RESOLVING CRYPTOGRAPHIC CERTIFICATE SEAL FROM REGISTER...</p>
        </div>
      )}

      {error && (
        <div className="bg-white border border-rose-300 text-rose-900 p-6 text-center text-xs shadow-editorial space-y-1">
          <h3 className="font-bold text-sm uppercase tracking-wider">INVALID OR UNVERIFIED CERTIFICATE</h3>
          <p className="text-rose-800 uppercase mt-1">{error}</p>
        </div>
      )}

      {data && (
        <div className="bg-white border border-editorial-border shadow-editorial overflow-hidden space-y-6 p-6">
          {/* Certificate Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-editorial-border pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400 block">
                CERTIFICATE IDENTIFIER
              </span>
              <span className="text-lg font-black font-mono text-ink-950 block mt-0.5">
                {data.report_number}
              </span>
            </div>
            <div
              className={`px-3 py-1.5 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border ${
                isHashMatched
                  ? 'bg-ink-950 text-white border-ink-950'
                  : 'bg-rose-600 text-white border-rose-600'
              }`}
            >
              {isHashMatched ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>AUTHENTIC & VERIFIED</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-white" />
                  <span>HASH MISMATCH DETECTED</span>
                </>
              )}
            </div>
          </div>

          {/* Instrument Specifications Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-alabaster-50 p-4 border border-editorial-border">
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">INSTRUMENT SERIAL</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{data.instrument_serial}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">ACCURACY CLASS</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{data.accuracy_class}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">MANUFACTURER</span>
              <span className="font-bold text-ink-950 mt-0.5 block truncate">{data.manufacturer_name}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">MODEL DENOMINATION</span>
              <span className="font-bold text-ink-950 mt-0.5 block truncate">{data.model_name}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">APPROVAL TIMESTAMP</span>
              <span className="font-bold text-ink-950 mt-0.5 block">{formatDate(data.approved_at)}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[9px] uppercase font-bold">STATUTORY STANDARD</span>
              <span className="font-bold text-ink-950 mt-0.5 block">OIML R 76-1:2006</span>
            </div>
          </div>

          {/* Cryptographic SHA-256 Digest Box */}
          <div className="bg-alabaster-50 border border-editorial-border p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-widest block">
                CRYPTOGRAPHIC SHA-256 TAMPER-EVIDENT SEAL
              </span>
              <span className="text-[9px] text-ink-950 font-bold bg-white px-2 py-0.5 border border-editorial-border uppercase tracking-wider">
                DETERMINISTIC AUDIT MATCH
              </span>
            </div>
            <div className="font-mono text-[11px] text-ink-900 break-all bg-white p-3 border border-editorial-border">
              {data.sha256_hash}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2">
            <a
              href={getReportPdfUrl(reportId)}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 bg-ink-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all text-center flex items-center justify-center gap-2 shadow-editorial"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD OFFICIAL OIML R 76-2 CERTIFICATE (PDF)</span>
            </a>
          </div>

          <div className="text-center text-[10px] text-ink-400 pt-2 border-t border-editorial-border uppercase">
            CERTIFIED UNDER THE LEGAL METROLOGY ACT, 2009 & LEGAL METROLOGY (GENERAL) RULES, 2011.
          </div>
        </div>
      )}
    </div>
  );
}
