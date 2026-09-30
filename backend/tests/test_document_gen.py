import pytest
import datetime
from app.schemas.metrology import (
    AccuracyClass,
    InstrumentMeta,
    WeighingEvaluationResult,
    TestDirection,
    ComplianceVerdict
)
from app.services.reporting import (
    OIMLErrorChartEngine,
    OIMLPDFGenerator,
    OIMLDOCXGenerator
)

@pytest.fixture
def sample_report_context():
    spec = InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg"
    )

    observations = [
        WeighingEvaluationResult(
            load_applied=0.0,
            indication_observed=0.0,
            delta_load=0.001,
            calculated_p=0.0,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.001,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        ),
        WeighingEvaluationResult(
            load_applied=1.0,
            indication_observed=1.0,
            delta_load=0.001,
            calculated_p=1.0,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.001,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        ),
        WeighingEvaluationResult(
            load_applied=5.0,
            indication_observed=5.0,
            delta_load=0.001,
            calculated_p=5.0,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.002,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        ),
        WeighingEvaluationResult(
            load_applied=10.0,
            indication_observed=9.998,
            delta_load=0.001,
            calculated_p=9.998,
            true_error_e=-0.002,
            corrected_error_ec=-0.002,
            mpe_allowed=0.003,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        ),
        WeighingEvaluationResult(
            load_applied=15.0,
            indication_observed=15.001,
            delta_load=0.001,
            calculated_p=15.001,
            true_error_e=0.001,
            corrected_error_ec=0.001,
            mpe_allowed=0.003,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.INCREASING
        ),
        WeighingEvaluationResult(
            load_applied=10.0,
            indication_observed=10.000,
            delta_load=0.001,
            calculated_p=10.0,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.003,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.DECREASING
        ),
        WeighingEvaluationResult(
            load_applied=0.0,
            indication_observed=0.0,
            delta_load=0.001,
            calculated_p=0.0,
            true_error_e=0.0,
            corrected_error_ec=0.0,
            mpe_allowed=0.001,
            status=ComplianceVerdict.PASS,
            is_compliant=True,
            direction=TestDirection.DECREASING
        )
    ]

    return {
        "report_number": "OIML-2026-TR-0042",
        "created_date": "2026-09-25",
        "approved_date": "2026-09-25",
        "overall_verdict": True,
        "zero_error_e0": 0.0,
        "instrument": {
            "manufacturer_name": "Avery Metrology Ltd.",
            "model_name": "PreciseWeigh Pro 15",
            "serial_number": "SN-2026-NAWI-8891",
            "accuracy_class": "CLASS_III",
            "max_capacity": 15.0,
            "min_capacity": 0.1,
            "scale_interval_d": 0.002,
            "verification_interval_e": 0.002,
            "unit": "kg",
            "load_receptor_type": "Stainless Steel Platform",
            "indicator_make_model": "IND-2000-HD",
            "year_of_manufacture": 2026,
            "calculated_n": 7500
        },
        "reference_standard": {
            "set_identifier": "NPL-E2-SET-04",
            "accuracy_class": "E2",
            "certificate_number": "CAL-2025-0892",
            "calibrated_by": "National Physical Laboratory",
            "calibration_date": "2025-06-15",
            "expiry_date": "2026-06-15",
            "expanded_uncertainty_k2": 0.0001
        },
        "environment": {
            "ambient_temperature_celsius": 22.4,
            "relative_humidity_pct": 54.0,
            "atmospheric_pressure_hpa": 1013.25
        },
        "weighing_observations": observations,
        "conducted_by": "A. Sharma (Testing Metrologist)",
        "approved_by": "Dr. R. K. Mukherjee (Director of Metrology)",
        "sha256_hash": "a4f91b72e92c431b9f71c48996fb92427ae41e4649b934ca495991b7852b855"
    }

def test_weasyprint_pdf_generation(sample_report_context):
    from app.services.reporting.pdf_generator import HTML
    if HTML is None:
        pytest.skip("WeasyPrint GTK/Pango libraries are not installed on this host environment.")

    spec = InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg"
    )
    chart_png = OIMLErrorChartEngine.generate_error_curve_image(
        spec=spec,
        results=sample_report_context["weighing_observations"],
        dpi=150
    )

    pdf_gen = OIMLPDFGenerator()
    pdf_bytes = pdf_gen.render_pdf(
        report_context=sample_report_context,
        chart_png_bytes=chart_png
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 10000  # Substantial PDF document
    assert pdf_bytes.startswith(b"%PDF-")


def test_docx_report_generation(sample_report_context):
    spec = InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg"
    )
    chart_png = OIMLErrorChartEngine.generate_error_curve_image(
        spec=spec,
        results=sample_report_context["weighing_observations"],
        dpi=150
    )

    docx_bytes = OIMLDOCXGenerator.render_docx(
        report_context=sample_report_context,
        chart_png_bytes=chart_png
    )

    assert isinstance(docx_bytes, bytes)
    assert len(docx_bytes) > 10000
    # Valid ZIP/DOCX magic header is PK\x03\x04
    assert docx_bytes.startswith(b"PK\x03\x04")
