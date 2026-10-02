'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Copy, Check, Filter, Database, Link2 } from 'lucide-react';
import { IntegrityEntry, IntegrityVerificationResult } from '@/types/metrology';

interface LedgerViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: IntegrityEntry[];
  verificationResult: IntegrityVerificationResult | null;
  reportNumber?: string;
}

export const LedgerViewerModal: React.FC<LedgerViewerModalProps> = ({
  isOpen,
  onClose,
  entries,
  verificationResult,
  reportNumber,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const filteredEntries = filterType === 'ALL'
    ? entries
    : entries.filter((e) => e.entity_type === filterType);

  const isIntact = verificationResult?.status === 'INTACT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white border border-editorial-border shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-neutral-950 text-white px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-display font-bold text-sm tracking-wider uppercase">
                CRYPTOGRAPHIC RAW-DATA LEDGER
              </h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">
                ISO/IEC 17025 TAMPER-EVIDENT EVIDENCE CHAIN {reportNumber ? `• ${reportNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {verificationResult && (
              <span
                className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                  isIntact
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700'
                }`}
              >
                {isIntact ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {verificationResult.status}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-1 rounded-sm cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between bg-alabaster-100 border-b border-editorial-border px-6 py-2.5 text-xs font-mono">
          <div className="flex items-center gap-2 text-ink-600">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider font-bold">FILTER ENTITY:</span>
            <div className="flex gap-1">
              {['ALL', 'TEST_OBSERVATION', 'EVIDENCE', 'REPORT', 'DEVICE_MEASUREMENT'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer border ${
                    filterType === type
                      ? 'bg-ink-950 text-white border-ink-950'
                      : 'bg-white text-ink-700 border-editorial-border hover:bg-alabaster-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-ink-500 uppercase tracking-wider">
            SHOWING {filteredEntries.length} OF {entries.length} ENTRIES
          </div>
        </div>

        {/* Table Body */}
        <div className="max-h-[60vh] overflow-y-auto p-0">
          {filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-ink-400 font-mono text-xs uppercase tracking-wider">
              No ledger entries registered matching current filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-alabaster-50 border-b border-editorial-border text-ink-800 text-[10px] uppercase font-bold sticky top-0">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 w-32">TIMESTAMP (UTC)</th>
                  <th className="p-3 w-36">ENTITY & EVENT</th>
                  <th className="p-3">PAYLOAD SHA-256</th>
                  <th className="p-3">PREVIOUS ENTRY</th>
                  <th className="p-3">ENTRY HASH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-editorial-border">
                {filteredEntries.map((entry) => {
                  const isGenesis = entry.sequence_number === 1;
                  const shortPayload = entry.payload_hash.slice(0, 10) + '...' + entry.payload_hash.slice(-6);
                  const shortPrev = entry.previous_hash
                    ? entry.previous_hash.slice(0, 10) + '...' + entry.previous_hash.slice(-6)
                    : 'GENESIS [None]';
                  const shortEntry = entry.entry_hash.slice(0, 10) + '...' + entry.entry_hash.slice(-6);

                  return (
                    <tr key={entry.id} className="hover:bg-alabaster-50 transition-colors">
                      <td className="p-3 text-center font-bold text-ink-950 bg-alabaster-100/50">
                        {entry.sequence_number}
                      </td>

                      <td className="p-3 text-[11px] text-ink-600">
                        {new Date(entry.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>

                      <td className="p-3">
                        <span className="block font-bold text-ink-900 text-[11px] uppercase">
                          {entry.entity_type}
                        </span>
                        <span className="block text-[10px] text-ink-500 uppercase tracking-tight">
                          {entry.event_type}
                        </span>
                      </td>

                      {/* Payload Hash */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] text-ink-800 bg-alabaster-100 px-1 py-0.5 border border-editorial-border select-all">
                            {shortPayload}
                          </code>
                          <button
                            onClick={() => handleCopy(entry.payload_hash, `p-${entry.id}`)}
                            className="text-ink-400 hover:text-ink-900 transition-colors p-0.5"
                            title="Copy full payload hash"
                          >
                            {copiedHash === `p-${entry.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Previous Hash */}
                      <td className="p-3">
                        {isGenesis ? (
                          <span className="text-[10px] font-bold text-neutral-500 italic uppercase">
                            GENESIS ROOT
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Link2 className="w-3 h-3 text-ink-400 shrink-0" />
                            <code className="text-[11px] text-ink-600 bg-alabaster-100 px-1 py-0.5 border border-editorial-border select-all">
                              {shortPrev}
                            </code>
                            {entry.previous_hash && (
                              <button
                                onClick={() => handleCopy(entry.previous_hash || '', `prev-${entry.id}`)}
                                className="text-ink-400 hover:text-ink-900 transition-colors p-0.5"
                                title="Copy full previous entry hash"
                              >
                                {copiedHash === `prev-${entry.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Entry Hash */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-bold text-ink-950 bg-alabaster-200/80 px-1 py-0.5 border border-editorial-border select-all">
                            {shortEntry}
                          </code>
                          <button
                            onClick={() => handleCopy(entry.entry_hash, `e-${entry.id}`)}
                            className="text-ink-400 hover:text-ink-900 transition-colors p-0.5"
                            title="Copy full entry hash"
                          >
                            {copiedHash === `e-${entry.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Checkpoint info footer */}
        {verificationResult?.checkpoint && (
          <div className="p-3.5 bg-neutral-900 text-white text-[10px] font-mono border-t border-neutral-800 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold uppercase">SIGNED INTEGRITY CHECKPOINT:</span>
              <span className="text-neutral-300">
                Algorithm: {String(verificationResult.checkpoint.algorithm || 'Ed25519')} • Key: {String(verificationResult.checkpoint.key_id || 'primary')}
              </span>
            </div>
            <div className="text-neutral-400">
              Chain Head: {String(verificationResult.checkpoint.chain_head_hash || '').slice(0, 16)}...
            </div>
          </div>
        )}

        {/* Actions footer */}
        <div className="flex justify-between items-center bg-alabaster-50 border-t border-editorial-border px-6 py-3">
          <span className="text-[10px] font-mono text-ink-500 uppercase tracking-widest">
            Cryptographic ledger is tamper-evident under standard SHA-256 hash chaining.
          </span>
          <button
            onClick={onClose}
            className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default LedgerViewerModal;
