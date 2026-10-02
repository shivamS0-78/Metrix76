"""
Data models for Cryptographic Raw-Data Ledger & Tamper-Evident Evidence Chain.
Conforms to ISO/IEC 17025 requirements for immutable chain-of-custody.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class IntegrityStatus(str, Enum):
    INTACT = "INTACT"
    TAMPER_DETECTED = "TAMPER_DETECTED"
    MISSING_ENTRY = "MISSING_ENTRY"
    BROKEN_CHAIN = "BROKEN_CHAIN"
    PAYLOAD_MISMATCH = "PAYLOAD_MISMATCH"
    EVIDENCE_MISMATCH = "EVIDENCE_MISMATCH"
    VERIFICATION_ERROR = "VERIFICATION_ERROR"
    NOT_VERIFIED = "NOT_VERIFIED"


class EntityType(str, Enum):
    REPORT = "REPORT"
    TEST_PLAN = "TEST_PLAN"
    TEST_OBSERVATION = "TEST_OBSERVATION"
    DEVICE_MEASUREMENT = "DEVICE_MEASUREMENT"
    EVIDENCE = "EVIDENCE"
    REFERENCE_STANDARD = "REFERENCE_STANDARD"


class IntegrityEntry(BaseModel):
    id: str = Field(..., description="UUID identifier of the ledger record")
    report_id: Optional[str] = Field(None, description="Associated report UUID")
    entity_type: str = Field(..., description="Target entity category (e.g. TEST_OBSERVATION)")
    entity_id: str = Field(..., description="UUID or identifier of the captured entity")
    event_type: str = Field(..., description="Lifecycle event action (e.g. OBSERVATION_CAPTURED)")
    sequence_number: int = Field(..., description="Monotonically increasing sequence number per report")
    payload_hash: str = Field(..., description="SHA-256 digest of canonical entity content")
    previous_hash: Optional[str] = Field(None, description="entry_hash of sequence - 1 (or None for genesis)")
    entry_hash: str = Field(..., description="SHA-256 digest over the complete entry header")
    algorithm: str = Field("SHA-256", description="Cryptographic hash algorithm")
    canonicalization_version: str = Field("M76-C14N-V1", description="Canonical encoding format")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of recording")
    created_by: Optional[str] = Field(None, description="User ID who executed the action")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Supplementary contextual metadata")


class IntegrityFailureDetail(BaseModel):
    sequence: Optional[int] = Field(None, description="Sequence number where failure was detected")
    entity_type: Optional[str] = Field(None, description="Entity type of the failed record")
    entity_id: Optional[str] = Field(None, description="Entity ID of the failed record")
    reason: str = Field(..., description="Technical failure reason code or explanation")
    expected_hash: Optional[str] = Field(None, description="Expected cryptographic digest")
    actual_hash: Optional[str] = Field(None, description="Recalculated cryptographic digest")
    details: Optional[str] = Field(None, description="Diagnostic message")


class IntegrityVerificationResult(BaseModel):
    report_id: str
    status: IntegrityStatus
    entries_checked: int
    observations_checked: int
    evidence_checked: int
    algorithm: str = Field("SHA-256", description="Cryptographic hash algorithm verified")
    chain_head_hash: Optional[str] = None
    first_failure: Optional[IntegrityFailureDetail] = None
    verified_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    checkpoint: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
