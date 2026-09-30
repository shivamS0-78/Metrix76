export type AccuracyClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
export type TestDirection = 'INCREASING' | 'DECREASING' | 'STATIC';
export type TestType = 'WEIGHING' | 'REPEATABILITY' | 'ECCENTRICITY' | 'TARE_ZERO';
export type ReportStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type ComplianceVerdict = 'PASS' | 'WARN' | 'FAIL';

export interface MultiIntervalSpec {
  max_capacity: number;
  verification_interval_e: number;
  scale_interval_d: number;
}

export interface InstrumentMeta {
  accuracy_class: AccuracyClass;
  max_capacity: number;
  min_capacity: number;
  scale_interval_d: number;
  verification_interval_e: number;
  unit: string;
  is_multi_interval?: boolean;
  multi_interval_ranges?: MultiIntervalSpec[];
}

export interface SanityCheckResult {
  is_valid: boolean;
  calculated_n: number;
  n_min: number;
  n_max: number | null;
  min_capacity_required: number;
  issues: string[];
}

export interface InstrumentAttachment {
  id?: string;
  attachment_type: 'NAMEPLATE' | 'LEAD_SEAL' | 'LEVEL_BUBBLE' | 'OVERALL_FRONT';
  storage_path: string;
  file_name?: string;
  uploaded_at?: string;
}

export interface Instrument {
  id: string;
  serial_number: string;
  model_name: string;
  manufacturer_name: string;
  accuracy_class: AccuracyClass;
  max_capacity: number;
  min_capacity: number;
  scale_interval_d: number;
  verification_interval_e: number;
  unit: string;
  is_multi_interval: boolean;
  load_receptor_type?: string;
  indicator_make_model?: string;
  year_of_manufacture?: number;
  calculated_n: number;
  attachments?: InstrumentAttachment[];
  created_at: string;
}

export interface ReferenceStandard {
  id: string;
  set_identifier: string;
  accuracy_class: string;
  certificate_number: string;
  calibrated_by: string;
  calibration_date: string;
  expiry_date: string;
  expanded_uncertainty_k2?: number;
  nominal_range?: string;
  is_active: boolean;
  is_expired: boolean;
  days_to_expiry: number;
  created_at: string;
}

export interface WeighingPointInput {
  load_applied: number;
  indication_observed: number;
  delta_load: number;
  direction: TestDirection;
}

export interface WeighingEvaluationResult {
  load_applied: number;
  indication_observed: number;
  delta_load: number;
  calculated_p: number;
  true_error_e: number;
  corrected_error_ec: number;
  mpe_allowed: number;
  status: ComplianceVerdict;
  is_compliant: boolean;
  direction: TestDirection;
}

export interface WeighingBatchResponse {
  zero_error_e0: number;
  results: WeighingEvaluationResult[];
  overall_compliant: boolean;
}

export interface RepeatabilitySeriesResult {
  nominal_load: number;
  p_max: number;
  p_min: number;
  delta_i: number;
  mpe_allowed: number;
  standard_deviation_s: number;
  is_compliant: boolean;
}

export interface EccentricityPointInput {
  position_tag: string;
  load_applied: number;
  indication_observed: number;
  delta_load: number;
}

export interface EccentricityEvaluationResult {
  position_tag: string;
  load_applied: number;
  indication_observed: number;
  calculated_p: number;
  corrected_error_ec: number;
  mpe_allowed: number;
  is_compliant: boolean;
}

export interface EccentricityBatchResponse {
  recommended_load: number;
  zero_error_e0: number;
  results: EccentricityEvaluationResult[];
  overall_compliant: boolean;
}

export interface TestReportSummary {
  id: string;
  report_number: string;
  instrument_serial: string;
  instrument_model: string;
  manufacturer_name: string;
  accuracy_class: AccuracyClass;
  status: ReportStatus;
  overall_verdict: boolean | null;
  conducted_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  active_evaluations_count: number;
  pending_approval_count: number;
  completed_approvals_month: number;
  completed_approvals_year: number;
  overall_compliance_rate_pct: number;
  rejection_rate_by_class: Record<string, number>;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  expiring_standards: ReferenceStandard[];
  technician_work_queue: TestReportSummary[];
  approver_work_queue: TestReportSummary[];
}

export interface TechnicalChecklist {
  level_indicator_present?: boolean;
  zero_setting_operative?: boolean;
  tare_device_operative?: boolean;
  security_sealing_intact?: boolean;
  audit_counter_value?: string;
  notes?: string | null;
}

export interface CreateReportDraftPayload {
  instrument_id: string;
  reference_standard_id: string;
  ambient_temperature_celsius: number;
  relative_humidity_pct: number;
  atmospheric_pressure_hpa?: number;
  technical_checklist: TechnicalChecklist;
  conducted_by?: string;
}

export interface ReportObservationInput {
  test_type: TestType;
  direction: TestDirection;
  sequence_order: number;
  load_applied: number;
  indication_observed: number;
  delta_load: number;
  position_tag?: string;
  run_cycle?: number;
}

export interface BatchObservationPayload {
  report_id: string;
  observations: ReportObservationInput[];
}

export interface EnvironmentalConditions {
  ambient_temperature_celsius: number;
  relative_humidity_pct: number;
  atmospheric_pressure_hpa?: number;
  temp_min_allowed?: number;
  temp_max_allowed?: number;
}

export interface TestReportDetail {
  id: string;
  report_number: string;
  attempt_number: number;
  status: ReportStatus;
  standard_version: string;
  instrument: Instrument;
  reference_standard: ReferenceStandard;
  environment: EnvironmentalConditions;
  technical_checklist: TechnicalChecklist;
  overall_verdict: boolean | null;
  rejection_reason?: string | null;
  sha256_hash?: string | null;
  pdf_storage_path?: string | null;
  docx_storage_path?: string | null;
  weighing_observations: WeighingEvaluationResult[];
  repeatability_results: RepeatabilitySeriesResult[];
  eccentricity_results: EccentricityEvaluationResult[];
  conducted_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSubmissionResult {
  report_id: string;
  status: ReportStatus;
  message: string;
}
