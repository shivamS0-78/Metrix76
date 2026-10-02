"""
Automatic OIML Test Plan Generator Engine.
Validates instrument inputs, freezes configuration snapshots, deterministically sequences tests,
and detects plan staleness.
"""
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.schemas.metrology import AccuracyClass, InstrumentMeta
from .models import (
    TestPlan,
    TestPlanItem,
    TestPlanStatus,
    TestExecutionStatus,
    TestPlanDiff,
    TestPlanIssue,
)
from .definitions import (
    GENERATOR_VERSION,
    STANDARD_VERSION,
    RULE_SET_VERSION,
    SUPPORTED_TEST_DEFINITIONS,
)
from .validators import validate_instrument_configuration
from .rules import TestPlanRuleEngine


class TestPlanGenerator:
    """
    Core authoritative engine for generating and evaluating OIML test plans.
    """

    @classmethod
    def generate_plan(
        cls,
        report_id: str,
        instrument_dict: Dict[str, Any],
        standard_dict: Optional[Dict[str, Any]] = None,
        rule_set_version: str = RULE_SET_VERSION,
        supersedes_plan_id: Optional[str] = None,
        user_id: Optional[str] = None,
        rule_context: Optional[Dict[str, Any]] = None
    ) -> TestPlan:
        """
        Generates an authoritative, structured OIML test plan for an instrument.
        """
        plan_id = f"tp-{uuid.uuid4().hex[:12]}"
        inst_id = str(instrument_dict.get("id") or instrument_dict.get("instrument_id") or "inst-unknown")
        std_id = str(standard_dict.get("id")) if standard_dict else None

        # 1. Server-side validation
        issues = validate_instrument_configuration(instrument_dict)
        if issues:
            return TestPlan(
                id=plan_id,
                report_id=report_id,
                instrument_id=inst_id,
                reference_standard_id=std_id,
                standard_version=STANDARD_VERSION,
                rule_set_version=rule_set_version,
                generator_version=GENERATOR_VERSION,
                status=TestPlanStatus.INVALID,
                instrument_snapshot=dict(instrument_dict),
                issues=issues,
                items=[],
                supersedes_plan_id=supersedes_plan_id,
                generated_by=user_id
            )

        # 2. Frozen configuration snapshot
        acc_class_raw = instrument_dict.get("accuracy_class")
        acc_class = AccuracyClass(acc_class_raw) if isinstance(acc_class_raw, str) else acc_class_raw
        
        snapshot = {
            "accuracy_class": str(acc_class.value if hasattr(acc_class, "value") else acc_class),
            "max_capacity": float(instrument_dict.get("max_capacity", 0.0)),
            "min_capacity": float(instrument_dict.get("min_capacity", 0.0)),
            "scale_interval_d": float(instrument_dict.get("scale_interval_d", 0.0)),
            "verification_interval_e": float(instrument_dict.get("verification_interval_e", 0.0)),
            "unit": str(instrument_dict.get("unit", "kg")),
            "is_multi_interval": bool(instrument_dict.get("is_multi_interval", False)),
            "multi_interval_spec": instrument_dict.get("multi_interval_spec") or instrument_dict.get("multi_interval_ranges")
        }

        spec = InstrumentMeta(
            accuracy_class=acc_class,
            max_capacity=snapshot["max_capacity"],
            min_capacity=snapshot["min_capacity"],
            scale_interval_d=snapshot["scale_interval_d"],
            verification_interval_e=snapshot["verification_interval_e"],
            unit=snapshot["unit"],
            is_multi_interval=snapshot["is_multi_interval"],
            multi_interval_ranges=None
        )

        # 3. Deterministic sequencing of supported tests
        items: List[TestPlanItem] = []
        ordered_defs = sorted(SUPPORTED_TEST_DEFINITIONS.values(), key=lambda d: d.sequence_order)

        for test_def in ordered_defs:
            item = TestPlanRuleEngine.create_plan_item(
                test_plan_id=plan_id,
                test_type=test_def.test_type,
                spec=spec,
                standard_dict=standard_dict,
                rule_set_version=rule_set_version,
                rule_context=rule_context
            )
            items.append(item)

        # Overall plan status
        overall_status = TestPlanStatus.READY

        return TestPlan(
            id=plan_id,
            report_id=report_id,
            instrument_id=inst_id,
            reference_standard_id=std_id,
            standard_version=STANDARD_VERSION,
            rule_set_version=rule_set_version,
            generator_version=GENERATOR_VERSION,
            status=overall_status,
            instrument_snapshot=snapshot,
            issues=[],
            items=items,
            supersedes_plan_id=supersedes_plan_id,
            generated_by=user_id
        )

    @classmethod
    def is_plan_stale(
        cls,
        plan: TestPlan,
        current_instrument: Dict[str, Any],
        current_standard: Optional[Dict[str, Any]] = None
    ) -> tuple[bool, List[str]]:
        """
        Determines if a previously generated plan is stale relative to current instrument or standard parameters.
        Returns: (is_stale, list_of_staleness_reasons)
        """
        reasons = []
        snap = plan.instrument_snapshot or {}

        # Compare accuracy class
        curr_class = current_instrument.get("accuracy_class")
        curr_class_str = str(curr_class.value if hasattr(curr_class, "value") else curr_class)
        snap_class_str = str(snap.get("accuracy_class", ""))
        if curr_class_str != snap_class_str:
            reasons.append(f"Accuracy class changed from '{snap_class_str}' to '{curr_class_str}'.")

        # Compare numeric capacity & intervals
        fields_to_check = [
            ("max_capacity", "Maximum capacity Max"),
            ("min_capacity", "Minimum capacity Min"),
            ("verification_interval_e", "Verification interval e"),
            ("scale_interval_d", "Scale interval d"),
            ("unit", "Measurement unit"),
            ("is_multi_interval", "Multi-interval configuration")
        ]

        for field_name, label in fields_to_check:
            snap_val = snap.get(field_name)
            curr_val = current_instrument.get(field_name)
            if snap_val is not None and curr_val is not None:
                if isinstance(snap_val, (int, float)) and isinstance(curr_val, (int, float)):
                    if abs(float(snap_val) - float(curr_val)) > 1e-9:
                        reasons.append(f"{label} changed from {snap_val} to {curr_val}.")
                elif str(snap_val) != str(curr_val):
                    reasons.append(f"{label} changed from {snap_val} to {curr_val}.")

        # Compare reference standard ID
        if current_standard:
            curr_std_id = str(current_standard.get("id"))
            if plan.reference_standard_id and plan.reference_standard_id != curr_std_id:
                reasons.append(f"Assigned reference standard changed to '{current_standard.get('set_identifier', curr_std_id)}'.")

        return len(reasons) > 0, reasons

    @classmethod
    def compute_plan_diff(cls, old_plan: TestPlan, new_plan: TestPlan) -> TestPlanDiff:
        """
        Computes structured differences between an existing superseded plan and a newly generated plan.
        """
        old_types = {item.test_type: item for item in old_plan.items}
        new_types = {item.test_type: item for item in new_plan.items}

        added = [t for t in new_types if t not in old_types]
        removed = [t for t in old_types if t not in new_types]
        modified = []
        reasons = []

        for t in new_types:
            if t in old_types:
                old_it = old_types[t]
                new_it = new_types[t]
                mod_reasons = []

                if old_it.applicable != new_it.applicable:
                    mod_reasons.append(f"Applicability changed to {new_it.applicable}")
                if old_it.configured != new_it.configured:
                    mod_reasons.append(f"Configuration changed to {new_it.configured}")
                if old_it.execution_status != new_it.execution_status:
                    mod_reasons.append(f"Execution status changed from {old_it.execution_status} to {new_it.execution_status}")

                # Check load differences
                old_rec = getattr(old_it.procedure_config, "recommended_load", None)
                new_rec = getattr(new_it.procedure_config, "recommended_load", None)
                if old_rec != new_rec and new_rec is not None:
                    mod_reasons.append(f"Recommended load changed from {old_rec} to {new_rec}")

                if mod_reasons:
                    modified.append(t)
                    reasons.append(f"{t}: {', '.join(mod_reasons)}")

        has_changes = bool(added or removed or modified)
        return TestPlanDiff(
            has_changes=has_changes,
            added_tests=added,
            removed_tests=removed,
            modified_tests=modified,
            changed_reasons=reasons
        )
