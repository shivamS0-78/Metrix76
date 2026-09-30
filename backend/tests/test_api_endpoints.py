import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_weighing_payload():
    return {
        "instrument": {
            "accuracy_class": "CLASS_III",
            "max_capacity": 15.0,
            "min_capacity": 0.1,
            "scale_interval_d": 0.002,
            "verification_interval_e": 0.002,
            "unit": "kg"
        },
        "points": [
            {"load_applied": 0.0, "indication_observed": 0.0, "delta_load": 0.001, "direction": "INCREASING"},
            {"load_applied": 5.0, "indication_observed": 5.0, "delta_load": 0.001, "direction": "INCREASING"},
            {"load_applied": 10.0, "indication_observed": 9.998, "delta_load": 0.001, "direction": "INCREASING"},
            {"load_applied": 15.0, "indication_observed": 15.001, "delta_load": 0.001, "direction": "INCREASING"}
        ]
    }


@pytest.fixture(autouse=True)
def seed_test_report():
    from datetime import datetime, timezone
    from app.api.v1.endpoints.reports import _LOCAL_REPORTS, _SAMPLE_INST, _SAMPLE_STD
    from app.schemas.report import ReportStatus, TechnicalChecklist, EnvironmentalConditions, TestReportDetail

    test_rep = TestReportDetail(
        id="rep-100",
        report_number="OIML-2026-TR-0100",
        attempt_number=1,
        status=ReportStatus.APPROVED,
        standard_version="OIML R 76-1:2006",
        instrument=_SAMPLE_INST,
        reference_standard=_SAMPLE_STD,
        environment=EnvironmentalConditions(
            ambient_temperature_celsius=22.5,
            relative_humidity_pct=55.0,
            atmospheric_pressure_hpa=1013.25
        ),
        technical_checklist=TechnicalChecklist(),
        overall_verdict=True,
        rejection_reason=None,
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        pdf_storage_path="generated-reports/rep-100.pdf",
        docx_storage_path="generated-reports/rep-100.docx",
        weighing_observations=[],
        repeatability_results=[],
        eccentricity_results=[],
        conducted_by="A. Verma (Testing Metrologist)",
        approved_by="Dr. R. K. Mukherjee (Director of Metrology)",
        approved_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    _LOCAL_REPORTS.append(test_rep)
    yield
    _LOCAL_REPORTS.clear()


def test_api_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"


def test_api_evaluate_weighing(sample_weighing_payload):
    res = client.post("/api/v1/metrology/evaluate-weighing", json=sample_weighing_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_compliant"] is True
    assert len(data["results"]) == 4
    assert "zero_error_e0" in data


def test_api_evaluate_repeatability():
    payload = {
        "instrument": {
            "accuracy_class": "CLASS_III",
            "max_capacity": 15.0,
            "min_capacity": 0.1,
            "scale_interval_d": 0.002,
            "verification_interval_e": 0.002,
            "unit": "kg"
        },
        "series": [
            {
                "nominal_load": 7.5,
                "observations": [
                    {"load_applied": 7.5, "indication_observed": 7.500, "delta_load": 0.001}
                    for _ in range(10)
                ]
            }
        ]
    }
    res = client.post("/api/v1/metrology/evaluate-repeatability", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_compliant"] is True
    assert len(data["series_results"]) == 1
    assert data["series_results"][0]["delta_i"] == 0.0


def test_api_evaluate_eccentricity():
    payload = {
        "instrument": {
            "accuracy_class": "CLASS_III",
            "max_capacity": 15.0,
            "min_capacity": 0.1,
            "scale_interval_d": 0.002,
            "verification_interval_e": 0.002,
            "unit": "kg"
        },
        "geometry": "FOUR_CORNERS",
        "points": [
            {"position_tag": "CENTER", "load_applied": 5.0, "indication_observed": 5.000, "delta_load": 0.001},
            {"position_tag": "CORNER_1", "load_applied": 5.0, "indication_observed": 5.000, "delta_load": 0.001},
            {"position_tag": "CORNER_2", "load_applied": 5.0, "indication_observed": 5.002, "delta_load": 0.001},
            {"position_tag": "CORNER_3", "load_applied": 5.0, "indication_observed": 5.000, "delta_load": 0.001},
            {"position_tag": "CORNER_4", "load_applied": 5.0, "indication_observed": 4.998, "delta_load": 0.001}
        ]
    }
    res = client.post("/api/v1/metrology/evaluate-eccentricity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["overall_compliant"] is True
    assert data["recommended_load"] == 5.0
    assert len(data["results"]) == 5


def test_api_calculate_uncertainty():
    payload = {
        "scale_interval_d": 0.002,
        "repeatability_std_dev": 0.0008,
        "n_repeat_observations": 10,
        "standard_expanded_uncertainty_k2": 0.0002,
        "coverage_factor_k": 2.0
    }
    res = client.post("/api/v1/metrology/calculate-uncertainty", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["u_cal"] == 0.0001
    assert data["expanded_uncertainty_U"] > 0
    assert data["coverage_factor_k"] == 2.0


def test_api_render_chart_png(sample_weighing_payload):
    res = client.post("/api/v1/metrology/render-chart-png", json=sample_weighing_payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(b"\x89PNG\r\n\x1a\n")


def test_api_render_chart_svg(sample_weighing_payload):
    res = client.post("/api/v1/metrology/render-chart-svg", json=sample_weighing_payload)
    assert res.status_code == 200
    assert "image/svg+xml" in res.headers["content-type"]
    assert "<svg" in res.text


def test_api_generate_pdf_for_report():
    from app.services.reporting.pdf_generator import HTML
    if HTML is None:
        pytest.skip("WeasyPrint GTK/Pango libraries are not installed on this host environment.")

    res = client.post("/api/v1/documents/reports/rep-100/generate-pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_api_generate_pdf_direct():
    from app.services.reporting.pdf_generator import HTML
    if HTML is None:
        pytest.skip("WeasyPrint GTK/Pango libraries are not installed on this host environment.")

    payload = {
        "report_context": {
            "report_number": "OIML-TEST-001",
            "created_date": "2026-09-29",
            "approved_date": "2026-09-29",
            "overall_verdict": True,
            "zero_error_e0": 0.0,
            "instrument": {
                "serial_number": "SN-TEST",
                "model_name": "TestScale",
                "manufacturer_name": "TestLab",
                "accuracy_class": "CLASS_III",
                "max_capacity": 15.0,
                "min_capacity": 0.1,
                "scale_interval_d": 0.002,
                "verification_interval_e": 0.002,
                "unit": "kg",
                "is_multi_interval": False,
                "calculated_n": 7500,
                "created_at": "2026-09-29T10:00:00Z"
            },
            "reference_standard": {
                "set_identifier": "STD-01",
                "accuracy_class": "E2",
                "certificate_number": "CERT-01",
                "calibrated_by": "NPL",
                "calibration_date": "2026-01-01",
                "expiry_date": "2027-01-01",
                "is_active": True,
                "is_expired": False,
                "days_to_expiry": 100,
                "created_at": "2026-09-29T10:00:00Z"
            },
            "environment": {
                "ambient_temperature_celsius": 22.0,
                "relative_humidity_pct": 50.0
            },
            "weighing_observations": [],
            "conducted_by": "Tester"
        }
    }
    res = client.post("/api/v1/documents/generate-pdf", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")


def test_api_generate_docx_for_report():
    res = client.post("/api/v1/documents/reports/rep-100/generate-docx")
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers["content-type"]
    assert res.content.startswith(b"PK\x03\x04")


def test_api_generate_docx_direct():
    payload = {
        "report_context": {
            "report_number": "OIML-TEST-001",
            "created_date": "2026-09-29",
            "approved_date": "2026-09-29",
            "overall_verdict": True,
            "zero_error_e0": 0.0,
            "instrument": {
                "serial_number": "SN-TEST",
                "model_name": "TestScale",
                "manufacturer_name": "TestLab",
                "accuracy_class": "CLASS_III",
                "max_capacity": 15.0,
                "min_capacity": 0.1,
                "scale_interval_d": 0.002,
                "verification_interval_e": 0.002,
                "unit": "kg"
            },
            "reference_standard": {
                "set_identifier": "STD-01",
                "accuracy_class": "E2",
                "certificate_number": "CERT-01",
                "calibrated_by": "NPL",
                "calibration_date": "2026-01-01",
                "expiry_date": "2027-01-01"
            },
            "environment": {
                "ambient_temperature_celsius": 22.0,
                "relative_humidity_pct": 50.0
            },
            "weighing_observations": [],
            "conducted_by": "Tester"
        }
    }
    res = client.post("/api/v1/documents/generate-docx", json=payload)
    assert res.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in res.headers["content-type"]
    assert res.content.startswith(b"PK\x03\x04")


def test_api_attachment_categories():
    res = client.get("/api/v1/attachments/categories")
    assert res.status_code == 200
    categories = res.json()
    types = [c["type"] for c in categories]
    assert "NAMEPLATE" in types
    assert "LEAD_SEAL" in types
    assert "LEVEL_BUBBLE" in types
    assert "OVERALL_FRONT" in types


def test_api_upload_attachment():
    # Create test image in memory
    img = Image.new("RGB", (100, 100), color="blue")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_byte_arr.seek(0)

    files = {"file": ("test_nameplate.jpg", img_byte_arr, "image/jpeg")}
    data = {
        "attachment_type": "NAMEPLATE",
        "instrument_id": "inst-test-01"
    }

    res = client.post("/api/v1/attachments/upload", files=files, data=data)
    assert res.status_code == 201
    resp_data = res.json()
    assert resp_data["attachment_type"] == "NAMEPLATE"
    assert "instrument-attachments/inst-test-01/nameplate_" in resp_data["storage_path"]
    assert resp_data["file_size_bytes"] > 0


def test_api_assign_role_invalid_role():
    res = client.post("/api/v1/auth/assign-role", json={"user_id": "usr-123", "role": "SUPERUSER"})
    assert res.status_code == 422

