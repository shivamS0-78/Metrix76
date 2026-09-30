'use client';

import React, { useEffect, useState } from 'react';
import { 
  Award, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  X, 
  Save, 
  Calendar, 
  Hash, 
  Building,
  Scale
} from 'lucide-react';
import { listReferenceStandards, createReferenceStandard } from '@/lib/api';
import { ReferenceStandard } from '@/types/metrology';
import { formatDate } from '@/lib/utils';

export default function ReferenceStandardsPage() {
  const [standards, setStandards] = useState<ReferenceStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state for new standard weight set
  const todayStr = new Date().toISOString().split('T')[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextYearStr = nextYear.toISOString().split('T')[0];

  const [formState, setFormState] = useState({
    set_identifier: '',
    accuracy_class: 'E2',
    certificate_number: '',
    calibrated_by: 'National Physical Laboratory (NPL India)',
    calibration_date: todayStr,
    expiry_date: nextYearStr,
    expanded_uncertainty_k2: 0.00005,
    nominal_range: '1 mg to 20 kg',
    is_active: true,
  });

  const fetchStandards = () => {
    setLoading(true);
    listReferenceStandards()
      .then((data) => {
        setStandards(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load reference standards. Confirm the FastAPI backend is running.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStandards();
  }, []);

  const handleCreateStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.set_identifier || !formState.certificate_number || !formState.calibrated_by) {
      alert('Please fill in Set Identifier, Certificate Number, and Calibrated By.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createReferenceStandard(formState);
      setStandards([created, ...standards]);
      setShowModal(false);
      setToastMessage(`Standard Weight Set "${created.set_identifier}" registered with ISO 17025 traceability!`);
      setTimeout(() => setToastMessage(null), 5000);

      // Reset form
      setFormState({
        set_identifier: '',
        accuracy_class: 'E2',
        certificate_number: '',
        calibrated_by: 'National Physical Laboratory (NPL India)',
        calibration_date: todayStr,
        expiry_date: nextYearStr,
        expanded_uncertainty_k2: 0.00005,
        nominal_range: '1 mg to 20 kg',
        is_active: true,
      });
    } catch (err: any) {
      console.error(err);
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-editorial-border shadow-editorial">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight uppercase text-ink-950">
              STANDARDS & VAULT REGISTRY
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              ISO/IEC 17025
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1">
            TRACEABLE REFERENCE WEIGHT SETS • EXPANDED UNCERTAINTY (k=2) • AUTOMATED EXPIRY GUARDRAILS
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-editorial cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>REGISTER WEIGHT SET</span>
        </button>
      </div>

      {toastMessage && (
        <div className="border border-emerald-300 bg-white p-4 text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 shadow-editorial">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="border border-ink-900 bg-neutral-900 text-white p-4 text-xs font-mono">
          <strong>SYSTEM NOTICE:</strong> {error}
        </div>
      )}

      {/* Standards Table */}
      <div className="bg-white border border-editorial-border shadow-editorial overflow-hidden">
        <div className="p-4 border-b border-editorial-border flex items-center justify-between bg-alabaster-50">
          <span className="font-mono font-bold text-xs text-ink-900 uppercase tracking-widest">
            TRACEABLE REFERENCE WEIGHT SETS ({standards.length})
          </span>
          {loading && <span className="text-xs font-mono text-ink-400">REFRESHING...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-alabaster-100 border-b border-editorial-border text-ink-900 font-mono font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">SET IDENTIFIER</th>
                <th className="p-4">ACCURACY CLASS</th>
                <th className="p-4">CERTIFICATE NO.</th>
                <th className="p-4">CALIBRATED BY</th>
                <th className="p-4">CALIBRATION DATE</th>
                <th className="p-4">EXPIRY DATE</th>
                <th className="p-4">GUARDRAIL STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-editorial-border">
              {standards.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center font-mono text-xs text-ink-400">
                    No reference standard weight sets found. Click &quot;REGISTER WEIGHT SET&quot; to add one.
                  </td>
                </tr>
              ) : (
                standards.map((std) => (
                  <tr key={std.id} className="hover:bg-alabaster-50 transition-colors">
                    <td className="p-4 font-bold font-mono text-ink-950">{std.set_identifier}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-ink-950 text-white uppercase">
                        OIML {std.accuracy_class}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-ink-600">{std.certificate_number}</td>
                    <td className="p-4 text-ink-800 font-medium">{std.calibrated_by}</td>
                    <td className="p-4 text-ink-500 font-mono text-[11px]">{formatDate(std.calibration_date)}</td>
                    <td className="p-4 font-mono text-[11px]">
                      <span className={std.is_expired ? 'text-rose-600 font-bold' : std.days_to_expiry <= 30 ? 'text-amber-600 font-bold' : 'text-ink-900'}>
                        {formatDate(std.expiry_date)} ({std.days_to_expiry}d left)
                      </span>
                    </td>
                    <td className="p-4 font-mono">
                      {std.is_expired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold uppercase bg-neutral-900 text-rose-400 border border-neutral-700">
                          <XCircle className="w-3 h-3" /> EXPIRED (BLOCKED)
                        </span>
                      ) : std.days_to_expiry <= 30 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold uppercase bg-neutral-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> EXPIRING SOON
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold uppercase bg-white text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE & VALID
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog: Register Reference Standard Weight Set */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-editorialLg border border-editorial-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-editorial-border bg-alabaster-50">
              <div>
                <h2 className="font-display font-bold text-lg text-ink-950 uppercase">
                  REGISTER REFERENCE STANDARD
                </h2>
                <p className="text-[10px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">
                  ISO/IEC 17025 TRACEABLE CALIBRATION CERTIFICATE METADATA
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-ink-400 hover:text-ink-950 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateStandard} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    SET IDENTIFIER *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.set_identifier}
                    onChange={(e) => setFormState({ ...formState, set_identifier: e.target.value })}
                    placeholder="e.g. NPL-E2-SET-05"
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    ACCURACY CLASS *
                  </label>
                  <select
                    value={formState.accuracy_class}
                    onChange={(e) => setFormState({ ...formState, accuracy_class: e.target.value })}
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                  >
                    <option value="E1">Class E1 (Primary National Standard)</option>
                    <option value="E2">Class E2 (High Precision Metrology)</option>
                    <option value="F1">Class F1 (Laboratory Working Standards)</option>
                    <option value="F2">Class F2 (Industrial Calibration Standards)</option>
                    <option value="M1">Class M1 (Commercial & Field Weights)</option>
                    <option value="M2">Class M2 (Heavy Capacity Weights)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                  CERTIFICATE NUMBER *
                </label>
                <input
                  type="text"
                  required
                  value={formState.certificate_number}
                  onChange={(e) => setFormState({ ...formState, certificate_number: e.target.value })}
                  placeholder="e.g. NPL/MASS/2026/C-4890"
                  className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                  CALIBRATED BY (ACCREDITED BODY) *
                </label>
                <input
                  type="text"
                  required
                  value={formState.calibrated_by}
                  onChange={(e) => setFormState({ ...formState, calibrated_by: e.target.value })}
                  placeholder="e.g. National Physical Laboratory (NPL India)"
                  className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    CALIBRATION DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.calibration_date}
                    onChange={(e) => setFormState({ ...formState, calibration_date: e.target.value })}
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    EXPIRY DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.expiry_date}
                    onChange={(e) => setFormState({ ...formState, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    NOMINAL RANGE
                  </label>
                  <input
                    type="text"
                    value={formState.nominal_range}
                    onChange={(e) => setFormState({ ...formState, nominal_range: e.target.value })}
                    placeholder="e.g. 1 mg to 20 kg"
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                    EXPANDED UNCERTAINTY (k=2) [g]
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formState.expanded_uncertainty_k2}
                    onChange={(e) => setFormState({ ...formState, expanded_uncertainty_k2: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00005"
                    className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-editorial-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-editorial-border text-xs font-mono uppercase tracking-wider text-ink-700 hover:bg-alabaster-100 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-editorial transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'REGISTERING...' : 'REGISTER STANDARD SET'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
