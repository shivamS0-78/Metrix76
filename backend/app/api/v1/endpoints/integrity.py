"""
Cryptographic Integrity & Failure Explanation API Endpoints.
Conforms to ISO/IEC 17025 requirements for tamper-evident data chains and deterministic failure diagnostics.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel

from app.services.integrity import (
    IntegrityStatus,
    IntegrityEntry,
    IntegrityVerificationResult,
    IntegrityLedgerService,
    IntegrityVerifierService,
)
from app.services.metrology.explanations import (
    FailureExplanationGenerator,
    FailureExplanationResponse,
)
from app.api.v1.endpoints.reports import (
    get_report_detail,
    _LOCAL_REPORTS,
    _LOCAL_OBSERVATIONS,
)
from app.core.supabase import get_supabase_client

router = APIRouter()


class SimulateTamperRequest(BaseModel):
    sequence_number: Optional[int] = None
    target_observation_sequence: Optional[int] = 1
    new_indication_value: Optional[float] = 999.999
    tamper_mode: Optional[str] = "PAYLOAD_MISMATCH"
    reason: Optional[str] = "Simulated manual database alteration"


@router.get("/reports/{report_id}/failure-explanations", response_model=FailureExplanationResponse)
def get_report_failure_explanations(report_id: str):
    """
    Returns structured, clause-level explanations for all non-compliant observations
    derived directly from the authoritative OIMLR76Engine calculation results.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Test report not found")

    unit = rep.instrument.unit if (rep.instrument and hasattr(rep.instrument, "unit")) else "kg"

    # Fetch stored observations from Supabase or in-memory
    obs_list = []
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("test_observations").select("*").eq("report_id", report_id).order("sequence_order").execute()
            if res.data:
                obs_list = res.data
        except Exception as e:
            print(f"[Supabase] Error loading observations for explanations: {e}")

    if not obs_list:
        local_raw = _LOCAL_OBSERVATIONS.get(report_id, [])
        for idx, item in enumerate(local_raw):
            row_dict = item.model_dump() if hasattr(item, "model_dump") else (item.dict() if hasattr(item, "dict") else dict(item))
            row_dict.setdefault("id", f"obs-local-{idx+1}")
            # If evaluation calculation is available on report
            if idx < len(rep.weighing_observations):
                weigh_res = rep.weighing_observations[idx]
                row_dict["calculated_p"] = weigh_res.calculated_p
                row_dict["error_e"] = weigh_res.true_error_e
                row_dict["corrected_error_ec"] = weigh_res.corrected_error_ec
                row_dict["mpe_allowed"] = weigh_res.mpe_allowed
                row_dict["is_compliant"] = weigh_res.is_compliant
            obs_list.append(row_dict)

    return FailureExplanationGenerator.generate_for_report(
        report_id=report_id,
        observations=obs_list,
        unit=unit
    )


@router.get("/reports/{report_id}/integrity", response_model=IntegrityVerificationResult)
def get_report_integrity_status(
    report_id: str,
    force_verify: bool = Query(False, description="Whether to bypass cache and run deep re-verification")
):
    """
    Returns current cryptographic integrity status of the report.
    Returns cached result if fresh unless force_verify is True.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Test report not found")

    if force_verify:
        return IntegrityVerifierService.verify_report_integrity(report_id)
    return IntegrityVerifierService.get_cached_or_verify(report_id)


@router.post("/reports/{report_id}/integrity/verify", response_model=IntegrityVerificationResult)
def verify_report_integrity_chain(report_id: str):
    """
    Executes deep re-verification of the report's cryptographic hash chain,
    checking sequence continuity, previous_hash linkage, entry headers,
    underlying observation payloads, and evidence file hashes.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Test report not found")

    return IntegrityVerifierService.verify_report_integrity(report_id)


@router.get("/reports/{report_id}/integrity/entries", response_model=List[IntegrityEntry])
def list_report_integrity_entries(report_id: str):
    """
    Returns the complete read-only cryptographic ledger sequence for the specified report.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Test report not found")

    return IntegrityLedgerService.get_report_entries(report_id)


@router.get("/reports/{report_id}/integrity/entries/{entry_id}", response_model=IntegrityEntry)
def get_report_integrity_entry(report_id: str, entry_id: str):
    """
    Retrieves a single cryptographic ledger entry by ID.
    """
    entry = IntegrityLedgerService.get_entry_by_id(entry_id)
    if not entry or (entry.report_id and entry.report_id != report_id):
        raise HTTPException(status_code=404, detail="Integrity ledger entry not found")
    return entry


@router.post("/reports/{report_id}/integrity/simulate-tamper")
def simulate_observation_tamper(report_id: str, payload: SimulateTamperRequest):
    """
    DEVELOPMENT/TEST ONLY: Simulates an unauthorized manual alteration of an observation record
    in the database without updating the cryptographic ledger.
    Subsequent verification calls will detect TAMPER_DETECTED.
    """
    clean_rep_id = str(report_id)
    target_seq = payload.sequence_number if payload.sequence_number is not None else (payload.target_observation_sequence or 1)
    new_val = payload.new_indication_value or 999.999
    tamper_mode = payload.tamper_mode or "PAYLOAD_MISMATCH"

    mutated = False

    # 1. Mutate in Supabase if present
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("test_observations").select("*").eq("report_id", clean_rep_id).eq("sequence_order", target_seq).execute()
            if res.data:
                target_id = res.data[0]["id"]
                supabase.table("test_observations").update({
                    "indication_observed": new_val,
                    "corrected_error_ec": new_val
                }).eq("id", target_id).execute()
                mutated = True
        except Exception as e:
            print(f"[SimulateTamper] Supabase mutation note: {e}")

    # 2. Mutate in-memory store
    local_obs = _LOCAL_OBSERVATIONS.get(clean_rep_id, [])
    for obs in local_obs:
        if getattr(obs, "sequence_order", None) == target_seq:
            obs.indication_observed = new_val
            mutated = True
            break

    # Also mutate report.weighing_observations if present
    rep = get_report_detail(clean_rep_id)
    if rep and rep.weighing_observations and len(rep.weighing_observations) >= target_seq:
        rep.weighing_observations[target_seq - 1].indication_observed = new_val
        mutated = True

    # 3. Mutate via IntegrityLedgerService
    if not mutated:
        ledger_res = IntegrityLedgerService.simulate_tamper(
            report_id=clean_rep_id,
            sequence_number=target_seq,
            tamper_mode=tamper_mode
        )
        if ledger_res.get("status") == "TAMPER_SIMULATED":
            mutated = True

    if not mutated:
        raise HTTPException(
            status_code=404,
            detail=f"No observation found at sequence {target_seq} to tamper with."
        )

    # Invalidate cache so verification detects the alteration
    from app.services.integrity.ledger import _CACHED_VERIFICATIONS
    if clean_rep_id in _CACHED_VERIFICATIONS:
        del _CACHED_VERIFICATIONS[clean_rep_id]

    return {
        "status": "TAMPER_SIMULATED",
        "report_id": clean_rep_id,
        "tampered_sequence": target_seq,
        "new_indication": new_val,
        "message": f"Observation sequence {target_seq} was altered in database. Call POST /verify to detect tampering."
    }
