from fastapi import APIRouter, HTTPException, Query, status
from datetime import datetime, date, timezone
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.schemas.report import (
    BatchObservationPayload,
    ReportSubmissionResponse,
    TestObservationRowPayload,
    TestReportCreate,
    TestReportSummary,
    TestReportDetail,
    PublicVerificationResponse,
    ReportStatus,
    EnvironmentalConditions,
    TechnicalChecklist,
)
from app.schemas.instrument import InstrumentOut
from app.schemas.reference_standard import ReferenceStandardOut
from app.schemas.metrology import (
    AccuracyClass,
    TestDirection,
    TestType,
    ComplianceVerdict,
    WeighingPointInput,
    WeighingEvaluationResult,
    EccentricityPointInput,
    EccentricityEvaluationResult,
    RepeatabilitySeriesInput,
    RepeatabilitySeriesResult,
    InstrumentMeta,
)
from app.services.metrology import (
    OIMLR76Engine,
    RepeatabilityEvaluator,
    EccentricityEvaluator,
    TareZeroEvaluator,
)
from app.core.supabase import get_supabase_client
from app.api.v1.endpoints.instruments import _LOCAL_CACHE as _LOCAL_INSTRUMENTS, _map_row_to_instrument
from app.api.v1.endpoints.reference_standards import _LOCAL_CACHE as _LOCAL_STANDARDS, _map_row_to_standard

router = APIRouter()

# Sample fixtures for tests
_SAMPLE_INST = InstrumentOut(
    id="inst-001",
    serial_number="WB-2026-9941",
    manufacturer_name="Mettler Toledo",
    model_name="Precision Pro 15k",
    accuracy_class=AccuracyClass.CLASS_III,
    max_capacity=15.0,
    min_capacity=0.04,
    scale_interval_d=0.002,
    verification_interval_e=0.002,
    unit="kg",
    is_multi_interval=False,
    multi_interval_spec=None,
    load_receptor_type="Platform",
    indicator_make_model="IND-2000",
    year_of_manufacture=2026,
    calculated_n=7500,
    attachments=[],
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
)

_SAMPLE_STD = ReferenceStandardOut(
    id="std-001",
    set_identifier="STD-F1-8842",
    accuracy_class="CLASS_F1",
    certificate_number="NABL/2026/CAL/9912",
    calibrated_by="National Physical Laboratory",
    calibration_date=date(2026, 1, 1),
    expiry_date=date(2026, 12, 31),
    expanded_uncertainty_k2=0.0001,
    nominal_range="1 mg to 50 kg",
    is_active=True,
    is_expired=False,
    days_to_expiry=90,
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
)

# In-memory performance cache (Supabase is authoritative persistence)
_LOCAL_REPORTS: List[TestReportDetail] = []
_LOCAL_OBSERVATIONS: Dict[str, List[TestObservationRowPayload]] = {}


def _get_instrument_helper(instrument_id: str) -> Optional[InstrumentOut]:
    """Retrieves instrument from Supabase or valid cache. Returns None if not found."""
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("instruments").select("*").eq("id", instrument_id).execute()
            if res.data and len(res.data) > 0:
                inst = _map_row_to_instrument(res.data[0])
                if not any(i.id == inst.id for i in _LOCAL_INSTRUMENTS):
                    _LOCAL_INSTRUMENTS.append(inst)
                return inst
        except Exception as e:
            print(f"[Supabase] Error fetching instrument: {e}")

    inst = next((i for i in _LOCAL_INSTRUMENTS if i.id == instrument_id), None)
    if inst:
        return inst
    return None


def _get_standard_helper(standard_id: str) -> Optional[ReferenceStandardOut]:
    """Retrieves reference standard from Supabase or valid cache. Returns None if not found."""
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("reference_standards").select("*").eq("id", standard_id).execute()
            if res.data and len(res.data) > 0:
                std = _map_row_to_standard(res.data[0])
                if not any(s.id == std.id for s in _LOCAL_STANDARDS):
                    _LOCAL_STANDARDS.append(std)
                return std
        except Exception as e:
            print(f"[Supabase] Error fetching standard: {e}")

    std = next((s for s in _LOCAL_STANDARDS if s.id == standard_id), None)
    if std:
        return std
    return None


def _map_row_to_report_summary(row: dict) -> TestReportSummary:
    inst = row.get("instruments") or {}
    return TestReportSummary(
        id=str(row["id"]),
        report_number=row["report_number"],
        instrument_serial=inst.get("serial_number", "N/A"),
        instrument_model=inst.get("model_name", "N/A"),
        manufacturer_name=inst.get("manufacturer_name", "N/A"),
        accuracy_class=AccuracyClass(inst.get("accuracy_class", "CLASS_III")),
        status=ReportStatus(row.get("status", "DRAFT")),
        overall_verdict=row.get("overall_verdict"),
        conducted_by_name=str(row.get("conducted_by", "Testing Metrologist")),
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")) if "created_at" in row else datetime.now(timezone.utc),
        updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")) if "updated_at" in row else datetime.now(timezone.utc)
    )


def _map_row_to_report_detail(row: dict) -> TestReportDetail:
    inst_raw = row.get("instruments") or {}
    std_raw = row.get("reference_standards") or {}

    max_cap = float(inst_raw.get("max_capacity", 15.0))
    e_val = float(inst_raw.get("verification_interval_e", 0.002))

    inst_obj = InstrumentOut(
        id=str(inst_raw.get("id", "inst-001")),
        serial_number=inst_raw.get("serial_number", "SN-UNKNOWN"),
        model_name=inst_raw.get("model_name", "Standard Scale"),
        manufacturer_name=inst_raw.get("manufacturer_name", "Metrology Dept"),
        accuracy_class=AccuracyClass(inst_raw.get("accuracy_class", "CLASS_III")),
        max_capacity=max_cap,
        min_capacity=float(inst_raw.get("min_capacity", 0.1)),
        scale_interval_d=float(inst_raw.get("scale_interval_d", 0.002)),
        verification_interval_e=e_val,
        unit=inst_raw.get("unit", "kg"),
        is_multi_interval=inst_raw.get("is_multi_interval", False),
        multi_interval_spec=inst_raw.get("multi_interval_spec"),
        load_receptor_type=inst_raw.get("load_receptor_type", "Platform"),
        indicator_make_model=inst_raw.get("indicator_make_model", "IND-2000"),
        year_of_manufacture=inst_raw.get("year_of_manufacture", 2026),
        calculated_n=int(round(max_cap / e_val)) if e_val > 0 else 0,
        attachments=[],
        created_at=datetime.fromisoformat(inst_raw["created_at"].replace("Z", "+00:00")) if "created_at" in inst_raw else datetime.now(timezone.utc)
    )

    exp_date_str = std_raw.get("expiry_date", "2027-01-01")
    cal_date_str = std_raw.get("calibration_date", "2026-01-01")
    exp_date = date.fromisoformat(exp_date_str) if isinstance(exp_date_str, str) else exp_date_str
    cal_date = date.fromisoformat(cal_date_str) if isinstance(cal_date_str, str) else cal_date_str

    std_obj = ReferenceStandardOut(
        id=str(std_raw.get("id", "std-001")),
        set_identifier=std_raw.get("set_identifier", "STD-SET-01"),
        accuracy_class=std_raw.get("accuracy_class", "E2"),
        certificate_number=std_raw.get("certificate_number", "CAL-2026-001"),
        calibrated_by=std_raw.get("calibrated_by", "National Metrology Lab"),
        calibration_date=cal_date,
        expiry_date=exp_date,
        expanded_uncertainty_k2=float(std_raw.get("expanded_uncertainty_k2", 0.0001)),
        nominal_range=std_raw.get("nominal_range", "1 mg to 50 kg"),
        is_active=std_raw.get("is_active", True),
        is_expired=exp_date < date.today(),
        days_to_expiry=(exp_date - date.today()).days,
        created_at=datetime.now(timezone.utc)
    )

    # Observations grouping
    obs_list: List[WeighingEvaluationResult] = []
    ecc_list: List[EccentricityEvaluationResult] = []
    rep_list: List[RepeatabilitySeriesResult] = []

    raw_obs = row.get("test_observations") or []
    sorted_obs = sorted(raw_obs, key=lambda x: x.get("sequence_order", 0))

    for o in sorted_obs:
        tt = o.get("test_type", "WEIGHING")
        if tt == "WEIGHING":
            obs_list.append(
                WeighingEvaluationResult(
                    load_applied=float(o.get("load_applied", 0)),
                    indication_observed=float(o.get("indication_observed", 0)),
                    delta_load=float(o.get("delta_load", 0)),
                    calculated_p=float(o.get("calculated_p", 0)),
                    true_error_e=float(o.get("error_e", 0)),
                    corrected_error_ec=float(o.get("corrected_error_ec", 0)),
                    mpe_allowed=float(o.get("mpe_allowed", 0.001)),
                    status=ComplianceVerdict.PASS if o.get("is_compliant", True) else ComplianceVerdict.FAIL,
                    is_compliant=bool(o.get("is_compliant", True)),
                    direction=TestDirection(o.get("direction", "INCREASING"))
                )
            )
        elif tt == "ECCENTRICITY":
            ecc_list.append(
                EccentricityEvaluationResult(
                    position_tag=o.get("position_tag", "CENTER"),
                    load_applied=float(o.get("load_applied", 0)),
                    indication_observed=float(o.get("indication_observed", 0)),
                    calculated_p=float(o.get("calculated_p", 0)),
                    corrected_error_ec=float(o.get("corrected_error_ec", 0)),
                    mpe_allowed=float(o.get("mpe_allowed", 0.001)),
                    is_compliant=bool(o.get("is_compliant", True))
                )
            )

    return TestReportDetail(
        id=str(row["id"]),
        report_number=row["report_number"],
        attempt_number=row.get("attempt_number", 1),
        status=ReportStatus(row.get("status", "DRAFT")),
        standard_version=row.get("standard_version", "OIML R 76-1:2006"),
        instrument=inst_obj,
        reference_standard=std_obj,
        environment=EnvironmentalConditions(
            ambient_temperature_celsius=float(row.get("ambient_temperature_celsius") or 22.5),
            relative_humidity_pct=float(row.get("relative_humidity_pct") or 55.0),
            atmospheric_pressure_hpa=float(row.get("atmospheric_pressure_hpa") or 1013.25)
        ),
        technical_checklist=TechnicalChecklist(**row.get("technical_checklist", {})) if isinstance(row.get("technical_checklist"), dict) else TechnicalChecklist(),
        overall_verdict=row.get("overall_verdict"),
        rejection_reason=row.get("rejection_reason"),
        sha256_hash=row.get("sha256_hash"),
        pdf_storage_path=row.get("pdf_storage_path"),
        docx_storage_path=row.get("docx_storage_path"),
        weighing_observations=obs_list,
        repeatability_results=rep_list,
        eccentricity_results=ecc_list,
        conducted_by=str(row.get("conducted_by", "Testing Metrologist")),
        approved_by=str(row.get("approved_by")) if row.get("approved_by") else None,
        approved_at=datetime.fromisoformat(row["approved_at"].replace("Z", "+00:00")) if row.get("approved_at") else None,
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")) if "created_at" in row else datetime.now(timezone.utc),
        updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")) if "updated_at" in row else datetime.now(timezone.utc)
    )


def _get_report_or_404(report_id: str) -> TestReportDetail:
    return get_report_detail(report_id)


def _generate_database_safe_report_number() -> str:
    """
    Generates a unique, database-safe report number formatted as OIML-YYYY-TR-NNNN.
    Queries the highest existing sequence number for the current year from test_reports.
    """
    now = datetime.now(timezone.utc)
    current_year = now.year
    prefix = f"OIML-{current_year}-TR-"
    max_seq = 0

    supabase = get_supabase_client()
    if supabase:
        try:
            res = (
                supabase.table("test_reports")
                .select("report_number")
                .like("report_number", f"{prefix}%")
                .order("report_number", desc=True)
                .limit(20)
                .execute()
            )
            if res.data:
                for row in res.data:
                    rn = row.get("report_number", "")
                    if rn.startswith(prefix):
                        suffix = rn[len(prefix):]
                        if suffix.isdigit():
                            max_seq = max(max_seq, int(suffix))
        except Exception as e:
            print(f"[Supabase] Error scanning report numbers: {e}")

    for r in _LOCAL_REPORTS:
        if r.report_number.startswith(prefix):
            suffix = r.report_number[len(prefix):]
            if suffix.isdigit():
                max_seq = max(max_seq, int(suffix))

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:04d}"


@router.post("/draft", response_model=TestReportDetail, status_code=status.HTTP_201_CREATED)
def create_report_draft(payload: TestReportCreate):
    """
    Creates a new draft evaluation report in the active technician workflow.
    Validates instrument passport and reference standard, records real environmental inputs.
    """
    instrument = _get_instrument_helper(payload.instrument_id)
    if not instrument:
        raise HTTPException(
            status_code=404,
            detail=f"Instrument '{payload.instrument_id}' not found in database. Please register instrument passport first."
        )

    standard = _get_standard_helper(payload.reference_standard_id)
    if not standard:
        raise HTTPException(
            status_code=404,
            detail=f"Reference standard '{payload.reference_standard_id}' not found in database."
        )

    if not standard.is_active or standard.expiry_date < date.today():
        raise HTTPException(status_code=422, detail="Selected reference standard is expired or inactive (ISO 17025 guardrail)")

    now = datetime.now(timezone.utc)
    report_num = _generate_database_safe_report_number()
    supabase = get_supabase_client()

    if supabase:
        try:
            # Resolve user ID for foreign key constraint
            conducted_by_id = payload.conducted_by or "5ec3c7f8-9d47-4024-9898-a4bbb4db1701"

            insert_data = {
                "report_number": report_num,
                "instrument_id": instrument.id,
                "reference_standard_id": standard.id,
                "attempt_number": 1,
                "status": "DRAFT",
                "standard_version": "OIML R 76-1:2006",
                "ambient_temperature_celsius": payload.ambient_temperature_celsius,
                "relative_humidity_pct": payload.relative_humidity_pct,
                "atmospheric_pressure_hpa": payload.atmospheric_pressure_hpa or 1013.25,
                "technical_checklist": payload.technical_checklist.model_dump() if payload.technical_checklist else {},
                "conducted_by": conducted_by_id,
            }
            res = supabase.table("test_reports").insert(insert_data).execute()
            if res.data and len(res.data) > 0:
                new_row = res.data[0]
                persisted_report = get_report_detail(new_row["id"])
                # Update in-memory cache
                if not any(r.id == persisted_report.id for r in _LOCAL_REPORTS):
                    _LOCAL_REPORTS.append(persisted_report)
                return persisted_report
        except Exception as e:
            print(f"[Supabase] Error creating report draft: {e}")

    # In-memory fallback
    report_id = f"rep-{len(_LOCAL_REPORTS) + 101:03d}"
    draft = TestReportDetail(
        id=report_id,
        report_number=report_num,
        attempt_number=1,
        status=ReportStatus.DRAFT,
        standard_version="OIML R 76-1:2006",
        instrument=instrument,
        reference_standard=standard,
        environment=EnvironmentalConditions(
            ambient_temperature_celsius=payload.ambient_temperature_celsius,
            relative_humidity_pct=payload.relative_humidity_pct,
            atmospheric_pressure_hpa=payload.atmospheric_pressure_hpa or 1013.25,
        ),
        technical_checklist=payload.technical_checklist or TechnicalChecklist(),
        overall_verdict=None,
        rejection_reason=None,
        sha256_hash=None,
        pdf_storage_path=None,
        docx_storage_path=None,
        weighing_observations=[],
        repeatability_results=[],
        eccentricity_results=[],
        conducted_by=payload.conducted_by or "Technician Draft",
        approved_by=None,
        approved_at=None,
        created_at=now,
        updated_at=now,
    )
    _LOCAL_REPORTS.append(draft)
    _LOCAL_OBSERVATIONS.setdefault(report_id, [])
    return draft


@router.put("/{report_id}/observations")
def upsert_report_observations(report_id: str, payload: BatchObservationPayload):
    """
    Authoritative Observation Upsert Engine:
    Recalculates all test points through OIMLR76Engine using the real instrument configuration:
    - Weighing performance (Clause A.4.4): P, E, E0 turning point, Ec, statutory MPE, compliance
    - Eccentricity (Clause A.4.7): center baseline E0, corner deviations Ec, statutory MPE
    - Repeatability (Clause A.4.10): series spread delta_i, standard deviation s, statutory MPE
    - Tare / Zero (Clauses A.4.2 & A.4.6): zero setting error against 0.25e, tare error
    Updates overall compliance verdict in Supabase test_reports.
    """
    rep = _get_report_or_404(report_id)
    if not rep.instrument:
        raise HTTPException(status_code=422, detail="Report does not have an associated instrument passport")

    inst = rep.instrument
    spec = InstrumentMeta(
        accuracy_class=inst.accuracy_class,
        max_capacity=inst.max_capacity,
        min_capacity=inst.min_capacity,
        scale_interval_d=inst.scale_interval_d,
        verification_interval_e=inst.verification_interval_e,
        unit=inst.unit or "kg",
        is_multi_interval=inst.is_multi_interval,
        multi_interval_ranges=inst.multi_interval_spec
    )
    e = spec.verification_interval_e

    # Group incoming observations by test_type
    weighing_obs = [
        o for o in payload.observations
        if (o.test_type.value if hasattr(o.test_type, "value") else str(o.test_type)) == "WEIGHING"
    ]
    ecc_obs = [
        o for o in payload.observations
        if (o.test_type.value if hasattr(o.test_type, "value") else str(o.test_type)) == "ECCENTRICITY"
    ]
    rep_obs = [
        o for o in payload.observations
        if (o.test_type.value if hasattr(o.test_type, "value") else str(o.test_type)) == "REPEATABILITY"
    ]
    tare_zero_obs = [
        o for o in payload.observations
        if (o.test_type.value if hasattr(o.test_type, "value") else str(o.test_type)) == "TARE_ZERO"
    ]

    obs_rows = []

    # 1. Authoritative Weighing Performance Calculation (Clause A.4.4)
    if weighing_obs:
        weigh_inputs = [
            WeighingPointInput(
                load_applied=o.load_applied,
                indication_observed=o.indication_observed,
                delta_load=o.delta_load,
                direction=o.direction
            )
            for o in weighing_obs
        ]
        weigh_res = OIMLR76Engine.evaluate_weighing_batch(spec, weigh_inputs)
        for o, res in zip(weighing_obs, weigh_res.results):
            obs_rows.append({
                "report_id": report_id,
                "test_type": "WEIGHING",
                "direction": o.direction.value if hasattr(o.direction, "value") else str(o.direction),
                "sequence_order": o.sequence_order,
                "load_applied": res.load_applied,
                "indication_observed": res.indication_observed,
                "delta_load": res.delta_load,
                "calculated_p": res.calculated_p,
                "error_e": res.true_error_e,
                "corrected_error_ec": res.corrected_error_ec,
                "mpe_allowed": res.mpe_allowed,
                "is_compliant": res.is_compliant,
                "position_tag": o.position_tag or "CENTER",
                "run_cycle": o.run_cycle or 1
            })

    # 2. Authoritative Eccentricity Calculation (Clause A.4.7)
    if ecc_obs:
        ecc_inputs = [
            EccentricityPointInput(
                position_tag=o.position_tag or "CENTER",
                load_applied=o.load_applied,
                indication_observed=o.indication_observed,
                delta_load=o.delta_load
            )
            for o in ecc_obs
        ]
        ecc_res = OIMLR76Engine.evaluate_eccentricity_batch(spec, ecc_inputs)
        for o, res in zip(ecc_obs, ecc_res.results):
            p = res.calculated_p
            err_e = round((o.indication_observed + 0.5 * e - o.delta_load) - o.load_applied, 5)
            obs_rows.append({
                "report_id": report_id,
                "test_type": "ECCENTRICITY",
                "direction": "STATIC",
                "sequence_order": o.sequence_order,
                "load_applied": res.load_applied,
                "indication_observed": res.indication_observed,
                "delta_load": o.delta_load,
                "calculated_p": p,
                "error_e": err_e,
                "corrected_error_ec": res.corrected_error_ec,
                "mpe_allowed": res.mpe_allowed,
                "is_compliant": res.is_compliant,
                "position_tag": res.position_tag,
                "run_cycle": o.run_cycle or 1
            })

    # 3. Authoritative Repeatability Calculation (Clause A.4.10)
    if rep_obs:
        cycles: Dict[int, List[TestObservationRowPayload]] = {}
        for o in rep_obs:
            c = o.run_cycle or 1
            cycles.setdefault(c, []).append(o)

        for c_idx, c_obs in cycles.items():
            nominal_load = c_obs[0].load_applied if c_obs else 0.0
            pts = [
                WeighingPointInput(
                    load_applied=o.load_applied,
                    indication_observed=o.indication_observed,
                    delta_load=o.delta_load,
                    direction=o.direction
                )
                for o in c_obs
            ]
            series = [RepeatabilitySeriesInput(nominal_load=nominal_load, observations=pts)]
            rep_res = OIMLR76Engine.evaluate_repeatability_batch(spec, series)
            series_comp = rep_res.overall_compliant
            series_mpe = rep_res.series_results[0].mpe_allowed if rep_res.series_results else OIMLR76Engine.get_mpe(nominal_load, spec)

            for o in c_obs:
                p = round(o.indication_observed + 0.5 * e - o.delta_load, 5)
                err_e = round(p - o.load_applied, 5)
                obs_rows.append({
                    "report_id": report_id,
                    "test_type": "REPEATABILITY",
                    "direction": "STATIC",
                    "sequence_order": o.sequence_order,
                    "load_applied": o.load_applied,
                    "indication_observed": o.indication_observed,
                    "delta_load": o.delta_load,
                    "calculated_p": p,
                    "error_e": err_e,
                    "corrected_error_ec": err_e,
                    "mpe_allowed": series_mpe,
                    "is_compliant": series_comp,
                    "position_tag": o.position_tag or "CENTER",
                    "run_cycle": c_idx
                })

    # 4. Authoritative Tare / Zero Calculation (Clauses A.4.2 & A.4.6)
    if tare_zero_obs:
        zero_limit = round(0.25 * e, 5)
        for o in tare_zero_obs:
            p = round(o.indication_observed + 0.5 * e - o.delta_load, 5)
            err_e = round(p - o.load_applied, 5)
            mpe = OIMLR76Engine.get_mpe(o.load_applied, spec) if o.load_applied > 0 else zero_limit
            is_comp = abs(err_e) <= (mpe + 1e-9)
            obs_rows.append({
                "report_id": report_id,
                "test_type": "TARE_ZERO",
                "direction": "STATIC",
                "sequence_order": o.sequence_order,
                "load_applied": o.load_applied,
                "indication_observed": o.indication_observed,
                "delta_load": o.delta_load,
                "calculated_p": p,
                "error_e": err_e,
                "corrected_error_ec": err_e,
                "mpe_allowed": mpe,
                "is_compliant": is_comp,
                "position_tag": o.position_tag or "ZERO_SETTING",
                "run_cycle": o.run_cycle or 1
            })

    # Calculate overall compliance verdict across all test points
    overall_verdict = all(row["is_compliant"] for row in obs_rows) if obs_rows else True
    now_iso = datetime.now(timezone.utc).isoformat()

    # Persist authoritative results to Supabase
    supabase = get_supabase_client()
    if supabase:
        try:
            # Delete existing observations for this report to maintain clean sequence ordering
            supabase.table("test_observations").delete().eq("report_id", report_id).execute()
            if obs_rows:
                supabase.table("test_observations").insert(obs_rows).execute()
            supabase.table("test_reports").update({
                "overall_verdict": overall_verdict,
                "updated_at": now_iso
            }).eq("id", report_id).execute()
        except Exception as e:
            print(f"[Supabase] Error persisting observations: {e}")

    # Update in-memory caches
    _LOCAL_OBSERVATIONS[report_id] = payload.observations
    if weighing_obs and 'weigh_res' in locals():
        rep.weighing_observations = weigh_res.results
    if ecc_obs and 'ecc_res' in locals():
        rep.eccentricity_results = ecc_res.results
    rep.overall_verdict = overall_verdict
    rep.updated_at = datetime.now(timezone.utc)

    return {
        "report_id": report_id,
        "overall_verdict": overall_verdict,
        "observations": payload.observations,
        "observations_count": len(obs_rows),
        "all_compliant": overall_verdict
    }


def _validate_observations_completeness(observations: List[TestObservationRowPayload]) -> None:
    """
    Validates that the observation payload contains the mandatory test measurements
    conforming to OIML R 76 requirements.
    """
    grouped_by_type: Dict[str, List[TestObservationRowPayload]] = {}
    for obs in observations:
        key = obs.test_type.value if hasattr(obs.test_type, "value") else str(obs.test_type)
        grouped_by_type.setdefault(key, []).append(obs)

    # 1. Weighing Performance (Clause A.4.4): Mandatory core test
    weighing_obs = grouped_by_type.get("WEIGHING", [])
    if not weighing_obs:
        raise HTTPException(
            status_code=422,
            detail="Submission rejected: Weighing performance test observations (Clause A.4.4) are required.",
        )

    if len(weighing_obs) < 5:
        raise HTTPException(
            status_code=422,
            detail=f"Submission rejected: Weighing performance test requires at least 5 observation points across the range, found {len(weighing_obs)}.",
        )

    directions = {obs.direction.value if hasattr(obs.direction, "value") else str(obs.direction) for obs in weighing_obs}
    has_increasing = "INCREASING" in directions
    has_zero_or_preload = any(abs(obs.load_applied) < 1e-7 for obs in weighing_obs)
    if not has_increasing or not has_zero_or_preload:
        raise HTTPException(
            status_code=422,
            detail="Submission rejected: Weighing performance test must include a zero-load point (L=0) and INCREASING direction observations.",
        )


@router.post("/{report_id}/submit", response_model=ReportSubmissionResponse)
def submit_report(report_id: str):
    """
    Validates report data, reference standard validity, environmental conditions,
    and observation completeness, then transitions the report to PENDING_APPROVAL.
    """
    rep = _get_report_or_404(report_id)

    if not rep.instrument:
        raise HTTPException(status_code=422, detail="Submission rejected: Instrument passport is required")

    if not rep.reference_standard:
        raise HTTPException(status_code=422, detail="Submission rejected: Reference standard is required")

    if rep.reference_standard.expiry_date < date.today() or not rep.reference_standard.is_active:
        raise HTTPException(
            status_code=422,
            detail="Submission rejected: Reference standard is expired or inactive (ISO 17025 guardrail)",
        )

    # Validate Environmental Conditions
    if rep.environment:
        temp = rep.environment.ambient_temperature_celsius
        rh = rep.environment.relative_humidity_pct
        min_temp = rep.environment.temp_min_allowed if rep.environment.temp_min_allowed is not None else -10.0
        max_temp = rep.environment.temp_max_allowed if rep.environment.temp_max_allowed is not None else 40.0

        if not (min_temp <= temp <= max_temp):
            raise HTTPException(
                status_code=422,
                detail=f"Submission rejected: Ambient temperature ({temp}°C) exceeds operational limits ({min_temp}°C to {max_temp}°C).",
            )
        if not (10.0 <= rh <= 90.0):
            raise HTTPException(
                status_code=422,
                detail=f"Submission rejected: Relative humidity ({rh}%) is outside acceptable range (10% - 90%).",
            )

    # Validate Observation Completeness
    observations = _LOCAL_OBSERVATIONS.get(report_id, [])
    supabase = get_supabase_client()
    if not observations and supabase:
        try:
            res = supabase.table("test_observations").select("*").eq("report_id", report_id).execute()
            if res.data:
                observations = [
                    TestObservationRowPayload(
                        test_type=r.get("test_type", "WEIGHING"),
                        direction=r.get("direction", "INCREASING"),
                        sequence_order=r.get("sequence_order", 1),
                        load_applied=float(r.get("load_applied", 0)),
                        indication_observed=float(r.get("indication_observed", 0)),
                        delta_load=float(r.get("delta_load", 0)),
                        position_tag=r.get("position_tag", "CENTER"),
                        run_cycle=r.get("run_cycle", 1)
                    )
                    for r in res.data
                ]
        except Exception as e:
            print(f"[Supabase] Error fetching observations: {e}")

    if not observations:
        raise HTTPException(status_code=422, detail="Submission rejected: No test observations recorded for this report")

    _validate_observations_completeness(observations)

    # Transition to PENDING_APPROVAL in Supabase
    now_iso = datetime.now(timezone.utc).isoformat()
    if supabase:
        try:
            supabase.table("test_reports").update({
                "status": "PENDING_APPROVAL",
                "updated_at": now_iso
            }).eq("id", report_id).execute()
        except Exception as e:
            print(f"[Supabase] Error submitting report: {e}")

    rep.status = ReportStatus.PENDING_APPROVAL
    rep.updated_at = datetime.now(timezone.utc)
    return ReportSubmissionResponse(
        report_id=rep.id,
        status=rep.status,
        message="Report submitted for approval successfully"
    )


class ReportRejectPayload(BaseModel):
    reason: Optional[str] = None
    remarks: Optional[str] = None


@router.post("/{report_id}/reject")
def reject_report(report_id: str, payload: Optional[ReportRejectPayload] = None):
    """
    Formally records report rejection with mandatory reason and transitions status to REJECTED.
    """
    rep = _get_report_or_404(report_id)
    reason = (payload.reason or payload.remarks or "Rejected during verification inspection").strip() if payload else "Rejected during verification inspection"
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase = get_supabase_client()
    if supabase:
        try:
            supabase.table("test_reports").update({
                "status": "REJECTED",
                "rejection_reason": reason,
                "overall_verdict": False,
                "updated_at": now_iso
            }).eq("id", report_id).execute()
        except Exception as e:
            print(f"[Supabase] Error rejecting report: {e}")

    rep.status = ReportStatus.REJECTED
    rep.rejection_reason = reason
    rep.overall_verdict = False
    rep.updated_at = datetime.now(timezone.utc)

    return {
        "report_id": report_id,
        "status": ReportStatus.REJECTED,
        "rejection_reason": reason,
        "returned_to_queue": True,
        "message": "Report rejected and returned to queue."
    }



@router.get("/archive", response_model=List[TestReportSummary])
def search_archive(
    query: Optional[str] = Query(None, description="Free text search: Serial, Model, Manufacturer, Report #"),
    accuracy_class: Optional[AccuracyClass] = None,
    status_filter: Optional[ReportStatus] = None,
    verdict: Optional[bool] = None,
    user_id: Optional[str] = Query(None, description="Scoped user ID for metrologist data isolation"),
    role: Optional[str] = Query(None, description="Active user role")
):
    """
    Module 6: Faceted search and filter engine for reports with multi-tenant user scoping.
    Queries live Supabase database as the authoritative source of truth.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            db_query = supabase.table("test_reports").select("*, instruments(*)")
            if status_filter:
                db_query = db_query.eq("status", status_filter.value)
            if verdict is not None:
                db_query = db_query.eq("overall_verdict", verdict)
            if role == "TECHNICIAN" and user_id:
                db_query = db_query.eq("conducted_by", user_id)

            res = db_query.order("created_at", desc=True).execute()
            if res.data is not None:
                filtered = []
                for r in res.data:
                    inst = r.get("instruments") or {}
                    if accuracy_class and inst.get("accuracy_class") != accuracy_class.value:
                        continue
                    if query:
                        q = query.lower()
                        match = (
                            q in r.get("report_number", "").lower() or
                            q in inst.get("serial_number", "").lower() or
                            q in inst.get("model_name", "").lower() or
                            q in inst.get("manufacturer_name", "").lower()
                        )
                        if not match:
                            continue
                    filtered.append(_map_row_to_report_summary(r))
                return filtered
        except Exception as e:
            print(f"[Supabase] Error searching archive: {e}")

    # In-memory fallback
    results = []
    for r in _LOCAL_REPORTS:
        if role == "TECHNICIAN" and user_id and r.conducted_by != user_id:
            continue
        if query:
            q = query.lower()
            matches = (
                q in r.report_number.lower() or
                q in r.instrument.serial_number.lower() or
                q in r.instrument.model_name.lower() or
                q in r.instrument.manufacturer_name.lower()
            )
            if not matches:
                continue

        if accuracy_class and r.instrument.accuracy_class != accuracy_class:
            continue
        if status_filter and r.status != status_filter:
            continue
        if verdict is not None and r.overall_verdict != verdict:
            continue

        results.append(
            TestReportSummary(
                id=r.id,
                report_number=r.report_number,
                instrument_serial=r.instrument.serial_number,
                instrument_model=r.instrument.model_name,
                manufacturer_name=r.instrument.manufacturer_name,
                accuracy_class=r.instrument.accuracy_class,
                status=r.status,
                overall_verdict=r.overall_verdict,
                conducted_by_name=r.conducted_by,
                created_at=r.created_at,
                updated_at=r.updated_at
            )
        )
    return results


@router.get("/{report_id}", response_model=TestReportDetail)
def get_report_detail(report_id: str):
    """
    Retrieves full test report record with observations and instrument from Supabase.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            res = (
                supabase.table("test_reports")
                .select("*, instruments(*), reference_standards(*), test_observations(*)")
                .eq("id", report_id)
                .execute()
            )
            if res.data and len(res.data) > 0:
                report_detail = _map_row_to_report_detail(res.data[0])
                # Update in-memory cache
                existing_idx = next((i for i, r in enumerate(_LOCAL_REPORTS) if r.id == report_id), None)
                if existing_idx is not None:
                    _LOCAL_REPORTS[existing_idx] = report_detail
                else:
                    _LOCAL_REPORTS.append(report_detail)
                return report_detail
        except Exception as e:
            print(f"[Supabase] Error fetching report: {e}")

    rep = next((r for r in _LOCAL_REPORTS if r.id == report_id), None)
    if not rep:
        raise HTTPException(status_code=404, detail="Test report not found")
    return rep


@router.get("/verify/{report_id}", response_model=PublicVerificationResponse)
def public_verify_report(report_id: str):
    """
    Module 6: Public Verification Portal resolving certificate validity from Supabase.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("test_reports").select("*, instruments(*)").eq("id", report_id).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                inst = row.get("instruments") or {}
                if row.get("status") != "APPROVED":
                    raise HTTPException(status_code=404, detail="Report is not approved for type verification")

                return PublicVerificationResponse(
                    is_valid=True,
                    report_number=row["report_number"],
                    status=ReportStatus(row["status"]),
                    instrument_serial=inst.get("serial_number", "UNKNOWN"),
                    manufacturer_name=inst.get("manufacturer_name", "UNKNOWN"),
                    model_name=inst.get("model_name", "UNKNOWN"),
                    accuracy_class=inst.get("accuracy_class", "CLASS_III"),
                    overall_verdict=bool(row.get("overall_verdict", True)),
                    approved_at=datetime.fromisoformat(row["approved_at"].replace("Z", "+00:00")) if row.get("approved_at") else None,
                    sha256_hash=row.get("sha256_hash", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
                    verified_at=datetime.now(timezone.utc)
                )
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Supabase] Error in public verify: {e}")

    rep = next((r for r in _LOCAL_REPORTS if r.id == report_id), None)
    if not rep or rep.status != ReportStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Valid approved certificate not found for this identifier")

    return PublicVerificationResponse(
        is_valid=True,
        report_number=rep.report_number,
        status=rep.status,
        instrument_serial=rep.instrument.serial_number,
        manufacturer_name=rep.instrument.manufacturer_name,
        model_name=rep.instrument.model_name,
        accuracy_class=rep.instrument.accuracy_class.value,
        overall_verdict=rep.overall_verdict if rep.overall_verdict is not None else True,
        approved_at=rep.approved_at,
        sha256_hash=rep.sha256_hash or "e3b0c44298fc1c149afbf4c8996fb924",
        verified_at=datetime.now(timezone.utc)
    )
