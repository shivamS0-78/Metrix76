'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Layers,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Save,
  ArrowRight,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Database,
  RefreshCw,
  Search,
  AlertTriangle,
  Info,
  Trash2
} from 'lucide-react';
import {
  Instrument,
  InstrumentMeta,
  WeighingPointInput,
  WeighingBatchResponse,
  EccentricityPointInput,
  EccentricityBatchResponse,
  ReferenceStandard,
  ReportObservationInput,
  FailureExplanation,
  FailureExplanationResponse,
  IntegrityVerificationResult,
  IntegrityEntry,
  TestPlan,
  TestPlanDiff,
  TestPlanItem
} from '@/types/metrology';
import {
  evaluateWeighingPoints,
  evaluateEccentricity,
  listReferenceStandards,
  listInstruments,
  createReportDraft,
  deleteReportDraft,
  getReportDetail,
  upsertReportObservations,
  submitReportForReview,
  getFailureExplanations,
  getIntegrityStatus,
  verifyReportIntegrity,
  getIntegrityEntries,
  simulateTamper,
  generateTestPlan,
  getTestPlan,
  regenerateTestPlan
} from '@/lib/api';
import { getMPE, evaluateWeighingClient } from '@/lib/metrology/r76';
import ToleranceChart from '@/components/worksheets/ToleranceChart';
import FailureDetailPanel from '@/components/worksheets/FailureDetailPanel';
import LedgerViewerModal from '@/components/integrity/LedgerViewerModal';
import TestPlanPanel from '@/components/test_plan/TestPlanPanel';
import { useAuth } from '@/lib/authContext';

const STORAGE_KEY = 'draft_evaluation_default';

const getDraftStorageKey = (reportId?: string | null) => (reportId ? `draft_evaluation_${reportId}` : STORAGE_KEY);

type AmbientSetupState = {
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  reference_standard: string;
};

const defaultAmbientSetup: AmbientSetupState = {
  temperature_c: 22.5,
  humidity_pct: 55,
  pressure_hpa: 1013.25,
  reference_standard: 'NPL-E2-SET-04',
};

type WorksheetTab = 'A_WEIGHING' | 'B_REPEATABILITY' | 'C_ECCENTRICITY' | 'D_TARE_ZERO';
type CellField = 'direction' | 'load_applied' | 'indication_observed' | 'delta_load';

const createEmptyPoint = (): WeighingPointInput => ({
  load_applied: 0,
  indication_observed: 0,
  delta_load: 0,
  direction: 'INCREASING',
});

const defaultPoints: WeighingPointInput[] = [
  { load_applied: 0.0, indication_observed: 0.0, delta_load: 0.001, direction: 'INCREASING' },
  { load_applied: 1.0, indication_observed: 1.0, delta_load: 0.001, direction: 'INCREASING' },
  { load_applied: 5.0, indication_observed: 5.0, delta_load: 0.001, direction: 'INCREASING' },
  { load_applied: 10.0, indication_observed: 9.998, delta_load: 0.001, direction: 'INCREASING' },
  { load_applied: 15.0, indication_observed: 15.001, delta_load: 0.001, direction: 'INCREASING' },
  { load_applied: 10.0, indication_observed: 10.0, delta_load: 0.001, direction: 'DECREASING' },
  { load_applied: 5.0, indication_observed: 5.0, delta_load: 0.001, direction: 'DECREASING' },
  { load_applied: 0.0, indication_observed: 0.0, delta_load: 0.001, direction: 'DECREASING' },
];

const defaultEccentricityPoints: EccentricityPointInput[] = [
  { position_tag: 'CENTER', load_applied: 5.0, indication_observed: 5.000, delta_load: 0.001 },
  { position_tag: 'TOP_LEFT', load_applied: 5.0, indication_observed: 5.002, delta_load: 0.001 },
  { position_tag: 'TOP_RIGHT', load_applied: 5.0, indication_observed: 4.998, delta_load: 0.001 },
  { position_tag: 'BOTTOM_RIGHT', load_applied: 5.0, indication_observed: 5.001, delta_load: 0.001 },
  { position_tag: 'BOTTOM_LEFT', load_applied: 5.0, indication_observed: 4.999, delta_load: 0.001 },
];

const fieldOrder: CellField[] = ['direction', 'load_applied', 'indication_observed', 'delta_load'];

const eccentricityLayout: Record<string, { x: number; y: number }> = {
  CENTER: { x: 110, y: 110 },
  TOP_LEFT: { x: 52, y: 52 },
  TOP_RIGHT: { x: 168, y: 52 },
  BOTTOM_RIGHT: { x: 168, y: 168 },
  BOTTOM_LEFT: { x: 52, y: 168 },
};

type RepeatabilitySeriesState = {
  id: string;
  label: string;
  nominalLoad: number;
  readings: number[];
};

const createRepeatabilitySeries = (maxCapacity: number): RepeatabilitySeriesState[] => [
  {
    id: 'A',
    label: 'Series A',
    nominalLoad: maxCapacity * 0.5,
    readings: [0.011, 0.009, 0.012, 0.010, 0.011, 0.013, 0.009, 0.010, 0.012, 0.010],
  },
  {
    id: 'B',
    label: 'Series B',
    nominalLoad: maxCapacity * 1.0,
    readings: [0.024, 0.022, 0.025, 0.023, 0.024, 0.026, 0.022, 0.023, 0.024, 0.025],
  },
  {
    id: 'C',
    label: 'Series C',
    nominalLoad: maxCapacity * 0.5,
    readings: [0.010, 0.011, 0.009, 0.010, 0.012, 0.011, 0.010, 0.009, 0.011, 0.010],
  },
];

const getSampleStandardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
};

const evaluateRepeatabilitySeries = (series: RepeatabilitySeriesState, instrument: InstrumentMeta) => {
  const pMax = Math.max(...series.readings);
  const pMin = Math.min(...series.readings);
  const deltaI = pMax - pMin;
  const standardDeviation = getSampleStandardDeviation(series.readings);
  const mpeAllowed = Math.abs(getMPE(series.nominalLoad, instrument));
  const isCompliant = deltaI <= mpeAllowed + 1e-9;

  return {
    pMax,
    pMin,
    deltaI,
    standardDeviation,
    mpeAllowed,
    isCompliant,
  };
};

export default function EvaluationsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<WorksheetTab>('A_WEIGHING');
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

  const [reportId, setReportId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;

    try {
      const urlParam = new URLSearchParams(window.location.search).get('reportId');
      if (urlParam) return urlParam;

      const stored = window.localStorage.getItem('metrix76_active_report_id');
      if (stored) return stored;

      const generic = window.localStorage.getItem(STORAGE_KEY);
      if (!generic) return null;
      const parsed = JSON.parse(generic);
      return parsed?.reportId ?? null;
    } catch (error) {
      console.warn('Failed to load saved report ID from draft:', error);
      return null;
    }
  });

  const [loadedReportNumber, setLoadedReportNumber] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [draftSavedToast, setDraftSavedToast] = useState<string | null>(null);

  const readSavedDraft = (draftId: string | null = reportId) => {
    if (typeof window === 'undefined') return null;

    try {
      const preferredKey = getDraftStorageKey(draftId);
      const saved = window.localStorage.getItem(preferredKey) ?? window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (error) {
      console.warn('Failed to load saved draft:', error);
    }

    return null;
  };

  const savedDraft = readSavedDraft();

  const [instrument, setInstrument] = useState<InstrumentMeta>(() => ({
    accuracy_class: 'CLASS_III',
    max_capacity: 15.0,
    min_capacity: 0.1,
    scale_interval_d: 0.002,
    verification_interval_e: 0.002,
    unit: 'kg',
    ...(savedDraft?.instrument ?? {}),
  }));
  const [wizardStep, setWizardStep] = useState<number>(() => savedDraft?.wizardStep ?? 1);
  const [instrumentId, setInstrumentId] = useState<string>(() => savedDraft?.instrumentId ?? 'inst-001');
  const [availableInstruments, setAvailableInstruments] = useState<Instrument[]>([]);
  const [instrumentSourceMode, setInstrumentSourceMode] = useState<'REGISTERED' | 'CUSTOM'>(() => savedDraft?.instrumentSourceMode ?? 'REGISTERED');

  const handleSelectRegisteredInstrument = (id: string) => {
    setInstrumentId(id);
    const found = availableInstruments.find((inst) => inst.id === id);
    if (found) {
      setInstrument({
        accuracy_class: found.accuracy_class,
        max_capacity: Number(found.max_capacity),
        min_capacity: Number(found.min_capacity),
        scale_interval_d: Number(found.scale_interval_d),
        verification_interval_e: Number(found.verification_interval_e),
        unit: found.unit || 'kg',
        is_multi_interval: Boolean(found.is_multi_interval),
      });
    }
  };

  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [ambientSetup, setAmbientSetup] = useState<AmbientSetupState>(() => ({
    ...defaultAmbientSetup,
    ...(savedDraft?.ambientSetup ?? {}),
  }));
  const [referenceStandards, setReferenceStandards] = useState<ReferenceStandard[]>([]);

  const [points, setPoints] = useState<WeighingPointInput[]>(() => {
    if (Array.isArray(savedDraft?.points) && savedDraft.points.length > 0) {
      return savedDraft.points as WeighingPointInput[];
    }

    return defaultPoints;
  });

  const [evaluation, setEvaluation] = useState<WeighingBatchResponse | null>(null);
  const [repeatabilityData, setRepeatabilityData] = useState<RepeatabilitySeriesState[]>(() => {
    if (Array.isArray(savedDraft?.repeatabilityData) && savedDraft.repeatabilityData.length > 0) {
      return savedDraft.repeatabilityData as RepeatabilitySeriesState[];
    }
    return createRepeatabilitySeries(15);
  });
  const [eccentricityPoints, setEccentricityPoints] = useState<EccentricityPointInput[]>(() => {
    if (Array.isArray(savedDraft?.eccentricityPoints) && savedDraft.eccentricityPoints.length > 0) {
      return savedDraft.eccentricityPoints as EccentricityPointInput[];
    }
    return defaultEccentricityPoints;
  });
  const [eccentricityEvaluation, setEccentricityEvaluation] = useState<EccentricityBatchResponse | null>(null);
  const [activeEccentricityPosition, setActiveEccentricityPosition] = useState<string>('CENTER');
  type TareZeroState = {
    zeroSetting: number;
    zeroTracking: number;
    tareBalancing: number;
  };

  const [tareZeroState, setTareZeroState] = useState<TareZeroState>(() => ({
    zeroSetting: 0.000,
    zeroTracking: 0.000,
    tareBalancing: 0.000,
    ...(savedDraft?.tareZeroState ?? {}),
  }));
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitted'>('idle');

  // Feature 1: Clause-Level Failure Explanations
  const [failureData, setFailureData] = useState<FailureExplanationResponse | null>(null);
  const [selectedExplanation, setSelectedExplanation] = useState<FailureExplanation | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [loadingExplanations, setLoadingExplanations] = useState<boolean>(false);

  // Feature 2: Cryptographic Raw-Data Ledger
  const [integrityResult, setIntegrityResult] = useState<IntegrityVerificationResult | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<IntegrityEntry[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState<boolean>(false);

  // Feature 3: Automatic OIML Test Plan Generator
  const [testPlan, setTestPlan] = useState<TestPlan | null>(() => savedDraft?.testPlan ?? null);
  const [testPlanLoading, setTestPlanLoading] = useState<boolean>(false);
  const [testPlanError, setTestPlanError] = useState<string | null>(null);
  const [testPlanDiff, setTestPlanDiff] = useState<TestPlanDiff | null>(null);

  const isPlanStale = Boolean(
    testPlan &&
    testPlan.instrument_snapshot &&
    (
      testPlan.instrument_snapshot.accuracy_class !== instrument.accuracy_class ||
      Number(testPlan.instrument_snapshot.max_capacity) !== Number(instrument.max_capacity) ||
      Number(testPlan.instrument_snapshot.min_capacity) !== Number(instrument.min_capacity) ||
      Number(testPlan.instrument_snapshot.verification_interval_e) !== Number(instrument.verification_interval_e) ||
      Number(testPlan.instrument_snapshot.scale_interval_d) !== Number(instrument.scale_interval_d) ||
      testPlan.instrument_snapshot.unit !== instrument.unit
    )
  );

  const applyPlanLoadPoints = () => {
    const weighingItem = testPlan?.items.find((i) => i.test_type === 'WEIGHING');
    const config = weighingItem?.procedure_config as any;
    if (config && Array.isArray(config.load_points) && config.load_points.length > 0) {
      const inc: WeighingPointInput[] = config.load_points.map((p: any) => ({
        load_applied: p.nominal_kg,
        indication_observed: p.nominal_kg,
        delta_load: instrument.scale_interval_d * 0.1,
        direction: 'INCREASING',
      }));
      const dec: WeighingPointInput[] = [...config.load_points].reverse().map((p: any) => ({
        load_applied: p.nominal_kg,
        indication_observed: p.nominal_kg,
        delta_load: instrument.scale_interval_d * 0.1,
        direction: 'DECREASING',
      }));
      setPoints([...inc, ...dec]);
    }
  };

  const applyPlanEccentricity = () => {
    const eccItem = testPlan?.items.find((i) => i.test_type === 'ECCENTRICITY');
    const config = eccItem?.procedure_config as any;
    if (config && Array.isArray(config.positions)) {
      const cornerLoad = config.load_kg ?? Number((instrument.max_capacity / 3).toFixed(2));
      const pts: EccentricityPointInput[] = config.positions.map((pos: string) => ({
        position_tag: pos,
        load_applied: cornerLoad,
        indication_observed: cornerLoad,
        delta_load: instrument.scale_interval_d * 0.1,
      }));
      setEccentricityPoints(pts);
    }
  };

  const applyPlanRepeatability = () => {
    const repItem = testPlan?.items.find((i) => i.test_type === 'REPEATABILITY');
    const config = repItem?.procedure_config as any;
    if (config && Array.isArray(config.series)) {
      const seriesList: RepeatabilitySeriesState[] = config.series.map((s: any) => ({
        id: s.id,
        label: s.label,
        nominalLoad: s.nominal_load,
        readings: Array(s.runs || 10).fill(Number((s.nominal_load * 0.001).toFixed(4))),
      }));
      setRepeatabilityData(seriesList);
    }
  };

  const fetchDiagnostics = async (rId: string) => {
    try {
      setLoadingExplanations(true);
      const [expl, integ] = await Promise.allSettled([
        getFailureExplanations(rId),
        getIntegrityStatus(rId)
      ]);
      if (expl.status === 'fulfilled') {
        setFailureData(expl.value);
      }
      if (integ.status === 'fulfilled') {
        setIntegrityResult(integ.value);
      }
    } catch (e) {
      console.warn('Failed to load diagnostics:', e);
    } finally {
      setLoadingExplanations(false);
    }
  };

  const handleSaveDraftToDatabase = async (): Promise<string | null> => {
    setSavingDraft(true);
    const fallbackStandardId = referenceStandards.find((s) => s.set_identifier === ambientSetup.reference_standard)?.id ?? referenceStandards[0]?.id ?? 'std-001';
    try {
      let activeId = reportId;
      if (!activeId) {
        const draft = await createReportDraft({
          instrument_id: instrumentId,
          reference_standard_id: fallbackStandardId,
          ambient_temperature_celsius: ambientSetup.temperature_c,
          relative_humidity_pct: ambientSetup.humidity_pct,
          atmospheric_pressure_hpa: ambientSetup.pressure_hpa,
          technical_checklist: {
            level_indicator_present: true,
            zero_setting_operative: true,
            tare_device_operative: true,
            security_sealing_intact: true,
            audit_counter_value: 'AC-0001',
            notes: 'Explicit draft evaluation saved by tester'
          },
          conducted_by: user?.id
        });
        const validId: string = draft.id;
        activeId = validId;
        setReportId(validId);
        setLoadedReportNumber(draft.report_number);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('reportId', validId);
          window.history.replaceState({}, '', url.toString());
          window.localStorage.setItem('metrix76_active_report_id', validId);
        }
      }

      if (!activeId) return null;
      const targetId: string = activeId;

      const weighingObservations: ReportObservationInput[] = points.map((point, index) => ({
        test_type: 'WEIGHING',
        direction: point.direction,
        sequence_order: index + 1,
        load_applied: point.load_applied,
        indication_observed: point.indication_observed,
        delta_load: point.delta_load,
        position_tag: 'CENTER',
      }));

      const repeatabilityObservations: ReportObservationInput[] = repeatabilityData.flatMap((series, sIdx) =>
        series.readings.map((reading, rIdx) => ({
          test_type: 'REPEATABILITY' as const,
          direction: 'STATIC' as const,
          sequence_order: (sIdx + 1) * 100 + (rIdx + 1),
          load_applied: series.nominalLoad,
          indication_observed: reading,
          delta_load: 0,
          position_tag: 'CENTER',
          run_cycle: sIdx + 1,
        }))
      );

      const eccentricityObservations: ReportObservationInput[] = eccentricityPoints.map((point, index) => ({
        test_type: 'ECCENTRICITY' as const,
        direction: 'STATIC' as const,
        sequence_order: 1000 + (index + 1),
        load_applied: point.load_applied,
        indication_observed: point.indication_observed,
        delta_load: point.delta_load,
        position_tag: point.position_tag,
      }));

      const tareZeroObservations: ReportObservationInput[] = [
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2001,
          load_applied: 0,
          indication_observed: tareZeroState.zeroSetting,
          delta_load: 0,
          position_tag: 'ZERO_SETTING',
        },
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2002,
          load_applied: 0,
          indication_observed: tareZeroState.zeroTracking,
          delta_load: 0,
          position_tag: 'ZERO_TRACKING',
        },
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2003,
          load_applied: 0,
          indication_observed: tareZeroState.tareBalancing,
          delta_load: 0,
          position_tag: 'TARE_BALANCING',
        },
      ];

      await upsertReportObservations(targetId, {
        report_id: targetId,
        observations: [
          ...weighingObservations,
          ...repeatabilityObservations,
          ...eccentricityObservations,
          ...tareZeroObservations,
        ]
      });

      await fetchDiagnostics(targetId);
      try {
        const updatedPlan = await getTestPlan(targetId);
        if (updatedPlan?.plan) {
          setTestPlan(updatedPlan.plan);
        }
      } catch {
        // plan not yet generated
      }
      setDraftSavedToast(`Draft saved to database successfully!`);
      setTimeout(() => setDraftSavedToast(null), 4000);
      return targetId;
    } catch (e: any) {
      console.warn('Draft save failed:', e);
      alert(`Could not save draft: ${e.message || 'Server error'}`);
      return null;
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSyncToDraft = async (): Promise<string | null> => {
    if (!reportId) {
      // STRICT: Never auto-create draft in database unless tester clicked save
      return null;
    }
    return handleSaveDraftToDatabase();
  };

  const handleStartNewEvaluation = () => {
    if (confirm('Start a new blank evaluation? The active draft remains saved in the database work queue.')) {
      setReportId(null);
      setLoadedReportNumber(null);
      setTestPlan(null);
      setTestPlanDiff(null);
      setFailureData(null);
      setIntegrityResult(null);
      setPoints(defaultPoints);
      setRepeatabilityData(createRepeatabilitySeries(15));
      setEccentricityPoints(defaultEccentricityPoints);
      setWizardStep(1);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('metrix76_active_report_id');
        window.localStorage.removeItem(STORAGE_KEY);
        const url = new URL(window.location.href);
        url.searchParams.delete('reportId');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  };

  const [deletingActiveDraft, setDeletingActiveDraft] = useState<boolean>(false);

  const handleDeleteActiveDraft = async () => {
    if (!reportId) return;
    const name = loadedReportNumber || reportId;
    if (!confirm(`Are you sure you want to permanently delete draft "${name}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingActiveDraft(true);
    try {
      await deleteReportDraft(reportId);
      setDraftSavedToast(`Draft "${name}" deleted successfully.`);
      setTimeout(() => setDraftSavedToast(null), 4000);
      setReportId(null);
      setLoadedReportNumber(null);
      setTestPlan(null);
      setTestPlanDiff(null);
      setFailureData(null);
      setIntegrityResult(null);
      setPoints(defaultPoints);
      setRepeatabilityData(createRepeatabilitySeries(15));
      setEccentricityPoints(defaultEccentricityPoints);
      setWizardStep(1);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('metrix76_active_report_id');
        window.localStorage.removeItem(STORAGE_KEY);
        const url = new URL(window.location.href);
        url.searchParams.delete('reportId');
        window.history.replaceState({}, '', url.pathname);
      }
    } catch (e: any) {
      console.error('Failed to delete active draft:', e);
      alert(`Could not delete draft: ${e.message || 'Server error'}`);
    } finally {
      setDeletingActiveDraft(false);
    }
  };

  const fetchOrGeneratePlan = async (forceRegenerate: boolean = false) => {
    let activeId = reportId;
    if (!activeId) {
      // Tester explicitly clicked Generate Test Plan
      activeId = await handleSaveDraftToDatabase();
    }
    if (!activeId) {
      setTestPlanError('A valid report draft is required before generating an OIML test plan.');
      return;
    }

    setTestPlanLoading(true);
    setTestPlanError(null);
    try {
      if (forceRegenerate) {
        const res = await regenerateTestPlan(activeId);
        setTestPlan(res.plan);
        setTestPlanDiff(res.diff ?? null);
      } else {
        try {
          const existing = await getTestPlan(activeId);
          if (existing?.plan) {
            setTestPlan(existing.plan);
          }
          setTestPlanDiff(null);
        } catch {
          const generated = await generateTestPlan(activeId);
          setTestPlan(generated.plan);
          setTestPlanDiff(null);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to generate test plan';
      setTestPlanError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setTestPlanLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    let activeId = reportId;
    if (!activeId) {
      activeId = await handleSaveDraftToDatabase();
    }
    if (activeId) {
      try {
        setVerifyingIntegrity(true);
        const res = await verifyReportIntegrity(activeId);
        setIntegrityResult(res);
      } catch (e) {
        console.error('Integrity verification failed:', e);
      } finally {
        setVerifyingIntegrity(false);
      }
    }
  };

  const handleOpenLedger = async () => {
    let activeId = reportId;
    if (!activeId) {
      activeId = await handleSaveDraftToDatabase();
    }
    if (activeId) {
      try {
        const entries = await getIntegrityEntries(activeId);
        setLedgerEntries(entries);
        setIsLedgerOpen(true);
      } catch (e) {
        console.error('Failed to load ledger entries:', e);
      }
    }
  };

  // URL / Server Report Hydration
  useEffect(() => {
    if (!reportId) return;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('metrix76_active_report_id', reportId);
      const url = new URL(window.location.href);
      if (url.searchParams.get('reportId') !== reportId) {
        url.searchParams.set('reportId', reportId);
        window.history.replaceState({}, '', url.toString());
      }
    }

    let isMounted = true;
    getReportDetail(reportId)
      .then((detail) => {
        if (!isMounted || !detail) return;
        setLoadedReportNumber(detail.report_number || null);

        if (detail.instrument) {
          const inst = detail.instrument;
          setInstrumentId(inst.id || detail.instrument_id);
          setInstrument({
            accuracy_class: inst.accuracy_class,
            max_capacity: Number(inst.max_capacity),
            min_capacity: Number(inst.min_capacity),
            scale_interval_d: Number(inst.scale_interval_d),
            verification_interval_e: Number(inst.verification_interval_e),
            unit: inst.unit || 'kg',
            is_multi_interval: Boolean(inst.is_multi_interval),
          });
        }

        setAmbientSetup((prev) => ({
          ...prev,
          temperature_c: detail.ambient_temperature_celsius ?? prev.temperature_c,
          humidity_pct: detail.relative_humidity_pct ?? prev.humidity_pct,
          pressure_hpa: detail.atmospheric_pressure_hpa ?? prev.pressure_hpa,
          reference_standard: detail.reference_standard?.set_identifier ?? prev.reference_standard,
        }));

        if (Array.isArray(detail.test_observations) && detail.test_observations.length > 0) {
          const weighObs = detail.test_observations.filter((o: any) => o.test_type === 'WEIGHING');
          if (weighObs.length > 0) {
            setPoints(weighObs.map((o: any) => ({
              load_applied: Number(o.load_applied),
              indication_observed: Number(o.indication_observed),
              delta_load: Number(o.delta_load || 0),
              direction: o.direction || 'INCREASING',
            })));
          }

          const repObs = detail.test_observations.filter((o: any) => o.test_type === 'REPEATABILITY');
          if (repObs.length > 0) {
            const seriesMap: Record<number, number[]> = {};
            repObs.forEach((o: any) => {
              const cycle = o.run_cycle || 1;
              if (!seriesMap[cycle]) seriesMap[cycle] = [];
              seriesMap[cycle].push(Number(o.indication_observed));
            });
            const seriesList = Object.entries(seriesMap).map(([cycle, readings], idx) => ({
              id: `series-${cycle}`,
              label: `Series ${idx + 1} (${repObs[0]?.load_applied || 15} kg)`,
              nominalLoad: Number(repObs[0]?.load_applied || 15),
              readings: readings.length >= 10 ? readings : [...readings, ...Array(10 - readings.length).fill(0)],
            }));
            if (seriesList.length > 0) {
              setRepeatabilityData(seriesList);
            }
          }

          const eccObs = detail.test_observations.filter((o: any) => o.test_type === 'ECCENTRICITY');
          if (eccObs.length > 0) {
            setEccentricityPoints(eccObs.map((o: any) => ({
              position_tag: o.position_tag || 'CENTER',
              load_applied: Number(o.load_applied),
              indication_observed: Number(o.indication_observed),
              delta_load: Number(o.delta_load || 0),
            })));
          }
        }

        getTestPlan(reportId)
          .then((res) => {
            if (isMounted && res?.plan) {
              setTestPlan(res.plan);
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        console.warn(`Failed to hydrate draft report ${reportId}:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  useEffect(() => {
    if (wizardStep === 3) {
      if (reportId && !testPlan && !testPlanLoading) {
        fetchOrGeneratePlan(false);
      }
    } else if (wizardStep === 5) {
      if (reportId) {
        fetchDiagnostics(reportId);
      }
    }
  }, [wizardStep, reportId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const draftPayload = {
        instrument,
        ambientSetup,
        points,
        repeatabilityData,
        eccentricityPoints,
        tareZeroState,
        activeTab,
        wizardStep,
        instrumentId,
        instrumentSourceMode,
        reportId,
        testPlan,
        savedAt: new Date().toISOString(),
      };
      const storageKey = getDraftStorageKey(reportId);
      window.localStorage.setItem(storageKey, JSON.stringify(draftPayload));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftPayload));

      if (reportId) {
        window.localStorage.setItem('metrix76_active_report_id', reportId);
      }
    }
  }, [
    instrument,
    ambientSetup,
    points,
    repeatabilityData,
    eccentricityPoints,
    tareZeroState,
    activeTab,
    wizardStep,
    instrumentId,
    instrumentSourceMode,
    reportId,
    testPlan,
  ]);

  useEffect(() => {
    listInstruments()
      .then((instruments) => {
        setAvailableInstruments(instruments);
        if (instruments.length > 0) {
          const match = instruments.find((i) => i.id === instrumentId) ?? instruments[0];
          setInstrumentId(match.id);
          if (!savedDraft?.instrument) {
            setInstrument({
              accuracy_class: match.accuracy_class,
              max_capacity: Number(match.max_capacity),
              min_capacity: Number(match.min_capacity),
              scale_interval_d: Number(match.scale_interval_d),
              verification_interval_e: Number(match.verification_interval_e),
              unit: match.unit || 'kg',
              is_multi_interval: Boolean(match.is_multi_interval),
            });
          }
        }
      })
      .catch((error) => console.error('Instrument lookup error:', error));

    listReferenceStandards()
      .then((standards) => {
        setReferenceStandards(standards);
        const activeStandard = standards.find((standard) => standard.is_active && !standard.is_expired);
        if (activeStandard) {
          setAmbientSetup((prev) => {
            if (standards.some((standard) => standard.set_identifier === prev.reference_standard)) {
              return prev;
            }
            return { ...prev, reference_standard: activeStandard.set_identifier };
          });
        }
      })
      .catch((error) => console.error('Reference standards error:', error));
  }, []);

  useEffect(() => {
    let isCurrent = true;

    evaluateWeighingPoints(instrument, points)
      .then((data) => {
        if (isCurrent) setEvaluation(data);
      })
      .catch((err) => {
        console.warn('Backend evaluation API unavailable, using client-side engine:', err);
        if (isCurrent) {
          try {
            const clientResult = evaluateWeighingClient(instrument, points);
            setEvaluation(clientResult);
          } catch (evalError) {
            console.error('Client evaluation error:', evalError);
          }
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [points, instrument]);

  useEffect(() => {
    let isCurrent = true;

    evaluateEccentricity(instrument, eccentricityPoints)
      .then((data) => {
        if (isCurrent) setEccentricityEvaluation(data);
      })
      .catch((err) => {
        console.warn('Eccentricity evaluation API unavailable, using fallback calculation:', err);
        if (isCurrent) {
          const e = instrument.verification_interval_e;
          const recommendedLoad = Number((instrument.max_capacity / 3).toFixed(2));
          const centerPt = eccentricityPoints.find((p) => p.position_tag === 'CENTER') || eccentricityPoints[0];
          const e0 = centerPt ? (centerPt.indication_observed + 0.5 * e - centerPt.delta_load) - centerPt.load_applied : 0;
          let overallCompliant = true;
          const results = eccentricityPoints.map((pt) => {
            const p = pt.indication_observed + 0.5 * e - pt.delta_load;
            const ec = (p - pt.load_applied) - e0;
            const mpe = Math.abs(getMPE(pt.load_applied, instrument));
            const isCompliant = Math.abs(ec) <= mpe + 1e-9;
            if (!isCompliant) overallCompliant = false;
            return {
              position_tag: pt.position_tag,
              load_applied: pt.load_applied,
              indication_observed: pt.indication_observed,
              calculated_p: Number(p.toFixed(5)),
              corrected_error_ec: Number(ec.toFixed(5)),
              mpe_allowed: Number(mpe.toFixed(5)),
              is_compliant: isCompliant,
            };
          });
          setEccentricityEvaluation({
            recommended_load: recommendedLoad,
            zero_error_e0: Number(e0.toFixed(5)),
            results,
            overall_compliant: overallCompliant,
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [eccentricityPoints, instrument]);

  const focusCell = (rowIndex: number, field: CellField) => {
    const key = `${rowIndex}-${field}`;
    const element = inputRefs.current[key];
    if (!element) return;

    element.focus();
    if ('select' in element && typeof element.select === 'function') {
      element.select();
    }
  };

  const handleCellNavigation = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    field: CellField
  ) => {
    const currentFieldIndex = fieldOrder.indexOf(field);

    if (['Tab', 'Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();

      if (event.key === 'Tab') {
        const nextFieldIndex = event.shiftKey ? currentFieldIndex - 1 : currentFieldIndex + 1;

        if (nextFieldIndex >= 0 && nextFieldIndex < fieldOrder.length) {
          focusCell(rowIndex, fieldOrder[nextFieldIndex]);
          return;
        }

        if (event.shiftKey && rowIndex > 0) {
          focusCell(rowIndex - 1, 'delta_load');
          return;
        }

        if (!event.shiftKey && rowIndex < points.length - 1) {
          focusCell(rowIndex + 1, 'direction');
          return;
        }
      }

      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        const nextRow = Math.min(rowIndex + 1, points.length - 1);
        focusCell(nextRow, field);
        return;
      }

      if (event.key === 'ArrowUp') {
        const nextRow = Math.max(rowIndex - 1, 0);
        focusCell(nextRow, field);
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextFieldIndex = Math.min(
          Math.max(currentFieldIndex + direction, 0),
          fieldOrder.length - 1
        );
        focusCell(rowIndex, fieldOrder[nextFieldIndex]);
      }
    }
  };

  const updateCell = (index: number, field: keyof WeighingPointInput, val: string | number | 'INCREASING' | 'DECREASING' | 'STATIC') => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    const rows = text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length === 0) return;

    const parsed: WeighingPointInput[] = rows.flatMap((row) => {
      const cells = row
        .split(/\t|,|;/)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length === 0) return [];

      const normalized = cells.map((cell) => cell.replace(/[^0-9.+\-eE]/g, ''));
      const numericValues = normalized
        .filter((cell) => cell !== '' && !Number.isNaN(Number(cell)))
        .map((cell) => Number(cell));

      const directionText = cells.find((cell) => /increasing|decreasing|static/i.test(cell));
      const direction: WeighingPointInput['direction'] =
        directionText?.toUpperCase().includes('DECREASING')
          ? 'DECREASING'
          : directionText?.toUpperCase().includes('STATIC')
            ? 'STATIC'
            : 'INCREASING';

      const base = createEmptyPoint();
      const loadApplied = numericValues[0] ?? base.load_applied;
      const indicationObserved = numericValues[1] ?? base.indication_observed;
      const deltaLoad = numericValues[2] ?? base.delta_load;

      return [{
        ...base,
        load_applied: Number(loadApplied),
        indication_observed: Number(indicationObserved),
        delta_load: Number(deltaLoad),
        direction,
      }];
    });

    if (parsed.length > 0) {
      setPoints((prev) => {
        const merged = [...prev];
        const replacementCount = Math.min(parsed.length, merged.length);

        for (let index = 0; index < replacementCount; index += 1) {
          merged[index] = parsed[index];
        }

        if (parsed.length > replacementCount) {
          parsed.slice(replacementCount).forEach((point) => merged.push(point));
        }

        return merged;
      });
    }
  };

  const handleAddObservationStep = () => {
    setPoints((prev) => [...prev, createEmptyPoint()]);
  };

  const updateRepeatabilityReading = (seriesIndex: number, readingIndex: number, value: number) => {
    setRepeatabilityData((prev) =>
      prev.map((series, idx) => {
        if (idx !== seriesIndex) return series;

        return {
          ...series,
          readings: series.readings.map((reading, currentIndex) =>
            currentIndex === readingIndex ? value : reading
          ),
        };
      })
    );
  };

  const updateEccentricityPoint = (positionTag: string, field: keyof EccentricityPointInput, value: number) => {
    setEccentricityPoints((prev) =>
      prev.map((point) =>
        point.position_tag === positionTag ? { ...point, [field]: value } : point
      )
    );
  };

  const updateTareZeroField = (field: keyof typeof tareZeroState, value: number) => {
    setTareZeroState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForReview = async () => {
    const fallbackStandardId = referenceStandards.find((standard) => standard.set_identifier === ambientSetup.reference_standard)?.id ?? referenceStandards[0]?.id ?? 'std-001';

    try {
      const draftReport = reportId
        ? { id: reportId }
        : await createReportDraft({
            instrument_id: instrumentId,
            reference_standard_id: fallbackStandardId,
            ambient_temperature_celsius: ambientSetup.temperature_c,
            relative_humidity_pct: ambientSetup.humidity_pct,
            atmospheric_pressure_hpa: ambientSetup.pressure_hpa,
            technical_checklist: {
              level_indicator_present: true,
              zero_setting_operative: true,
              tare_device_operative: true,
              security_sealing_intact: true,
              audit_counter_value: 'AC-0001',
              notes: 'Created from technician evaluation workflow',
            },
            conducted_by: user?.id,
          });

      const activeReportId = draftReport.id;
      setReportId(activeReportId);

      const weighingObservations: ReportObservationInput[] = points.map((point, index) => ({
        test_type: 'WEIGHING',
        direction: point.direction,
        sequence_order: index + 1,
        load_applied: point.load_applied,
        indication_observed: point.indication_observed,
        delta_load: point.delta_load,
        position_tag: 'CENTER',
      }));

      const repeatabilityObservations: ReportObservationInput[] = repeatabilityData.flatMap((series, sIdx) =>
        series.readings.map((reading, rIdx) => ({
          test_type: 'REPEATABILITY' as const,
          direction: 'STATIC' as const,
          sequence_order: (sIdx + 1) * 100 + (rIdx + 1),
          load_applied: series.nominalLoad,
          indication_observed: reading,
          delta_load: 0,
          position_tag: 'CENTER',
          run_cycle: sIdx + 1,
        }))
      );

      const eccentricityObservations: ReportObservationInput[] = eccentricityPoints.map((point, index) => ({
        test_type: 'ECCENTRICITY' as const,
        direction: 'STATIC' as const,
        sequence_order: 1000 + (index + 1),
        load_applied: point.load_applied,
        indication_observed: point.indication_observed,
        delta_load: point.delta_load,
        position_tag: point.position_tag,
      }));

      const tareZeroObservations: ReportObservationInput[] = [
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2001,
          load_applied: 0,
          indication_observed: tareZeroState.zeroSetting,
          delta_load: 0,
          position_tag: 'ZERO_SETTING',
        },
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2002,
          load_applied: 0,
          indication_observed: tareZeroState.zeroTracking,
          delta_load: 0,
          position_tag: 'ZERO_TRACKING',
        },
        {
          test_type: 'TARE_ZERO' as const,
          direction: 'STATIC' as const,
          sequence_order: 2003,
          load_applied: 0,
          indication_observed: tareZeroState.tareBalancing,
          delta_load: 0,
          position_tag: 'TARE_BALANCING',
        },
      ];

      const observationRows: ReportObservationInput[] = [
        ...weighingObservations,
        ...repeatabilityObservations,
        ...eccentricityObservations,
        ...tareZeroObservations,
      ];

      await upsertReportObservations(activeReportId, {
        report_id: activeReportId,
        observations: observationRows,
      });

      const submitResult = await submitReportForReview(activeReportId);
      setSubmissionState('submitted');
      setSubmissionError(null);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`${STORAGE_KEY}_status`, 'PENDING_APPROVAL');
        window.localStorage.setItem(`${STORAGE_KEY}_report_id`, activeReportId);
      }

      console.info('Report submitted for review:', submitResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit the report for review';
      setSubmissionState('idle');
      setSubmissionError(message);
      console.error('Report submission failure:', error);
    }
  };

  const updateInstrumentField = <K extends keyof InstrumentMeta>(field: K, value: InstrumentMeta[K]) => {
    setInstrument((prev) => ({ ...prev, [field]: value }));
  };

  const zeroThreshold = 0.25 * instrument.verification_interval_e;
  const tareZeroResults = {
    zeroSetting: { value: Math.abs(tareZeroState.zeroSetting), limit: zeroThreshold, compliant: Math.abs(tareZeroState.zeroSetting) <= zeroThreshold },
    zeroTracking: { value: Math.abs(tareZeroState.zeroTracking), limit: zeroThreshold, compliant: Math.abs(tareZeroState.zeroTracking) <= zeroThreshold },
    tareBalancing: { value: Math.abs(tareZeroState.tareBalancing), limit: zeroThreshold, compliant: Math.abs(tareZeroState.tareBalancing) <= zeroThreshold },
  };
  const selectedStandard = referenceStandards.find((standard) => standard.set_identifier === ambientSetup.reference_standard) ?? null;
  const standardIsBlocked = !!selectedStandard && (selectedStandard.is_expired || !selectedStandard.is_active);

  const renderWizardStepContent = () => {
    if (wizardStep === 1) {
      const selectedRegistered = availableInstruments.find((i) => i.id === instrumentId) ?? null;

      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-border pb-4 gap-3">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">STEP 1 • INSTRUMENT PASSPORT</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Select a registered instrument passport from the vault or enter custom specifications.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-alabaster-50 p-1 border border-editorial-border">
              <button
                type="button"
                onClick={() => {
                  setInstrumentSourceMode('REGISTERED');
                  if (availableInstruments.length > 0) {
                    const match = availableInstruments.find((i) => i.id === instrumentId) ?? availableInstruments[0];
                    handleSelectRegisteredInstrument(match.id);
                  }
                }}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  instrumentSourceMode === 'REGISTERED'
                    ? 'bg-ink-950 text-white shadow-xs'
                    : 'text-ink-600 hover:text-ink-950'
                }`}
              >
                REGISTERED PASSPORT
              </button>
              <button
                type="button"
                onClick={() => setInstrumentSourceMode('CUSTOM')}
                className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  instrumentSourceMode === 'CUSTOM'
                    ? 'bg-ink-950 text-white shadow-xs'
                    : 'text-ink-600 hover:text-ink-950'
                }`}
              >
                CUSTOM / AD-HOC
              </button>
            </div>
          </div>

          {/* Draft Persistence Status & Action Bar */}
          <div className={`p-4 border text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            reportId ? 'bg-emerald-50/40 border-emerald-300' : 'bg-amber-50/50 border-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {reportId ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px] text-ink-950">
                  {reportId ? `ACTIVE DATABASE DRAFT: ${loadedReportNumber || reportId}` : 'LOCAL WORKSPACE (UNSAVED DRAFT)'}
                </span>
                <p className="text-[10px] text-ink-600 mt-0.5">
                  {reportId
                    ? 'This draft is officially registered in Supabase and appears in your Technical Testing Queue.'
                    : 'Unless you explicitly click "Save Draft To Database", no database record will be created.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {reportId ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveDraftToDatabase()}
                    disabled={savingDraft || deletingActiveDraft}
                    className="px-3 py-1.5 bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {savingDraft ? 'SYNCING...' : 'SYNC OBSERVATIONS'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteActiveDraft}
                    disabled={deletingActiveDraft}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-editorial-border hover:border-rose-300 text-rose-700 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                    title="Permanently delete active draft"
                  >
                    {deletingActiveDraft ? (
                      <span className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    <span>DELETE DRAFT</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNewEvaluation}
                    disabled={deletingActiveDraft}
                    className="px-3 py-1.5 bg-white hover:bg-alabaster-100 border border-editorial-border text-ink-900 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    + NEW EVALUATION
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSaveDraftToDatabase()}
                  disabled={savingDraft}
                  className="px-4 py-2 bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-editorial flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingDraft ? 'SAVING DRAFT...' : 'SAVE DRAFT TO DATABASE'}</span>
                </button>
              )}
            </div>
          </div>

          {instrumentSourceMode === 'REGISTERED' ? (
            <div className="bg-alabaster-50 border border-editorial-border p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[10px] font-mono font-bold text-ink-700 uppercase tracking-widest block">
                  CHOOSE REGISTERED INSTRUMENT FROM VAULT:
                </label>
                <Link
                  href="/instruments"
                  target="_blank"
                  className="text-[10px] font-mono font-bold text-ink-600 hover:text-ink-950 underline uppercase flex items-center gap-1"
                >
                  <span>+ OPEN INSTRUMENTS REGISTRY ↗</span>
                </Link>
              </div>

              <select
                value={instrumentId}
                onChange={(e) => handleSelectRegisteredInstrument(e.target.value)}
                className="w-full bg-white border border-editorial-border px-3.5 py-2.5 text-xs font-mono text-ink-950 outline-none focus:border-ink-950 font-bold"
              >
                {availableInstruments.length === 0 ? (
                  <option value="">Loading registered instruments from vault...</option>
                ) : (
                  availableInstruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.model_name} — {inst.manufacturer_name} (SN: {inst.serial_number}) • {inst.accuracy_class} • Max: {inst.max_capacity} {inst.unit}
                    </option>
                  ))
                )}
              </select>

              {selectedRegistered && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-[11px] font-mono text-ink-700 border-t border-editorial-border">
                  <div>
                    <span className="text-[9px] text-ink-400 uppercase block">MODEL & MAKE</span>
                    <strong className="text-ink-950 font-bold">{selectedRegistered.model_name} ({selectedRegistered.manufacturer_name})</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-ink-400 uppercase block">SERIAL NUMBER</span>
                    <strong className="text-ink-950 font-bold">{selectedRegistered.serial_number}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-ink-400 uppercase block">RESOLUTION n (Max/e)</span>
                    <strong className="text-ink-950 font-bold">
                      {selectedRegistered.calculated_n?.toLocaleString() ??
                        Math.round(selectedRegistered.max_capacity / selectedRegistered.verification_interval_e).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-ink-400 uppercase block">INTERVAL TYPE</span>
                    <strong className="text-ink-950 font-bold">{selectedRegistered.is_multi_interval ? 'Multi-Interval' : 'Single Interval'}</strong>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50/60 border border-amber-200 p-3 text-xs font-mono text-amber-900 flex items-center justify-between">
              <span><strong>CUSTOM SPECIFICATION MODE:</strong> You are entering ad-hoc scale parameters for testing without binding to a registered passport.</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              ACCURACY CLASS
              <select
                value={instrument.accuracy_class}
                onChange={(event) => updateInstrumentField('accuracy_class', event.target.value as InstrumentMeta['accuracy_class'])}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              >
                <option value="CLASS_I">CLASS_I</option>
                <option value="CLASS_II">CLASS_II</option>
                <option value="CLASS_III">CLASS_III</option>
                <option value="CLASS_IIII">CLASS_IIII</option>
              </select>
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              UNIT OF MEASUREMENT
              <input
                value={instrument.unit}
                onChange={(event) => updateInstrumentField('unit', event.target.value)}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              MAX CAPACITY ({instrument.unit})
              <input
                type="number"
                step="any"
                value={instrument.max_capacity}
                onChange={(event) => updateInstrumentField('max_capacity', Number(event.target.value) || 0)}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              MIN CAPACITY ({instrument.unit})
              <input
                type="number"
                step="any"
                value={instrument.min_capacity}
                onChange={(event) => updateInstrumentField('min_capacity', Number(event.target.value) || 0)}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              INTERVAL d ({instrument.unit})
              <input
                type="number"
                step="any"
                value={instrument.scale_interval_d}
                onChange={(event) => updateInstrumentField('scale_interval_d', Number(event.target.value) || 0)}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              VERIFICATION INTERVAL e ({instrument.unit})
              <input
                type="number"
                step="any"
                value={instrument.verification_interval_e}
                onChange={(event) => updateInstrumentField('verification_interval_e', Number(event.target.value) || 0)}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>
          </div>
        </div>
      );
    }

    if (wizardStep === 2) {
      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-5">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">STEP 2 • AMBIENT SETUP</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Record the exposure conditions and traceability reference before running worksheets.</p>
            </div>
          </div>

          {standardIsBlocked && (
            <div className="border border-neutral-900 bg-neutral-900 text-rose-400 p-4 text-xs font-mono">
              <strong>ISO 17025 GUARDRAIL:</strong> The selected reference standard is expired or inactive. Progression to worksheets is blocked until a valid set is chosen.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              TEMPERATURE (°C)
              <input
                type="number"
                step="any"
                value={ambientSetup.temperature_c}
                onChange={(event) => setAmbientSetup((prev) => ({ ...prev, temperature_c: Number(event.target.value) || 0 }))}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              RELATIVE HUMIDITY (%)
              <input
                type="number"
                step="any"
                value={ambientSetup.humidity_pct}
                onChange={(event) => setAmbientSetup((prev) => ({ ...prev, humidity_pct: Number(event.target.value) || 0 }))}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              ATMOSPHERIC PRESSURE (hPa)
              <input
                type="number"
                step="any"
                value={ambientSetup.pressure_hpa}
                onChange={(event) => setAmbientSetup((prev) => ({ ...prev, pressure_hpa: Number(event.target.value) || 0 }))}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              />
            </label>

            <label className="text-[10px] font-mono font-bold text-ink-600 uppercase tracking-widest">
              REFERENCE STANDARD SET
              <select
                value={ambientSetup.reference_standard}
                onChange={(event) => setAmbientSetup((prev) => ({ ...prev, reference_standard: event.target.value }))}
                className="mt-1.5 w-full bg-alabaster-50 border border-editorial-border px-3 py-2 text-xs font-mono text-ink-950 outline-none focus:border-ink-950"
              >
                {referenceStandards.length === 0 ? (
                  <option value="">Loading standards…</option>
                ) : (
                  referenceStandards.map((standard) => (
                    <option key={standard.id} value={standard.set_identifier}>
                      {standard.set_identifier} ({standard.is_expired ? 'EXPIRED' : standard.days_to_expiry + 'd left'})
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          {selectedStandard && (
            <div className="border border-editorial-border bg-alabaster-50 p-4 text-xs font-mono text-ink-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold uppercase">SELECTED REFERENCE STANDARD</span>
                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border ${
                  selectedStandard.is_expired || !selectedStandard.is_active
                    ? 'bg-neutral-900 text-rose-400 border-neutral-700'
                    : 'bg-white text-emerald-800 border-emerald-300'
                }`}>
                  {selectedStandard.is_expired || !selectedStandard.is_active ? 'BLOCKED' : 'VALID & TRACEABLE'}
                </span>
              </div>
              <div className="mt-2 font-bold text-ink-950">{selectedStandard.set_identifier}</div>
              <div className="mt-1 text-[11px] text-ink-500">EXPIRY: {selectedStandard.expiry_date} • {selectedStandard.days_to_expiry} DAYS REMAINING</div>
            </div>
          )}
        </div>
      );
    }

    if (wizardStep === 3) {
      const effectivePlan = testPlan
        ? {
            ...testPlan,
            status: isPlanStale ? ('STALE' as const) : testPlan.status,
          }
        : null;

      return (
        <div className="space-y-4">
          {!reportId && (
            <div className="bg-amber-50/70 border border-amber-300 p-4 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-editorial">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="text-amber-950 font-bold uppercase tracking-wider text-[11px] block">
                    WORKSPACE NOT YET SAVED AS DRAFT
                  </span>
                  <span className="text-ink-600 text-[10px]">
                    Clicking &quot;Generate Test Plan&quot; below will save an official evaluation draft in your Technical Testing Queue and configure OIML tests.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSaveDraftToDatabase()}
                disabled={savingDraft}
                className="px-3.5 py-1.5 bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 cursor-pointer shadow-xs"
              >
                {savingDraft ? 'SAVING...' : 'SAVE DRAFT NOW'}
              </button>
            </div>
          )}

          <TestPlanPanel
            plan={effectivePlan}
            loading={testPlanLoading}
            error={testPlanError}
            diff={testPlanDiff}
            instrument={instrument}
            referenceStandard={selectedStandard}
            onGenerate={() => fetchOrGeneratePlan(false)}
            onRegenerate={() => fetchOrGeneratePlan(true)}
            onSelectTest={(testType) => {
              if (testType === 'WEIGHING') setActiveTab('A_WEIGHING');
              else if (testType === 'REPEATABILITY') setActiveTab('B_REPEATABILITY');
              else if (testType === 'ECCENTRICITY') setActiveTab('C_ECCENTRICITY');
              else if (testType === 'TARE_ZERO') setActiveTab('D_TARE_ZERO');
              setWizardStep(4);
            }}
            onAcceptPlan={() => setWizardStep(4)}
          />
        </div>
      );
    }

    if (wizardStep === 4) {
      const defaultTabs: { key: WorksheetTab; label: string; clause: string }[] = [
        { key: 'A_WEIGHING', label: 'Weighing', clause: 'Clause A.4.4' },
        { key: 'B_REPEATABILITY', label: 'Repeatability', clause: 'Clause A.4.10' },
        { key: 'C_ECCENTRICITY', label: 'Eccentricity', clause: 'Clause A.4.7' },
        { key: 'D_TARE_ZERO', label: 'Tare & Zero', clause: 'Clauses A.4.2 & A.4.6' },
      ];

      return (
        <div className="space-y-6">
          <div className="bg-white p-3 border border-editorial-border flex flex-wrap gap-2 shadow-editorial items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {defaultTabs.map(({ key, label, clause }) => {
                const planItem = testPlan?.items?.find((i) => {
                  if (key === 'A_WEIGHING') return i.test_type === 'WEIGHING';
                  if (key === 'B_REPEATABILITY') return i.test_type === 'REPEATABILITY';
                  if (key === 'C_ECCENTRICITY') return i.test_type === 'ECCENTRICITY';
                  if (key === 'D_TARE_ZERO') return i.test_type === 'TARE_ZERO';
                  return false;
                });

                const isBlocked = planItem?.execution_status === 'BLOCKED';
                const isCompleted = planItem?.execution_status === 'COMPLETED';

                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                      activeTab === key
                        ? 'bg-ink-950 text-white shadow-editorial'
                        : 'bg-alabaster-50 border border-editorial-border text-ink-700 hover:bg-alabaster-100'
                    }`}
                  >
                    <span>{clause}: {label}</span>
                    {isCompleted && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Completed" />
                    )}
                    {isBlocked && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" title="Blocked" />
                    )}
                  </button>
                );
              })}
            </div>

            {testPlan && (
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="text-[11px] font-mono text-ink-500 hover:text-ink-950 uppercase flex items-center gap-1 border border-editorial-border px-3 py-1.5 bg-alabaster-50 hover:bg-alabaster-100 cursor-pointer"
              >
                <span>← VIEW TEST PLAN ({testPlan.items.filter((i) => i.execution_status === 'COMPLETED').length}/{testPlan.items.filter((i) => i.applicable).length} DONE)</span>
              </button>
            )}
          </div>

          {renderWorksheetShell()}
        </div>
      );
    }

    if (wizardStep === 5) {
      const isCompliant = evaluation?.overall_compliant && (!failureData || failureData.failed_observations === 0);

      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">STEP 5 • REVIEW SUMMARY</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Authoritative OIML R 76 evaluation verdict, test plan progress, clause failure analysis, and tamper-evident cryptographic evidence ledger.</p>
            </div>
            {submissionState === 'submitted' && (
              <span className="bg-ink-950 text-white px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider">
                PENDING APPROVAL
              </span>
            )}
          </div>

          {/* Test Plan Status & Progress Card */}
          {testPlan && (
            <div className="border border-editorial-border bg-alabaster-50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-editorial-border gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-ink-950" />
                  <span className="font-display font-bold text-xs uppercase text-ink-950 tracking-wider">
                    AUTOMATIC OIML TEST PLAN PROGRESS
                  </span>
                  <span className="text-[10px] font-mono text-ink-500 bg-white px-2 py-0.5 border border-editorial-border">
                    {testPlan.rule_set_version}
                  </span>
                </div>
                <div className="text-[10px] font-mono font-bold uppercase text-ink-900">
                  {testPlan.items.filter((i) => i.execution_status === 'COMPLETED').length} / {testPlan.items.filter((i) => i.applicable).length} PROCEDURES COMPLETED
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {testPlan.items.map((item) => (
                  <div key={item.id} className="bg-white border border-editorial-border p-2.5 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-ink-400 font-bold">{String(item.sequence_order).padStart(2, '0')}</span>
                      <span className={`px-1.5 py-0.2 uppercase text-[9px] font-bold border ${
                        item.execution_status === 'COMPLETED'
                          ? 'bg-ink-950 text-white border-ink-950'
                          : item.execution_status === 'READY'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : item.execution_status === 'BLOCKED'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                      }`}>
                        {item.execution_status}
                      </span>
                    </div>
                    <div className="font-bold text-ink-950 truncate uppercase text-[11px]">
                      {item.title}
                    </div>
                    <div className="text-[9px] text-ink-500 truncate">
                      {item.standard_reference}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overview Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-editorial-border p-4 bg-alabaster-50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-400">INSTRUMENT PASSPORT</div>
              <div className="mt-2 font-display font-bold text-lg text-ink-950">{instrument.accuracy_class}</div>
              <div className="text-xs font-mono text-ink-600">{instrument.max_capacity} kg max • e={instrument.verification_interval_e} kg</div>
            </div>

            <div className="border border-editorial-border p-4 bg-alabaster-50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-400">AMBIENT ENVIRONMENT</div>
              <div className="mt-2 font-display font-bold text-lg text-ink-950">{ambientSetup.temperature_c} °C</div>
              <div className="text-xs font-mono text-ink-600">{ambientSetup.humidity_pct}% RH • {ambientSetup.pressure_hpa} hPa</div>
            </div>

            <div className={`border p-4 ${isCompliant ? 'border-emerald-300 bg-emerald-50/40' : 'border-rose-300 bg-rose-50/40'}`}>
              <div className="text-[10px] font-mono uppercase tracking-widest text-ink-400">COMPLIANCE VERDICT</div>
              <div className={`mt-2 font-display font-bold text-lg ${isCompliant ? 'text-emerald-800' : 'text-rose-700'}`}>
                {isCompliant ? 'PASS • COMPLIANT' : 'FAIL • NON-COMPLIANT'}
              </div>
              <div className="text-xs font-mono text-ink-600">Standard: {ambientSetup.reference_standard}</div>
            </div>
          </div>

          {/* 1. Clause-Level Failure Explanation Section */}
          {!isCompliant ? (
            <div className="border border-rose-300 bg-rose-50/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <div>
                    <h4 className="font-display font-bold text-sm uppercase text-rose-950">
                      CLAUSE-LEVEL FAILURE EXPLANATION
                    </h4>
                    <p className="text-[10px] font-mono text-rose-700 uppercase tracking-wider mt-0.5">
                      {failureData
                        ? `${failureData.failed_tests} FAILED TEST MODULES • ${failureData.failed_observations} NON-COMPLIANT OBSERVATIONS`
                        : 'TEST EVALUATION EXCEEDS STATUTORY TOLERANCE LIMITS'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (reportId) fetchDiagnostics(reportId);
                    else handleSyncToDraft();
                  }}
                  disabled={loadingExplanations}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-white border border-rose-300 text-rose-800 px-3 py-1.5 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingExplanations ? 'animate-spin' : ''}`} />
                  <span>REFRESH DIAGNOSTICS</span>
                </button>
              </div>

              {/* Explanations List */}
              <div className="space-y-3">
                {failureData?.explanations && failureData.explanations.length > 0 ? (
                  failureData.explanations.map((expl) => (
                    <div key={expl.id} className="bg-white border border-rose-200 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-rose-950 uppercase font-mono">{expl.title}</span>
                            <span className="text-[9px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                              {expl.test_type}
                            </span>
                          </div>
                          <p className="text-xs text-ink-800 font-sans leading-relaxed">
                            {expl.summary}
                          </p>
                          <div className="text-[10px] font-mono text-ink-500">
                            Clause: <span className="font-bold">{expl.clause_reference || 'Applicable rule reference is not configured.'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExplanation(expl);
                            setIsDetailOpen(true);
                          }}
                          className="shrink-0 bg-ink-950 hover:bg-neutral-800 text-white text-[10px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 transition-colors cursor-pointer"
                        >
                          VIEW DETAILS
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white border border-rose-200 p-4 text-xs font-mono text-ink-600 flex items-center justify-between">
                    <span>Synchronizing authoritative observation calculations to extract clause explanations...</span>
                    <button
                      type="button"
                      onClick={() => handleSyncToDraft()}
                      className="text-[10px] font-mono font-bold uppercase underline text-rose-700"
                    >
                      SYNC NOW
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-emerald-300 bg-emerald-50/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="font-display font-bold text-xs uppercase text-emerald-950">COMPLIANCE CRITERIA MET (PASS)</h4>
                  <p className="text-[11px] font-mono text-emerald-800 mt-0.5">
                    All test observations fall strictly within statutory OIML R 76-1 Table 6 Maximum Permissible Error tolerances.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. Cryptographic Data Integrity Section */}
          <div className="border border-editorial-border bg-alabaster-50 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-editorial-border pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-ink-900" />
                <div>
                  <h4 className="font-display font-bold text-sm uppercase text-ink-950">
                    CRYPTOGRAPHIC RAW-DATA LEDGER (ISO/IEC 17025)
                  </h4>
                  <p className="text-[10px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">
                    TAMPER-EVIDENT SHA-256 HASH CHAIN • ED25519 CHECKPOINT SEAL
                  </p>
                </div>
              </div>

              <div>
                {integrityResult && (
                  <span className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                    integrityResult.status === 'INTACT'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    {integrityResult.status === 'INTACT' ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> : <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />}
                    {integrityResult.status}
                  </span>
                )}
              </div>
            </div>

            {/* Tampering Detection Alert */}
            {integrityResult && integrityResult.status !== 'INTACT' && integrityResult.status !== 'NOT_VERIFIED' && (
              <div className="p-4 border border-rose-300 bg-rose-50 space-y-2 font-mono">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>⚠ CRYPTOGRAPHIC INTEGRITY CHECK FAILED: {integrityResult.status}</span>
                </div>
                {integrityResult.first_failure && (
                  <div className="text-xs text-rose-800 space-y-1">
                    <div>First affected record: #{integrityResult.first_failure.sequence || 'Unknown'} ({integrityResult.first_failure.entity_type})</div>
                    <div>Reason: <span className="font-bold">{integrityResult.first_failure.reason}</span></div>
                    <div className="text-[11px] text-ink-700">{integrityResult.first_failure.details}</div>
                  </div>
                )}
              </div>
            )}

            {/* Integrity Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-white border border-editorial-border p-3">
                <span className="text-[9px] uppercase tracking-wider text-ink-400 block">LEDGER ENTRIES</span>
                <span className="text-sm font-bold text-ink-950 mt-1 block">
                  {integrityResult?.entries_checked ?? '--'}
                </span>
              </div>

              <div className="bg-white border border-editorial-border p-3">
                <span className="text-[9px] uppercase tracking-wider text-ink-400 block">OBSERVATIONS CHECKED</span>
                <span className="text-sm font-bold text-ink-950 mt-1 block">
                  {integrityResult?.observations_checked ?? '--'}
                </span>
              </div>

              <div className="bg-white border border-editorial-border p-3">
                <span className="text-[9px] uppercase tracking-wider text-ink-400 block">EVIDENCE CHECKED</span>
                <span className="text-sm font-bold text-ink-950 mt-1 block">
                  {integrityResult?.evidence_checked ?? '--'}
                </span>
              </div>

              <div className="bg-white border border-editorial-border p-3">
                <span className="text-[9px] uppercase tracking-wider text-ink-400 block">HASH ALGORITHM</span>
                <span className="text-sm font-bold text-ink-950 mt-1 block">SHA-256</span>
              </div>
            </div>

            {/* Ledger Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-[10px] font-mono text-ink-500 uppercase">
                {integrityResult?.verified_at
                  ? `LAST VERIFIED: ${new Date(integrityResult.verified_at).toISOString().replace('T', ' ').slice(0, 19)} UTC`
                  : 'STATUS: NOT VERIFIED (PENDING CHECK)'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenLedger}
                  className="bg-white hover:bg-alabaster-100 border border-editorial-border text-ink-900 text-xs font-mono font-bold uppercase tracking-wider px-4 py-2 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-ink-700" />
                  <span>VIEW LEDGER</span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyIntegrity}
                  disabled={verifyingIntegrity}
                  className="bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${verifyingIntegrity ? 'animate-spin' : 'text-emerald-400'}`} />
                  <span>{verifyingIntegrity ? 'VERIFYING...' : 'VERIFY INTEGRITY'}</span>
                </button>
              </div>
            </div>
          </div>

          {submissionError && (
            <div className="border border-neutral-900 bg-neutral-900 text-rose-400 p-4 text-xs font-mono">
              {submissionError}
            </div>
          )}

          {/* Submission Toolbar */}
          <div className="flex justify-end pt-4 border-t border-editorial-border">
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={submissionState === 'submitted'}
              className="bg-ink-950 hover:bg-neutral-800 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase tracking-widest px-6 py-3 shadow-editorial transition-all cursor-pointer"
            >
              {submissionState === 'submitted' ? 'SUBMITTED FOR REVIEW' : 'SUBMIT FOR DUAL-CUSTODY REVIEW'}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderWorksheetShell = () => {
    if (activeTab === 'A_WEIGHING') {
      return (
        <div className="space-y-6">
          <ToleranceChart instrument={instrument} results={evaluation?.results || []} />

          <div className="border border-editorial-border overflow-hidden bg-white shadow-editorial">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-alabaster-50 border-b border-editorial-border px-4 py-3 gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-ink-900">
                <ClipboardList className="w-4 h-4 text-ink-900" />
                <span>KEYBOARD-FIRST WORKSHEET (CLAUSE A.4.4)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyPlanLoadPoints}
                  className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-ink-950 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
                  title="Populate test rows with load points generated by OIML Test Plan"
                >
                  USE PLAN LOAD POINTS
                </button>
                <button
                  type="button"
                  onClick={() => setPoints(defaultPoints)}
                  className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-white border border-editorial-border text-ink-700 hover:bg-alabaster-100 transition-colors cursor-pointer"
                  title="Populate test rows with demo simulator points"
                >
                  DEMO TEMPLATE
                </button>
                <div className="text-[10px] font-mono text-ink-500 uppercase tracking-wider flex items-center gap-1.5 ml-2">
                  <Save className="w-3.5 h-3.5" />
                  ENCLAVE
                </div>
              </div>
            </div>

            <table onPaste={handlePaste} className="w-full text-left text-xs border-collapse">
              <thead className="bg-alabaster-100 border-b border-editorial-border text-ink-900 font-mono font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">DIRECTION</th>
                  <th className="p-3.5">LOAD (L) [kg]</th>
                  <th className="p-3.5">INDICATION (I) [kg]</th>
                  <th className="p-3.5">ΔL [kg]</th>
                  <th className="p-3.5 font-mono">P = I + 0.5e - ΔL</th>
                  <th className="p-3.5 font-mono">Ec = E - E₀</th>
                  <th className="p-3.5 font-mono">±mpe [kg]</th>
                  <th className="p-3.5 text-center">VERDICT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-editorial-border">
                {points.map((pt, idx) => {
                  const res = evaluation?.results[idx];

                  return (
                    <tr key={idx} className="hover:bg-alabaster-50 transition-colors font-mono">
                      <td className="p-3 text-ink-700">
                        <select
                          ref={(element) => {
                            inputRefs.current[`${idx}-direction`] = element;
                          }}
                          value={pt.direction}
                          onKeyDown={(event) => handleCellNavigation(event, idx, 'direction')}
                          onChange={(event) => updateCell(idx, 'direction', event.target.value as WeighingPointInput['direction'])}
                          className="border border-editorial-border px-2 py-1 text-xs outline-none bg-alabaster-50 font-mono uppercase text-ink-950 focus:border-ink-950"
                        >
                          <option value="INCREASING">Increasing</option>
                          <option value="DECREASING">Decreasing</option>
                          <option value="STATIC">Static</option>
                        </select>
                      </td>

                      <td className="p-3">
                        <input
                          ref={(element) => {
                            inputRefs.current[`${idx}-load_applied`] = element;
                          }}
                          type="number"
                          step="any"
                          value={pt.load_applied}
                          onKeyDown={(event) => handleCellNavigation(event, idx, 'load_applied')}
                          onChange={(event) => updateCell(idx, 'load_applied', Number(event.target.value) || 0)}
                          className="border border-editorial-border px-2.5 py-1 w-24 outline-none focus:border-ink-950 font-mono bg-alabaster-50 text-ink-950"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          ref={(element) => {
                            inputRefs.current[`${idx}-indication_observed`] = element;
                          }}
                          type="number"
                          step="any"
                          value={pt.indication_observed}
                          onKeyDown={(event) => handleCellNavigation(event, idx, 'indication_observed')}
                          onChange={(event) => updateCell(idx, 'indication_observed', Number(event.target.value) || 0)}
                          className="border border-editorial-border px-2.5 py-1 w-24 outline-none focus:border-ink-950 font-mono bg-alabaster-50 text-ink-950"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          ref={(element) => {
                            inputRefs.current[`${idx}-delta_load`] = element;
                          }}
                          type="number"
                          step="any"
                          value={pt.delta_load}
                          onKeyDown={(event) => handleCellNavigation(event, idx, 'delta_load')}
                          onChange={(event) => updateCell(idx, 'delta_load', Number(event.target.value) || 0)}
                          className="border border-editorial-border px-2 py-1 w-20 outline-none focus:border-ink-950 font-mono bg-alabaster-50 text-ink-950"
                        />
                      </td>

                      <td className="p-3 text-ink-700 font-mono">{res?.calculated_p.toFixed(5) ?? '--'}</td>
                      <td className="p-3 font-bold text-ink-950 font-mono">{res?.corrected_error_ec.toFixed(5) ?? '--'}</td>
                      <td className="p-3 text-ink-500 font-mono">{res ? `±${res.mpe_allowed.toFixed(5)}` : '--'}</td>
                      <td className="p-3 text-center">
                        {res && (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-2.5 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase border ${
                              res.status === 'PASS' ? 'bg-white text-emerald-800 border-emerald-300' :
                              res.status === 'WARN' ? 'bg-neutral-100 text-amber-800 border-amber-300' : 'bg-neutral-900 text-rose-400 border-neutral-700'
                            }`}>
                              {res.status}
                            </span>
                            {res.status === 'FAIL' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const excess = Math.max(0, Number((Math.abs(res.corrected_error_ec) - res.mpe_allowed).toFixed(5)));
                                  const marginPct = Number((excess / res.mpe_allowed * 100).toFixed(1));
                                  const expl: FailureExplanation = {
                                    id: `exp-weigh-${idx+1}`,
                                    report_id: reportId || 'draft',
                                    test_type: 'WEIGHING',
                                    clause_reference: 'OIML R 76-1:2006 Clause A.4.4',
                                    rule_id: 'RULE-OIML-A44-WEIGHING',
                                    rule_version: '2006',
                                    failure_code: 'ERROR_EXCEEDS_MPE',
                                    title: `Weighing Performance — Non-Compliant Observation #${idx+1}`,
                                    summary: `Observation #${idx+1} at ${res.load_applied} ${instrument.unit} failed: calculated error ${res.corrected_error_ec > 0 ? '+' : ''}${res.corrected_error_ec} ${instrument.unit} exceeds allowed limit ±${res.mpe_allowed} ${instrument.unit} by ${excess} ${instrument.unit}.`,
                                    measured_value: res.indication_observed,
                                    expected_value: res.load_applied,
                                    error_value: res.corrected_error_ec,
                                    allowed_limit: res.mpe_allowed,
                                    excess_value: excess,
                                    margin_percentage: marginPct,
                                    unit: instrument.unit,
                                    direction: pt.direction,
                                    position: 'CENTER',
                                    explanation: `Under OIML R 76-1:2006 Clause A.4.4, test point #${idx+1} (${pt.direction}) with applied load ${res.load_applied} ${instrument.unit} produced observed indication ${res.indication_observed} ${instrument.unit}. The calculated corrected error Ec is ${res.corrected_error_ec > 0 ? '+' : ''}${res.corrected_error_ec} ${instrument.unit}, which exceeds the statutory maximum permissible error of ±${res.mpe_allowed} ${instrument.unit} by ${excess} ${instrument.unit} (${marginPct}% beyond allowed tolerance).`,
                                    severity: 'ERROR',
                                    evidence_ids: [],
                                    created_at: new Date().toISOString(),
                                    engine_version: 'OIML-R76-2006-V1.0',
                                    explanation_version: 'M76-FAIL-EXPLAIN-V1',
                                    details: { calculated_p: res.calculated_p, corrected_error_ec: res.corrected_error_ec }
                                  };
                                  setSelectedExplanation(expl);
                                  setIsDetailOpen(true);
                                }}
                                className="text-[9px] font-mono text-rose-700 underline hover:text-rose-900 cursor-pointer"
                              >
                                Why did this fail?
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center text-xs font-mono">
            <button
              onClick={handleAddObservationStep}
              className="bg-ink-950 hover:bg-neutral-800 text-white px-5 py-2.5 font-bold uppercase tracking-wider shadow-editorial transition-colors cursor-pointer"
            >
              + ADD OBSERVATION STEP
            </button>
            <div className="flex items-center gap-2 text-ink-400 text-[11px] uppercase">
              <ArrowRight className="w-3.5 h-3.5" />
              <span>TIP: TAB / ENTER FOR RAPID DATA ENTRY • EXCEL PASTE SUPPORTED</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'B_REPEATABILITY') {
      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-border pb-3 gap-2">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">REPEATABILITY MATRIX (CLAUSE A.4.10)</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Series A/B/C with running spread, sample standard deviation, and compliance check.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyPlanRepeatability}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-ink-950 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
                title="Populate repeatability series from OIML Test Plan"
              >
                USE PLAN SERIES
              </button>
              <button
                type="button"
                onClick={() => setRepeatabilityData(createRepeatabilitySeries(instrument.max_capacity))}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-white border border-editorial-border text-ink-700 hover:bg-alabaster-100 transition-colors cursor-pointer"
                title="Reset to demo template"
              >
                DEMO TEMPLATE
              </button>
              <span className="bg-ink-950 text-white text-[9px] font-mono font-bold px-2.5 py-1 uppercase ml-2">LIVE EVAL</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {repeatabilityData.map((series, seriesIndex) => {
              const metrics = evaluateRepeatabilitySeries(series, instrument);

              return (
                <div key={series.id} className="border border-editorial-border p-5 bg-alabaster-50 space-y-4">
                  <div className="flex justify-between text-xs font-mono font-bold uppercase tracking-wider text-ink-950 border-b border-editorial-border pb-2">
                    <span>{series.label}</span>
                    <span>{series.nominalLoad.toFixed(2)} kg</span>
                  </div>

                  <div className="space-y-2">
                    {series.readings.map((reading, readingIndex) => (
                      <div key={`${series.id}-${readingIndex}`} className="grid grid-cols-[1fr_80px] gap-2 text-xs font-mono items-center">
                        <span className="text-ink-500">RUN {readingIndex + 1}</span>
                        <input
                          type="number"
                          step="any"
                          value={reading}
                          onChange={(event) =>
                            updateRepeatabilityReading(seriesIndex, readingIndex, Number(event.target.value) || 0)
                          }
                          className="w-full border border-editorial-border px-2 py-1 text-right bg-white text-ink-950 font-mono outline-none focus:border-ink-950"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-white border border-editorial-border p-2">
                      <div className="text-ink-400 uppercase">Pmax</div>
                      <div className="font-bold text-ink-950 mt-0.5">{metrics.pMax.toFixed(3)}</div>
                    </div>
                    <div className="bg-white border border-editorial-border p-2">
                      <div className="text-ink-400 uppercase">Pmin</div>
                      <div className="font-bold text-ink-950 mt-0.5">{metrics.pMin.toFixed(3)}</div>
                    </div>
                    <div className="bg-white border border-editorial-border p-2">
                      <div className="text-ink-400 uppercase">ΔI</div>
                      <div className="font-bold text-ink-950 mt-0.5">{metrics.deltaI.toFixed(3)}</div>
                    </div>
                    <div className="bg-white border border-editorial-border p-2">
                      <div className="text-ink-400 uppercase">s (STD DEV)</div>
                      <div className="font-bold text-ink-950 mt-0.5">{metrics.standardDeviation.toFixed(3)}</div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono flex items-center justify-between border border-editorial-border px-3 py-2 bg-white">
                    <span className="text-ink-500">±mpe LIMIT</span>
                    <span className="font-bold text-ink-950">{metrics.mpeAllowed.toFixed(3)}</span>
                  </div>

                  <div className={`text-center text-[10px] font-mono font-bold uppercase py-1 border ${
                    metrics.isCompliant ? 'bg-white text-emerald-800 border-emerald-300' : 'bg-neutral-900 text-rose-400 border-neutral-700'
                  }`}>
                    {metrics.isCompliant ? 'COMPLIANT (PASS)' : 'NON-COMPLIANT (FAIL)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'C_ECCENTRICITY') {
      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-border pb-3 gap-2">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">ECCENTRICITY PLATTER (CLAUSE A.4.7)</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Center and quadrant loading with automatic 1/3Max recommendation and per-position error bounds.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={applyPlanEccentricity}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-ink-950 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
                title="Populate eccentricity positions & load from OIML Test Plan"
              >
                USE PLAN CORNER LOAD
              </button>
              <button
                type="button"
                onClick={() => setEccentricityPoints(defaultEccentricityPoints)}
                className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-white border border-editorial-border text-ink-700 hover:bg-alabaster-100 transition-colors cursor-pointer"
                title="Reset to demo template"
              >
                DEMO TEMPLATE
              </button>
              <span className="bg-ink-950 text-white text-[9px] font-mono font-bold px-2.5 py-1 uppercase ml-2">LIVE EVAL</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[240px_1fr] gap-6">
            <div className="bg-alabaster-50 border border-editorial-border p-5">
              <svg viewBox="0 0 220 220" className="w-full h-auto bg-white border border-editorial-border">
                <rect x="20" y="20" width="180" height="180" rx="4" fill="#FAFAF9" stroke="#E2E2DE" strokeWidth="2" />
                <circle cx="110" cy="110" r="78" fill="#F6F6F4" stroke="#D3D3CD" strokeWidth="1.5" />
                <line x1="110" y1="20" x2="110" y2="200" stroke="#E2E2DE" strokeWidth="1.5" />
                <line x1="20" y1="110" x2="200" y2="110" stroke="#E2E2DE" strokeWidth="1.5" />

                {Object.entries(eccentricityLayout).map(([tag, position]) => {
                  const isActive = tag === activeEccentricityPosition;
                  const result = eccentricityEvaluation?.results.find((item) => item.position_tag === tag);

                  return (
                    <g key={tag} onClick={() => setActiveEccentricityPosition(tag)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r={isActive ? 12 : 9}
                        fill={isActive ? '#0A0A0A' : result?.is_compliant ? '#171717' : '#DC2626'}
                        stroke={isActive ? '#FFFFFF' : '#0A0A0A'}
                        strokeWidth={isActive ? 2 : 1}
                      />
                      <text x={position.x} y={position.y + 3} textAnchor="middle" fontSize="7" fill="#fff" fontFamily="monospace" fontWeight="700">
                        {tag.slice(0, 1)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-ink-600 border-t border-editorial-border pt-3">
                <span>RECOMMENDED LOAD</span>
                <span className="font-bold text-ink-950">{eccentricityEvaluation?.recommended_load.toFixed(2) ?? '--'} kg</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {eccentricityPoints.map((point) => {
                const result = eccentricityEvaluation?.results.find((item) => item.position_tag === point.position_tag);

                return (
                  <div
                    key={point.position_tag}
                    onClick={() => setActiveEccentricityPosition(point.position_tag)}
                    className={`border p-4 bg-alabaster-50 transition-all cursor-pointer ${
                      activeEccentricityPosition === point.position_tag
                        ? 'border-ink-950 bg-white shadow-editorial'
                        : 'border-editorial-border hover:border-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-ink-950 mb-3 border-b border-editorial-border pb-2">
                      <span>{point.position_tag.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                        result?.is_compliant ? 'bg-white text-emerald-800 border-emerald-300' : 'bg-neutral-900 text-rose-400 border-neutral-700'
                      }`}>
                        {result ? (result.is_compliant ? 'PASS' : 'FAIL') : 'LIVE'}
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <label className="block text-[10px] text-ink-500 uppercase tracking-widest">
                        APPLIED LOAD
                        <input
                          type="number"
                          step="any"
                          value={point.load_applied}
                          onChange={(event) =>
                            updateEccentricityPoint(point.position_tag, 'load_applied', Number(event.target.value) || 0)
                          }
                          className="mt-1 w-full border border-editorial-border px-2.5 py-1 text-right bg-white text-ink-950 outline-none focus:border-ink-950"
                        />
                      </label>

                      <label className="block text-[10px] text-ink-500 uppercase tracking-widest">
                        INDICATION
                        <input
                          type="number"
                          step="any"
                          value={point.indication_observed}
                          onChange={(event) =>
                            updateEccentricityPoint(point.position_tag, 'indication_observed', Number(event.target.value) || 0)
                          }
                          className="mt-1 w-full border border-editorial-border px-2.5 py-1 text-right bg-white text-ink-950 outline-none focus:border-ink-950"
                        />
                      </label>

                      <label className="block text-[10px] text-ink-500 uppercase tracking-widest">
                        ΔL
                        <input
                          type="number"
                          step="any"
                          value={point.delta_load}
                          onChange={(event) =>
                            updateEccentricityPoint(point.position_tag, 'delta_load', Number(event.target.value) || 0)
                          }
                          className="mt-1 w-full border border-editorial-border px-2.5 py-1 text-right bg-white text-ink-950 outline-none focus:border-ink-950"
                        />
                      </label>
                    </div>

                    <div className="mt-3 text-[10px] font-mono text-ink-500 grid grid-cols-2 gap-2 border-t border-editorial-border pt-2">
                      <div className="bg-white border border-editorial-border p-2">
                        <div className="uppercase">P</div>
                        <div className="font-bold text-ink-950 mt-0.5">{result ? result.calculated_p.toFixed(3) : '--'}</div>
                      </div>
                      <div className="bg-white border border-editorial-border p-2">
                        <div className="uppercase">Ec</div>
                        <div className="font-bold text-ink-950 mt-0.5">{result ? result.corrected_error_ec.toFixed(3) : '--'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'D_TARE_ZERO') {
      const overallZeroCompliant = Object.values(tareZeroResults).every((entry) => entry.compliant);

      return (
        <div className="bg-white p-6 sm:p-8 border border-editorial-border shadow-editorial space-y-6">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-ink-950">TARE & ZERO VERIFICATION (CLAUSES A.4.2 & A.4.6)</h3>
              <p className="text-[11px] font-mono text-ink-500 uppercase tracking-wider mt-0.5">Zero-setting, zero-tracking, and tare balancing residual checks with ±0.25e statutory guardrail.</p>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-1 uppercase border ${
              overallZeroCompliant ? 'bg-white text-emerald-800 border-emerald-300' : 'bg-neutral-100 text-amber-800 border-amber-300'
            }`}>
              {overallZeroCompliant ? 'GUARDED (PASS)' : 'REVIEW REQUIRED'}
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              ['zeroSetting', 'Zero Setting'],
              ['zeroTracking', 'Zero Tracking'],
              ['tareBalancing', 'Tare Balancing'],
            ].map(([key, label]) => {
              const entry = tareZeroResults[key as keyof typeof tareZeroResults];

              return (
                <div key={key} className="border border-editorial-border p-4 bg-alabaster-50 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-950 border-b border-editorial-border pb-2">
                    <span>{label}</span>
                    <span className={`px-2 py-0.5 text-[9px] uppercase border ${
                      entry.compliant ? 'bg-white text-emerald-800 border-emerald-300' : 'bg-neutral-900 text-rose-400 border-neutral-700'
                    }`}>
                      {entry.compliant ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <input
                    type="number"
                    step="any"
                    value={tareZeroState[key as keyof typeof tareZeroState]}
                    onChange={(event) =>
                      updateTareZeroField(key as keyof typeof tareZeroState, Number(event.target.value) || 0)
                    }
                    className="w-full border border-editorial-border px-3 py-1.5 text-right bg-white text-ink-950 text-xs font-mono outline-none focus:border-ink-950"
                  />

                  <div className="space-y-1 text-[10px] text-ink-500 pt-1">
                    <div className="flex items-center justify-between">
                      <span>RESIDUAL:</span>
                      <span className="font-bold text-ink-950">{entry.value.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>LIMIT (±0.25e):</span>
                      <span className="font-bold text-ink-950">±{entry.limit.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border border-editorial-border bg-alabaster-50 p-4 text-xs font-mono text-ink-700">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase">OVERALL CLAUSE A.4.2 / A.4.6 VERDICT:</span>
              <span className={`font-bold uppercase ${overallZeroCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
                {overallZeroCompliant ? 'COMPLIANT (≤ ±0.25e)' : 'NEEDS RECHECK'}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!authLoading && role === 'APPROVER') {
    return (
      <div className="max-w-2xl mx-auto py-24 px-4">
        <div className="bg-white border border-editorial-border p-8 shadow-editorial text-center space-y-4">
          <div className="flex items-center justify-between border-b border-editorial-border pb-3">
            <span className="font-mono text-[10px] text-ink-500 uppercase tracking-widest">
              ACCESS RESTRICTED // APPROVING OFFICER
            </span>
            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
              SEPARATION OF DUTIES
            </span>
          </div>
          <h3 className="font-display font-black text-xl text-ink-950 uppercase tracking-tight">
            Evaluation Worksheet Restricted
          </h3>
          <p className="font-mono text-xs text-ink-500 leading-relaxed">
            Approving Officers are not permitted to record raw test observation data. Your authorized duty is dual-custody review and verification sign-off.
          </p>
          <div className="pt-4 border-t border-editorial-border flex justify-center gap-3">
            <Link
              href="/verification"
              className="bg-ink-950 hover:bg-neutral-800 text-white font-semibold px-4 py-2 text-xs uppercase tracking-wider transition-colors shadow-editorial"
            >
              Go to Verification Queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-editorial-border shadow-editorial">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl tracking-tight uppercase text-ink-950">
              EVALUATION WORKSHEET & RULE ENGINE
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-ink-950 text-white uppercase tracking-wider">
              OIML R 76-1 / R 76-2
            </span>
          </div>
          <p className="text-xs text-ink-500 font-mono mt-1">
            CONTINUOUS TURNING-POINT CALCULATION (P = I + 0.5e - ΔL) • ±mpe CORRIDORS • LOCAL PERSISTENCE
          </p>
        </div>

        {evaluation && (
          <div className={`px-4 py-2 text-xs font-mono font-bold tracking-widest uppercase border flex items-center gap-2 ${
            evaluation.overall_compliant
              ? 'bg-white text-emerald-800 border-emerald-300'
              : 'bg-neutral-900 text-rose-400 border-neutral-700'
          }`}>
            {evaluation.overall_compliant ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>OVERALL VERDICT: COMPLIANT</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>OVERALL VERDICT: NON-COMPLIANT</span>
              </>
            )}
          </div>
        )}
      </div>

      {draftSavedToast && (
        <div className="border border-emerald-300 bg-white p-4 text-xs font-mono font-bold text-emerald-800 flex items-center gap-2 shadow-editorial">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{draftSavedToast}</span>
        </div>
      )}

      {/* Meta Specifications Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 p-5 bg-white border border-editorial-border text-xs shadow-editorial">
        <div><span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">CLASS</span><span className="font-bold font-mono text-ink-950">{instrument.accuracy_class}</span></div>
        <div><span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">MAX CAPACITY</span><span className="font-bold font-mono text-ink-950">{instrument.max_capacity} kg</span></div>
        <div><span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">INTERVAL (e)</span><span className="font-bold font-mono text-ink-950">{instrument.verification_interval_e} kg</span></div>
        <div><span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">ZERO ERROR (E₀)</span><span className="font-bold font-mono text-ink-950">{evaluation?.zero_error_e0 ?? '--'} kg</span></div>
        <div>
          <span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">DATABASE DRAFT</span>
          <span className={`font-bold font-mono text-xs ${reportId ? 'text-emerald-700' : 'text-amber-700'}`}>
            {reportId ? (loadedReportNumber || reportId.slice(0, 8)) : 'UNSAVED'}
          </span>
        </div>
        <div><span className="text-ink-400 block uppercase font-mono text-[9px] tracking-wider">LIFECYCLE</span><span className="font-bold font-mono text-ink-950">DRAFT PACKET</span></div>
      </div>

      {/* Draft Persistence Status & Action Bar */}
      <div className={`p-4 border text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-editorial ${
        reportId ? 'bg-white border-editorial-border' : 'bg-amber-50/70 border-amber-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {reportId ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <div>
            <span className="font-bold uppercase tracking-wider text-[11px] text-ink-950">
              {reportId ? `ACTIVE DRAFT: ${loadedReportNumber || reportId} • DATABASE PERSISTED` : 'LOCAL WORKSPACE • DRAFT NOT SAVED TO DATABASE'}
            </span>
            <p className="text-[10px] text-ink-500 mt-0.5">
              {reportId
                ? 'Observations are officially tracked in Supabase and listed in the Technical Testing Queue.'
                : 'No database draft is saved unless explicitly requested. Click "Save Draft to Database" to persist.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {reportId ? (
            <>
              <button
                type="button"
                onClick={() => handleSaveDraftToDatabase()}
                disabled={savingDraft || deletingActiveDraft}
                className="px-3 py-1.5 bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {savingDraft ? 'SYNCING...' : 'SYNC OBSERVATIONS'}
              </button>
              <button
                type="button"
                onClick={handleDeleteActiveDraft}
                disabled={deletingActiveDraft}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-editorial-border hover:border-rose-300 text-rose-700 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                title="Permanently delete active draft"
              >
                {deletingActiveDraft ? (
                  <span className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                <span>DELETE DRAFT</span>
              </button>
              <button
                type="button"
                onClick={handleStartNewEvaluation}
                disabled={deletingActiveDraft}
                className="px-3 py-1.5 bg-white hover:bg-alabaster-100 border border-editorial-border text-ink-900 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                + NEW EVALUATION
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleSaveDraftToDatabase()}
              disabled={savingDraft}
              className="px-4 py-2 bg-ink-950 hover:bg-neutral-800 disabled:opacity-50 text-white font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-editorial flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingDraft ? 'SAVING DRAFT...' : 'SAVE DRAFT TO DATABASE'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Step Tabs */}
      <div className="flex border-b border-editorial-border space-x-2 text-xs font-mono font-bold uppercase tracking-wider overflow-x-auto">
        {[
          { step: 1, label: '1. PASSPORT' },
          { step: 2, label: '2. AMBIENT' },
          { step: 3, label: '3. TEST PLAN' },
          { step: 4, label: '4. WORKSHEETS' },
          { step: 5, label: '5. SUMMARY' },
        ].map(({ step, label }) => (
          <button
            key={step}
            onClick={() => setWizardStep(step)}
            className={`px-5 py-3 transition-all whitespace-nowrap cursor-pointer ${
              wizardStep === step
                ? 'border-b-2 border-ink-950 text-ink-950 font-black bg-alabaster-100'
                : 'text-ink-400 hover:text-ink-950'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {renderWizardStepContent()}

      {/* Navigation Toolbar */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-editorial-border">
        <button
          type="button"
          onClick={() => setWizardStep((prev) => Math.max(prev - 1, 1))}
          disabled={wizardStep === 1}
          className="px-5 py-2.5 border border-editorial-border bg-white text-xs font-mono font-bold uppercase tracking-wider text-ink-700 hover:bg-alabaster-100 disabled:opacity-40 transition-colors cursor-pointer"
        >
          PREVIOUS STEP
        </button>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-ink-500 uppercase">
          <Gauge className="w-3.5 h-3.5 text-ink-900" />
          <span>REAL-TIME MATHEMATICAL VALIDATION ACTIVE</span>
        </div>

        <button
          type="button"
          onClick={() => setWizardStep((prev) => Math.min(prev + 1, 5))}
          disabled={wizardStep === 5 || (wizardStep === 2 && standardIsBlocked)}
          className="px-6 py-2.5 bg-ink-950 hover:bg-neutral-800 text-white text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed shadow-editorial transition-colors cursor-pointer"
        >
          {wizardStep === 5 ? 'FINAL REVIEW' : wizardStep === 3 ? 'PROCEED TO WORKSHEETS →' : 'NEXT STEP →'}
        </button>
      </div>

      {/* Feature 1: Clause-Level Failure Explanation Drawer/Panel */}
      <FailureDetailPanel
        explanation={selectedExplanation}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* Feature 2: Cryptographic Raw-Data Ledger Viewer */}
      <LedgerViewerModal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        entries={ledgerEntries}
        verificationResult={integrityResult}
        reportNumber={reportId || 'Draft Evaluation Report'}
      />
    </div>
  );
}
