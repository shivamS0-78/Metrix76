"""
Domain models for Clause-Level Failure Explanation.
Conforming to OIML R 76-1:2006 authoritative evaluation requirements.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FailureCode(str, Enum):
    ERROR_EXCEEDS_MPE = "ERROR_EXCEEDS_MPE"
    REPEATABILITY_EXCEEDS_LIMIT = "REPEATABILITY_EXCEEDS_LIMIT"
    ECCENTRICITY_EXCEEDS_LIMIT = "ECCENTRICITY_EXCEEDS_LIMIT"
    ZERO_ERROR_EXCEEDS_LIMIT = "ZERO_ERROR_EXCEEDS_LIMIT"
    TARE_ERROR_EXCEEDS_LIMIT = "TARE_ERROR_EXCEEDS_LIMIT"
    INVALID_OBSERVATION = "INVALID_OBSERVATION"
    MISSING_REQUIRED_OBSERVATION = "MISSING_REQUIRED_OBSERVATION"
    RULE_NOT_CONFIGURED = "RULE_NOT_CONFIGURED"
    STANDARD_INVALID = "STANDARD_INVALID"


class FailureExplanation(BaseModel):
    id: str = Field(..., description="Unique explanation identifier")
    report_id: str = Field(..., description="Referenced report identifier")
    observation_id: Optional[str] = Field(None, description="Observation ID if linked to a specific point")
    test_type: str = Field(..., description="WEIGHING, REPEATABILITY, ECCENTRICITY, TARE_ZERO")
    clause_reference: Optional[str] = Field(None, description="Authoritative OIML clause reference or None if unconfigured")
    rule_id: Optional[str] = Field(None, description="Internal rule identifier")
    rule_version: Optional[str] = Field("OIML-R76-2006", description="Active rule version")
    failure_code: FailureCode = Field(..., description="Standardized failure code")
    title: str = Field(..., description="Level 1 summary heading")
    summary: str = Field(..., description="Level 2 observation-level synopsis")
    measured_value: Optional[float] = Field(None, description="Observed indication or spread")
    expected_value: Optional[float] = Field(None, description="Nominal/applied load")
    error_value: Optional[float] = Field(None, description="Calculated error or delta_i")
    allowed_limit: Optional[float] = Field(None, description="Maximum Permissible Error or limit")
    excess_value: Optional[float] = Field(None, description="Absolute excess beyond allowable limit")
    margin_percentage: Optional[float] = Field(None, description="Percentage of MPE limit exceeded")
    unit: Optional[str] = Field("kg", description="Physical unit of measurement")
    direction: Optional[str] = Field(None, description="Test direction: INCREASING, DECREASING, STATIC")
    position: Optional[str] = Field(None, description="Receptor position tag for eccentricity")
    run_cycle: Optional[int] = Field(None, description="Run cycle number for repeatability")
    explanation: str = Field(..., description="Level 3 comprehensive numerical justification")
    severity: str = Field("ERROR", description="WARNING, ERROR, CRITICAL")
    evidence_ids: List[str] = Field(default_factory=list, description="Associated evidence or attachment IDs")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp generated")
    engine_version: str = Field("OIML-R76-2006-V1.0", description="Authoritative engine version")
    explanation_version: str = Field("M76-FAIL-EXPLAIN-V1", description="Explanation generator template version")
    details: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary calculation context for audit trail")


class FailureExplanationResponse(BaseModel):
    report_id: str
    overall_status: str  # PASS or FAIL
    failed_tests: int
    failed_observations: int
    explanations: List[FailureExplanation]
    engine_version: str = "OIML-R76-2006-V1.0"
    explanation_version: str = "M76-FAIL-EXPLAIN-V1"
