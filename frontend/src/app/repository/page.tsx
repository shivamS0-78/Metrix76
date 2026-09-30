'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Archive,
  Search,
  Download,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  History,
  Filter,
  Eye,
  Layers,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { searchArchive, getReportPdfUrl } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { TestReportSummary, AccuracyClass, ReportStatus } from '@/types/metrology';
import { formatDate } from '@/lib/utils';
import LifecycleDrawer from '@/components/archive/LifecycleDrawer';

export default function RepositoryPage() {
  const { user, role } = useAuth();
  const [reports, setReports] = useState<TestReportSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Lifecycle Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSerial, setActiveSerial] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState('');
  const [activeManufacturer, setActiveManufacturer] = useState('');
  const [activeClass, setActiveClass] = useState('');

  const fetchReports = useCallback(() => {
    setLoading(true);
    searchArchive(query, user?.id, role || undefined)
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query, user?.id, role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchReports]);

  // Filtered dataset
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (selectedClass !== 'ALL' && r.accuracy_class !== selectedClass) return false;
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      return true;
    });
  }, [reports, selectedClass, selectedStatus]);

  const handleOpenLifecycle = (rep: TestReportSummary) => {
    setActiveSerial(rep.instrument_serial);
    setActiveModel(rep.instrument_model);
    setActiveManufacturer(rep.manufacturer_name);
    setActiveClass(rep.accuracy_class);
    setDrawerOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-editorial-border shadow-editorial">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight uppercase text-ink-950">
              AUDIT & SEALS REPOSITORY
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              NATIONAL VAULT
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1">
            STATUTORY AUDIT REGISTRY • MULTI-ATTEMPT LIFECYCLE PROGRESSIONS • SHA-256 INTEGRITY SEALS
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {role === 'TECHNICIAN' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              My Evaluations Only ({user?.email})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              All Organization Records ({role || 'Authorized'})
            </span>
          )}

          <button
            onClick={fetchReports}
            className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-editorial cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>REFRESH ARCHIVE</span>
          </button>
        </div>
      </div>

      {/* Faceted Filter Toolbar */}
      <div className="bg-white p-5 border border-editorial-border shadow-editorial space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Free Text Search */}
          <div className="md:col-span-2 flex items-center gap-2.5 px-3.5 py-2.5 bg-alabaster-50 border border-editorial-border">
            <Search className="w-4 h-4 text-ink-400 shrink-0" />
            <input
              type="text"
              placeholder="SEARCH BY SERIAL NUMBER, MODEL, MANUFACTURER, OR REPORT ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs font-mono bg-transparent outline-none text-ink-950 placeholder:text-ink-400"
            />
          </div>

          {/* Accuracy Class Filter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-alabaster-50 border border-editorial-border">
            <Layers className="w-4 h-4 text-ink-400 shrink-0" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-mono uppercase bg-transparent outline-none text-ink-900"
            >
              <option value="ALL">All Accuracy Classes</option>
              <option value="CLASS_I">Class I (Special)</option>
              <option value="CLASS_II">Class II (High)</option>
              <option value="CLASS_III">Class III (Medium)</option>
              <option value="CLASS_IIII">Class IIII (Ordinary)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-alabaster-50 border border-editorial-border">
            <FileCheck2 className="w-4 h-4 text-ink-400 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs font-mono uppercase bg-transparent outline-none text-ink-900"
            >
              <option value="ALL">All Report Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Historical Repository Table */}
      <div className="bg-white border border-editorial-border shadow-editorial overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-alabaster-100 border-b border-editorial-border text-ink-900 font-mono font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">REPORT IDENTIFIER</th>
                <th className="p-4">INSTRUMENT SERIAL</th>
                <th className="p-4">MODEL / MAKE</th>
                <th className="p-4">MANUFACTURER</th>
                <th className="p-4">ACCURACY CLASS</th>
                <th className="p-4">AUDIT STATUS</th>
                <th className="p-4">DATE STAMPED</th>
                <th className="p-4 text-right">ACTIONS & EXPORTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-editorial-border">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center font-mono text-xs text-ink-400">
                    {loading ? 'SEARCHING NATIONAL REPOSITORY RECORDS...' : 'NO EVALUATIONS MATCH THE SEARCH FILTERS.'}
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => {
                  const isApproved = rep.status === 'APPROVED';
                  const isRejected = rep.status === 'REJECTED';
                  const isPending = rep.status === 'PENDING_APPROVAL';

                  return (
                    <tr key={rep.id} className="hover:bg-alabaster-50 transition-colors">
                      <td className="p-4 font-bold font-mono text-ink-950">
                        {rep.report_number}
                      </td>
                      <td className="p-4 font-mono">
                        <button
                          type="button"
                          onClick={() => handleOpenLifecycle(rep)}
                          className="font-bold text-ink-950 hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-ink-700" />
                          <span>{rep.instrument_serial}</span>
                        </button>
                      </td>
                      <td className="p-4 font-bold text-ink-900">{rep.instrument_model}</td>
                      <td className="p-4 text-ink-700">{rep.manufacturer_name}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 font-mono text-[9px] font-bold bg-ink-950 text-white uppercase">
                          {rep.accuracy_class}
                        </span>
                      </td>
                      <td className="p-4 font-mono">
                        <span
                          className={`px-2.5 py-0.5 text-[9px] font-bold uppercase border ${
                            isApproved
                              ? 'bg-white text-emerald-800 border-emerald-300'
                              : isRejected
                              ? 'bg-neutral-900 text-rose-400 border-neutral-700'
                              : isPending
                              ? 'bg-neutral-100 text-amber-800 border-amber-300'
                              : 'bg-alabaster-100 text-ink-700 border-editorial-border'
                          }`}
                        >
                          {rep.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-ink-500 font-mono text-[11px]">
                        {formatDate(rep.created_at)}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap font-mono">
                        <Link
                          href={`/evaluations/${rep.id}/review`}
                          className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-ink-950 text-white hover:bg-neutral-800 px-3 py-1 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>REVIEW</span>
                        </Link>

                        {isApproved && (
                          <>
                            <a
                              href={getReportPdfUrl(rep.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] uppercase font-bold border border-editorial-border hover:border-ink-950 text-ink-900 px-2.5 py-1 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3" />
                              <span>PDF</span>
                            </a>
                            <Link
                              href={`/verify/${rep.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[10px] uppercase font-bold border border-editorial-border hover:border-ink-950 text-ink-900 px-2.5 py-1 transition-colors"
                              title="Verify Public SHA-256 Seal"
                            >
                              <QrCode className="w-3 h-3" />
                              <span>SEAL</span>
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instrument Lifecycle Drawer Component */}
      <LifecycleDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        serialNumber={activeSerial}
        modelName={activeModel}
        manufacturerName={activeManufacturer}
        accuracyClass={activeClass}
      />
    </div>
  );
}
