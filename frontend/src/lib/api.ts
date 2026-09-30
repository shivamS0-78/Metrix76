import {
  InstrumentMeta,
  WeighingPointInput,
  WeighingBatchResponse,
  RepeatabilitySeriesResult,
  EccentricityPointInput,
  EccentricityBatchResponse,
  DashboardData,
  ReferenceStandard,
  Instrument,
  TestReportSummary,
  SanityCheckResult,
  CreateReportDraftPayload,
  BatchObservationPayload,
  ReportSubmissionResult
} from '@/types/metrology';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Module 1: Dashboard API
export async function getDashboardData(userId?: string, role?: string): Promise<DashboardData> {
  const params = new URLSearchParams();
  if (userId) params.append('user_id', userId);
  if (role) params.append('role', role);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/api/v1/dashboard/metrics${queryStr}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Dashboard API error: ${res.statusText}`);
  return res.json();
}

// Module 2: Reference Standards API
export async function listReferenceStandards(): Promise<ReferenceStandard[]> {
  const res = await fetch(`${API_BASE}/api/v1/standards/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Standards API error: ${res.statusText}`);
  return res.json();
}

export async function createReferenceStandard(payload: any): Promise<ReferenceStandard> {
  const res = await fetch(`${API_BASE}/api/v1/standards/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === 'object' ? err.detail.message || JSON.stringify(err.detail) : err.detail;
    throw new Error(detail || `Failed to register standard weight set (${res.statusText})`);
  }
  return res.json();
}

export async function checkStandardValidity(id: string): Promise<{ is_valid: boolean; guardrail_status: string }> {
  const res = await fetch(`${API_BASE}/api/v1/standards/${id}/check-validity`);
  if (!res.ok) throw new Error(`Standard validity check error: ${res.statusText}`);
  return res.json();
}

// Module 3: Instruments API
export async function listInstruments(): Promise<Instrument[]> {
  const res = await fetch(`${API_BASE}/api/v1/instruments/`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Instruments API error: ${res.statusText}`);
  return res.json();
}

export async function createInstrument(payload: any): Promise<Instrument> {
  const res = await fetch(`${API_BASE}/api/v1/instruments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === 'object' ? err.detail.message || JSON.stringify(err.detail) : err.detail;
    throw new Error(detail || `Failed to create instrument passport (${res.statusText})`);
  }
  return res.json();
}

export async function validateInstrumentSanity(spec: InstrumentMeta): Promise<SanityCheckResult> {
  const res = await fetch(`${API_BASE}/api/v1/instruments/validate-sanity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error(`Sanity validation error: ${res.statusText}`);
  return res.json();
}

// Module 4: Live Test Evaluations
export async function evaluateWeighingPoints(
  instrument: InstrumentMeta,
  points: WeighingPointInput[]
): Promise<WeighingBatchResponse> {
  const res = await fetch(`${API_BASE}/api/v1/metrology/evaluate-weighing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument, points }),
  });
  if (!res.ok) throw new Error(`Evaluation API error: ${res.statusText}`);
  return res.json();
}

export async function evaluateEccentricity(
  instrument: InstrumentMeta,
  points: EccentricityPointInput[]
): Promise<EccentricityBatchResponse> {
  const res = await fetch(`${API_BASE}/api/v1/metrology/evaluate-eccentricity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument, points }),
  });
  if (!res.ok) throw new Error(`Eccentricity evaluation error: ${res.statusText}`);
  return res.json();
}

// Module 5: Verification & Approver Review API
export async function getReportDetail(reportId: string) {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Report details lookup error: ${res.statusText}`);
  return res.json();
}

export async function submitVerificationAction(
  reportId: string,
  action: 'APPROVE' | 'REJECT',
  officerPin?: string,
  remarks?: string
) {
  const res = await fetch(`${API_BASE}/api/v1/verification/reports/${reportId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, officer_pin: officerPin, remarks }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Verification action failed');
  }
  return res.json();
}

// Module 6: Report CRUD & Searchable Archive API
export async function createReportDraft(payload: CreateReportDraftPayload) {
  const res = await fetch(`${API_BASE}/api/v1/reports/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Draft creation failed');
  }
  return res.json();
}

export async function upsertReportObservations(reportId: string, payload: BatchObservationPayload): Promise<{ report_id: string; observations: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/observations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Observation save failed');
  }
  return res.json();
}

export async function submitReportForReview(reportId: string): Promise<ReportSubmissionResult> {
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/submit`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Report submission failed');
  }
  return res.json();
}

export async function searchArchive(query?: string, userId?: string, role?: string): Promise<TestReportSummary[]> {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (userId) params.append('user_id', userId);
  if (role) params.append('role', role);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE}/api/v1/reports/archive${queryStr}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Archive API error: ${res.statusText}`);
  return res.json();
}

export async function verifyPublicReport(reportId: string) {
  const res = await fetch(`${API_BASE}/api/v1/reports/verify/${reportId}`);
  if (!res.ok) throw new Error(`Verification lookup error: ${res.statusText}`);
  return res.json();
}

// Attachments & Evidence Vault API
export async function uploadAttachment(formData: FormData) {
  const res = await fetch(`${API_BASE}/api/v1/attachments/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Attachment upload failed');
  }
  return res.json();
}

// Document URLs
export { API_BASE };
export function getReportPdfUrl(reportId: string): string {
  return `${API_BASE}/api/v1/documents/reports/${reportId}/generate-pdf`;
}

export function getReportDocxUrl(reportId: string): string {
  return `${API_BASE}/api/v1/documents/reports/${reportId}/generate-docx`;
}

export async function assignUserRole(userId: string, role: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/assign-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to assign role');
  }
  return res.json();
}
