"""
Authoritative OIML R 76-1:2006 Test Definitions & Procedure Factories.
Provides backend-controlled procedural configurations, observation schemas, and statutory clause mappings.
"""
from typing import Dict, Any, List
from app.schemas.metrology import AccuracyClass, InstrumentMeta
from .models import (
    TestDefinition,
    ObservationSchema,
    ProcedureConfig,
)

GENERATOR_VERSION = "M76-TPG-V1"
STANDARD_VERSION = "OIML R 76-1:2006"
RULE_SET_VERSION = "2006"

# Centralized registry of supported OIML test procedures
SUPPORTED_TEST_DEFINITIONS: Dict[str, TestDefinition] = {
    "WEIGHING": TestDefinition(
        test_code="OIML-A44-WEIGHING",
        test_type="WEIGHING",
        title="Weighing Performance Test",
        description="Clause A.4.4: Evaluates indication errors across capacity range with turning-point changeover rounding corrections and zero-setting adjustment.",
        standard_reference="OIML R 76-1:2006 Clause A.4.4",
        rule_version="2006",
        sequence_order=1,
        prerequisites=[],
        required_standards={"type": "STANDARD_WEIGHTS", "min_accuracy_multiplier": 3},
        enabled=True,
        configuration_status="CONFIGURED"
    ),
    "REPEATABILITY": TestDefinition(
        test_code="OIML-A410-REPEATABILITY",
        test_type="REPEATABILITY",
        title="Repeatability Test",
        description="Clause A.4.10: Evaluates variance between consecutive weighings of identical loads (delta_i = P_max - P_min) across at least 3 series of 10 cycles.",
        standard_reference="OIML R 76-1:2006 Clause A.4.10",
        rule_version="2006",
        sequence_order=2,
        prerequisites=["WEIGHING"],
        required_standards={"type": "STANDARD_WEIGHTS"},
        enabled=True,
        configuration_status="CONFIGURED"
    ),
    "ECCENTRICITY": TestDefinition(
        test_code="OIML-A47-ECCENTRICITY",
        test_type="ECCENTRICITY",
        title="Eccentricity (Corner Load) Test",
        description="Clause A.4.7: Evaluates corner loading errors across 4 quadrants against the central receptor reference baseline using 1/3 Max.",
        standard_reference="OIML R 76-1:2006 Clause A.4.7",
        rule_version="2006",
        sequence_order=3,
        prerequisites=["WEIGHING"],
        required_standards={"type": "STANDARD_WEIGHTS"},
        enabled=True,
        configuration_status="CONFIGURED"
    ),
    "TARE_ZERO": TestDefinition(
        test_code="OIML-A42-TARE-ZERO",
        test_type="TARE_ZERO",
        title="Tare Balancing & Zero-Setting Test",
        description="Clauses A.4.2 & A.4.6: Evaluates accuracy of zero-setting device (|E0| <= 0.25e) and tare mechanism balancing linearity.",
        standard_reference="OIML R 76-1:2006 Clause A.4.2 / A.4.6",
        rule_version="2006",
        sequence_order=4,
        prerequisites=["WEIGHING"],
        required_standards={"type": "STANDARD_WEIGHTS"},
        enabled=True,
        configuration_status="CONFIGURED"
    )
}


def build_weighing_procedure(spec: InstrumentMeta) -> tuple[ObservationSchema, ProcedureConfig]:
    """
    Computes statutory OIML R 76 Table 6 step change boundaries and required test loads.
    """
    e = spec.verification_interval_e
    max_cap = spec.max_capacity
    min_cap = spec.min_capacity

    # Identify MPE transition thresholds in units of 'e'
    if spec.accuracy_class == AccuracyClass.CLASS_I:
        m1, m2 = 50000, 200000
    elif spec.accuracy_class == AccuracyClass.CLASS_II:
        m1, m2 = 5000, 20000
    elif spec.accuracy_class == AccuracyClass.CLASS_III:
        m1, m2 = 500, 2000
    else:  # CLASS_IIII
        m1, m2 = 50, 200

    step1_load = round(m1 * e, 5)
    step2_load = round(m2 * e, 5)

    # Generate recommended statutory test points
    target_loads = [0.0]
    if min_cap > 0 and min_cap not in target_loads:
        target_loads.append(min_cap)

    if step1_load < max_cap and step1_load not in target_loads:
        target_loads.append(step1_load)
    
    half_load = round(max_cap * 0.5, 5)
    if half_load < max_cap and half_load not in target_loads:
        target_loads.append(half_load)

    if step2_load < max_cap and step2_load not in target_loads:
        target_loads.append(step2_load)

    if max_cap not in target_loads:
        target_loads.append(max_cap)

    target_loads = sorted(list(set(target_loads)))

    # Construct descriptive procedure points
    calculated_points = []
    for l in target_loads:
        calculated_points.append({
            "load": l,
            "unit": spec.unit,
            "direction": "INCREASING",
            "is_statutory_boundary": l in [0.0, min_cap, step1_load, step2_load, max_cap]
        })

    # Return descending points for hysteresis check
    descending_loads = [l for l in reversed(target_loads) if l < max_cap]
    for l in descending_loads:
        calculated_points.append({
            "load": l,
            "unit": spec.unit,
            "direction": "DECREASING",
            "is_statutory_boundary": l in [0.0, min_cap, step1_load, step2_load]
        })

    obs_schema = ObservationSchema(
        minimum_observations=len(calculated_points),
        requires_zero=True,
        directions=["INCREASING", "DECREASING"],
        expected_load_points=target_loads,
        positions=["CENTER"]
    )

    proc_config = ProcedureConfig(
        parameters={
            "verification_interval_e": e,
            "scale_interval_d": spec.scale_interval_d,
            "step1_threshold_load": step1_load,
            "step2_threshold_load": step2_load,
            "unit": spec.unit,
            "fractional_weights_step": round(0.1 * e, 6)
        },
        instructions="Apply test loads in increasing order up to Max, then decreasing back to zero. Use small changeover weights (0.1e) to find exact turning points.",
        calculated_load_points=calculated_points,
        tolerance_summary=f"Table 6 limits: ±0.5e up to {step1_load}{spec.unit}, ±1.0e up to {step2_load}{spec.unit}, ±1.5e up to Max."
    )

    return obs_schema, proc_config


def build_repeatability_procedure(spec: InstrumentMeta) -> tuple[ObservationSchema, ProcedureConfig]:
    max_cap = spec.max_capacity
    nominal_loads = [
        round(max_cap * 0.5, 5),
        round(max_cap * 1.0, 5),
        round(max_cap * 0.5, 5)
    ]

    obs_schema = ObservationSchema(
        minimum_observations=30,  # 3 series of 10
        requires_zero=True,
        directions=["STATIC"],
        expected_load_points=nominal_loads,
        series_count=3,
        runs_per_series=10
    )

    proc_config = ProcedureConfig(
        parameters={
            "series_count": 3,
            "runs_per_series": 10,
            "series_nominal_loads": [
                {"series": "A", "load": nominal_loads[0], "fraction": "0.5 Max"},
                {"series": "B", "load": nominal_loads[1], "fraction": "1.0 Max"},
                {"series": "C", "load": nominal_loads[2], "fraction": "0.5 Max"}
            ],
            "unit": spec.unit
        },
        instructions="Execute at least 10 consecutive weighings for each nominal load series without zero readjustment during the run.",
        tolerance_summary="Maximum difference between any two results (delta_i = P_max - P_min) shall not exceed the absolute MPE for that load."
    )

    return obs_schema, proc_config


def build_eccentricity_procedure(spec: InstrumentMeta) -> tuple[ObservationSchema, ProcedureConfig]:
    max_cap = spec.max_capacity
    rec_load = round(max_cap / 3.0, 5)
    positions = ["CENTER", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_RIGHT", "BOTTOM_LEFT"]

    obs_schema = ObservationSchema(
        minimum_observations=5,
        requires_zero=True,
        directions=["STATIC"],
        expected_load_points=[rec_load],
        positions=positions
    )

    proc_config = ProcedureConfig(
        parameters={
            "recommended_load": rec_load,
            "load_formula": "Max / 3",
            "positions": positions,
            "unit": spec.unit
        },
        instructions="Apply 1/3 Max load sequentially to center and four quadrant corners. Central reading serves as reference baseline for corner deviations.",
        recommended_load=rec_load,
        tolerance_summary="Corner error Ec after baseline zero subtraction shall not exceed statutory MPE for 1/3 Max."
    )

    return obs_schema, proc_config


def build_tare_zero_procedure(spec: InstrumentMeta) -> tuple[ObservationSchema, ProcedureConfig]:
    e = spec.verification_interval_e
    zero_limit = round(0.25 * e, 6)

    obs_schema = ObservationSchema(
        minimum_observations=2,
        requires_zero=True,
        directions=["STATIC"],
        expected_load_points=[0.0, round(spec.max_capacity * 0.3, 5)],
        positions=["CENTER"]
    )

    proc_config = ProcedureConfig(
        parameters={
            "zero_setting_limit": zero_limit,
            "unit": spec.unit,
            "tare_test_load": round(spec.max_capacity * 0.3, 5)
        },
        instructions="Determine zero-setting turning error (|E0| <= 0.25e). Apply tare load, balance tare, and test net weighing accuracy.",
        tolerance_summary=f"Zero error must not exceed ±0.25e (±{zero_limit} {spec.unit}). Tare balancing net error must satisfy Table 6 MPE."
    )

    return obs_schema, proc_config
