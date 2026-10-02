"""
Comprehensive Unit & Integration Tests for Clause-Level Failure Explanations.
Conforming to OIML R 76-1:2006 authoritative evaluation requirements.
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.metrology import (
    AccuracyClass,
    InstrumentMeta,
    WeighingPointInput,
    TestDirection,
)
from app.services.metrology import OIMLR76Engine
from app.services.metrology.explanations import (
    FailureExplanationGenerator,
    FailureCode,
    get_rule_metadata,
    format_clause_display,
)
from app.api.v1.endpoints.reports import (
    _LOCAL_REPORTS,
    _LOCAL_OBSERVATIONS,
    TestReportDetail,
    ReportStatus,
    EnvironmentalConditions,
    TechnicalChecklist,
)
from app.schemas.instrument import InstrumentOut
from app.schemas.reference_standard import ReferenceStandardOut

client = TestClient(app)


@pytest.fixture
def sample_spec():
    return InstrumentMeta(
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.005,
        verification_interval_e=0.005,
        unit="kg"
    )


def test_compliant_observations_produce_pass(sample_spec):
    # Compliant observation within MPE
    points = [
        WeighingPointInput(load_applied=0.0, indication_observed=0.0, delta_load=0.0025, direction=TestDirection.INCREASING),
        WeighingPointInput(load_applied=5.0, indication_observed=5.0, delta_load=0.0025, direction=TestDirection.INCREASING),
    ]
    batch_res = OIMLR76Engine.evaluate_weighing_batch(sample_spec, points)
    assert batch_res.overall_compliant is True

    obs_dicts = [
        {
            "id": "obs-comp-1",
            "test_type": "WEIGHING",
            "load_applied": r.load_applied,
            "indication_observed": r.indication_observed,
            "calculated_p": r.calculated_p,
            "error_e": r.true_error_e,
            "corrected_error_ec": r.corrected_error_ec,
            "mpe_allowed": r.mpe_allowed,
            "is_compliant": r.is_compliant,
            "sequence_order": idx + 1
        }
        for idx, r in enumerate(batch_res.results)
    ]

    resp = FailureExplanationGenerator.generate_for_report(
        report_id="rep-pass-001",
        observations=obs_dicts,
        unit="kg"
    )

    assert resp.overall_status == "PASS"
    assert resp.failed_tests == 0
    assert resp.failed_observations == 0
    assert len(resp.explanations) == 0


def test_weighing_mpe_failure_deterministic_values(sample_spec):
    # Intentionally failing point: applied 10 kg, indication 10.050 kg (error +0.050 kg against MPE 0.005 or 0.010 kg)
    points = [
        WeighingPointInput(load_applied=0.0, indication_observed=0.0, delta_load=0.0025, direction=TestDirection.INCREASING),
        WeighingPointInput(load_applied=10.0, indication_observed=10.050, delta_load=0.0025, direction=TestDirection.INCREASING),
    ]
    batch_res = OIMLR76Engine.evaluate_weighing_batch(sample_spec, points)
    assert batch_res.overall_compliant is False

    obs_dicts = [
        {
            "id": f"obs-{idx+1}",
            "test_type": "WEIGHING",
            "load_applied": r.load_applied,
            "indication_observed": r.indication_observed,
            "calculated_p": r.calculated_p,
            "error_e": r.true_error_e,
            "corrected_error_ec": r.corrected_error_ec,
            "mpe_allowed": r.mpe_allowed,
            "is_compliant": r.is_compliant,
            "sequence_order": idx + 1,
            "direction": "INCREASING"
        }
        for idx, r in enumerate(batch_res.results)
    ]

    resp = FailureExplanationGenerator.generate_for_report(
        report_id="rep-fail-001",
        observations=obs_dicts,
        unit="kg"
    )

    assert resp.overall_status == "FAIL"
    assert resp.failed_tests == 1
    assert resp.failed_observations == 1
    assert len(resp.explanations) == 1

    exp = resp.explanations[0]
    assert exp.failure_code == FailureCode.ERROR_EXCEEDS_MPE
    assert exp.clause_reference == "OIML R 76-1:2006 Clause A.4.4"
    assert exp.expected_value == 10.0
    assert exp.measured_value == 10.050
    assert exp.error_value == 0.05
    assert exp.allowed_limit == 0.005
    assert exp.excess_value == 0.045
    assert exp.margin_percentage == 900.0  # 900% beyond MPE

    # Verify 3 levels of explanations
    assert "Non-Compliant Observation #2" in exp.title  # Level 1
    assert "exceeds permissible limit" in exp.summary    # Level 2
    assert "Under OIML R 76-1:2006 Clause A.4.4" in exp.explanation  # Level 3
    assert "900.0% beyond allowable tolerance" in exp.explanation


def test_repeatability_failure_explanation():
    # Repeatability spread exceeding MPE
    obs_dicts = [
        {
            "id": "obs-rep-1",
            "test_type": "REPEATABILITY",
            "load_applied": 7.5,
            "indication_observed": 0.042,
            "delta_load": 0.042,
            "calculated_p": 7.542,
            "error_e": 0.042,  # spread delta_i
            "mpe_allowed": 0.010,
            "is_compliant": False,
            "run_cycle": 1,
            "sequence_order": 1
        }
    ]

    resp = FailureExplanationGenerator.generate_for_report("rep-fail-002", obs_dicts, unit="kg")
    assert resp.overall_status == "FAIL"
    assert len(resp.explanations) == 1

    exp = resp.explanations[0]
    assert exp.failure_code == FailureCode.REPEATABILITY_EXCEEDS_LIMIT
    assert exp.clause_reference == "OIML R 76-1:2006 Clause A.4.10"
    assert exp.excess_value == 0.032
    assert "Series 1 Spread Exceeded" in exp.title
    assert "ΔI = 0.042 kg" in exp.summary


def test_eccentricity_failure_explanation():
    obs_dicts = [
        {
            "id": "obs-ecc-1",
            "test_type": "ECCENTRICITY",
            "load_applied": 5.0,
            "indication_observed": 5.042,
            "calculated_p": 5.042,
            "error_e": 0.042,
            "corrected_error_ec": 0.042,
            "mpe_allowed": 0.010,
            "is_compliant": False,
            "position_tag": "TOP_RIGHT",
            "sequence_order": 2
        }
    ]

    resp = FailureExplanationGenerator.generate_for_report("rep-fail-003", obs_dicts, unit="kg")
    assert resp.overall_status == "FAIL"
    exp = resp.explanations[0]
    assert exp.failure_code == FailureCode.ECCENTRICITY_EXCEEDS_LIMIT
    assert exp.clause_reference == "OIML R 76-1:2006 Clause A.4.7"
    assert exp.position == "TOP_RIGHT"
    assert "TOP_RIGHT" in exp.title


def test_unconfigured_rule_reference_no_invented_clauses():
    # If a rule is explicitly unconfigured or disabled, clause_reference must be None
    rule_info = get_rule_metadata("WEIGHING", rule_context={"disable_rules": ["WEIGHING"]})
    assert rule_info["clause_reference"] is None
    assert format_clause_display(rule_info["clause_reference"]) == "Applicable rule reference is not configured."

    # When generator processes with unconfigured rule
    obs_dicts = [
        {
            "id": "obs-unknown-1",
            "test_type": "UNKNOWN_MODULE",
            "load_applied": 1.0,
            "indication_observed": 1.5,
            "error_e": 0.5,
            "mpe_allowed": 0.01,
            "is_compliant": False,
            "sequence_order": 1
        }
    ]
    resp = FailureExplanationGenerator.generate_for_report("rep-unconf", obs_dicts)
    assert resp.explanations[0].clause_reference is None


def test_failure_explanation_api_endpoint():
    # Seed local report with a failing observation
    report_id = "rep-test-api-fail"
    from app.api.v1.endpoints.reports import _SAMPLE_INST, _SAMPLE_STD
    rep_detail = TestReportDetail(
        id=report_id,
        report_number="M76-REP-FAIL-API",
        attempt_number=1,
        status=ReportStatus.DRAFT,
        standard_version="OIML R 76-1:2006",
        instrument=_SAMPLE_INST,
        reference_standard=_SAMPLE_STD,
        environment=EnvironmentalConditions(ambient_temperature_celsius=22.0, relative_humidity_pct=50.0),
        technical_checklist=TechnicalChecklist(),
        overall_verdict=False,
        rejection_reason=None,
        sha256_hash=None,
        pdf_storage_path=None,
        docx_storage_path=None,
        approved_by=None,
        approved_at=None,
        conducted_by="Technician Tester",
        created_at="2026-10-01T12:00:00Z",
        updated_at="2026-10-01T12:00:00Z",
        weighing_observations=[]
    )

    # Insert into local cache
    _LOCAL_REPORTS.append(rep_detail)

    # Put failing observation in batch endpoint
    payload = {
        "report_id": report_id,
        "observations": [
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 1,
                "load_applied": 0.0,
                "indication_observed": 0.0,
                "delta_load": 0.0025
            },
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 2,
                "load_applied": 10.0,
                "indication_observed": 10.050,  # 50 g error >> 10 g MPE
                "delta_load": 0.0025
            }
        ]
    }
    upsert_res = client.put(f"/api/v1/reports/{report_id}/observations", json=payload)
    assert upsert_res.status_code == 200

    # Call failure explanation API
    res = client.get(f"/api/v1/reports/{report_id}/failure-explanations")
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] == "FAIL"
    assert data["failed_tests"] == 1
    assert data["failed_observations"] == 1
    assert len(data["explanations"]) == 1
    assert data["explanations"][0]["failure_code"] == "ERROR_EXCEEDS_MPE"
    assert data["explanations"][0]["clause_reference"] == "OIML R 76-1:2006 Clause A.4.4"
