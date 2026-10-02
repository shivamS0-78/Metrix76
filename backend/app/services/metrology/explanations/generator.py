"""
Authoritative Failure Explanation Generator.
Consumes authoritative calculation results from OIMLR76Engine and outputs
structured, audit-grade Clause-Level Failure Explanations.
"""
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from .models import (
    FailureCode,
    FailureExplanation,
    FailureExplanationResponse,
)
from .rules import (
    METROLOGY_ENGINE_VERSION,
    EXPLANATION_VERSION,
    get_rule_metadata,
)
from .formatters import (
    build_weighing_explanation,
    build_repeatability_explanation,
    build_eccentricity_explanation,
    build_tare_zero_explanation,
)


class FailureExplanationGenerator:
    """
    Generates deterministic, traceable failure explanations from authoritative OIML calculation results.
    Does NOT determine compliance independently; only explains why an existing calculation failed.
    """

    @classmethod
    def generate_for_report(
        cls,
        report_id: str,
        observations: List[Dict[str, Any]],
        unit: str = "kg",
        rule_context: Optional[Dict[str, Any]] = None,
        evidence_map: Optional[Dict[str, List[str]]] = None
    ) -> FailureExplanationResponse:
        """
        Processes stored/evaluated observations for a report and generates explanations for all non-compliant points.
        """
        explanations: List[FailureExplanation] = []
        failed_test_types = set()
        failed_obs_count = 0
        evidence_map = evidence_map or {}

        for obs in observations:
            is_compliant = obs.get("is_compliant", True)
            if is_compliant:
                continue

            failed_obs_count += 1
            raw_type = obs.get("test_type", "WEIGHING")
            test_type = (raw_type.value if hasattr(raw_type, "value") else str(raw_type)).split(".")[-1].upper()
            failed_test_types.add(test_type)

            obs_id = obs.get("id") or str(uuid.uuid4())
            seq_order = obs.get("sequence_order", 1)
            evidence_ids = evidence_map.get(str(obs_id), [])

            # Fetch authoritative rule metadata
            rule_info = get_rule_metadata(test_type, rule_context=rule_context)
            clause_ref = rule_info.get("clause_reference")
            rule_id = rule_info.get("rule_id")
            rule_ver = rule_info.get("rule_version")

            if test_type == "WEIGHING":
                load = float(obs.get("load_applied", 0.0))
                indication = float(obs.get("indication_observed", 0.0))
                # Use corrected_error_ec if present, else error_e
                err = float(obs.get("corrected_error_ec", obs.get("error_e", 0.0)))
                mpe = float(obs.get("mpe_allowed", 0.0))
                direction = obs.get("direction", "INCREASING")
                
                excess = max(0.0, round(abs(err) - mpe, 5))
                margin_pct = round((excess / mpe * 100.0), 2) if mpe > 0 else 100.0

                title, summary, detail = build_weighing_explanation(
                    seq=seq_order,
                    load=load,
                    indication=indication,
                    error=err,
                    mpe=mpe,
                    excess=excess,
                    margin_pct=margin_pct,
                    direction=direction,
                    unit=unit,
                    clause_ref=clause_ref
                )

                explanations.append(
                    FailureExplanation(
                        id=f"exp-{uuid.uuid4().hex[:12]}",
                        report_id=report_id,
                        observation_id=str(obs_id) if obs.get("id") else None,
                        test_type="WEIGHING",
                        clause_reference=clause_ref,
                        rule_id=rule_id,
                        rule_version=rule_ver,
                        failure_code=FailureCode.ERROR_EXCEEDS_MPE,
                        title=title,
                        summary=summary,
                        measured_value=round(indication, 5),
                        expected_value=round(load, 5),
                        error_value=round(err, 5),
                        allowed_limit=round(mpe, 5),
                        excess_value=excess,
                        margin_percentage=margin_pct,
                        unit=unit,
                        direction=direction,
                        position=obs.get("position_tag", "CENTER"),
                        run_cycle=obs.get("run_cycle", 1),
                        explanation=detail,
                        severity="ERROR",
                        evidence_ids=evidence_ids,
                        engine_version=METROLOGY_ENGINE_VERSION,
                        explanation_version=EXPLANATION_VERSION,
                        details={
                            "calculated_p": obs.get("calculated_p"),
                            "delta_load": obs.get("delta_load"),
                            "true_error_e": obs.get("error_e"),
                            "corrected_error_ec": obs.get("corrected_error_ec")
                        }
                    )
                )

            elif test_type == "REPEATABILITY":
                cycle = int(obs.get("run_cycle", 1))
                load = float(obs.get("load_applied", 0.0))
                # For repeatability, error_e or delta_i represents the spread
                spread = float(obs.get("error_e", obs.get("delta_load", 0.0)))
                mpe = float(obs.get("mpe_allowed", 0.0))
                p_max = float(obs.get("calculated_p", load + spread))
                p_min = float(p_max - spread)
                excess = max(0.0, round(spread - mpe, 5))
                margin_pct = round((excess / mpe * 100.0), 2) if mpe > 0 else 100.0

                title, summary, detail = build_repeatability_explanation(
                    cycle=cycle,
                    nominal_load=load,
                    delta_i=spread,
                    mpe=mpe,
                    excess=excess,
                    p_max=p_max,
                    p_min=p_min,
                    unit=unit,
                    clause_ref=clause_ref
                )

                explanations.append(
                    FailureExplanation(
                        id=f"exp-{uuid.uuid4().hex[:12]}",
                        report_id=report_id,
                        observation_id=str(obs_id) if obs.get("id") else None,
                        test_type="REPEATABILITY",
                        clause_reference=clause_ref,
                        rule_id=rule_id,
                        rule_version=rule_ver,
                        failure_code=FailureCode.REPEATABILITY_EXCEEDS_LIMIT,
                        title=title,
                        summary=summary,
                        measured_value=round(spread, 5),
                        expected_value=round(load, 5),
                        error_value=round(spread, 5),
                        allowed_limit=round(mpe, 5),
                        excess_value=excess,
                        margin_percentage=margin_pct,
                        unit=unit,
                        direction="STATIC",
                        position="CENTER",
                        run_cycle=cycle,
                        explanation=detail,
                        severity="ERROR",
                        evidence_ids=evidence_ids,
                        engine_version=METROLOGY_ENGINE_VERSION,
                        explanation_version=EXPLANATION_VERSION,
                        details={
                            "nominal_load": load,
                            "delta_i": spread,
                            "p_max": p_max,
                            "p_min": p_min
                        }
                    )
                )

            elif test_type == "ECCENTRICITY":
                pos_tag = str(obs.get("position_tag", "UNKNOWN"))
                load = float(obs.get("load_applied", 0.0))
                indication = float(obs.get("indication_observed", 0.0))
                err = float(obs.get("corrected_error_ec", obs.get("error_e", 0.0)))
                mpe = float(obs.get("mpe_allowed", 0.0))
                excess = max(0.0, round(abs(err) - mpe, 5))
                margin_pct = round((excess / mpe * 100.0), 2) if mpe > 0 else 100.0

                title, summary, detail = build_eccentricity_explanation(
                    pos_tag=pos_tag,
                    load=load,
                    indication=indication,
                    error=err,
                    mpe=mpe,
                    excess=excess,
                    unit=unit,
                    clause_ref=clause_ref
                )

                explanations.append(
                    FailureExplanation(
                        id=f"exp-{uuid.uuid4().hex[:12]}",
                        report_id=report_id,
                        observation_id=str(obs_id) if obs.get("id") else None,
                        test_type="ECCENTRICITY",
                        clause_reference=clause_ref,
                        rule_id=rule_id,
                        rule_version=rule_ver,
                        failure_code=FailureCode.ECCENTRICITY_EXCEEDS_LIMIT,
                        title=title,
                        summary=summary,
                        measured_value=round(indication, 5),
                        expected_value=round(load, 5),
                        error_value=round(err, 5),
                        allowed_limit=round(mpe, 5),
                        excess_value=excess,
                        margin_percentage=margin_pct,
                        unit=unit,
                        direction="STATIC",
                        position=pos_tag,
                        run_cycle=1,
                        explanation=detail,
                        severity="ERROR",
                        evidence_ids=evidence_ids,
                        engine_version=METROLOGY_ENGINE_VERSION,
                        explanation_version=EXPLANATION_VERSION,
                        details={
                            "calculated_p": obs.get("calculated_p"),
                            "corrected_error_ec": obs.get("corrected_error_ec")
                        }
                    )
                )

            elif test_type == "TARE_ZERO":
                load = float(obs.get("load_applied", 0.0))
                indication = float(obs.get("indication_observed", 0.0))
                err = float(obs.get("error_e", obs.get("corrected_error_ec", 0.0)))
                mpe = float(obs.get("mpe_allowed", 0.0))
                excess = max(0.0, round(abs(err) - mpe, 5))
                margin_pct = round((excess / mpe * 100.0), 2) if mpe > 0 else 100.0
                subtype = "Zero-Setting" if load == 0.0 else "Tare Balancing"
                failure_code = FailureCode.ZERO_ERROR_EXCEEDS_LIMIT if load == 0.0 else FailureCode.TARE_ERROR_EXCEEDS_LIMIT

                title, summary, detail = build_tare_zero_explanation(
                    seq=seq_order,
                    test_subtype=subtype,
                    load=load,
                    indication=indication,
                    error=err,
                    limit=mpe,
                    excess=excess,
                    unit=unit,
                    clause_ref=clause_ref
                )

                explanations.append(
                    FailureExplanation(
                        id=f"exp-{uuid.uuid4().hex[:12]}",
                        report_id=report_id,
                        observation_id=str(obs_id) if obs.get("id") else None,
                        test_type="TARE_ZERO",
                        clause_reference=clause_ref,
                        rule_id=rule_id,
                        rule_version=rule_ver,
                        failure_code=failure_code,
                        title=title,
                        summary=summary,
                        measured_value=round(indication, 5),
                        expected_value=round(load, 5),
                        error_value=round(err, 5),
                        allowed_limit=round(mpe, 5),
                        excess_value=excess,
                        margin_percentage=margin_pct,
                        unit=unit,
                        direction="STATIC",
                        position=obs.get("position_tag", "ZERO"),
                        run_cycle=1,
                        explanation=detail,
                        severity="ERROR",
                        evidence_ids=evidence_ids,
                        engine_version=METROLOGY_ENGINE_VERSION,
                        explanation_version=EXPLANATION_VERSION,
                        details={
                            "calculated_p": obs.get("calculated_p"),
                            "is_zero_point": load == 0.0
                        }
                    )
                )

            else:
                # Handle unconfigured test modules or non-standard tests where compliance failed
                load = float(obs.get("load_applied", 0.0))
                indication = float(obs.get("indication_observed", 0.0))
                err = float(obs.get("corrected_error_ec", obs.get("error_e", 0.0)))
                mpe = float(obs.get("mpe_allowed", 0.0))
                excess = max(0.0, round(abs(err) - mpe, 5))
                margin_pct = round((excess / mpe * 100.0), 2) if mpe > 0 else 100.0

                title = f"{test_type} — Non-Compliant Observation #{seq_order}"
                summary = (
                    f"Observation #{seq_order} failed for module '{test_type}'. "
                    f"Applicable rule reference is not configured."
                )
                detail = (
                    f"Observation #{seq_order} failed compliance check with observed indication {indication} {unit} "
                    f"for applied load {load} {unit}. Calculated error was {err} {unit} against limit {mpe} {unit}. "
                    f"Applicable rule reference is not configured."
                )

                explanations.append(
                    FailureExplanation(
                        id=f"exp-{uuid.uuid4().hex[:12]}",
                        report_id=report_id,
                        observation_id=str(obs_id) if obs.get("id") else None,
                        test_type=test_type,
                        clause_reference=clause_ref,
                        rule_id=rule_id,
                        rule_version=rule_ver,
                        failure_code=FailureCode.RULE_NOT_CONFIGURED,
                        title=title,
                        summary=summary,
                        measured_value=round(indication, 5),
                        expected_value=round(load, 5),
                        error_value=round(err, 5),
                        allowed_limit=round(mpe, 5),
                        excess_value=excess,
                        margin_percentage=margin_pct,
                        unit=unit,
                        direction=obs.get("direction", "STATIC"),
                        position=obs.get("position_tag", "UNKNOWN"),
                        run_cycle=obs.get("run_cycle", 1),
                        explanation=detail,
                        severity="ERROR",
                        evidence_ids=evidence_ids,
                        engine_version=METROLOGY_ENGINE_VERSION,
                        explanation_version=EXPLANATION_VERSION,
                        details={"raw_observation": obs}
                    )
                )

        overall_status = "FAIL" if explanations else "PASS"

        return FailureExplanationResponse(
            report_id=report_id,
            overall_status=overall_status,
            failed_tests=len(failed_test_types),
            failed_observations=failed_obs_count,
            explanations=explanations,
            engine_version=METROLOGY_ENGINE_VERSION,
            explanation_version=EXPLANATION_VERSION
        )
