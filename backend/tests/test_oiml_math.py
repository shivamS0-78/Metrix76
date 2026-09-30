import pytest
import math
from app.schemas.metrology import (
    AccuracyClass,
    InstrumentMeta,
    WeighingPointInput,
    RepeatabilitySeriesInput,
    EccentricityPointInput,
    EccentricityGeometry,
    ZeroSettingInput,
    TareBalancingInput,
    ComplianceVerdict
)
from app.services.metrology import (
    OIMLR76Engine,
    RepeatabilityEvaluator,
    EccentricityEvaluator,
    TareZeroEvaluator,
    UncertaintyCalculator,
    InstrumentSanityEngine
)

@pytest.fixture
def class_iii_scale():
    return InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg"
    )

@pytest.fixture
def class_i_scale():
    return InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_I,
        max_capacity=0.5,
        min_capacity=0.001,
        scale_interval_d=0.00001,
        verification_interval_e=0.00001,
        unit="kg"
    )

# ------------------------------------------------------------------------------
# 1. Statutory MPE Threshold Tests (Table 6 OIML R 76-1)
# ------------------------------------------------------------------------------
def test_mpe_thresholds_class_iii(class_iii_scale):
    # m = L / e -> e = 0.002
    # 0 <= m <= 500 (0 to 1.0 kg) -> +-0.5e (0.001 kg)
    assert OIMLR76Engine.get_mpe(0.5, class_iii_scale) == 0.001
    assert OIMLR76Engine.get_mpe(1.0, class_iii_scale) == 0.001
    # 500 < m <= 2000 (1.0 to 4.0 kg) -> +-1.0e (0.002 kg)
    assert OIMLR76Engine.get_mpe(2.0, class_iii_scale) == 0.002
    assert OIMLR76Engine.get_mpe(4.0, class_iii_scale) == 0.002
    # 2000 < m <= 10000 (4.0 to 20.0 kg) -> +-1.5e (0.003 kg)
    assert OIMLR76Engine.get_mpe(10.0, class_iii_scale) == 0.003
    assert OIMLR76Engine.get_mpe(15.0, class_iii_scale) == 0.003

def test_mpe_thresholds_class_i(class_i_scale):
    # e = 0.00001 kg = 0.01 g
    # 0 <= m <= 50000 -> +-0.5e
    assert OIMLR76Engine.get_mpe(0.1, class_i_scale) == pytest.approx(0.000005)
    # 50000 < m <= 200000 -> +-1.0e
    assert OIMLR76Engine.get_mpe(1.0, class_i_scale) == pytest.approx(0.00001)
    # > 200000 -> +-1.5e
    assert OIMLR76Engine.get_mpe(3.0, class_i_scale) == pytest.approx(0.000015)

# ------------------------------------------------------------------------------
# 2. Clause A.4.4: Weighing Performance & Turning Point Discrete Rounding
# ------------------------------------------------------------------------------
def test_discrete_rounding_and_error_correction(class_iii_scale):
    points = [
        WeighingPointInput(load_applied=0.0, indication_observed=0.0, delta_load=0.001),
        WeighingPointInput(load_applied=10.0, indication_observed=9.998, delta_load=0.001),
        WeighingPointInput(load_applied=15.0, indication_observed=15.001, delta_load=0.001)
    ]
    res = OIMLR76Engine.evaluate_weighing_batch(class_iii_scale, points)
    assert res.overall_compliant is True
    # P = 9.998 + 0.001 - 0.001 = 9.998, E = -0.002, Ec = -0.002
    assert res.results[1].corrected_error_ec == -0.002
    assert res.results[1].is_compliant is True
    assert res.results[1].status in [ComplianceVerdict.PASS, ComplianceVerdict.WARN]

def test_weighing_performance_fail_condition(class_iii_scale):
    # Apply load with error breaching mpe (at 10 kg, mpe is 0.003)
    points = [
        WeighingPointInput(load_applied=0.0, indication_observed=0.0, delta_load=0.001),
        WeighingPointInput(load_applied=10.0, indication_observed=10.005, delta_load=0.001) # Error +0.005 > 0.003
    ]
    res = OIMLR76Engine.evaluate_weighing_batch(class_iii_scale, points)
    assert res.overall_compliant is False
    assert res.results[1].is_compliant is False
    assert res.results[1].status == ComplianceVerdict.FAIL

# ------------------------------------------------------------------------------
# 3. Clause A.4.10: Repeatability Test Suite
# ------------------------------------------------------------------------------
def test_repeatability_evaluator(class_iii_scale):
    # 10 observations at 0.5 Max (7.5 kg), mpe is 0.003 kg
    obs_half = [
        WeighingPointInput(load_applied=7.5, indication_observed=7.500, delta_load=0.001)
        for _ in range(8)
    ] + [
        WeighingPointInput(load_applied=7.5, indication_observed=7.501, delta_load=0.001),
        WeighingPointInput(load_applied=7.5, indication_observed=7.499, delta_load=0.001)
    ]
    
    series_input = [RepeatabilitySeriesInput(nominal_load=7.5, observations=obs_half)]
    batch_res = RepeatabilityEvaluator.evaluate_batch(class_iii_scale, series_input)
    
    assert batch_res.overall_compliant is True
    res = batch_res.series_results[0]
    assert res.delta_i == pytest.approx(0.002, abs=1e-5)
    assert res.standard_deviation_s > 0.0
    assert res.mpe_allowed == 0.003

def test_repeatability_evaluator_breach(class_iii_scale):
    # Delta I = 0.010 > mpe (0.003) -> Fail
    obs_spread = [
        WeighingPointInput(load_applied=15.0, indication_observed=15.000, delta_load=0.001),
        WeighingPointInput(load_applied=15.0, indication_observed=15.010, delta_load=0.001),
    ] + [WeighingPointInput(load_applied=15.0, indication_observed=15.000, delta_load=0.001) for _ in range(8)]
    
    series = [RepeatabilitySeriesInput(nominal_load=15.0, observations=obs_spread)]
    batch_res = RepeatabilityEvaluator.evaluate_batch(class_iii_scale, series)
    assert batch_res.overall_compliant is False
    assert batch_res.series_results[0].is_compliant is False

# ------------------------------------------------------------------------------
# 4. Clause A.4.7: Eccentricity (Corner Load) Suite
# ------------------------------------------------------------------------------
def test_eccentricity_evaluator_pass(class_iii_scale):
    # Recommended load is 1/3 Max = 5.0 kg
    points = [
        EccentricityPointInput(position_tag="CENTER", load_applied=5.0, indication_observed=5.000, delta_load=0.001),
        EccentricityPointInput(position_tag="CORNER_1", load_applied=5.0, indication_observed=5.000, delta_load=0.001),
        EccentricityPointInput(position_tag="CORNER_2", load_applied=5.0, indication_observed=5.002, delta_load=0.001),
        EccentricityPointInput(position_tag="CORNER_3", load_applied=5.0, indication_observed=5.000, delta_load=0.001),
        EccentricityPointInput(position_tag="CORNER_4", load_applied=5.0, indication_observed=4.998, delta_load=0.001),
    ]
    res = EccentricityEvaluator.evaluate_batch(class_iii_scale, points, EccentricityGeometry.FOUR_CORNERS)
    assert res.overall_compliant is True
    assert res.recommended_load == 5.0
    assert len(res.results) == 5
    assert all(r.is_compliant for r in res.results)

# ------------------------------------------------------------------------------
# 5. Clauses A.4.2 & A.4.6: Tare & Zero Setting Suite
# ------------------------------------------------------------------------------
def test_tare_zero_evaluator(class_iii_scale):
    # Zero test: E0 <= 0.25e = 0.0005 kg
    zero_in = ZeroSettingInput(indication_observed=0.0, delta_load=0.001)
    
    tare_inputs = [
        TareBalancingInput(tare_load_applied=2.0, net_load_applied=5.0, indication_observed=5.000, delta_load=0.001),
        TareBalancingInput(tare_load_applied=5.0, net_load_applied=5.0, indication_observed=5.000, delta_load=0.001)
    ]
    
    res = TareZeroEvaluator.evaluate_full_tare_zero(class_iii_scale, zero_in, tare_inputs)
    assert res.zero_setting_compliant is True
    assert res.zero_setting_mpe == 0.0005
    assert res.overall_compliant is True
    assert len(res.tare_results) == 2

# ------------------------------------------------------------------------------
# 6. ISO/IEC Guide 98-3 (GUM) Measurement Uncertainty Suite
# ------------------------------------------------------------------------------
def test_uncertainty_calculator():
    # Scale interval d = 0.002 kg, repeatability std dev s = 0.0008 kg, n = 10
    budget = UncertaintyCalculator.calculate_expanded_uncertainty(
        scale_interval_d=0.002,
        repeatability_std_dev=0.0008,
        n_repeat_observations=10,
        standard_expanded_uncertainty_k2=0.0002, # 0.2 g certificate uncertainty
        coverage_factor_k=2.0
    )
    
    assert budget.u_cal == 0.0001
    assert budget.u_res == pytest.approx(0.002 / (2 * math.sqrt(3)), rel=1e-4)
    assert budget.u_rep == pytest.approx(0.0008 / math.sqrt(10), rel=1e-4)
    assert budget.expanded_uncertainty_U > 0.0
    assert budget.coverage_factor_k == 2.0
