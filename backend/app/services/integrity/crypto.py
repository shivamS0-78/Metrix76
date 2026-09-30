"""
Cryptographic Dataset Stamping & Integrity Engine
Conforms to ISO/IEC 17025 requirements for tamper evidence, auditability, and deterministic reproducibility.
"""
import hashlib
import json
from datetime import datetime, date, timezone
from typing import Dict, Any, Union
from app.schemas.integrity import IntegritySeal
from app.services.integrity.qr_service import QRService


class CryptoIntegrityService:
    """
    Computes deterministic cryptographic hashes over metrological test datasets
    and generates verifiable tamper-evident seals.
    """

    @classmethod
    def _canonicalize(cls, obj: Any) -> Any:
        """
        Recursively transforms objects into standard canonical structures
        so that dictionary ordering or type nuances do not alter the hash.
        """
        if isinstance(obj, dict):
            return {str(k): cls._canonicalize(v) for k, v in sorted(obj.items())}
        elif isinstance(obj, (list, tuple, set)):
            return [cls._canonicalize(x) for x in obj]
        elif isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, float):
            # Normalize float representations to avoid floating point string variations
            if obj.is_integer():
                return int(obj)
            return round(obj, 8)
        elif hasattr(obj, "model_dump"):
            return cls._canonicalize(obj.model_dump())
        elif hasattr(obj, "dict"):
            return cls._canonicalize(obj.dict())
        return obj

    @classmethod
    def compute_sha256_digest(cls, data: Union[Dict[str, Any], list, Any]) -> str:
        """
        Generates a deterministic SHA-256 hexadecimal digest of canonical test JSON.
        """
        canonical_data = cls._canonicalize(data)
        serialized = json.dumps(
            canonical_data,
            sort_keys=True,
            ensure_ascii=True,
            separators=(",", ":"),
            default=str
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @classmethod
    def generate_integrity_seal(
        cls,
        report_id: str,
        test_dataset: Dict[str, Any],
        base_url: str = "https://lims.metrology.gov.in"
    ) -> IntegritySeal:
        """
        Creates an IntegritySeal containing:
        - report_id
        - sha256_hash: Deterministic digest of canonical test dataset
        - verification_url: https://[domain]/verify/{report_id}?hash={sha256[:12]}
        - qr_code_base64: Base64 data URI PNG of the QR code
        - timestamp: Current UTC timestamp
        """
        sha256_hash = cls.compute_sha256_digest(test_dataset)
        short_hash = sha256_hash[:12]
        clean_base = base_url.rstrip("/")
        verification_url = f"{clean_base}/verify/{report_id}?hash={short_hash}"
        qr_base64 = QRService.generate_verification_qr(verification_url)

        return IntegritySeal(
            report_id=report_id,
            sha256_hash=sha256_hash,
            verification_url=verification_url,
            qr_code_base64=qr_base64,
            timestamp=datetime.now(timezone.utc)
        )

    @classmethod
    def verify_dataset_integrity(
        cls,
        test_dataset: Dict[str, Any],
        expected_hash: str
    ) -> bool:
        """
        Verifies that a test dataset matches the expected SHA-256 hash.
        """
        computed = cls.compute_sha256_digest(test_dataset)
        return computed.lower() == expected_hash.strip().lower()
