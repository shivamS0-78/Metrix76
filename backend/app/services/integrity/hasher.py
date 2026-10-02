"""
SHA-256 Hashing and Checkpoint Signing Engine.
Provides deterministic cryptographic hashing for raw observations, device measurements, evidence,
and tamper-evident ledger entry chains.
"""
import os
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

from .canonical import serialize_canonical, CANONICALIZATION_VERSION

HASH_ALGORITHM = "SHA-256"
GENESIS_MARKER = "METRIX76_LEDGER_GENESIS_V1"

# Internal deterministic fallback key for testing/dev if environment secret is not set
_DEFAULT_ED25519_SEED = b"metrix76_ed25519_master_seed_32b"  # 32 bytes


def _get_signing_key() -> ed25519.Ed25519PrivateKey:
    env_hex = os.environ.get("METRIX76_CHECKPOINT_PRIVATE_KEY")
    if env_hex:
        try:
            raw_bytes = bytes.fromhex(env_hex)
            return ed25519.Ed25519PrivateKey.from_private_bytes(raw_bytes)
        except Exception as e:
            print(f"[Crypto] Note: failed to parse METRIX76_CHECKPOINT_PRIVATE_KEY: {e}")
    return ed25519.Ed25519PrivateKey.from_private_bytes(_DEFAULT_ED25519_SEED)


def compute_payload_hash(data: Any) -> str:
    """
    Computes SHA-256 hex digest of the canonicalized payload.
    """
    canonical_bytes = serialize_canonical(data)
    return hashlib.sha256(canonical_bytes).hexdigest()


def compute_file_bytes_hash(file_bytes: bytes) -> str:
    """
    Computes SHA-256 hex digest of raw binary file bytes.
    """
    return hashlib.sha256(file_bytes).hexdigest()


def compute_entry_hash(
    entity_type: str,
    entity_id: str,
    event_type: str,
    sequence_number: int,
    payload_hash: str,
    previous_hash: Optional[str],
    created_at_iso: str,
    canonicalization_version: str = CANONICALIZATION_VERSION
) -> str:
    """
    Computes deterministic SHA-256 digest of a ledger entry header.
    For sequence_number == 1, effective previous_hash includes GENESIS_MARKER.
    """
    effective_prev = previous_hash if previous_hash is not None else (GENESIS_MARKER if sequence_number == 1 else None)
    
    header_data = {
        "algorithm": HASH_ALGORITHM,
        "canonicalization_version": canonicalization_version,
        "created_at": created_at_iso,
        "entity_id": str(entity_id),
        "entity_type": str(entity_type),
        "event_type": str(event_type),
        "payload_hash": str(payload_hash),
        "previous_hash": str(effective_prev) if effective_prev is not None else None,
        "sequence_number": int(sequence_number)
    }
    
    canonical_bytes = serialize_canonical(header_data)
    return hashlib.sha256(canonical_bytes).hexdigest()


def sign_checkpoint(
    chain_head_hash: str,
    report_id: str,
    sequence_number: int
) -> Dict[str, Any]:
    """
    Generates an Ed25519 signed integrity checkpoint over the final chain head.
    The private key stays strictly in the backend execution environment.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    checkpoint_payload = {
        "report_id": str(report_id),
        "chain_head_hash": str(chain_head_hash),
        "sequence_number": int(sequence_number),
        "signed_at": now_iso
    }
    canonical_bytes = serialize_canonical(checkpoint_payload)
    
    priv_key = _get_signing_key()
    pub_key = priv_key.public_key()
    pub_bytes = pub_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    
    signature = priv_key.sign(canonical_bytes)
    
    return {
        "algorithm": "Ed25519",
        "key_id": "m76-signer-primary",
        "public_key_hex": pub_bytes.hex(),
        "signature_hex": signature.hex(),
        "signed_at": now_iso,
        "report_id": report_id,
        "chain_head_hash": chain_head_hash,
        "sequence_number": sequence_number
    }


def verify_checkpoint_signature(checkpoint_data: Dict[str, Any]) -> bool:
    """
    Verifies an Ed25519 signed integrity checkpoint against its public key.
    """
    try:
        pub_hex = checkpoint_data.get("public_key_hex")
        sig_hex = checkpoint_data.get("signature_hex")
        if not pub_hex or not sig_hex:
            return False
            
        pub_key = ed25519.Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub_hex))
        
        checkpoint_payload = {
            "report_id": str(checkpoint_data["report_id"]),
            "chain_head_hash": str(checkpoint_data["chain_head_hash"]),
            "sequence_number": int(checkpoint_data["sequence_number"]),
            "signed_at": str(checkpoint_data["signed_at"])
        }
        canonical_bytes = serialize_canonical(checkpoint_payload)
        pub_key.verify(bytes.fromhex(sig_hex), canonical_bytes)
        return True
    except Exception:
        return False
