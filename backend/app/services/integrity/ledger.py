"""
Cryptographic Integrity Ledger Service.
Handles atomic, concurrency-protected append operations to the per-report hash chain.
Maintains tamper-evident records for observations, device measurements, evidence, and report lifecycle transitions.
"""
import uuid
import threading
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone

from app.core.supabase import get_supabase_client
from .models import IntegrityEntry
from .hasher import (
    compute_payload_hash,
    compute_entry_hash,
    compute_file_bytes_hash,
    CANONICALIZATION_VERSION,
    HASH_ALGORITHM,
)

# Concurrency locks per report_id to guarantee atomic sequence progression
_REPORT_LOCKS: Dict[str, threading.Lock] = {}
_GLOBAL_LOCK = threading.Lock()

# In-memory storage for test/offline environments
_LOCAL_LEDGER: Dict[str, List[IntegrityEntry]] = {}
_CACHED_VERIFICATIONS: Dict[str, Any] = {}
_IN_MEMORY_OBSERVATIONS: Dict[str, Dict[str, Any]] = {}
_IN_MEMORY_ATTACHMENTS: Dict[str, Dict[str, Any]] = {}


def _get_report_lock(report_id: str) -> threading.Lock:
    with _GLOBAL_LOCK:
        if report_id not in _REPORT_LOCKS:
            _REPORT_LOCKS[report_id] = threading.Lock()
        return _REPORT_LOCKS[report_id]


class IntegrityLedgerService:
    """
    Authoritative manager for appending and reading cryptographically linked ledger entries.
    """

    @classmethod
    def append_entry(
        cls,
        report_id: Optional[str],
        entity_type: str,
        entity_id: str,
        event_type: str,
        payload: Any,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        precomputed_payload_hash: Optional[str] = None
    ) -> IntegrityEntry:
        """
        Atomically appends a new entry to the cryptographic chain.
        Guarantees strictly sequential sequence_numbers and exact previous_hash linking.
        """
        clean_rep_id = str(report_id) if report_id else "global"
        lock = _get_report_lock(clean_rep_id)

        with lock:
            # 1. Compute payload hash
            payload_hash = precomputed_payload_hash or compute_payload_hash(payload)

            # 2. Determine next sequence number and previous hash
            entries = cls.get_report_entries(clean_rep_id)
            if entries:
                last_entry = entries[-1]
                next_seq = last_entry.sequence_number + 1
                prev_hash = last_entry.entry_hash
            else:
                next_seq = 1
                prev_hash = None  # Genesis entry

            # 3. Compute entry hash over header
            now_dt = datetime.now(timezone.utc)
            now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            entry_id = str(uuid.uuid4())

            entry_hash = compute_entry_hash(
                entity_type=entity_type,
                entity_id=str(entity_id),
                event_type=event_type,
                sequence_number=next_seq,
                payload_hash=payload_hash,
                previous_hash=prev_hash,
                created_at_iso=now_iso,
                canonicalization_version=CANONICALIZATION_VERSION
            )

            new_entry = IntegrityEntry(
                id=entry_id,
                report_id=report_id,
                entity_type=entity_type,
                entity_id=str(entity_id),
                event_type=event_type,
                sequence_number=next_seq,
                payload_hash=payload_hash,
                previous_hash=prev_hash,
                entry_hash=entry_hash,
                algorithm=HASH_ALGORITHM,
                canonicalization_version=CANONICALIZATION_VERSION,
                created_at=now_dt,
                created_by=user_id,
                metadata=metadata or {}
            )

            # 4. Persist to Supabase if available
            supabase = get_supabase_client()
            if supabase:
                try:
                    supabase.table("integrity_ledger").insert({
                        "id": new_entry.id,
                        "report_id": new_entry.report_id,
                        "entity_type": new_entry.entity_type,
                        "entity_id": new_entry.entity_id,
                        "event_type": new_entry.event_type,
                        "sequence_number": new_entry.sequence_number,
                        "payload_hash": new_entry.payload_hash,
                        "previous_hash": new_entry.previous_hash,
                        "entry_hash": new_entry.entry_hash,
                        "algorithm": new_entry.algorithm,
                        "canonicalization_version": new_entry.canonicalization_version,
                        "created_at": new_entry.created_at.isoformat(),
                        "created_by": new_entry.created_by,
                        "metadata": new_entry.metadata
                    }).execute()
                except Exception as e:
                    print(f"[IntegrityLedger] Supabase persist note: {e}")

            # 5. Append to in-memory store
            if clean_rep_id not in _LOCAL_LEDGER:
                _LOCAL_LEDGER[clean_rep_id] = []
            _LOCAL_LEDGER[clean_rep_id].append(new_entry)

            # 6. Invalidate cached verification result since chain has grown
            if clean_rep_id in _CACHED_VERIFICATIONS:
                del _CACHED_VERIFICATIONS[clean_rep_id]

            return new_entry

    @classmethod
    def get_report_entries(cls, report_id: str) -> List[IntegrityEntry]:
        """
        Retrieves all ledger entries for a report, ordered strictly by sequence_number ascending.
        """
        clean_rep_id = str(report_id)
        supabase = get_supabase_client()
        if supabase:
            try:
                res = supabase.table("integrity_ledger").select("*").eq("report_id", clean_rep_id).order("sequence_number", desc=False).execute()
                if res.data:
                    return [
                        IntegrityEntry(
                            id=row["id"],
                            report_id=row.get("report_id"),
                            entity_type=row["entity_type"],
                            entity_id=row["entity_id"],
                            event_type=row["event_type"],
                            sequence_number=row["sequence_number"],
                            payload_hash=row["payload_hash"],
                            previous_hash=row.get("previous_hash"),
                            entry_hash=row["entry_hash"],
                            algorithm=row.get("algorithm", HASH_ALGORITHM),
                            canonicalization_version=row.get("canonicalization_version", CANONICALIZATION_VERSION),
                            created_at=row["created_at"],
                            created_by=row.get("created_by"),
                            metadata=row.get("metadata") or {}
                        )
                        for row in res.data
                    ]
            except Exception as e:
                print(f"[IntegrityLedger] Supabase fetch note: {e}")

        # Fallback to local in-memory
        return list(_LOCAL_LEDGER.get(clean_rep_id, []))

    @classmethod
    def get_entry_by_id(cls, entry_id: str) -> Optional[IntegrityEntry]:
        supabase = get_supabase_client()
        if supabase:
            try:
                res = supabase.table("integrity_ledger").select("*").eq("id", str(entry_id)).execute()
                if res.data:
                    row = res.data[0]
                    return IntegrityEntry(
                        id=row["id"],
                        report_id=row.get("report_id"),
                        entity_type=row["entity_type"],
                        entity_id=row["entity_id"],
                        event_type=row["event_type"],
                        sequence_number=row["sequence_number"],
                        payload_hash=row["payload_hash"],
                        previous_hash=row.get("previous_hash"),
                        entry_hash=row["entry_hash"],
                        algorithm=row.get("algorithm", HASH_ALGORITHM),
                        canonicalization_version=row.get("canonicalization_version", CANONICALIZATION_VERSION),
                        created_at=row["created_at"],
                        created_by=row.get("created_by"),
                        metadata=row.get("metadata") or {}
                    )
            except Exception:
                pass

        for entries in _LOCAL_LEDGER.values():
            for e in entries:
                if e.id == str(entry_id):
                    return e
        return None

    @classmethod
    def record_observation_capture(
        cls,
        report_id: str,
        observation_id: str,
        observation_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Tuple[IntegrityEntry, str]:
        """
        Creates a canonical hash of an observation record and appends an OBSERVATION_CAPTURED entry.
        Returns: (IntegrityEntry, payload_hash)
        """
        canonical_obs = {
            "observation_id": str(observation_id),
            "report_id": str(report_id),
            "test_type": str(observation_data.get("test_type", "WEIGHING")),
            "direction": str(observation_data.get("direction", "STATIC")),
            "sequence_order": int(observation_data.get("sequence_order", 1)),
            "load_applied": float(observation_data.get("load_applied", 0.0)),
            "indication_observed": float(observation_data.get("indication_observed", 0.0)),
            "delta_load": float(observation_data.get("delta_load", 0.0)),
            "calculated_p": float(observation_data.get("calculated_p", 0.0)),
            "error_e": float(observation_data.get("error_e", 0.0)),
            "corrected_error_ec": float(observation_data.get("corrected_error_ec", 0.0)),
            "mpe_allowed": float(observation_data.get("mpe_allowed", 0.0)),
            "is_compliant": bool(observation_data.get("is_compliant", True)),
            "position_tag": str(observation_data.get("position_tag", "CENTER")),
            "run_cycle": int(observation_data.get("run_cycle", 1))
        }

        payload_hash = compute_payload_hash(canonical_obs)
        entry = cls.append_entry(
            report_id=report_id,
            entity_type="TEST_OBSERVATION",
            entity_id=str(observation_id),
            event_type="OBSERVATION_CAPTURED",
            payload=canonical_obs,
            user_id=user_id,
            metadata={
                "test_type": canonical_obs["test_type"],
                "sequence_order": canonical_obs["sequence_order"],
                "load_applied": canonical_obs["load_applied"]
            },
            precomputed_payload_hash=payload_hash
        )
        _IN_MEMORY_OBSERVATIONS[str(observation_id)] = dict(canonical_obs)
        return entry, payload_hash

    @classmethod
    def record_device_measurement(
        cls,
        report_id: str,
        measurement_id: str,
        measurement_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> IntegrityEntry:
        """
        Hashes full context of an automated raw hardware acquisition:
        raw_frame, parsed value, raw unit, normalized value, stability, timestamp, device session, source.
        """
        canonical_meas = {
            "measurement_id": str(measurement_id),
            "report_id": str(report_id),
            "raw_frame": str(measurement_data.get("raw_frame", "")),
            "parsed_value": float(measurement_data.get("parsed_value", 0.0)),
            "raw_unit": str(measurement_data.get("raw_unit", "kg")),
            "normalized_value": float(measurement_data.get("normalized_value", 0.0)),
            "stability_flag": bool(measurement_data.get("stability_flag", True)),
            "timestamp": str(measurement_data.get("timestamp", datetime.now(timezone.utc).isoformat())),
            "device_session": str(measurement_data.get("device_session", "DEFAULT_SESSION")),
            "source": str(measurement_data.get("source", "EDGE_SERIAL"))
        }
        return cls.append_entry(
            report_id=report_id,
            entity_type="DEVICE_MEASUREMENT",
            entity_id=str(measurement_id),
            event_type="MEASUREMENT_CAPTURED",
            payload=canonical_meas,
            user_id=user_id,
            metadata={
                "device_session": canonical_meas["device_session"],
                "source": canonical_meas["source"]
            }
        )

    @classmethod
    def record_evidence_upload(
        cls,
        report_id: Optional[str],
        attachment_id: str,
        file_bytes: bytes,
        metadata: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Tuple[IntegrityEntry, str]:
        """
        Hashes exact binary bytes of uploaded photographic/documentary evidence.
        Returns: (IntegrityEntry, sha256_hash)
        """
        file_hash = compute_file_bytes_hash(file_bytes)
        evidence_payload = {
            "attachment_id": str(attachment_id),
            "report_id": str(report_id) if report_id else None,
            "sha256_hash": file_hash,
            "size_bytes": len(file_bytes),
            "mime_type": str(metadata.get("content_type", metadata.get("mime_type", "application/octet-stream"))),
            "file_name": str(metadata.get("file_name", "evidence.bin")),
            "attachment_type": str(metadata.get("attachment_type", "GENERAL")),
            "storage_path": str(metadata.get("storage_path", "")),
            "uploaded_at": str(metadata.get("uploaded_at", datetime.now(timezone.utc).isoformat())),
            "supersedes_evidence_id": metadata.get("supersedes_evidence_id")
        }

        entry = cls.append_entry(
            report_id=report_id,
            entity_type="EVIDENCE",
            entity_id=str(attachment_id),
            event_type="EVIDENCE_RECORDED",
            payload=evidence_payload,
            user_id=user_id,
            metadata={
                "attachment_type": evidence_payload["attachment_type"],
                "file_name": evidence_payload["file_name"],
                "size_bytes": evidence_payload["size_bytes"]
            }
        )
        _IN_MEMORY_ATTACHMENTS[str(attachment_id)] = {
            "id": str(attachment_id),
            "report_id": str(report_id) if report_id else None,
            "file_bytes": file_bytes,
            **evidence_payload
        }
        return entry, file_hash

    @classmethod
    def record_evidence_attachment(
        cls,
        report_id: Optional[str],
        evidence_id: str,
        filename: str,
        file_bytes: bytes,
        mime_type: str = "application/pdf",
        user_id: Optional[str] = None
    ) -> Tuple[IntegrityEntry, str]:
        """Convenience alias for test and evidence uploads."""
        return cls.record_evidence_upload(
            report_id=report_id,
            attachment_id=evidence_id,
            file_bytes=file_bytes,
            metadata={
                "file_name": filename,
                "mime_type": mime_type,
                "attachment_type": "CALIBRATION_CERT"
            },
            user_id=user_id
        )

    @classmethod
    def record_report_lifecycle_event(
        cls,
        report_id: str,
        event_type: str,
        report_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> IntegrityEntry:
        """
        Captures major report state transitions:
        DRAFT_CREATED, OBSERVATION_CAPTURED, TEST_COMPLETED, REPORT_SUBMITTED, REPORT_APPROVED, REPORT_REJECTED.
        """
        canonical_state = {
            "report_id": str(report_id),
            "report_number": str(report_data.get("report_number", "")),
            "status": str(report_data.get("status", "DRAFT")),
            "overall_verdict": report_data.get("overall_verdict"),
            "standard_version": str(report_data.get("standard_version", "OIML R 76-1:2006")),
            "transition_event": str(event_type),
            "transition_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        return cls.append_entry(
            report_id=report_id,
            entity_type="REPORT",
            entity_id=str(report_id),
            event_type=event_type,
            payload=canonical_state,
            user_id=user_id,
            metadata={"status": canonical_state["status"]}
        )

    @classmethod
    def simulate_tamper(
        cls,
        report_id: str,
        sequence_number: int,
        tamper_mode: str = "PAYLOAD_MISMATCH"
    ) -> Dict[str, Any]:
        """
        Dev/testing utility to simulate tampering with a stored ledger entry or observation.
        """
        clean_rep_id = str(report_id)
        entries = cls.get_report_entries(clean_rep_id)
        target = next((e for e in entries if e.sequence_number == sequence_number), None)
        if not target:
            return {"status": "NOT_FOUND", "message": f"No entry at sequence {sequence_number}"}

        if tamper_mode == "PAYLOAD_MISMATCH":
            target_id = str(target.entity_id)
            if target_id in _IN_MEMORY_OBSERVATIONS:
                _IN_MEMORY_OBSERVATIONS[target_id]["indication_observed"] += 999.0
            else:
                target.payload_hash = "deadbeef" * 8
        elif tamper_mode == "BROKEN_CHAIN":
            target.previous_hash = "badcafe" * 8
        elif tamper_mode == "ENTRY_HASH_MISMATCH":
            target.entry_hash = "badhash" * 8

        if clean_rep_id in _CACHED_VERIFICATIONS:
            del _CACHED_VERIFICATIONS[clean_rep_id]

        return {"status": "TAMPER_SIMULATED", "sequence": sequence_number, "mode": tamper_mode}
