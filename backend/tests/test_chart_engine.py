import pytest
from app.schemas.metrology import (
    AccuracyClass,
    InstrumentMeta,
    WeighingEvaluationResult,
    TestDirection,
    ComplianceVerdict
)
from app.services.reporting.chart_engine import OIMLErrorChartEngine, generate_error_curve_image

@pytest.fixture
def class_iii_spec():
    return InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg"
    )

@pytest.fixture
def sample_weighing_results():
    loads = [0.0, 1.0, 5.0, 10.0, 15.0, 10.0, 5.0, 0.0]
    errors = [0.0, 0.0, -0.001, -0.002, -0.001, 0.0, 0.0, 0.0]
    directions = [
        TestDirection.INCREASING, TestDirection.INCREASING, TestDirection.INCREASING, TestDirection.INCREASING,
        TestDirection.INCREASING, TestDirection.DECREASING, TestDirection.DECREASING, TestDirection.DECREASING
    ]
    
    results = []
    for l, ec, d in zip(loads, errors, directions):
        results.append(
            WeighingEvaluationResult(
                load_applied=l,
                indication_observed=l + ec,
                delta_load=0.001,
                calculated_p=l + ec,
                true_error_e=ec,
                corrected_error_ec=ec,
                mpe_allowed=0.002 if l <= 4.0 else 0.003,
                status=ComplianceVerdict.PASS,
                is_compliant=True,
                direction=d
            )
        )
    return results

def test_generate_error_curve_image_png_bytes(class_iii_spec, sample_weighing_results):
    png_bytes = OIMLErrorChartEngine.generate_error_curve_image(class_iii_spec, sample_weighing_results, dpi=150)
    
    assert isinstance(png_bytes, bytes)
    assert len(png_bytes) > 5000  # Non-trivial image payload
    # Verify standard PNG binary magic header: \x89PNG\r\n\x1a\n
    assert png_bytes.startswith(b'\x89PNG\r\n\x1a\n')

def test_generate_error_curve_svg_string(class_iii_spec, sample_weighing_results):
    svg_str = OIMLErrorChartEngine.generate_error_curve_svg(class_iii_spec, sample_weighing_results)
    
    assert isinstance(svg_str, str)
    assert "<svg" in svg_str
    assert "</svg>" in svg_str
    assert "OIML R 76 Error of Indication Curve" in svg_str

def test_generate_error_curve_starter_signature():
    loads = [0.0, 5.0, 10.0, 15.0]
    errors = [0.0, -0.001, -0.002, -0.001]
    
    png_bytes = generate_error_curve_image(
        loads=loads,
        ec_errors=errors,
        e=0.002,
        accuracy_class="CLASS_III"
    )
    
    assert isinstance(png_bytes, bytes)
    assert png_bytes.startswith(b'\x89PNG\r\n\x1a\n')

def test_chart_generation_class_i():
    spec_i = InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_I,
        max_capacity=0.5,
        min_capacity=0.001,
        scale_interval_d=0.00001,
        verification_interval_e=0.00001,
        unit="kg"
    )
    results = [
        WeighingEvaluationResult(
            load_applied=0.1,
            indication_observed=0.1,
            delta_load=0.0,
            calculated_p=0.1,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.000005,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        )
    ]
    png_bytes = OIMLErrorChartEngine.generate_error_curve_image(spec_i, results, dpi=100)
    assert png_bytes.startswith(b'\x89PNG\r\n\x1a\n')
