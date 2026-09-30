"""
Cryptographic Integrity & Public Verification Data Models
Conforming to ISO/IEC 17025 (Chain of Custody, Auditability, Tamper Evidence)
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class IntegritySeal(BaseModel):
    """
    Tamper-evident cryptographic seal containing a deterministic SHA-256 digest,
    canonical verification URL, and base64-encoded QR code.
    """
    report_id: str = Field(..., description="Unique UUID/Identifier of the evaluated test report")
    sha256_hash: str = Field(..., description="Deterministic SHA-256 digest of canonical test JSON")
    verification_url: str = Field(..., description="Public verification URL")
    qr_code_base64: str = Field(..., description="Base64 encoded PNG QR code image with data URI scheme")
    timestamp: datetime = Field(default_factory=_now_utc, description="Timestamp of cryptographic signing")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "report_id": "rep-78a9c1",
                "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "verification_url": "https://lims.metrology.gov.in/verify/rep-78a9c1?hash=e3b0c44298fc",
                "qr_code_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
                "timestamp": "2026-09-28T12:00:00Z"
            }
        }
    )


class IntegrityVerifyRequest(BaseModel):
    """
    Payload for verifying an existing report's data against an expected hash or recalculating hash.
    """
    report_id: str
    expected_hash: Optional[str] = None
    dataset: Optional[Dict[str, Any]] = None


class IntegrityVerifyResponse(BaseModel):
    """
    Verification response validating whether the dataset matches the cryptographic seal.
    """
    report_id: str
    is_valid: bool
    computed_hash: str
    expected_hash: Optional[str] = None
    verification_url: str
    qr_code_base64: Optional[str] = None
    timestamp: datetime = Field(default_factory=_now_utc)
    details: Optional[str] = None
