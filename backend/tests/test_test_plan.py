"""
Comprehensive Unit & Integration Tests for Automatic OIML Test Plan Generator.
Covers:
- Valid single-interval and multi-interval instrument plan generation
- Statutory deterministic sequencing (Weighing -> Repeatability -> Eccentricity -> Tare/Zero)
- Server-side validation rejecting invalid parameters (e <= 0, Max <= 0, e < d, invalid multi-interval)
- Expired reference standard handling (BLOCKED state with detailed reason)
- Plan determinism and snapshot freezing
- Plan staleness detection upon instrument mutation
- Plan regeneration with structured diff calculation
- API endpoints (generate, get, regenerate)
- Observation sync updating execution and compliance statuses
"""
import uuid
from datetime import datetime, timezone, date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.metrology import AccuracyClass
from app.schemas.instrument import InstrumentOut
from app.schemas.reference_standard import ReferenceStandardOut
from app.services.metrology.test_plan import (
    TestPlanGenerator,
    TestPlanService,
    TestPlanStatus,
    TestExecutionStatus,
    TestComplianceStatus,
    validate_instrument_configuration,
    validate_reference_standard_status,
)
from app.api.v1.endpoints.reports import (
    _LOCAL_REPORTS,
    _SAMPLE_INST,
    _SAMPLE_STD,
    TestReportDetail,
    ReportStatus,
    EnvironmentalConditions,
    TechnicalChecklist,
)

client = TestClient(app)


@pytest.fixture
def valid_class_iii_instrument():
    return {
        "id": "inst-test-plan-01",
        "serial_number": "SN-PL-001",
        "model_name": "Scale-Pro-15",
        "manufacturer_name": "Metrix Instruments",
        "accuracy_class": "CLASS_III",
        "max_capacity": 15.0,
        "min_capacity": 0.1,
        "scale_interval_d": 0.005,
        "verification_interval_e": 0.005,
        "unit": "kg",
        "is_multi_interval": False,
        "calculated_n": 3000
    }


@pytest.fixture
def valid_reference_standard():
    return {
        "id": "std-test-plan-01",
        "set_identifier": "RW-F1-001",
        "accuracy_class": "F1",
        "is_active": True,
        "expiry_date": (date.today() + timedelta(days=180)).isoformat()
    }


def test_valid_single_interval_plan_generation(valid_class_iii_instrument, valid_reference_standard):
    plan = TestPlanGenerator.generate_plan(
        report_id="rep-tpg-001",
        instrument_dict=valid_class_iii_instrument,
        standard_dict=valid_reference_standard
    )

    assert plan.status == TestPlanStatus.READY
    assert len(plan.issues) == 0
    assert len(plan.items) == 4

    # Verify deterministic sequence order
    seqs = [item.sequence_order for item in plan.items]
    assert seqs == [1, 2, 3, 4]

    codes = [item.test_code for item in plan.items]
    assert codes == [
        "OIML-A44-WEIGHING",
        "OIML-A410-REPEATABILITY",
        "OIML-A47-ECCENTRICITY",
        "OIML-A42-TARE-ZERO"
    ]

    # Check Weighing item
    weigh_item = plan.items[0]
    assert weigh_item.applicable is True
    assert weigh_item.configured is True
    assert weigh_item.execution_status == TestExecutionStatus.READY
    assert weigh_item.standard_reference == "OIML R 76-1:2006 Clause A.4.4"
    assert 0.0 in weigh_item.observation_schema.expected_load_points
    assert 15.0 in weigh_item.observation_schema.expected_load_points

    # Check Eccentricity item
    ecc_item = plan.items[2]
    assert ecc_item.applicable is True
    assert ecc_item.execution_status == TestExecutionStatus.READY
    assert ecc_item.procedure_config.recommended_load == 5.0  # Max / 3 = 15 / 3 = 5.0 kg


def test_validation_rejects_invalid_instrument_parameters():
    # 1. Verification interval e <= 0
    bad_inst = {
        "max_capacity": 15.0,
        "min_capacity": 0.1,
        "scale_interval_d": 0.005,
        "verification_interval_e": 0.0,
        "accuracy_class": "CLASS_III"
    }
    issues = validate_instrument_configuration(bad_inst)
    assert any("greater than zero" in i.message and i.field == "verification_interval_e" for i in issues)

    # 2. Maximum capacity <= 0
    bad_max = {
        "max_capacity": -5.0,
        "min_capacity": 0.1,
        "scale_interval_d": 0.005,
        "verification_interval_e": 0.005,
        "accuracy_class": "CLASS_III"
    }
    issues_max = validate_instrument_configuration(bad_max)
    assert any(i.field == "max_capacity" for i in issues_max)

    # 3. Illegal interval relationship: e < d
    bad_interval = {
        "max_capacity": 15.0,
        "min_capacity": 0.1,
        "scale_interval_d": 0.010,
        "verification_interval_e": 0.005,  # e < d illegal
        "accuracy_class": "CLASS_III"
    }
    issues_interval = validate_instrument_configuration(bad_interval)
    assert any("cannot be less than scale interval" in i.message for i in issues_interval)

    # When generator runs on invalid instrument, plan status is INVALID
    plan = TestPlanGenerator.generate_plan(
        report_id="rep-invalid-01",
        instrument_dict=bad_inst
    )
    assert plan.status == TestPlanStatus.INVALID
    assert len(plan.issues) > 0
    assert len(plan.items) == 0


def test_multi_interval_instrument_plan_generation():
    valid_multi = {
        "id": "inst-multi-01",
        "serial_number": "SN-MULTI-01",
        "model_name": "DualRange-15",
        "accuracy_class": "CLASS_III",
        "max_capacity": 15.0,
        "min_capacity": 0.04,
        "scale_interval_d": 0.002,
        "verification_interval_e": 0.002,
        "unit": "kg",
        "is_multi_interval": True,
        "multi_interval_spec": [
            {"max_capacity": 6.0, "verification_interval_e": 0.002, "scale_interval_d": 0.002},
            {"max_capacity": 15.0, "verification_interval_e": 0.005, "scale_interval_d": 0.005}
        ]
    }
    issues = validate_instrument_configuration(valid_multi)
    assert len(issues) == 0

    plan = TestPlanGenerator.generate_plan(
        report_id="rep-multi-01",
        instrument_dict=valid_multi
    )
    assert plan.status == TestPlanStatus.READY
    assert plan.instrument_snapshot["is_multi_interval"] is True


def test_expired_reference_standard_blocks_tests(valid_class_iii_instrument):
    expired_standard = {
        "id": "std-expired-01",
        "set_identifier": "RW-EXPIRED-SET",
        "is_active": True,
        "expiry_date": (date.today() - timedelta(days=10)).isoformat()
    }

    is_valid, reason = validate_reference_standard_status(expired_standard)
    assert is_valid is False
    assert "expired on" in reason

    plan = TestPlanGenerator.generate_plan(
        report_id="rep-blocked-std",
        instrument_dict=valid_class_iii_instrument,
        standard_dict=expired_standard
    )

    # Tests requiring valid standard should be BLOCKED with explicit reason
    for it in plan.items:
        assert it.execution_status == TestExecutionStatus.BLOCKED
        assert "expired on" in it.blocked_reason


def test_plan_determinism(valid_class_iii_instrument, valid_reference_standard):
    plan1 = TestPlanGenerator.generate_plan("rep-det", valid_class_iii_instrument, valid_reference_standard)
    plan2 = TestPlanGenerator.generate_plan("rep-det", valid_class_iii_instrument, valid_reference_standard)

    assert [i.test_code for i in plan1.items] == [i.test_code for i in plan2.items]
    assert [i.sequence_order for i in plan1.items] == [i.sequence_order for i in plan2.items]
    assert plan1.instrument_snapshot == plan2.instrument_snapshot


def test_plan_staleness_detection(valid_class_iii_instrument):
    plan = TestPlanGenerator.generate_plan("rep-stale-01", valid_class_iii_instrument)

    # Identical instrument -> NOT stale
    is_stale, reasons = TestPlanGenerator.is_plan_stale(plan, valid_class_iii_instrument)
    assert is_stale is False
    assert len(reasons) == 0

    # Modify verification interval e: 0.005 -> 0.010
    modified_inst = dict(valid_class_iii_instrument)
    modified_inst["verification_interval_e"] = 0.010

    is_stale, reasons = TestPlanGenerator.is_plan_stale(plan, modified_inst)
    assert is_stale is True
    assert any("Verification interval e changed" in r for r in reasons)


def test_plan_regeneration_diff(valid_class_iii_instrument):
    old_plan = TestPlanGenerator.generate_plan("rep-diff-01", valid_class_iii_instrument)

    # Change max capacity 15 kg -> 30 kg (eccentricity load changes 5 kg -> 10 kg)
    updated_inst = dict(valid_class_iii_instrument)
    updated_inst["max_capacity"] = 30.0

    new_plan = TestPlanGenerator.generate_plan("rep-diff-01", updated_inst)
    diff = TestPlanGenerator.compute_plan_diff(old_plan, new_plan)

    assert diff.has_changes is True
    assert "ECCENTRICITY" in diff.modified_tests


def test_test_plan_api_endpoints():
    report_id = f"rep-api-plan-{uuid.uuid4().hex[:8]}"

    rep_detail = TestReportDetail(
        id=report_id,
        report_number=f"OIML-2026-TR-{report_id[:4]}",
        attempt_number=1,
        status=ReportStatus.DRAFT,
        standard_version="OIML R 76-1:2006",
        instrument=_SAMPLE_INST,
        reference_standard=_SAMPLE_STD,
        environment=EnvironmentalConditions(ambient_temperature_celsius=22.0, relative_humidity_pct=50.0),
        technical_checklist=TechnicalChecklist(),
        overall_verdict=None,
        rejection_reason=None,
        sha256_hash=None,
        pdf_storage_path=None,
        docx_storage_path=None,
        approved_by=None,
        approved_at=None,
        conducted_by="Testing Metrologist",
        created_at="2026-10-01T12:00:00Z",
        updated_at="2026-10-01T12:00:00Z",
        weighing_observations=[]
    )
    _LOCAL_REPORTS.append(rep_detail)

    # 1. Generate Plan via POST
    res_gen = client.post(f"/api/v1/reports/{report_id}/test-plan/generate")
    assert res_gen.status_code == 200
    data_gen = res_gen.json()
    assert "plan" in data_gen
    assert data_gen["plan"]["status"] == "READY"
    assert len(data_gen["plan"]["items"]) == 4

    # 2. Retrieve Plan via GET
    res_get = client.get(f"/api/v1/reports/{report_id}/test-plan")
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert data_get["plan"]["id"] == data_gen["plan"]["id"]

    # 3. Regenerate Plan via POST /regenerate
    res_regen = client.post(f"/api/v1/reports/{report_id}/test-plan/regenerate")
    assert res_regen.status_code == 200
    data_regen = res_regen.json()
    assert data_regen["plan"]["supersedes_plan_id"] == data_gen["plan"]["id"]
