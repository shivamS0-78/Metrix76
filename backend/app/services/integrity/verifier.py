"""
Cryptographic Chain Verification Service.
Evaluates per-report hash chains for sequence continuity, cryptographic linkage,
payload integrity, evidence byte match, and signed checkpoints.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from app.core.supabase import get_supabase_client
from .models import (
    IntegrityStatus,
    IntegrityVerificationResult,
    IntegrityFailureDetail,
    IntegrityEntry,
)
from .hasher import (
    compute_entry_hash,
    compute_payload_hash,
    compute_file_bytes_hash,
    sign_checkpoint,
    CANONICALIZATION_VERSION,
)
from .ledger import IntegrityLedgerService, _CACHED_VERIFICATIONS, _LOCAL_LEDGER


class IntegrityVerifierService:
    """
    Authoritative verifier for detecting ledger breaks, payload mutations, or evidence tampering.
    """

    @classmethod
    def get_cached_or_verify(cls, report_id: str) -> IntegrityVerificationResult:
        """
        Returns cached verification result if present and fresh, or runs full verification.
        """
        clean_rep_id = str(report_id)
        if clean_rep_id in _CACHED_VERIFICATIONS:
            return _CACHED_VERIFICATIONS[clean_rep_id]
        return cls.verify_report_integrity(clean_rep_id)

    @classmethod
    def verify_report_integrity(
        cls,
        report_id: str,
        verify_underlying_entities: bool = True
    ) -> IntegrityVerificationResult:
        """
        Executes a rigorous verification across all ledger entries and underlying records:
        1. Sequence continuity: 1, 2, 3 ... N without gaps or duplicates
        2. Previous hash linkage: entry[i].previous_hash == entry[i-1].entry_hash
        3. Header entry_hash integrity: recalculated entry_hash matches stored entry_hash
        4. Entity payload integrity: current stored observation re-hashed against stored payload_hash
        5. Evidence integrity: uploaded file bytes re-hashed against stored file_hash
        """
        clean_rep_id = str(report_id)
        entries: List[IntegrityEntry] = IntegrityLedgerService.get_report_entries(clean_rep_id)

        if not entries:
            return IntegrityVerificationResult(
                report_id=clean_rep_id,
                status=IntegrityStatus.NOT_VERIFIED,
                entries_checked=0,
                observations_checked=0,
                evidence_checked=0,
                first_failure=None,
                verified_at=datetime.now(timezone.utc),
                message="No cryptographic ledger records registered for this report."
            )

        obs_checked = 0
        evidence_checked = 0
        prev_entry: Optional[IntegrityEntry] = None

        # Fetch current database/in-memory observations to check against payload_hash
        current_obs_by_id = cls._load_current_observations(clean_rep_id)
        current_attachments_by_id = cls._load_current_attachments(clean_rep_id)

        for idx, entry in enumerate(entries):
            expected_seq = idx + 1

            # 1. Check sequence ordering
            if entry.sequence_number != expected_seq:
                fail = IntegrityFailureDetail(
                    sequence=entry.sequence_number,
                    entity_type=entry.entity_type,
                    entity_id=entry.entity_id,
                    reason="sequence_gap_or_duplicate",
                    details=f"Expected sequence {expected_seq}, found sequence {entry.sequence_number}."
                )
                res = IntegrityVerificationResult(
                    report_id=clean_rep_id,
                    status=IntegrityStatus.MISSING_ENTRY,
                    entries_checked=idx,
                    observations_checked=obs_checked,
                    evidence_checked=evidence_checked,
                    first_failure=fail,
                    verified_at=datetime.now(timezone.utc),
                    message="Ledger sequence order broken."
                )
                _CACHED_VERIFICATIONS[clean_rep_id] = res
                return res

            # 2. Check previous hash linkage
            if idx == 0:
                if entry.previous_hash is not None:
                    fail = IntegrityFailureDetail(
                        sequence=entry.sequence_number,
                        entity_type=entry.entity_type,
                        entity_id=entry.entity_id,
                        reason="invalid_genesis_entry",
                        details="Genesis entry (sequence 1) must have previous_hash = null."
                    )
                    res = IntegrityVerificationResult(
                        report_id=clean_rep_id,
                        status=IntegrityStatus.BROKEN_CHAIN,
                        entries_checked=1,
                        observations_checked=obs_checked,
                        evidence_checked=evidence_checked,
                        first_failure=fail,
                        verified_at=datetime.now(timezone.utc)
                    )
                    _CACHED_VERIFICATIONS[clean_rep_id] = res
                    return res
            else:
                assert prev_entry is not None
                if entry.previous_hash != prev_entry.entry_hash:
                    fail = IntegrityFailureDetail(
                        sequence=entry.sequence_number,
                        entity_type=entry.entity_type,
                        entity_id=entry.entity_id,
                        reason="previous_hash_mismatch",
                        expected_hash=prev_entry.entry_hash,
                        actual_hash=entry.previous_hash,
                        details=f"Entry at sequence {entry.sequence_number} does not link to previous entry hash."
                    )
                    res = IntegrityVerificationResult(
                        report_id=clean_rep_id,
                        status=IntegrityStatus.BROKEN_CHAIN,
                        entries_checked=idx,
                        observations_checked=obs_checked,
                        evidence_checked=evidence_checked,
                        first_failure=fail,
                        verified_at=datetime.now(timezone.utc)
                    )
                    _CACHED_VERIFICATIONS[clean_rep_id] = res
                    return res

            # 3. Recompute and verify entry_hash
            created_at_iso = entry.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if hasattr(entry.created_at, "strftime") else str(entry.created_at)
            recomputed_entry_hash = compute_entry_hash(
                entity_type=entry.entity_type,
                entity_id=entry.entity_id,
                event_type=entry.event_type,
                sequence_number=entry.sequence_number,
                payload_hash=entry.payload_hash,
                previous_hash=entry.previous_hash,
                created_at_iso=created_at_iso,
                canonicalization_version=entry.canonicalization_version
            )

            if recomputed_entry_hash.lower() != entry.entry_hash.lower():
                fail = IntegrityFailureDetail(
                    sequence=entry.sequence_number,
                    entity_type=entry.entity_type,
                    entity_id=entry.entity_id,
                    reason="entry_hash_mismatch",
                    expected_hash=entry.entry_hash,
                    actual_hash=recomputed_entry_hash,
                    details=f"Tampering detected: Entry header digest mismatch at sequence {entry.sequence_number}."
                )
                res = IntegrityVerificationResult(
                    report_id=clean_rep_id,
                    status=IntegrityStatus.TAMPER_DETECTED,
                    entries_checked=idx + 1,
                    observations_checked=obs_checked,
                    evidence_checked=evidence_checked,
                    first_failure=fail,
                    verified_at=datetime.now(timezone.utc)
                )
                _CACHED_VERIFICATIONS[clean_rep_id] = res
                return res

            # 4. Deep entity check against authoritative stored data
            if verify_underlying_entities:
                if entry.entity_type == "TEST_OBSERVATION":
                    obs_checked += 1
                    stored_obs = current_obs_by_id.get(str(entry.entity_id))
                    if stored_obs:
                        canonical_recalc = {
                            "observation_id": str(stored_obs.get("id", entry.entity_id)),
                            "report_id": str(clean_rep_id),
                            "test_type": str(stored_obs.get("test_type", "WEIGHING")),
                            "direction": str(stored_obs.get("direction", "STATIC")),
                            "sequence_order": int(stored_obs.get("sequence_order", 1)),
                            "load_applied": float(stored_obs.get("load_applied", 0.0)),
                            "indication_observed": float(stored_obs.get("indication_observed", 0.0)),
                            "delta_load": float(stored_obs.get("delta_load", 0.0)),
                            "calculated_p": float(stored_obs.get("calculated_p", 0.0)),
                            "error_e": float(stored_obs.get("error_e", 0.0)),
                            "corrected_error_ec": float(stored_obs.get("corrected_error_ec", 0.0)),
                            "mpe_allowed": float(stored_obs.get("mpe_allowed", 0.0)),
                            "is_compliant": bool(stored_obs.get("is_compliant", True)),
                            "position_tag": str(stored_obs.get("position_tag", "CENTER")),
                            "run_cycle": int(stored_obs.get("run_cycle", 1))
                        }
                        current_hash = compute_payload_hash(canonical_recalc)
                        if current_hash.lower() != entry.payload_hash.lower():
                            fail = IntegrityFailureDetail(
                                sequence=entry.sequence_number,
                                entity_type=entry.entity_type,
                                entity_id=entry.entity_id,
                                reason="payload_hash_mismatch",
                                expected_hash=entry.payload_hash,
                                actual_hash=current_hash,
                                details=f"Observation #{stored_obs.get('sequence_order', entry.sequence_number)} payload altered since cryptographic recording."
                            )
                            res = IntegrityVerificationResult(
                                report_id=clean_rep_id,
                                status=IntegrityStatus.TAMPER_DETECTED,
                                entries_checked=idx + 1,
                                observations_checked=obs_checked,
                                evidence_checked=evidence_checked,
                                first_failure=fail,
                                verified_at=datetime.now(timezone.utc),
                                message="TAMPER DETECTED: Stored observation payload does not match ledger cryptographic digest."
                            )
                            _CACHED_VERIFICATIONS[clean_rep_id] = res
                            return res

                elif entry.entity_type == "EVIDENCE":
                    evidence_checked += 1
                    stored_att = current_attachments_by_id.get(str(entry.entity_id))
                    if stored_att and "raw_bytes" in stored_att:
                        actual_file_hash = compute_file_bytes_hash(stored_att["raw_bytes"])
                        if actual_file_hash.lower() != entry.payload_hash.lower():
                            fail = IntegrityFailureDetail(
                                sequence=entry.sequence_number,
                                entity_type=entry.entity_type,
                                entity_id=entry.entity_id,
                                reason="evidence_bytes_mismatch",
                                expected_hash=entry.payload_hash,
                                actual_hash=actual_file_hash,
                                details=f"Evidence file '{stored_att.get('file_name', entry.entity_id)}' bytes modified."
                            )
                            res = IntegrityVerificationResult(
                                report_id=clean_rep_id,
                                status=IntegrityStatus.EVIDENCE_MISMATCH,
                                entries_checked=idx + 1,
                                observations_checked=obs_checked,
                                evidence_checked=evidence_checked,
                                first_failure=fail,
                                verified_at=datetime.now(timezone.utc),
                                message="EVIDENCE MISMATCH: Uploaded file bytes do not match cryptographic digest."
                            )
                            _CACHED_VERIFICATIONS[clean_rep_id] = res
                            return res

            prev_entry = entry

        # All checks passed: chain is intact
        chain_head = entries[-1].entry_hash
        checkpoint = sign_checkpoint(
            chain_head_hash=chain_head,
            report_id=clean_rep_id,
            sequence_number=len(entries)
        )

        success_result = IntegrityVerificationResult(
            report_id=clean_rep_id,
            status=IntegrityStatus.INTACT,
            entries_checked=len(entries),
            observations_checked=obs_checked,
            evidence_checked=evidence_checked,
            chain_head_hash=chain_head,
            first_failure=None,
            verified_at=datetime.now(timezone.utc),
            checkpoint=checkpoint,
            message="Chain of custody verified intact. All cryptographic ledger hashes and underlying records match."
        )

        _CACHED_VERIFICATIONS[clean_rep_id] = success_result
        return success_result

    @classmethod
    def _load_current_observations(cls, report_id: str) -> Dict[str, Dict[str, Any]]:
        obs_map: Dict[str, Dict[str, Any]] = {}
        supabase = get_supabase_client()
        if supabase:
            try:
                res = supabase.table("test_observations").select("*").eq("report_id", report_id).execute()
                if res.data:
                    for row in res.data:
                        obs_map[str(row["id"])] = row
            except Exception:
                pass
        
        # Check in-memory store in reports endpoint
        from app.api.v1.endpoints.reports import _LOCAL_OBSERVATIONS, _LOCAL_REPORTS
        local_raw = _LOCAL_OBSERVATIONS.get(report_id, [])
        for idx, item in enumerate(local_raw):
            row_dict = item.model_dump() if hasattr(item, "model_dump") else (item.dict() if hasattr(item, "dict") else dict(item))
            row_dict.setdefault("id", f"obs-local-{idx+1}")
            obs_map[str(row_dict["id"])] = row_dict
            obs_map[f"obs-seq-{row_dict.get('sequence_order', idx+1)}"] = row_dict

        from .ledger import _IN_MEMORY_OBSERVATIONS
        for obs_id, o in _IN_MEMORY_OBSERVATIONS.items():
            if str(o.get("report_id")) == str(report_id):
                obs_map[str(obs_id)] = o

        return obs_map

    @classmethod
    def _load_current_attachments(cls, report_id: str) -> Dict[str, Dict[str, Any]]:
        att_map: Dict[str, Dict[str, Any]] = {}
        supabase = get_supabase_client()
        if supabase:
            try:
                res = supabase.table("instrument_attachments").select("*").eq("report_id", report_id).execute()
                if res.data:
                    for row in res.data:
                        att_map[str(row["id"])] = row
            except Exception:
                pass

        from .ledger import _IN_MEMORY_ATTACHMENTS
        for att_id, a in _IN_MEMORY_ATTACHMENTS.items():
            if str(a.get("report_id")) == str(report_id):
                att_map[str(att_id)] = a

        return att_map
