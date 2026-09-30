from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class AccuracyClass(str, Enum):
    CLASS_I = "CLASS_I"
    CLASS_II = "CLASS_II"
    CLASS_III = "CLASS_III"
    CLASS_IIII = "CLASS_IIII"

class TestDirection(str, Enum):
    __test__ = False
    INCREASING = "INCREASING"
    DECREASING = "DECREASING"
    STATIC = "STATIC"

class TestType(str, Enum):
    __test__ = False
    WEIGHING = "WEIGHING"
    REPEATABILITY = "REPEATABILITY"
    ECCENTRICITY = "ECCENTRICITY"
    TARE_ZERO = "TARE_ZERO"

class ComplianceVerdict(str, Enum):
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"

class MultiIntervalSpec(BaseModel):
    max_capacity: float
    verification_interval_e: float
    scale_interval_d: float

class InstrumentMeta(BaseModel):
    accuracy_class: AccuracyClass
    max_capacity: float
    min_capacity: float
    scale_interval_d: float
    verification_interval_e: float
    unit: str = "kg"
    is_multi_interval: bool = False
    multi_interval_ranges: Optional[List[MultiIntervalSpec]] = None

class SanityCheckResult(BaseModel):
    is_valid: bool
    calculated_n: int
    n_min: int
    n_max: Optional[int]
    min_capacity_required: float
    issues: List[str]

# --- 1. Weighing Performance (Clause A.4.4) ---
class WeighingPointInput(BaseModel):
    load_applied: float = Field(..., description="L: Applied standard load")
    indication_observed: float = Field(..., description="I: Displayed indication")
    delta_load: float = Field(0.0, description="ΔL: Fractional load added to find turnover")
    direction: TestDirection = TestDirection.INCREASING

class WeighingEvaluationResult(BaseModel):
    load_applied: float
    indication_observed: float
    delta_load: float
    calculated_p: float
    true_error_e: float
    corrected_error_ec: float
    mpe_allowed: float
    status: ComplianceVerdict
    is_compliant: bool
    direction: TestDirection

class WeighingBatchRequest(BaseModel):
    instrument: InstrumentMeta
    points: List[WeighingPointInput]

class WeighingBatchResponse(BaseModel):
    zero_error_e0: float
    results: List[WeighingEvaluationResult]
    overall_compliant: bool

# --- 2. Repeatability Test (Clause A.4.10) ---
class RepeatabilitySeriesInput(BaseModel):
    nominal_load: float
    observations: List[WeighingPointInput] # typically 10 measurements per series

class RepeatabilitySeriesResult(BaseModel):
    nominal_load: float
    p_max: float
    p_min: float
    delta_i: float # Pmax - Pmin
    mpe_allowed: float
    standard_deviation_s: float
    is_compliant: bool

class RepeatabilityBatchRequest(BaseModel):
    instrument: InstrumentMeta
    series: List[RepeatabilitySeriesInput]

class RepeatabilityBatchResponse(BaseModel):
    series_results: List[RepeatabilitySeriesResult]
    overall_compliant: bool

# --- 3. Eccentricity Test (Clause A.4.7) ---
class EccentricityGeometry(str, Enum):
    FOUR_CORNERS = "FOUR_CORNERS"
    FOUR_QUADRANTS = "FOUR_QUADRANTS"
    AXLE_POINTS = "AXLE_POINTS"

class EccentricityPointInput(BaseModel):
    position_tag: str # 'CENTER', 'CORNER_1', 'CORNER_2', 'CORNER_3', 'CORNER_4'
    load_applied: float
    indication_observed: float
    delta_load: float = 0.0

class EccentricityEvaluationResult(BaseModel):
    position_tag: str
    load_applied: float
    indication_observed: float
    calculated_p: float
    corrected_error_ec: float
    mpe_allowed: float
    is_compliant: bool

class EccentricityBatchRequest(BaseModel):
    instrument: InstrumentMeta
    geometry: EccentricityGeometry = EccentricityGeometry.FOUR_CORNERS
    points: List[EccentricityPointInput]

class EccentricityBatchResponse(BaseModel):
    recommended_load: float
    zero_error_e0: float
    results: List[EccentricityEvaluationResult]
    overall_compliant: bool

# --- 4. Tare and Zero Setting (Clauses A.4.2 & A.4.6) ---
class ZeroSettingInput(BaseModel):
    indication_observed: float
    delta_load: float

class TareBalancingInput(BaseModel):
    tare_load_applied: float
    net_load_applied: float
    indication_observed: float
    delta_load: float

class TareZeroBatchRequest(BaseModel):
    instrument: InstrumentMeta
    zero_setting: ZeroSettingInput
    tare_balancing: List[TareBalancingInput]

class TareZeroEvaluationResponse(BaseModel):
    zero_setting_error: float
    zero_setting_mpe: float # 0.25e
    zero_setting_compliant: bool
    tare_results: List[WeighingEvaluationResult]
    overall_compliant: bool

# --- 5. ISO/IEC Guide 98-3 (GUM) Measurement Uncertainty ---
class UncertaintyCalculationRequest(BaseModel):
    scale_interval_d: float
    repeatability_std_dev: float
    n_repeat_observations: int = 10
    standard_expanded_uncertainty_k2: Optional[float] = None
    coverage_factor_k: float = 2.0

