from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_draft_report_and_submit_for_approval():
    standard_response = client.post(
        "/api/v1/standards/",
        json={
            "set_identifier": "NPL-TEST-SET-99",
            "accuracy_class": "E2",
            "certificate_number": "CAL-2026-0999",
            "calibrated_by": "National Physical Laboratory",
            "calibration_date": "2026-09-01",
            "expiry_date": "2027-09-01",
            "expanded_uncertainty_k2": 0.0001,
            "nominal_range": "1 mg to 50 kg",
            "is_active": True,
        }
    )
    assert standard_response.status_code == 201, standard_response.text
    reference_standard_id = standard_response.json()["id"]

    draft_payload = {
        "instrument_id": "inst-001",
        "reference_standard_id": reference_standard_id,
        "ambient_temperature_celsius": 22.4,
        "relative_humidity_pct": 54.0,
        "atmospheric_pressure_hpa": 1013.25,
        "technical_checklist": {
            "level_indicator_present": True,
            "zero_setting_operative": True,
            "tare_device_operative": True,
            "security_sealing_intact": True,
            "audit_counter_value": "AC-0042",
            "notes": "Draft created during metrologist intake"
        }
    }

    create_response = client.post("/api/v1/reports/draft", json=draft_payload)
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()
    assert created["status"] == "DRAFT"
    report_id = created["id"]

    observation_payload = {
        "report_id": report_id,
        "observations": [
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 1,
                "load_applied": 0.0,
                "indication_observed": 0.0,
                "delta_load": 0.001,
                "position_tag": "CENTER",
            },
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 2,
                "load_applied": 1.0,
                "indication_observed": 1.0,
                "delta_load": 0.001,
                "position_tag": "CENTER",
            },
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 3,
                "load_applied": 5.0,
                "indication_observed": 5.0,
                "delta_load": 0.001,
                "position_tag": "CENTER",
            },
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 4,
                "load_applied": 10.0,
                "indication_observed": 9.998,
                "delta_load": 0.001,
                "position_tag": "CENTER",
            },
            {
                "test_type": "WEIGHING",
                "direction": "INCREASING",
                "sequence_order": 5,
                "load_applied": 15.0,
                "indication_observed": 15.001,
                "delta_load": 0.001,
                "position_tag": "CENTER",
            },
        ],
    }

    put_response = client.put(f"/api/v1/reports/{report_id}/observations", json=observation_payload)
    assert put_response.status_code == 200, put_response.text
    upserted = put_response.json()
    assert len(upserted["observations"]) == 5

    submit_response = client.post(f"/api/v1/reports/{report_id}/submit")
    assert submit_response.status_code == 200, submit_response.text
    submitted = submit_response.json()
    assert submitted["status"] == "PENDING_APPROVAL"
    assert submitted["report_id"] == report_id


def test_submit_report_rejects_incomplete_observations():
    standard_response = client.post(
        "/api/v1/standards/",
        json={
            "set_identifier": "NPL-TEST-SET-INCOMPLETE",
            "accuracy_class": "E2",
            "certificate_number": "CAL-2026-0998",
            "calibrated_by": "National Physical Laboratory",
            "calibration_date": "2026-09-01",
            "expiry_date": "2027-09-01",
            "expanded_uncertainty_k2": 0.0001,
            "nominal_range": "1 mg to 50 kg",
            "is_active": True,
        },
    )
    assert standard_response.status_code == 201
    standard_id = standard_response.json()["id"]

    draft_response = client.post(
        "/api/v1/reports/draft",
        json={
            "instrument_id": "inst-001",
            "reference_standard_id": standard_id,
            "ambient_temperature_celsius": 22.0,
            "relative_humidity_pct": 50.0,
            "atmospheric_pressure_hpa": 1013.25,
            "technical_checklist": {"notes": "testing incomplete submit guard"},
        },
    )
    assert draft_response.status_code == 201
    report_id = draft_response.json()["id"]

    # Only 1 single row submitted - should be rejected by the validation guard
    client.put(
        f"/api/v1/reports/{report_id}/observations",
        json={
            "report_id": report_id,
            "observations": [
                {
                    "test_type": "WEIGHING",
                    "direction": "INCREASING",
                    "sequence_order": 1,
                    "load_applied": 10.0,
                    "indication_observed": 10.0,
                    "delta_load": 0.0,
                }
            ],
        },
    )

    submit_res = client.post(f"/api/v1/reports/{report_id}/submit")
    assert submit_res.status_code == 422
    assert "Weighing performance test requires at least 5 observation points" in submit_res.json()["detail"]


def _jwt_from_payload(payload):
    import base64
    import json

    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')

    return f"{enc({'alg': 'HS256', 'typ': 'JWT'})}.{enc(payload)}.signature"


def test_get_current_user_supports_array_role_claims(monkeypatch):
    import time
    import jwt
    from fastapi.security import HTTPAuthorizationCredentials
    from app.core.security import get_current_user, require_roles

    test_secret = "test-supabase-jwt-secret-for-crypto-verification-32b"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", test_secret)

    # Case 1: Array claim in app_metadata.roles with valid signature & exp
    valid_payload = {
        "sub": "user-123",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        "app_metadata": {"roles": ["TECHNICIAN", "ADMIN"]},
        "user_metadata": {"roles": ["ATTACKER_FAKE_ROLE"]},
    }
    token = jwt.encode(valid_payload, test_secret, algorithm="HS256")

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = get_current_user(credentials)

    assert user["user_id"] == "user-123"
    assert user["role"] == "ADMIN"  # normalized to highest priority role
    assert "TECHNICIAN" in user["roles"]
    assert "ADMIN" in user["roles"]
    # Verify user_metadata was NOT trusted
    assert "ATTACKER_FAKE_ROLE" not in user["roles"]

    # Check require_roles dependency
    guard = require_roles("ADMIN")
    assert guard(user) == user

    # Case 2: Array claim in top-level roles
    valid_payload2 = {
        "sub": "user-456",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        "roles": ["APPROVER"],
    }
    token2 = jwt.encode(valid_payload2, test_secret, algorithm="HS256")
    credentials2 = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token2)
    user2 = get_current_user(credentials2)
    assert user2["user_id"] == "user-456"
    assert user2["role"] == "APPROVER"
    assert user2["roles"] == ["APPROVER"]


def test_get_current_user_rejects_forged_or_tampered_token(monkeypatch):
    import time
    import jwt
    import pytest
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.core.security import get_current_user

    test_secret = "test-supabase-jwt-secret-for-crypto-verification-32b"
    attacker_secret = "attacker-secret-key-attempting-bypass"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", test_secret)

    # Token signed with wrong secret (forged token)
    forged_token = jwt.encode(
        {"sub": "attacker-001", "aud": "authenticated", "exp": int(time.time()) + 3600, "role": "ADMIN"},
        attacker_secret,
        algorithm="HS256",
    )

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials)
    assert exc_info.value.status_code == 401
    assert "Invalid or expired token" in exc_info.value.detail


def test_get_current_user_rejects_expired_token(monkeypatch):
    import time
    import jwt
    import pytest
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.core.security import get_current_user

    test_secret = "test-supabase-jwt-secret-for-crypto-verification-32b"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", test_secret)

    # Token that expired in the past
    expired_token = jwt.encode(
        {"sub": "user-expired", "aud": "authenticated", "exp": int(time.time()) - 3600, "role": "ADMIN"},
        test_secret,
        algorithm="HS256",
    )

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials)
    assert exc_info.value.status_code == 401
    assert "Signature has expired" in exc_info.value.detail or "Invalid or expired token" in exc_info.value.detail


def test_get_current_user_rejects_token_when_secret_not_configured(monkeypatch):
    import time
    import jwt
    import pytest
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.core.security import get_current_user

    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    token = jwt.encode(
        {"sub": "user-001", "aud": "authenticated", "exp": int(time.time()) + 3600},
        "some-key",
        algorithm="HS256",
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials)
    # Must fail securely with 500 configuration error, NOT fail open with decoded claims
    assert exc_info.value.status_code == 500
    assert "SUPABASE_JWT_SECRET is not configured" in exc_info.value.detail


