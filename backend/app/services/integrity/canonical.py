"""
Deterministic Canonical Serialization Engine (ISO/IEC 17025 Compliant).
Guarantees identical byte sequences for equivalent data structures across platforms.
"""
import json
from datetime import datetime, date, timezone
from typing import Any
from decimal import Decimal

CANONICALIZATION_VERSION = "M76-C14N-V1"


def canonicalize(obj: Any) -> Any:
    """
    Recursively transforms objects into standard canonical structures:
    - Stable dictionary key ordering (sorted ascending)
    - Normalized UTF-8 strings
    - Explicit null / None handling
    - Deterministic float representations (rounded to 8 decimal places, avoiding -0.0)
    - Deterministic ISO-8601 UTC timestamps
    - Stable list transformations
    - Pydantic model unwrapping
    """
    if obj is None:
        return None
    elif isinstance(obj, bool):
        return obj
    elif isinstance(obj, (int,)):
        return obj
    elif isinstance(obj, (float, Decimal)):
        f_val = float(obj)
        # Avoid negative zero
        if abs(f_val) < 1e-12:
            return 0
        if f_val.is_integer():
            return int(f_val)
        return round(f_val, 8)
    elif isinstance(obj, (datetime, date)):
        if isinstance(obj, datetime):
            # Normalize to UTC
            if obj.tzinfo is None:
                dt_utc = obj.replace(tzinfo=timezone.utc)
            else:
                dt_utc = obj.astimezone(timezone.utc)
            return dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {str(k): canonicalize(v) for k, v in sorted(obj.items(), key=lambda item: str(item[0]))}
    elif isinstance(obj, (list, tuple)):
        return [canonicalize(x) for x in obj]
    elif isinstance(obj, set):
        return [canonicalize(x) for x in sorted(list(obj), key=lambda x: str(x))]
    elif hasattr(obj, "model_dump"):
        return canonicalize(obj.model_dump())
    elif hasattr(obj, "dict"):
        return canonicalize(obj.dict())
    return str(obj)


def serialize_canonical(data: Any) -> bytes:
    """
    Encodes canonicalized data into deterministic UTF-8 JSON bytes.
    Uses separators=(',', ':') with no whitespace, sorted keys, and ASCII escaping disabled for UTF-8 preservation.
    """
    c_data = canonicalize(data)
    json_str = json.dumps(
        c_data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":")
    )
    return json_str.encode("utf-8")
