'use client';

import React, { useEffect, useState } from 'react';
import { 
  Scale, 
  Plus, 
  CheckCircle2, 
  AlertOctagon, 
  Info, 
  ShieldCheck, 
  X, 
  Save, 
  Layers, 
  Sparkles, 
  Building, 
  Tag, 
  Hash 
} from 'lucide-react';
import { listInstruments, validateInstrumentSanity, createInstrument } from '@/lib/api';
import { Instrument, InstrumentMeta, SanityCheckResult, AccuracyClass } from '@/types/metrology';

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form state for creating a new instrument
  const [formState, setFormState] = useState({
    serial_number: '',
    model_name: '',
    manufacturer_name: '',
    accuracy_class: 'CLASS_III' as AccuracyClass,
    max_capacity: 15.0,
    min_capacity: 0.1,
    scale_interval_d: 0.002,
    verification_interval_e: 0.002,
    unit: 'kg',
    load_receptor_type: 'Platform (Single Load Cell)',
    indicator_make_model: '',
    year_of_manufacture: new Date().getFullYear(),
  });

  const [formSanity, setFormSanity] = useState<SanityCheckResult | null>(null);

  // Sandbox state
  const [sandboxSpec, setSandboxSpec] = useState<InstrumentMeta>({
    accuracy_class: 'CLASS_III',
    max_capacity: 15.0,
    min_capacity: 0.1,
    scale_interval_d: 0.002,
    verification_interval_e: 0.002,
    unit: 'kg',
  });
  const [sandboxSanity, setSandboxSanity] = useState<SanityCheckResult | null>(null);

  const fetchInstruments = () => {
    setLoadingList(true);
    listInstruments()
      .then((data) => {
        setInstruments(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load instrument list. Confirm the FastAPI backend is running.');
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    fetchInstruments();
  }, []);

  // Sandbox sanity validator
  useEffect(() => {
    validateInstrumentSanity(sandboxSpec)
      .then(setSandboxSanity)
      .catch(() => setSandboxSanity(null));
  }, [sandboxSpec]);

  // Form sanity validator
  useEffect(() => {
    const meta: InstrumentMeta = {
      accuracy_class: formState.accuracy_class,
      max_capacity: formState.max_capacity,
      min_capacity: formState.min_capacity,
      scale_interval_d: formState.scale_interval_d,
      verification_interval_e: formState.verification_interval_e,
      unit: formState.unit,
    };
    validateInstrumentSanity(meta)
      .then(setFormSanity)
      .catch(() => setFormSanity(null));
  }, [formState.accuracy_class, formState.max_capacity, formState.min_capacity, formState.scale_interval_d, formState.verification_interval_e, formState.unit]);

  const handleCreateInstrument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.serial_number || !formState.model_name || !formState.manufacturer_name) {
      alert('Please fill in Serial Number, Model Name, and Manufacturer.');
      return;
    }

    if (formSanity && !formSanity.is_valid) {
      alert('Cannot register instrument: OIML R 76 statutory sanity rules are violated.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createInstrument({
        ...formState,
        is_multi_interval: false,
      });
      setInstruments([created, ...instruments]);
      setShowModal(false);
      setSuccessToast(`Instrument Passport "${created.model_name} (${created.serial_number})" registered successfully!`);
      setTimeout(() => setSuccessToast(null), 5000);
      // Reset form
      setFormState({
        serial_number: '',
        model_name: '',
        manufacturer_name: '',
        accuracy_class: 'CLASS_III',
        max_capacity: 15.0,
        min_capacity: 0.1,
        scale_interval_d: 0.002,
        verification_interval_e: 0.002,
        unit: 'kg',
        load_receptor_type: 'Platform (Single Load Cell)',
        indicator_make_model: '',
        year_of_manufacture: new Date().getFullYear(),
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
              INSTRUMENT PASSPORTS
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              OIML R 76-1 CLAUSE 3
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1">
            STRUCTURAL METROLOGICAL METADATA • AUTOMATED INTERVAL SANITY (e ≥ d, n = Max/e)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-editorial cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>NEW INSTRUMENT PASSPORT</span>
        </button>
      </div>

      {successToast && (
        <div className="border border-emerald-300 bg-white p-4 text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 shadow-editorial">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className="border border-neutral-900 bg-neutral-900 text-white p-4 text-xs font-mono">
          <strong>SYSTEM NOTICE:</strong> {error}
        </div>
      )}

      {/* Sanity Engine Live Checker Sandbox (Jet Black Contrast Strip) */}
      <div className="bg-[#0A0A0A] text-white p-6 sm:p-8 border border-neutral-800 shadow-editorial space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="font-display font-bold text-base tracking-tight uppercase text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>STRUCTURAL SANITY VERIFICATION ENGINE (SANDBOX)</span>
            </h3>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
              Validates interval ratios (e ≥ d), total scale intervals (n = Max/e), and statutory limits.
            </p>
          </div>
          {sandboxSanity && (
            <span className={`px-3 py-1 text-[10px] font-mono font-bold tracking-widest uppercase border self-start sm:self-auto ${
              sandboxSanity.is_valid ? 'bg-white text-ink-950 border-white' : 'bg-neutral-900 text-rose-400 border-neutral-700'
            }`}>
              {sandboxSanity.is_valid ? 'SANITY PASSED' : 'SANITY VIOLATION'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
              ACCURACY CLASS
            </label>
            <select
              value={sandboxSpec.accuracy_class}
              onChange={(e) => setSandboxSpec({ ...sandboxSpec, accuracy_class: e.target.value as AccuracyClass })}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-full text-white font-mono text-xs outline-none focus:border-neutral-500"
            >
              <option value="CLASS_I">Class I (Special)</option>
              <option value="CLASS_II">Class II (High)</option>
              <option value="CLASS_III">Class III (Medium)</option>
              <option value="CLASS_IIII">Class IIII (Ordinary)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
              MAX CAPACITY [{sandboxSpec.unit}]
            </label>
            <input
              type="number"
              step="any"
              value={sandboxSpec.max_capacity}
              onChange={(e) => setSandboxSpec({ ...sandboxSpec, max_capacity: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-full text-white font-mono text-xs outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
              MIN CAPACITY [{sandboxSpec.unit}]
            </label>
            <input
              type="number"
              step="any"
              value={sandboxSpec.min_capacity}
              onChange={(e) => setSandboxSpec({ ...sandboxSpec, min_capacity: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-full text-white font-mono text-xs outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
              INTERVAL e [{sandboxSpec.unit}]
            </label>
            <input
              type="number"
              step="any"
              value={sandboxSpec.verification_interval_e}
              onChange={(e) => setSandboxSpec({ ...sandboxSpec, verification_interval_e: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-full text-white font-mono text-xs outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
              INTERVAL d [{sandboxSpec.unit}]
            </label>
            <input
              type="number"
              step="any"
              value={sandboxSpec.scale_interval_d}
              onChange={(e) => setSandboxSpec({ ...sandboxSpec, scale_interval_d: parseFloat(e.target.value) || 0 })}
              className="bg-neutral-900 border border-neutral-800 px-3 py-2 w-full text-white font-mono text-xs outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        {sandboxSanity && !sandboxSanity.is_valid && (
          <div className="bg-neutral-950 border border-neutral-800 p-4 text-xs font-mono space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-400">
              <AlertOctagon className="w-4 h-4" /> STATUTORY PARAMETER NON-COMPLIANCE:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px] mt-1">
              {sandboxSanity.issues.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Registered Instruments Table */}
      <div className="bg-white border border-editorial-border shadow-editorial overflow-hidden">
        <div className="p-4 border-b border-editorial-border flex items-center justify-between bg-alabaster-50">
          <span className="font-mono font-bold text-xs text-ink-900 uppercase tracking-widest">
            REGISTERED PHYSICAL INSTRUMENTS ({instruments.length})
          </span>
          {loadingList && <span className="text-xs font-mono text-ink-400">REFRESHING...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-alabaster-100 border-b border-editorial-border text-ink-900 font-mono font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">SERIAL NUMBER</th>
                <th className="p-4">MODEL / MAKE</th>
                <th className="p-4">MANUFACTURER</th>
                <th className="p-4">ACCURACY CLASS</th>
                <th className="p-4">CAPACITY (MAX / MIN)</th>
                <th className="p-4">INTERVALS (e / d)</th>
                <th className="p-4">DIVISIONS (n)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-editorial-border">
              {instruments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center font-mono text-xs text-ink-400">
                    No instruments registered yet. Click &quot;NEW INSTRUMENT PASSPORT&quot; to create one.
                  </td>
                </tr>
              ) : (
                instruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-alabaster-50 transition-colors">
                    <td className="p-4 font-bold font-mono text-ink-950">{inst.serial_number}</td>
                    <td className="p-4 font-bold text-ink-900">{inst.model_name}</td>
                    <td className="p-4 text-ink-700">{inst.manufacturer_name}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 font-mono text-[9px] font-bold bg-ink-950 text-white uppercase">
                        {inst.accuracy_class}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-ink-800">
                      {inst.max_capacity} {inst.unit} / {inst.min_capacity} {inst.unit}
                    </td>
                    <td className="p-4 font-mono text-ink-800">
                      e={inst.verification_interval_e} / d={inst.scale_interval_d}
                    </td>
                    <td className="p-4 font-mono font-bold text-ink-950">
                      {inst.calculated_n ? inst.calculated_n.toLocaleString() : (inst.max_capacity / inst.verification_interval_e).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog: New Instrument Passport */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-editorialLg border border-editorial-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-editorial-border bg-alabaster-50">
              <div>
                <h2 className="font-display font-bold text-lg text-ink-950 uppercase">
                  REGISTER INSTRUMENT PASSPORT
                </h2>
                <p className="text-[10px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">
                  STRUCTURAL METADATA CONFORMING TO OIML R 76-1 CLAUSE 3.1–3.4
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
            <form onSubmit={handleCreateInstrument} className="p-6 space-y-6">
              {/* Identification Section */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-editorial-border pb-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span>1. IDENTITY & MANUFACTURER DETAILS</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      SERIAL NUMBER *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.serial_number}
                      onChange={(e) => setFormState({ ...formState, serial_number: e.target.value })}
                      placeholder="e.g. SN-PB-2026-0042"
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      MODEL / BRAND NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.model_name}
                      onChange={(e) => setFormState({ ...formState, model_name: e.target.value })}
                      placeholder="e.g. PrecisionScale Pro-15"
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      MANUFACTURER NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.manufacturer_name}
                      onChange={(e) => setFormState({ ...formState, manufacturer_name: e.target.value })}
                      placeholder="e.g. Mettler Toledo India"
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>
                </div>
              </div>

              {/* Metrological Parameters Section */}
              <div className="space-y-4 pt-2">
                <h3 className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-editorial-border pb-2">
                  <Hash className="w-3.5 h-3.5" />
                  <span>2. METROLOGICAL SPECIFICATION & INTERVALS</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      ACCURACY CLASS
                    </label>
                    <select
                      value={formState.accuracy_class}
                      onChange={(e) => setFormState({ ...formState, accuracy_class: e.target.value as AccuracyClass })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    >
                      <option value="CLASS_I">Class I (Special)</option>
                      <option value="CLASS_II">Class II (High)</option>
                      <option value="CLASS_III">Class III (Medium)</option>
                      <option value="CLASS_IIII">Class IIII (Ordinary)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      UNITS OF MASS
                    </label>
                    <select
                      value={formState.unit}
                      onChange={(e) => setFormState({ ...formState, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    >
                      <option value="kg">Kilograms (kg)</option>
                      <option value="g">Grams (g)</option>
                      <option value="mg">Milligrams (mg)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      MAX CAPACITY (Max)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formState.max_capacity}
                      onChange={(e) => setFormState({ ...formState, max_capacity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      MIN CAPACITY (Min)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formState.min_capacity}
                      onChange={(e) => setFormState({ ...formState, min_capacity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      VERIFICATION INTERVAL (e)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formState.verification_interval_e}
                      onChange={(e) => setFormState({ ...formState, verification_interval_e: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest mb-1.5">
                      ACTUAL INTERVAL (d)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formState.scale_interval_d}
                      onChange={(e) => setFormState({ ...formState, scale_interval_d: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-alabaster-50 border border-editorial-border text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
                    />
                  </div>
                </div>
              </div>

              {/* Sanity Engine Status in Modal */}
              {formSanity && (
                <div className={`p-4 border text-xs font-mono ${
                  formSanity.is_valid
                    ? 'bg-alabaster-50 border-editorial-border text-ink-900'
                    : 'bg-white border-rose-400 text-rose-900'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 uppercase">
                      {formSanity.is_valid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertOctagon className="w-4 h-4 text-rose-600" />}
                      <span>{formSanity.is_valid ? 'OIML R 76 Sanity Check Passed' : 'OIML Sanity Check Failed'}</span>
                    </span>
                    <span className="text-[10px]">
                      n = {(formState.max_capacity / (formState.verification_interval_e || 1)).toLocaleString()} intervals
                    </span>
                  </div>
                  {!formSanity.is_valid && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700 mt-2">
                      {formSanity.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Modal Actions */}
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
                  disabled={submitting || (formSanity ? !formSanity.is_valid : false)}
                  className="bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-editorial transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'REGISTERING...' : 'SAVE & REGISTER PASSPORT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
