"""
Authoritative OIML R 76-1:2006 Rule Mapping and Clause Registry.
Follows existing Metrix76 rule configuration conventions.
Strictly returns None if a rule is not configured.
"""
from typing import Optional, Dict, Any

METROLOGY_ENGINE_VERSION = "OIML-R76-2006-V1.0"
EXPLANATION_VERSION = "M76-FAIL-EXPLAIN-V1"

# Existing Metrix76 configured rule references
CONFIGURED_OIML_RULES: Dict[str, Dict[str, Any]] = {
    "WEIGHING": {
        "clause_reference": "OIML R 76-1:2006 Clause A.4.4",
        "rule_id": "RULE-OIML-A44-WEIGHING",
        "rule_version": "2006",
        "title": "Weighing Performance Test",
        "description": "Calculates corrected error Ec taking zero-point turning error E0 into account and checks against Table 6 Maximum Permissible Error (MPE)."
    },
    "REPEATABILITY": {
        "clause_reference": "OIML R 76-1:2006 Clause A.4.10",
        "rule_id": "RULE-OIML-A410-REPEATABILITY",
        "rule_version": "2006",
        "title": "Repeatability Test",
        "description": "Evaluates maximum difference between results of several weighings of the same load (delta_i = P_max - P_min) against MPE for that load."
    },
    "ECCENTRICITY": {
        "clause_reference": "OIML R 76-1:2006 Clause A.4.7",
        "rule_id": "RULE-OIML-A47-ECCENTRICITY",
        "rule_version": "2006",
        "title": "Eccentricity (Corner Load) Test",
        "description": "Calculates error differences between center reference baseline and off-center receptor positions under 1/3 or 1/4 max capacity."
    },
    "TARE_ZERO": {
        "clause_reference": "OIML R 76-1:2006 Clause A.4.2 / A.4.6",
        "rule_id": "RULE-OIML-A42-TARE-ZERO",
        "rule_version": "2006",
        "title": "Tare Balancing & Zero-Setting Test",
        "description": "Evaluates zero setting error (|E0| <= 0.25e) and tare balancing linearity against applicable MPE."
    }
}


def get_rule_metadata(test_type: str, rule_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Retrieves configured rule metadata for a given test type.
    If the rule is explicitly unconfigured in rule_context or not in the registry,
    returns clause_reference = None.
    """
    raw = test_type.value if hasattr(test_type, "value") else str(test_type) if test_type else ""
    clean_type = raw.split(".")[-1].upper().strip()
    
    # Check custom rule_context override if provided
    if rule_context and "disable_rules" in rule_context and clean_type in rule_context["disable_rules"]:
        return {
            "clause_reference": None,
            "rule_id": None,
            "rule_version": None,
            "title": f"{clean_type} Test",
            "unconfigured": True
        }

    if clean_type in CONFIGURED_OIML_RULES:
        return CONFIGURED_OIML_RULES[clean_type]

    # For unknown / unsupported test types, do not fabricate clauses
    return {
        "clause_reference": None,
        "rule_id": None,
        "rule_version": None,
        "title": f"Unconfigured {clean_type} Rule",
        "unconfigured": True
    }


def format_clause_display(clause_reference: Optional[str]) -> str:
    """
    Renders human-readable clause display string.
    Per specification: when clause_reference is null, display 'Applicable rule reference is not configured.'
    """
    if not clause_reference:
        return "Applicable rule reference is not configured."
    return clause_reference
