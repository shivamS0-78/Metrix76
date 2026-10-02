'use client';

import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  TestPlan,
  TestPlanItem,
  TestPlanDiff,
  TestPlanIssue,
  InstrumentMeta,
  ReferenceStandard
} from '@/types/metrology';

interface TestPlanPanelProps {
  plan: TestPlan | null;
  loading: boolean;
  error: string | null;
  instrument: InstrumentMeta;
  referenceStandard: ReferenceStandard | null;
  onGenerate: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onSelectTest: (testType: string) => void;
  onAcceptPlan: () => void;
  diff?: TestPlanDiff | null;
}

export const TestPlanPanel: React.FC<TestPlanPanelProps> = ({
  plan,
  loading,
  error,
  instrument,
  referenceStandard,
  onGenerate,
  onRegenerate,
  onSelectTest,
  onAcceptPlan,
  diff,
}) => {
  const [showDiff, setShowDiff] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const getStatusBadge = (item: TestPlanItem) => {
    switch (item.execution_status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-ink-950 text-white flex items-center gap-1 border border-ink-950">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            COMPLETED
          </span>
        );
      case 'READY':
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            READY
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1">
            <Ban className="w-3 h-3 text-rose-600" />
            BLOCKED
          </span>
        );
      case 'RUNNING':
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-600" />
            IN PROGRESS
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            NOT CONFIGURED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-alabaster-100 text-ink-600 border border-editorial-border">
            {item.execution_status}
          </span>
        );
    }
  };

  const getProcedureSummary = (item: TestPlanItem) => {
    const config = item.procedure_config as Record<string, any>;
    if (!config) return null;

    if (item.test_type === 'WEIGHING' && Array.isArray(config.load_points)) {
      return (
        <div className="text-[11px] font-mono text-ink-600 space-y-1">
          <div>
            <strong className="text-ink-950 font-bold">Recommended Load Points:</strong>{' '}
            {config.load_points.map((p: any) => `${p.label} (${p.nominal_kg} kg)`).join(', ')}
          </div>
          <div>Directions: Increasing & Decreasing • Turning-Point Delta: 0.1d</div>
        </div>
      );
    }

    if (item.test_type === 'REPEATABILITY' && Array.isArray(config.series)) {
      return (
        <div className="text-[11px] font-mono text-ink-600 space-y-1">
          <div>
            <strong className="text-ink-950 font-bold">Series Layout:</strong>{' '}
            {config.series.map((s: any) => `${s.label} (${s.nominal_load} kg × ${s.runs} runs)`).join(', ')}
          </div>
          <div>Acceptance: Absolute difference ≤ |MPE| (OIML R 76-1:2006 3.6.1)</div>
        </div>
      );
    }

    if (item.test_type === 'ECCENTRICITY' && Array.isArray(config.positions)) {
      return (
        <div className="text-[11px] font-mono text-ink-600 space-y-1">
          <div>
            <strong className="text-ink-950 font-bold">Corner Load:</strong> {config.load_fraction || '1/3'} Max ({config.load_kg ?? (instrument.max_capacity / 3).toFixed(2)} kg)
          </div>
          <div>Positions: {config.positions.join(', ')}</div>
        </div>
      );
    }

    if (item.test_type === 'TARE_ZERO') {
      return (
        <div className="text-[11px] font-mono text-ink-600 space-y-1">
          <div>
            <strong className="text-ink-950 font-bold">Checkpoints:</strong> Zero-Setting, Zero-Tracking, Tare Balancing
          </div>
          <div>Maximum Permissible Deviation: 0.25e ({(0.25 * instrument.verification_interval_e).toFixed(4)} kg)</div>
        </div>
      );
    }

    return null;
  };

  const getRequiredStandardsDisplay = (standards: Record<string, unknown> | null | undefined): string => {
    if (!standards || Object.keys(standards).length === 0) return 'STANDARD TEST WEIGHTS';
    if (Array.isArray(standards)) {
      return (standards as string[]).join(', ');
    }
    const parts = Object.entries(standards).map(([k, v]) => `${k.replace('_', ' ')}: ${String(v)}`);
    return parts.length > 0 ? parts.join(' • ') : 'STANDARD TEST WEIGHTS';
  };

  const completedCount = plan?.items?.filter((i) => i.execution_status === 'COMPLETED').length ?? 0;
  const applicableCount = plan?.items?.filter((i) => i.applicable && i.configured).length ?? 0;
  const isStale = plan?.status === 'STALE';
  const isBlocked = plan?.items?.some((i) => i.execution_status === 'BLOCKED') ?? false;

  return (
    <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-editorial-border gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-widest bg-ink-950 text-white uppercase">
              OIML R 76-1:2006
            </span>
            <span className="text-[11px] font-mono text-ink-500 uppercase tracking-wider">
              DETERMINISTIC TEST PLAN GENERATOR
            </span>
          </div>
          <h2 className="font-display font-black text-xl uppercase text-ink-950 tracking-tight mt-1">
            AUTOMATIC OIML TEST PLAN
          </h2>
          <p className="text-xs font-mono text-ink-500 uppercase tracking-wider mt-0.5">
            Rule engine evaluated test applicability, prerequisites, and standards traceability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {plan && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="px-4 py-2 bg-alabaster-50 hover:bg-alabaster-100 border border-editorial-border text-ink-800 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              REGENERATE PLAN
            </button>
          )}

          {!plan && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="px-5 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-editorial transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {loading ? 'GENERATING...' : 'GENERATE TEST PLAN'}
            </button>
          )}
        </div>
      </div>

      {/* Staleness Banner */}
      {isStale && (
        <div className="border-2 border-amber-600 bg-amber-50 p-4 text-xs font-mono text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm tracking-wide uppercase text-amber-950">
                ⚠ TEST PLAN IS STALE
              </div>
              <p className="text-[11px] mt-0.5 text-amber-800">
                Instrument configuration was modified after this plan was generated. The test parameters, load points, or applicability may have changed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono font-bold uppercase tracking-wider shrink-0 transition-colors shadow-sm cursor-pointer"
          >
            {loading ? 'REGENERATING...' : 'REGENERATE TEST PLAN NOW'}
          </button>
        </div>
      )}

      {/* Plan Regeneration Diff View */}
      {diff && (diff.has_changes || diff.added_tests.length > 0 || diff.removed_tests.length > 0 || diff.modified_tests.length > 0) && (
        <div className="border border-editorial-border bg-alabaster-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-xs uppercase text-ink-950 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-ink-700" />
              PLAN MODIFICATIONS DETECTED (DIFF)
            </span>
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="text-[10px] font-mono font-bold text-ink-600 uppercase underline cursor-pointer"
            >
              {showDiff ? 'HIDE DIFF DETAILS' : 'VIEW DIFF DETAILS'}
            </button>
          </div>
          {showDiff && (
            <div className="text-xs font-mono bg-white p-3 border border-editorial-border space-y-2">
              {diff.added_tests.length > 0 && (
                <div className="text-emerald-700">
                  + Added Tests: {diff.added_tests.join(', ')}
                </div>
              )}
              {diff.removed_tests.length > 0 && (
                <div className="text-rose-700">
                  - Removed Tests: {diff.removed_tests.join(', ')}
                </div>
              )}
              {diff.modified_tests.map((mod, idx) => (
                <div key={idx} className="text-ink-800 border-t border-editorial-border pt-1">
                  ~ Modified Test: {mod}
                </div>
              ))}
              {diff.changed_reasons.map((reason, idx) => (
                <div key={`reason-${idx}`} className="text-amber-800 text-[11px]">
                  • {reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error or Invalid Notice */}
      {error && (
        <div className="border border-rose-300 bg-rose-50 p-4 text-xs font-mono text-rose-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold uppercase text-sm">TEST PLAN COULD NOT BE GENERATED</div>
            <p className="mt-1 text-[11px]">{error}</p>
          </div>
        </div>
      )}

      {/* Active Instrument Snapshot */}
      <div className="bg-alabaster-50 border border-editorial-border p-4 text-xs font-mono">
        <div className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-2">
          EVALUATED INSTRUMENT SPECIFICATION
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">ACCURACY CLASS</span>
            <strong className="text-ink-950 font-bold">{instrument.accuracy_class}</strong>
          </div>
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">MAX CAPACITY</span>
            <strong className="text-ink-950 font-bold">{instrument.max_capacity} {instrument.unit}</strong>
          </div>
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">MIN CAPACITY</span>
            <strong className="text-ink-950 font-bold">{instrument.min_capacity} {instrument.unit}</strong>
          </div>
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">SCALE INTERVAL d</span>
            <strong className="text-ink-950 font-bold">{instrument.scale_interval_d} {instrument.unit}</strong>
          </div>
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">VERIFICATION e</span>
            <strong className="text-ink-950 font-bold">{instrument.verification_interval_e} {instrument.unit}</strong>
          </div>
          <div>
            <span className="text-[9px] text-ink-400 uppercase block">RESOLUTION n (Max/e)</span>
            <strong className="text-ink-950 font-bold">
              {instrument.verification_interval_e > 0
                ? Math.round(instrument.max_capacity / instrument.verification_interval_e).toLocaleString()
                : '—'}
            </strong>
          </div>
        </div>

        {plan && (
          <div className="mt-3 pt-3 border-t border-editorial-border flex flex-wrap items-center justify-between text-[10px] text-ink-500 gap-2">
            <div>
              RULE SET: <strong className="text-ink-900">{plan.rule_set_version}</strong> • GENERATOR:{' '}
              <strong className="text-ink-900">{plan.generator_version}</strong>
            </div>
            <div>
              PLAN ID: <span className="font-mono">{plan.id.slice(0, 8)}...</span> • GENERATED:{' '}
              {new Date(plan.generated_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Progress & Acceptance Banner */}
      {plan && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-editorial-border p-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase text-ink-950">
                PLAN EXECUTION PROGRESS:
              </span>
              <span className="text-xs font-mono font-black text-ink-950">
                {completedCount} / {applicableCount} PROCEDURES COMPLETED
              </span>
            </div>
            <div className="w-full sm:w-64 h-2 bg-alabaster-200 border border-editorial-border overflow-hidden">
              <div
                className="h-full bg-ink-950 transition-all duration-300"
                style={{
                  width: `${applicableCount > 0 ? (completedCount / applicableCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAcceptPlan}
              disabled={isBlocked || isStale}
              className="px-6 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-editorial transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>ACCEPT & PROCEED TO WORKSHEETS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Ordered Test Procedure Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-editorial-border">
          <h3 className="font-display font-bold text-sm uppercase text-ink-950 tracking-wider">
            ORDERED STATUTORY TEST PROCEDURES
          </h3>
          <span className="text-[10px] font-mono text-ink-500 uppercase">
            {plan?.items?.length || 0} TOTAL PROCEDURES DETERMINED
          </span>
        </div>

        {!plan && !loading && (
          <div className="border border-dashed border-editorial-border p-8 text-center space-y-3">
            <p className="font-mono text-xs text-ink-500 uppercase">
              No active test plan generated for this report draft.
            </p>
            <button
              type="button"
              onClick={onGenerate}
              className="px-5 py-2 bg-ink-950 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
            >
              GENERATE TEST PLAN
            </button>
          </div>
        )}

        {plan?.items?.map((item) => {
          const isExpanded = expandedItem === item.id;
          const blocked = item.execution_status === 'BLOCKED';
          const notConfigured = item.execution_status === 'NOT_CONFIGURED';

          return (
            <div
              key={item.id}
              className={`border transition-all ${
                blocked
                  ? 'border-rose-400 bg-rose-50/20'
                  : notConfigured
                  ? 'border-neutral-300 bg-neutral-50/50'
                  : item.execution_status === 'COMPLETED'
                  ? 'border-ink-950 bg-white'
                  : 'border-editorial-border bg-white'
              }`}
            >
              {/* Header row */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 shrink-0 bg-alabaster-100 border border-editorial-border flex items-center justify-center font-display font-black text-sm text-ink-950">
                    {String(item.sequence_order).padStart(2, '0')}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display font-bold text-sm uppercase text-ink-950 tracking-wide">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-mono text-ink-500 bg-alabaster-100 px-2 py-0.5 border border-editorial-border">
                        {item.standard_reference}
                      </span>
                    </div>

                    <p className="text-xs text-ink-600 mt-1 max-w-2xl font-serif">
                      {item.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono text-ink-500 uppercase">
                      <span>
                        PREREQUISITES:{' '}
                        <strong className="text-ink-900">
                          {item.prerequisites && item.prerequisites.length > 0
                            ? item.prerequisites.join(', ')
                            : 'NONE'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        REQUIRED STANDARDS:{' '}
                        <strong className="text-ink-900">
                          {getRequiredStandardsDisplay(item.required_standards)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                  {getStatusBadge(item)}

                  {item.configured && item.applicable && (
                    <button
                      type="button"
                      onClick={() => onSelectTest(item.test_type)}
                      disabled={blocked}
                      className="px-4 py-1.5 bg-ink-950 hover:bg-neutral-800 text-white text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>OPEN TEST</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Blocked alert reason */}
              {blocked && item.blocked_reason && (
                <div className="mx-4 sm:mx-5 mb-4 p-3 bg-rose-50 border border-rose-300 text-xs font-mono text-rose-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>BLOCKED REASON:</strong> {item.blocked_reason}
                  </div>
                </div>
              )}

              {/* Not configured notice */}
              {notConfigured && (
                <div className="mx-4 sm:mx-5 mb-4 p-3 bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                  <div>
                    This procedure is not configured for the current rule set. Statutory verification requires configuration before execution.
                  </div>
                </div>
              )}

              {/* Procedure parameters preview */}
              {item.configured && (
                <div className="px-4 sm:px-5 py-3 bg-alabaster-50 border-t border-editorial-border flex flex-col md:flex-row md:items-center justify-between gap-2">
                  {getProcedureSummary(item)}

                  <button
                    type="button"
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    className="text-[10px] font-mono text-ink-500 hover:text-ink-950 uppercase flex items-center gap-1 cursor-pointer self-start md:self-auto"
                  >
                    <span>{isExpanded ? 'LESS DETAILS' : 'VIEW SCHEMA DETAILS'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Schema JSON details when expanded */}
              {isExpanded && (
                <div className="p-4 bg-alabaster-100 border-t border-editorial-border font-mono text-[11px] text-ink-800 overflow-x-auto">
                  <div className="text-[10px] font-bold text-ink-500 uppercase mb-1">
                    OBSERVATION SCHEMA & PROCEDURE CONFIGURATION
                  </div>
                  <pre className="p-3 bg-white border border-editorial-border rounded text-[10px]">
                    {JSON.stringify(
                      {
                        observation_schema: item.observation_schema,
                        procedure_config: item.procedure_config,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TestPlanPanel;
