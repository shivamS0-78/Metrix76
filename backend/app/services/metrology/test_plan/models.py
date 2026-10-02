"""
Domain models for Automatic OIML Test Plan Generator.
Conforms to OIML R 76-1:2006 requirements for statutory test sequencing and ISO/IEC 17025 auditability.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TestPlanStatus(str, Enum):
    __test__ = False
    INVALID = "INVALID"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    STALE = "STALE"


class TestExecutionStatus(str, Enum):
    __test__ = False
    NOT_STARTED = "NOT_STARTED"
    BLOCKED = "BLOCKED"
    READY = "READY"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"
    NOT_CONFIGURED = "NOT_CONFIGURED"


class TestComplianceStatus(str, Enum):
    __test__ = False
    NOT_EVALUATED = "NOT_EVALUATED"
    PASS = "PASS"
    FAIL = "FAIL"


class TestPlanIssue(BaseModel):
    __test__ = False
    field: Optional[str] = Field(None, description="Configuration field causing the issue")
    message: str = Field(..., description="Human-readable explanation of the validation failure")
    severity: str = Field("ERROR", description="'ERROR' or 'WARNING'")


class ObservationSchema(BaseModel):
    minimum_observations: int = Field(1, description="Minimum observations required for completion")
    requires_zero: bool = Field(True, description="Whether a zero-load point is mandatory")
    directions: List[str] = Field(default_factory=lambda: ["INCREASING", "DECREASING"])
    expected_load_points: List[float] = Field(default_factory=list)
    positions: List[str] = Field(default_factory=list)
    series_count: Optional[int] = None
    runs_per_series: Optional[int] = None


class ProcedureConfig(BaseModel):
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Test procedural settings")
    instructions: Optional[str] = None
    calculated_load_points: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_load: Optional[float] = None
    tolerance_summary: Optional[str] = None


class TestDefinition(BaseModel):
    __test__ = False
    test_code: str = Field(..., description="Unique test code, e.g. OIML-A44-WEIGHING")
    test_type: str = Field(..., description="Base test type, e.g. WEIGHING")
    title: str = Field(..., description="Official test title")
    description: str = Field(..., description="Summary of testing procedure")
    standard_reference: str = Field(..., description="OIML statutory clause citation")
    rule_version: str = Field("2006", description="OIML rule version")
    sequence_order: int = Field(..., description="Deterministic sequence order")
    prerequisites: List[str] = Field(default_factory=list, description="Test codes or types required before this test")
    required_standards: Dict[str, Any] = Field(default_factory=dict, description="Specifications for reference standard")
    enabled: bool = Field(True, description="Whether this test is enabled in the current rule set")
    configuration_status: str = Field("CONFIGURED", description="'CONFIGURED' or 'NOT_CONFIGURED'")


class TestPlanItem(BaseModel):
    __test__ = False
    id: str = Field(..., description="UUID identifier of the plan item")
    test_plan_id: str = Field(..., description="Parent test plan UUID")
    test_type: str = Field(..., description="Test module type (WEIGHING, REPEATABILITY, ECCENTRICITY, TARE_ZERO)")
    test_code: str = Field(..., description="Unique test code")
    title: str = Field(..., description="Descriptive title")
    description: Optional[str] = None
    standard_reference: Optional[str] = None
    sequence_order: int = Field(..., description="Sequence execution order (1, 2, 3...)")
    applicable: bool = Field(True, description="Whether this test applies to the instrument")
    configured: bool = Field(True, description="Whether this test is configured in the rule set")
    execution_status: TestExecutionStatus = Field(TestExecutionStatus.READY)
    compliance_status: TestComplianceStatus = Field(TestComplianceStatus.NOT_EVALUATED)
    blocked_reason: Optional[str] = None
    prerequisites: List[str] = Field(default_factory=list)
    required_standards: Dict[str, Any] = Field(default_factory=dict)
    observation_schema: ObservationSchema = Field(default_factory=ObservationSchema)
    procedure_config: ProcedureConfig = Field(default_factory=ProcedureConfig)
    rule_version: str = Field("2006")
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TestPlan(BaseModel):
    __test__ = False
    id: str = Field(..., description="UUID identifier of the test plan")
    report_id: str = Field(..., description="Associated report UUID")
    instrument_id: str = Field(..., description="Associated instrument passport UUID")
    reference_standard_id: Optional[str] = None
    standard_version: str = Field("OIML R 76-1:2006", description="Standard recommendation")
    rule_set_version: str = Field("2006", description="Active rule set edition")
    generator_version: str = Field("M76-TPG-V1", description="Test plan generator engine version")
    status: TestPlanStatus = Field(TestPlanStatus.READY)
    instrument_snapshot: Dict[str, Any] = Field(default_factory=dict, description="Frozen snapshot of instrument inputs")
    issues: List[TestPlanIssue] = Field(default_factory=list, description="Validation issues preventing plan execution")
    items: List[TestPlanItem] = Field(default_factory=list, description="Ordered procedural test plan items")
    supersedes_plan_id: Optional[str] = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TestPlanDiff(BaseModel):
    __test__ = False
    has_changes: bool = False
    added_tests: List[str] = Field(default_factory=list)
    removed_tests: List[str] = Field(default_factory=list)
    modified_tests: List[str] = Field(default_factory=list)
    changed_reasons: List[str] = Field(default_factory=list)


class TestPlanGenerateRequest(BaseModel):
    __test__ = False
    rule_set_version: Optional[str] = Field("2006", description="Optional rule set version")
    force_regenerate: bool = Field(False, description="Whether to explicitly supersede an existing plan")


class TestPlanResponse(BaseModel):
    __test__ = False
    plan: TestPlan
    diff: Optional[TestPlanDiff] = None
    message: str = "Test plan ready"
