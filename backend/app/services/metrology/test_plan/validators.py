"""
Server-side Validation Engine for Instrument Configuration & Standards.
Performs rigorous structural, OIML sanity, and multi-interval validation before plan generation.
"""
from datetime import date
from typing import Dict, Any, List, Optional
from app.schemas.metrology import AccuracyClass, InstrumentMeta, MultiIntervalSpec
from app.services.metrology.sanity import InstrumentSanityEngine
from .models import TestPlanIssue


def validate_instrument_configuration(instrument_dict: Dict[str, Any]) -> List[TestPlanIssue]:
    """
    Validates physical and metrological instrument parameters.
    Returns a list of structured TestPlanIssue items (empty if valid).
    """
    issues: List[TestPlanIssue] = []

    # 1. Basic field existence and positive bounds
    max_cap = instrument_dict.get("max_capacity")
    min_cap = instrument_dict.get("min_capacity")
    e = instrument_dict.get("verification_interval_e")
    d = instrument_dict.get("scale_interval_d")
    acc_class = instrument_dict.get("accuracy_class")

    if max_cap is None or max_cap <= 0:
        issues.append(TestPlanIssue(
            field="max_capacity",
            message="Maximum capacity 'Max' must be greater than zero."
        ))

    if min_cap is None or min_cap < 0:
        issues.append(TestPlanIssue(
            field="min_capacity",
            message="Minimum capacity 'Min' cannot be negative."
        ))

    if e is None or e <= 0:
        issues.append(TestPlanIssue(
            field="verification_interval_e",
            message="Verification interval 'e' must be greater than zero."
        ))

    if d is None or d <= 0:
        issues.append(TestPlanIssue(
            field="scale_interval_d",
            message="Scale interval 'd' must be greater than zero."
        ))

    if not acc_class:
        issues.append(TestPlanIssue(
            field="accuracy_class",
            message="Accuracy class must be specified (Class I, II, III, or IIII)."
        ))

    if issues:
        return issues

    # 2. Capacity relationships
    if min_cap >= max_cap:
        issues.append(TestPlanIssue(
            field="min_capacity",
            message=f"Minimum capacity ({min_cap}) cannot be greater than or equal to maximum capacity ({max_cap})."
        ))

    # 3. OIML Sanity Check (e >= d, n limits, min capacity ratio)
    try:
        # Normalize AccuracyClass
        if isinstance(acc_class, str):
            clean_class = AccuracyClass(acc_class)
        else:
            clean_class = acc_class

        meta = InstrumentMeta(
            accuracy_class=clean_class,
            max_capacity=float(max_cap),
            min_capacity=float(min_cap),
            scale_interval_d=float(d),
            verification_interval_e=float(e),
            unit=str(instrument_dict.get("unit", "kg")),
            is_multi_interval=bool(instrument_dict.get("is_multi_interval", False)),
            multi_interval_ranges=None
        )

        sanity_res = InstrumentSanityEngine.validate_spec(meta)
        if not sanity_res.is_valid:
            for s_issue in sanity_res.issues:
                issues.append(TestPlanIssue(
                    field="metrology_spec",
                    message=s_issue
                ))
    except Exception as exc:
        issues.append(TestPlanIssue(
            field="accuracy_class",
            message=f"Invalid accuracy class or specification: {exc}"
        ))

    # 4. Multi-interval validation
    if instrument_dict.get("is_multi_interval"):
        ranges = instrument_dict.get("multi_interval_spec") or instrument_dict.get("multi_interval_ranges")
        if not ranges or not isinstance(ranges, list) or len(ranges) < 2:
            issues.append(TestPlanIssue(
                field="multi_interval_spec",
                message="Multi-interval instruments must define at least two valid interval ranges (W1, W2)."
            ))
        else:
            prev_max = 0.0
            prev_e = 0.0
            for idx, rng in enumerate(ranges):
                rng_dict = rng if isinstance(rng, dict) else (rng.model_dump() if hasattr(rng, "model_dump") else {})
                r_max = rng_dict.get("max_capacity") or rng_dict.get("max")
                r_e = rng_dict.get("verification_interval_e") or rng_dict.get("e")
                r_d = rng_dict.get("scale_interval_d") or rng_dict.get("d") or r_e

                if r_max is None or r_max <= prev_max:
                    issues.append(TestPlanIssue(
                        field=f"multi_interval_spec[{idx}].max_capacity",
                        message=f"Interval range {idx + 1} max capacity ({r_max}) must be strictly greater than preceding range ({prev_max})."
                    ))
                if r_e is None or r_e <= 0:
                    issues.append(TestPlanIssue(
                        field=f"multi_interval_spec[{idx}].verification_interval_e",
                        message=f"Interval range {idx + 1} verification interval 'e' must be > 0."
                    ))
                elif prev_e > 0 and r_e < prev_e:
                    issues.append(TestPlanIssue(
                        field=f"multi_interval_spec[{idx}].verification_interval_e",
                        message=f"Interval range {idx + 1} verification interval 'e' ({r_e}) cannot be smaller than preceding range ({prev_e})."
                    ))

                if r_max: prev_max = float(r_max)
                if r_e: prev_e = float(r_e)

    return issues


def validate_reference_standard_status(standard_dict: Optional[Dict[str, Any]]) -> tuple[bool, Optional[str]]:
    """
    Validates if the assigned reference standard is active, valid, and not expired.
    Returns: (is_valid, failure_reason)
    """
    if not standard_dict:
        return False, "No reference standard weight set assigned to this report."

    is_active = standard_dict.get("is_active", True)
    if not is_active:
        return False, f"Reference standard set '{standard_dict.get('set_identifier', 'N/A')}' is marked INACTIVE."

    expiry_val = standard_dict.get("expiry_date")
    if expiry_val:
        if isinstance(expiry_val, str):
            try:
                exp_date = date.fromisoformat(expiry_val.split("T")[0])
            except Exception:
                exp_date = date.today()
        else:
            exp_date = expiry_val

        if exp_date < date.today():
            set_id = standard_dict.get("set_identifier", standard_dict.get("id", "N/A"))
            return False, f"Reference standard set '{set_id}' expired on {exp_date.isoformat()} (ISO 17025 guardrail)."

    return True, None
