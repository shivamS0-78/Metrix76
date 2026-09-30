"""
Unit & Integration Tests for Cryptographic Integrity Engine
Validates deterministic SHA-256 digests, tamper detection, QR generation, and API endpoints.
"""
from fastapi.testclient import TestClient
from app.main import app
from app.services.integrity.crypto import CryptoIntegrityService
from app.services.integrity.qr_service import QRService

client = TestClient(app)


def test_sha256_digest_determinism():
    """Verify that identical data structures produce identical hashes regardless of key order."""
    data_1 = {
        "report_id": "rep-101",
        "instrument_serial": "SN-998877",
        "weighing_points": [
            {"load": 1000.0, "error": 0.1},
            {"load": 2000.0, "error": 0.2}
        ],
        "verdict": True
    }

    # Different key ordering
    data_2 = {
        "verdict": True,
        "weighing_points": [
            {"error": 0.1, "load": 1000.0},
            {"error": 0.2, "load": 2000.0}
        ],
        "report_id": "rep-101",
        "instrument_serial": "SN-998877"
    }

    hash_1 = CryptoIntegrityService.compute_sha256_digest(data_1)
    hash_2 = CryptoIntegrityService.compute_sha256_digest(data_2)

    assert hash_1 == hash_2
    assert len(hash_1) == 64


def test_tamper_detection():
    """Verify that even a slight modification to the dataset changes the digest."""
    original_data = {
        "report_id": "rep-101",
        "instrument_serial": "SN-998877",
        "error_corrected": 0.125
    }

    tampered_data = {
        "report_id": "rep-101",
        "instrument_serial": "SN-998877",
        "error_corrected": 0.126  # Small 0.001 delta
    }

    hash_original = CryptoIntegrityService.compute_sha256_digest(original_data)
    hash_tampered = CryptoIntegrityService.compute_sha256_digest(tampered_data)

    assert hash_original != hash_tampered
    assert CryptoIntegrityService.verify_dataset_integrity(original_data, hash_original) is True
    assert CryptoIntegrityService.verify_dataset_integrity(tampered_data, hash_original) is False


def test_qr_code_generation():
    """Verify QR code data URI generation."""
    url = "https://lims.metrology.gov.in/verify/rep-test-123?hash=abcdef123456"
    qr_base64 = QRService.generate_verification_qr(url)

    assert qr_base64.startswith("data:image/png;base64,")
    assert len(qr_base64) > 100

    raw_bytes = QRService.generate_qr_bytes(url)
    assert isinstance(raw_bytes, bytes)
    assert raw_bytes.startswith(b"\x89PNG\r\n\x1a\n")


def test_generate_integrity_seal():
    """Verify full integrity seal generation with required fields."""
    report_id = "rep-test-999"
    dataset = {"serial": "SN-12345", "class": "III", "max": 15000}

    seal = CryptoIntegrityService.generate_integrity_seal(report_id, dataset)

    assert seal.report_id == report_id
    assert len(seal.sha256_hash) == 64
    assert seal.verification_url.startswith("https://lims.metrology.gov.in/verify/rep-test-999?hash=")
    assert seal.qr_code_base64.startswith("data:image/png;base64,")
    assert seal.timestamp is not None


def test_api_generate_report_seal():
    """Integration test for POST /api/v1/verification/reports/{id}/seal."""
    response = client.post(
        "/api/v1/verification/reports/rep-sample-01/seal",
        json={"test": "data", "status": "APPROVED"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "rep-sample-01"
    assert "sha256_hash" in data
    assert "qr_code_base64" in data
    assert data["qr_code_base64"].startswith("data:image/png;base64,")


def test_api_verify_hash():
    """Integration test for POST /api/v1/verification/verify-hash."""
    dataset = {"report_id": "rep-sample-01", "reading": 500.0}
    actual_hash = CryptoIntegrityService.compute_sha256_digest(dataset)

    # Valid check
    resp_valid = client.post(
        "/api/v1/verification/verify-hash",
        json={
            "report_id": "rep-sample-01",
            "expected_hash": actual_hash,
            "dataset": dataset
        }
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["is_valid"] is True

    # Tampered check
    resp_invalid = client.post(
        "/api/v1/verification/verify-hash",
        json={
            "report_id": "rep-sample-01",
            "expected_hash": "0000000000000000000000000000000000000000000000000000000000000000",
            "dataset": dataset
        }
    )
    assert resp_invalid.status_code == 200
    assert resp_invalid.json()["is_valid"] is False
