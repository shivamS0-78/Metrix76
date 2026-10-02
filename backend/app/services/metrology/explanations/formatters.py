"""
Formatters for 3-Level Clause Failure Explanations.
Produces deterministic, human-readable explanations directly derived from server-side engine calculations.
"""
from typing import Optional


def format_number(val: Optional[float], decimals: int = 5, unit: str = "kg") -> str:
    if val is None:
        return "--"
    # Format nicely with sign if positive error
    rounded = round(val, decimals)
    # Remove trailing zeroes for clean display if float
    text = f"{rounded:.{decimals}f}".rstrip("0").rstrip(".") if "." in f"{rounded}" else f"{rounded}"
    return f"{text} {unit}".strip()


def format_error_with_sign(val: Optional[float], decimals: int = 5, unit: str = "kg") -> str:
    if val is None:
        return "--"
    rounded = round(val, decimals)
    sign = "+" if rounded > 0 else ""
    text = f"{sign}{rounded:.{decimals}f}".rstrip("0").rstrip(".") if "." in f"{rounded}" else f"{sign}{rounded}"
    return f"{text} {unit}".strip()


def build_weighing_explanation(
    seq: int,
    load: float,
    indication: float,
    error: float,
    mpe: float,
    excess: float,
    margin_pct: float,
    direction: Optional[str] = "INCREASING",
    unit: str = "kg",
    clause_ref: Optional[str] = None
) -> tuple[str, str, str]:
    """
    Returns (Level 1 Title, Level 2 Summary, Level 3 Detail)
    """
    rule_clause = clause_ref if clause_ref else "Applicable rule reference is not configured."
    title = f"Weighing Performance — Non-Compliant Observation #{seq}"
    summary = f"Observation #{seq} at {format_number(load, unit=unit)} failed: calculated error {format_error_with_sign(error, unit=unit)} exceeds permissible limit ±{format_number(mpe, unit=unit)} by {format_number(excess, unit=unit)}."
    
    direction_text = f"Direction: {direction.upper() if direction else 'STATIC'}"
    detail = (
        f"Under {rule_clause}, test point #{seq} ({direction_text}) with applied load {format_number(load, unit=unit)} "
        f"produced observed indication {format_number(indication, unit=unit)}. "
        f"The authoritative OIML R 76 turning point calculation produced a corrected error Ec of {format_error_with_sign(error, unit=unit)}. "
        f"The maximum permissible error (MPE) allowed for this load is ±{format_number(mpe, unit=unit)}. "
        f"The calculated error exceeds the statutory limit by {format_number(excess, unit=unit)} ({margin_pct:.1f}% beyond allowable tolerance)."
    )
    return title, summary, detail


def build_repeatability_explanation(
    cycle: int,
    nominal_load: float,
    delta_i: float,
    mpe: float,
    excess: float,
    p_max: float,
    p_min: float,
    unit: str = "kg",
    clause_ref: Optional[str] = None
) -> tuple[str, str, str]:
    rule_clause = clause_ref if clause_ref else "Applicable rule reference is not configured."
    title = f"Repeatability — Series {cycle} Spread Exceeded"
    summary = f"Repeatability Series {cycle} at nominal load {format_number(nominal_load, unit=unit)} failed: observed spread ΔI = {format_number(delta_i, unit=unit)} exceeds allowed threshold {format_number(mpe, unit=unit)} by {format_number(excess, unit=unit)}."
    
    detail = (
        f"Under {rule_clause}, series {cycle} (nominal test load {format_number(nominal_load, unit=unit)}) "
        f"exhibited a maximum calculated indication P_max = {format_number(p_max, unit=unit)} and minimum P_min = {format_number(p_min, unit=unit)}. "
        f"The resulting spread ΔI = P_max - P_min is {format_number(delta_i, unit=unit)}, which exceeds the applicable statutory limit "
        f"of {format_number(mpe, unit=unit)} by {format_number(excess, unit=unit)}. "
        f"The maximum deviation between successive weighings exceeds the repeatability criteria."
    )
    return title, summary, detail


def build_eccentricity_explanation(
    pos_tag: str,
    load: float,
    indication: float,
    error: float,
    mpe: float,
    excess: float,
    unit: str = "kg",
    clause_ref: Optional[str] = None
) -> tuple[str, str, str]:
    rule_clause = clause_ref if clause_ref else "Applicable rule reference is not configured."
    title = f"Eccentricity — Off-Center Failure at {pos_tag}"
    summary = f"Position {pos_tag} failed: corrected corner deviation {format_error_with_sign(error, unit=unit)} exceeds permissible limit ±{format_number(mpe, unit=unit)} by {format_number(excess, unit=unit)}."
    
    detail = (
        f"Under {rule_clause}, corner loading at position '{pos_tag}' with applied load {format_number(load, unit=unit)} "
        f"recorded indication {format_number(indication, unit=unit)}. "
        f"After correcting against the central reference baseline, the resulting corner error Ec is {format_error_with_sign(error, unit=unit)}, "
        f"exceeding the maximum permissible error of ±{format_number(mpe, unit=unit)} by {format_number(excess, unit=unit)}."
    )
    return title, summary, detail


def build_tare_zero_explanation(
    seq: int,
    test_subtype: str,
    load: float,
    indication: float,
    error: float,
    limit: float,
    excess: float,
    unit: str = "kg",
    clause_ref: Optional[str] = None
) -> tuple[str, str, str]:
    rule_clause = clause_ref if clause_ref else "Applicable rule reference is not configured."
    title = f"Tare / Zero — {test_subtype} Failure"
    summary = f"{test_subtype} test failed: calculated error {format_error_with_sign(error, unit=unit)} exceeds allowed threshold ±{format_number(limit, unit=unit)} by {format_number(excess, unit=unit)}."
    
    detail = (
        f"Under {rule_clause}, {test_subtype.lower()} observation #{seq} with applied load {format_number(load, unit=unit)} "
        f"recorded indication {format_number(indication, unit=unit)}. "
        f"The resulting calculated error is {format_error_with_sign(error, unit=unit)}, exceeding the allowable threshold "
        f"of ±{format_number(limit, unit=unit)} by {format_number(excess, unit=unit)}."
    )
    return title, summary, detail
