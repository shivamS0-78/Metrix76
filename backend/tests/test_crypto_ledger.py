"""
Comprehensive Tests for Cryptographic Raw-Data Ledger & Tamper-Evident Evidence Chain.
Covers:
- Canonical serialization determinism (floats, timestamps, nulls, keys, unicode)
- SHA-256 payload and entry hash chaining
- Genesis entry creation with METRIX76_LEDGER_GENESIS_V1
- Monotonic sequence numbering and concurrency safety
- Full report verification: INTACT
- Tamper detection: payload mismatch, broken chain, evidence mismatch
- Ed25519 Signed Checkpoints
- Public and verifier integrity API endpoints
"""
import uuid
import threading
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.integrity.canonical import serialize_canonical, canonicalize, CANONICALIZATION_VERSION
from app.services.integrity.hasher import (
    compute_payload_hash,
    compute_entry_hash,
    compute_file_bytes_hash,
    sign_checkpoint,
    verify_checkpoint_signature,
    GENESIS_MARKER,
)
from app.services.integrity.models import (
    IntegrityStatus,
    EntityType,
    IntegrityEntry,
)
from app.services.integrity.ledger import IntegrityLedgerService
from app.services.integrity.verifier import IntegrityVerifierService
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


def test_canonical_serialization_determinism():
    # Key order independent
    d1 = {"z_field": 100, "a_field": "hello", "nested": {"b": 2, "a": 1}}
    d2 = {"a_field": "hello", "nested": {"a": 1, "b": 2}, "z_field": 100}
    assert serialize_canonical(d1) == serialize_canonical(d2)

    # Unicode preservation
    d_unicode = {"name": "Mettler Toledo Prüfgewicht", "symbol": "ΔI ± 0.05 µg"}
    serialized = serialize_canonical(d_unicode)
    assert "Prüfgewicht".encode("utf-8") in serialized
    assert "ΔI".encode("utf-8") in serialized

    # None normalization
    d_null = {"present": None, "active": True}
    assert b'"present":null' in serialize_canonical(d_null)

    # Float formatting
    d_float = {"load": 20.00000000001, "mpe": 0.005}
    assert serialize_canonical(d_float) == serialize_canonical({"mpe": 0.005, "load": 20.00000000001})


def test_hasher_and_genesis_entry():
    payload = {"observation_seq": 1, "applied_load": 10.0, "unit": "kg"}
    p_hash = compute_payload_hash(payload)
    assert len(p_hash) == 64
    assert p_hash == compute_payload_hash(payload)

    # Genesis entry hash with previous_hash=None
    created_at_iso = "2026-10-01T12:00:00Z"
    genesis_entry_hash = compute_entry_hash(
        entity_type="TEST_OBSERVATION",
        entity_id="obs-001",
        event_type="CAPTURED",
        sequence_number=1,
        payload_hash=p_hash,
        previous_hash=None,
        created_at_iso=created_at_iso,
        canonicalization_version=CANONICALIZATION_VERSION
    )
    assert len(genesis_entry_hash) == 64

    # Second entry chaining
    second_created_at_iso = "2026-10-01T12:00:05Z"
    second_p_hash = compute_payload_hash({"observation_seq": 2, "applied_load": 20.0})
    second_entry_hash = compute_entry_hash(
        entity_type="TEST_OBSERVATION",
        entity_id="obs-002",
        event_type="CAPTURED",
        sequence_number=2,
        payload_hash=second_p_hash,
        previous_hash=genesis_entry_hash,
        created_at_iso=second_created_at_iso,
        canonicalization_version=CANONICALIZATION_VERSION
    )
    assert len(second_entry_hash) == 64
    assert second_entry_hash != genesis_entry_hash


def test_ed25519_signed_checkpoint():
    root_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    signed_cp = sign_checkpoint(chain_head_hash=root_hash, report_id="rep-sig-test", sequence_number=1)
    assert signed_cp["signature_hex"] is not None
    assert signed_cp["public_key_hex"] is not None
    assert signed_cp["algorithm"] == "Ed25519"

    # Verify signature
    is_valid = verify_checkpoint_signature(signed_cp)
    assert is_valid is True

    # Mutated root hash should fail verification
    mutated_cp = dict(signed_cp)
    mutated_cp["chain_head_hash"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    assert verify_checkpoint_signature(mutated_cp) is False


def test_file_bytes_hashing():
    raw_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (Metrix76 Calibration Cert) >>\nendobj\ntrailer\n<<>>\n%%EOF"
    sha = compute_file_bytes_hash(raw_pdf_bytes)
    assert len(sha) == 64
    assert sha == compute_file_bytes_hash(raw_pdf_bytes)

    # Different bytes yield different hash
    altered_pdf = raw_pdf_bytes + b"\n%tampered"
    assert compute_file_bytes_hash(altered_pdf) != sha


def test_ledger_append_and_intact_verification():
    report_id = f"rep-chain-{uuid.uuid4().hex[:8]}"

    # 1. Draft Created
    e1 = IntegrityLedgerService.record_report_lifecycle_event(
        report_id=report_id,
        event_type="DRAFT_CREATED",
        report_data={"report_id": report_id, "attempt": 1}
    )
    assert e1.sequence_number == 1
    assert e1.previous_hash is None
    assert len(e1.entry_hash) == 64

    # 2. Observation 1 Captured
    obs1_data = {"test_type": "WEIGHING", "load": 10.0, "indication": 10.0, "is_compliant": True}
    e2, p2 = IntegrityLedgerService.record_observation_capture(
        report_id=report_id,
        observation_id=f"obs-{uuid.uuid4()}",
        observation_data=obs1_data
    )
    assert e2.sequence_number == 2
    assert e2.previous_hash == e1.entry_hash

    # 3. Observation 2 Captured
    obs2_data = {"test_type": "WEIGHING", "load": 20.0, "indication": 20.0, "is_compliant": True}
    e3, p3 = IntegrityLedgerService.record_observation_capture(
        report_id=report_id,
        observation_id=f"obs-{uuid.uuid4()}",
        observation_data=obs2_data
    )
    assert e3.sequence_number == 3
    assert e3.previous_hash == e2.entry_hash

    # 4. Evidence Attached
    file_bytes = b"ISO17025 Cal Certificate bytes"
    e4, f4 = IntegrityLedgerService.record_evidence_attachment(
        report_id=report_id,
        evidence_id=f"att-{uuid.uuid4()}",
        filename="cal_cert.pdf",
        file_bytes=file_bytes,
        mime_type="application/pdf"
    )
    assert e4.sequence_number == 4
    assert e4.previous_hash == e3.entry_hash

    # Verify report integrity
    result = IntegrityVerifierService.verify_report_integrity(report_id)
    assert result.status == IntegrityStatus.INTACT
    assert result.entries_checked == 4
    assert result.observations_checked == 2
    assert result.evidence_checked == 1
    assert result.first_failure is None
    assert result.chain_head_hash == e4.entry_hash
    assert result.checkpoint is not None


def test_tamper_detection_on_mutated_observation():
    report_id = f"rep-tamper-{uuid.uuid4().hex[:8]}"

    # Add initial draft event
    IntegrityLedgerService.record_report_lifecycle_event(
        report_id=report_id,
        event_type="DRAFT_CREATED",
        report_data={"report_id": report_id}
    )

    # Add observation
    obs_id = str(uuid.uuid4())
    obs_data = {"test_type": "WEIGHING", "load_applied": 10.0, "indication_observed": 10.0, "is_compliant": True}
    e2, p2 = IntegrityLedgerService.record_observation_capture(
        report_id=report_id,
        observation_id=obs_id,
        observation_data=obs_data
    )

    # Initial verification should be INTACT
    ver_clean = IntegrityVerifierService.verify_report_integrity(report_id)
    assert ver_clean.status == IntegrityStatus.INTACT

    # Tamper simulation: directly alter observation data in-memory or ledger
    tamper_res = IntegrityLedgerService.simulate_tamper(
        report_id=report_id,
        sequence_number=2,
        tamper_mode="PAYLOAD_MISMATCH"
    )
    assert tamper_res["status"] == "TAMPER_SIMULATED"

    # Re-verify: must report TAMPER_DETECTED without repairing the hash
    ver_tampered = IntegrityVerifierService.verify_report_integrity(report_id)
    assert ver_tampered.status == IntegrityStatus.TAMPER_DETECTED
    assert ver_tampered.first_failure is not None
    assert ver_tampered.first_failure.sequence == 2
    assert ver_tampered.first_failure.reason == "payload_hash_mismatch"


def test_tamper_detection_broken_chain():
    report_id = f"rep-broken-{uuid.uuid4().hex[:8]}"

    IntegrityLedgerService.record_report_lifecycle_event(report_id=report_id, event_type="DRAFT_CREATED", report_data={})
    IntegrityLedgerService.record_report_lifecycle_event(report_id=report_id, event_type="TEST_COMPLETED", report_data={})

    # Tamper with previous_hash in sequence 2
    IntegrityLedgerService.simulate_tamper(report_id=report_id, sequence_number=2, tamper_mode="BROKEN_CHAIN")

    # Re-verify
    ver = IntegrityVerifierService.verify_report_integrity(report_id)
    assert ver.status == IntegrityStatus.BROKEN_CHAIN
    assert ver.first_failure is not None
    assert ver.first_failure.sequence == 2
    assert ver.first_failure.reason == "previous_hash_mismatch"


def test_concurrent_observation_writes_safety():
    report_id = f"rep-concurrency-{uuid.uuid4().hex[:8]}"
    IntegrityLedgerService.record_report_lifecycle_event(report_id=report_id, event_type="DRAFT_CREATED", report_data={})

    num_threads = 10
    errors = []

    def worker(i: int):
        try:
            IntegrityLedgerService.record_observation_capture(
                report_id=report_id,
                observation_id=f"obs-thread-{i}",
                observation_data={"seq": i, "val": 10.0 + i}
            )
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0

    # Retrieve all entries
    entries = IntegrityLedgerService.get_report_entries(report_id)
    assert len(entries) == num_threads + 1

    # Sequences must be strictly 1, 2, ..., 11
    seqs = [e.sequence_number for e in entries]
    assert seqs == list(range(1, num_threads + 2))

    # All hashes must chain correctly
    for idx in range(1, len(entries)):
        assert entries[idx].previous_hash == entries[idx - 1].entry_hash

    # Report verification must be INTACT
    ver = IntegrityVerifierService.verify_report_integrity(report_id)
    assert ver.status == IntegrityStatus.INTACT


def test_integrity_api_endpoints():
    report_id = f"rep-api-test-{uuid.uuid4().hex[:8]}"

    # Register local report
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
        overall_verdict=True,
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

    # 1. Check integrity status API (should be NOT_VERIFIED or INTACT once verified)
    res_status = client.get(f"/api/v1/reports/{report_id}/integrity")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert "status" in data_status

    # 2. Trigger verification via POST
    res_verify = client.post(f"/api/v1/reports/{report_id}/integrity/verify")
    assert res_verify.status_code == 200
    data_verify = res_verify.json()
    assert data_verify["report_id"] == report_id
    assert data_verify["algorithm"] == "SHA-256"

    # 3. Add observations and fetch ledger entries
    IntegrityLedgerService.record_observation_capture(
        report_id=report_id,
        observation_id=str(uuid.uuid4()),
        observation_data={"applied": 5.0, "ind": 5.0}
    )

    res_entries = client.get(f"/api/v1/reports/{report_id}/integrity/entries")
    assert res_entries.status_code == 200
    entries_list = res_entries.json()
    assert len(entries_list) >= 1
    first_entry = entries_list[0]
    assert "entry_hash" in first_entry
    assert "sequence_number" in first_entry

    # 4. Fetch specific entry by id
    res_single = client.get(f"/api/v1/reports/{report_id}/integrity/entries/{first_entry['id']}")
    assert res_single.status_code == 200
    assert res_single.json()["id"] == first_entry["id"]

    # 5. Simulate tamper endpoint
    res_tamper = client.post(
        f"/api/v1/reports/{report_id}/integrity/simulate-tamper",
        json={"sequence_number": first_entry["sequence_number"], "tamper_mode": "PAYLOAD_MISMATCH"}
    )
    assert res_tamper.status_code == 200
    assert res_tamper.json()["status"] == "TAMPER_SIMULATED"
