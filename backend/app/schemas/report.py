from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.metrology import (
    AccuracyClass,
    TestDirection,
    TestType,
    WeighingPointInput,
    WeighingEvaluationResult,
    RepeatabilitySeriesResult,
    EccentricityEvaluationResult
)
from app.schemas.instrument import InstrumentOut
from app.schemas.reference_standard import ReferenceStandardOut

class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class EnvironmentalConditions(BaseModel):
    ambient_temperature_celsius: float = Field(..., json_schema_extra={"example": 22.5})
    relative_humidity_pct: float = Field(..., json_schema_extra={"example": 55.0})
    atmospheric_pressure_hpa: Optional[float] = Field(1013.25, json_schema_extra={"example": 1013.25})
    temp_min_allowed: Optional[float] = -10.0
    temp_max_allowed: Optional[float] = 40.0

class TechnicalChecklist(BaseModel):
    level_indicator_present: bool = True
    zero_setting_operative: bool = True
    tare_device_operative: bool = True
    security_sealing_intact: bool = True
    audit_counter_value: Optional[str] = "AC-0042"
    notes: Optional[str] = None

class TestReportCreate(BaseModel):
    instrument_id: str
    reference_standard_id: str
    ambient_temperature_celsius: float
    relative_humidity_pct: float
    atmospheric_pressure_hpa: Optional[float] = 1013.25
    technical_checklist: TechnicalChecklist = TechnicalChecklist()
    conducted_by: Optional[str] = None

class TestObservationRowPayload(BaseModel):
    test_type: TestType = TestType.WEIGHING
    direction: TestDirection = TestDirection.INCREASING
    sequence_order: int = Field(1, ge=1)
    load_applied: float
    indication_observed: float
    delta_load: float = 0.0
    position_tag: Optional[str] = None
    run_cycle: Optional[int] = None

class BatchObservationPayload(BaseModel):
    report_id: str
    observations: List[TestObservationRowPayload]

class ReportSubmissionResponse(BaseModel):
    report_id: str
    status: ReportStatus
    message: str

class VerificationAction(BaseModel):
    action: str # "APPROVE" or "REJECT"
    officer_pin: Optional[str] = None
    remarks: Optional[str] = None

class TestReportSummary(BaseModel):
    id: str
    report_number: str
    instrument_serial: str
    instrument_model: str
    manufacturer_name: str
    accuracy_class: AccuracyClass
    status: ReportStatus
    overall_verdict: Optional[bool]
    conducted_by_name: str
    created_at: datetime
    updated_at: datetime

class TestReportDetail(BaseModel):
    id: str
    report_number: str
    attempt_number: int
    status: ReportStatus
    standard_version: str
    instrument: InstrumentOut
    reference_standard: ReferenceStandardOut
    environment: EnvironmentalConditions
    technical_checklist: TechnicalChecklist
    overall_verdict: Optional[bool]
    rejection_reason: Optional[str]
    sha256_hash: Optional[str]
    pdf_storage_path: Optional[str]
    docx_storage_path: Optional[str]
    weighing_observations: List[WeighingEvaluationResult] = []
    repeatability_results: List[RepeatabilitySeriesResult] = []
    eccentricity_results: List[EccentricityEvaluationResult] = []
    conducted_by: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class PublicVerificationResponse(BaseModel):
    is_valid: bool
    report_number: str
    status: ReportStatus
    instrument_serial: str
    manufacturer_name: str
    model_name: str
    accuracy_class: str
    overall_verdict: bool
    approved_at: Optional[datetime]
    sha256_hash: str
    verified_at: datetime
