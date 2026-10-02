"""
Persistence & Business Service for OIML Test Plans.
Integrates with Supabase, in-memory cache, and the audit ledger.
"""
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import json
import uuid

from app.core.supabase import get_supabase_client
from app.api.v1.endpoints.reports import get_report_detail, _LOCAL_REPORTS
from .models import (
    TestPlan,
    TestPlanItem,
    TestPlanStatus,
    TestExecutionStatus,
    TestComplianceStatus,
    TestPlanDiff,
    ObservationSchema,
    ProcedureConfig,
)
from .generator import TestPlanGenerator

# In-memory storage for test plans (for local dev/testing without active Supabase table)
_LOCAL_TEST_PLANS: Dict[str, TestPlan] = {}


class TestPlanService:
    """
    Manages lifecycle, retrieval, database persistence, and audit synchronization for test plans.
    """

    @classmethod
    def get_plan_for_report(cls, report_id: str) -> Optional[TestPlan]:
        """
        Retrieves the latest active test plan for a report from Supabase or in-memory fallback.
        """
        clean_rep_id = str(report_id)
        supabase = get_supabase_client()

        if supabase:
            try:
                # Fetch latest non-superseded plan
                res = (
                    supabase.table("test_plans")
                    .select("*")
                    .eq("report_id", clean_rep_id)
                    .order("generated_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    plan_row = res.data[0]
                    # Fetch items
                    items_res = (
                        supabase.table("test_plan_items")
                        .select("*")
                        .eq("test_plan_id", plan_row["id"])
                        .order("sequence_order")
                        .execute()
                    )
                    items = []
                    if items_res.data:
                        for ir in items_res.data:
                            items.append(
                                TestPlanItem(
                                    id=str(ir["id"]),
                                    test_plan_id=str(ir["test_plan_id"]),
                                    test_type=ir["test_type"],
                                    test_code=ir["test_code"],
                                    title=ir["title"],
                                    description=ir.get("description"),
                                    standard_reference=ir.get("standard_reference"),
                                    sequence_order=ir["sequence_order"],
                                    applicable=ir.get("applicable", True),
                                    configured=ir.get("configured", True),
                                    execution_status=TestExecutionStatus(ir.get("execution_status", "READY")),
                                    compliance_status=TestComplianceStatus(ir.get("compliance_status", "NOT_EVALUATED")),
                                    blocked_reason=ir.get("blocked_reason"),
                                    prerequisites=ir.get("prerequisites") or [],
                                    required_standards=ir.get("required_standards") or {},
                                    observation_schema=ObservationSchema(**(ir.get("observation_schema") or {})),
                                    procedure_config=ProcedureConfig(**(ir.get("procedure_config") or {})),
                                    rule_version=ir.get("rule_version", "2006"),
                                    started_at=ir.get("started_at"),
                                    completed_at=ir.get("completed_at"),
                                    created_at=ir.get("created_at"),
                                    updated_at=ir.get("updated_at")
                                )
                            )
                    
                    plan = TestPlan(
                        id=str(plan_row["id"]),
                        report_id=str(plan_row["report_id"]),
                        instrument_id=str(plan_row["instrument_id"]),
                        reference_standard_id=str(plan_row["reference_standard_id"]) if plan_row.get("reference_standard_id") else None,
                        standard_version=plan_row.get("standard_version", "OIML R 76-1:2006"),
                        rule_set_version=plan_row.get("rule_set_version", "2006"),
                        generator_version=plan_row.get("generator_version", "M76-TPG-V1"),
                        status=TestPlanStatus(plan_row.get("status", "READY")),
                        instrument_snapshot=plan_row.get("instrument_snapshot") or {},
                        issues=plan_row.get("issues") or [],
                        items=items,
                        supersedes_plan_id=str(plan_row["supersedes_plan_id"]) if plan_row.get("supersedes_plan_id") else None,
                        generated_at=plan_row.get("generated_at"),
                        generated_by=str(plan_row["generated_by"]) if plan_row.get("generated_by") else None,
                        created_at=plan_row.get("created_at"),
                        updated_at=plan_row.get("updated_at")
                    )
                    _LOCAL_TEST_PLANS[clean_rep_id] = plan
                    return plan
            except Exception as e:
                print(f"[TestPlanService] Supabase fetch note: {e}")

        # In-memory fallback
        return _LOCAL_TEST_PLANS.get(clean_rep_id)

    @classmethod
    def generate_or_get_plan(
        cls,
        report_id: str,
        force_regenerate: bool = False,
        rule_set_version: str = "2006",
        user_id: Optional[str] = None,
        rule_context: Optional[Dict[str, Any]] = None
    ) -> Tuple[TestPlan, Optional[TestPlanDiff]]:
        """
        Retrieves the active plan or generates a new one.
        Handles idempotency, staleness checks, and diff generation on explicit regeneration.
        """
        clean_rep_id = str(report_id)
        rep = get_report_detail(clean_rep_id)
        if not rep or not rep.instrument:
            raise ValueError(f"Report '{clean_rep_id}' or associated instrument passport not found.")

        # Serialize instrument and standard dictionaries
        inst_dict = rep.instrument.model_dump() if hasattr(rep.instrument, "model_dump") else (
            rep.instrument.dict() if hasattr(rep.instrument, "dict") else dict(rep.instrument)
        )
        std_dict = (
            rep.reference_standard.model_dump() if hasattr(rep.reference_standard, "model_dump") else (
                rep.reference_standard.dict() if hasattr(rep.reference_standard, "dict") else dict(rep.reference_standard)
            )
        ) if rep.reference_standard else None

        existing_plan = cls.get_plan_for_report(clean_rep_id)

        # If plan already exists and force_regenerate is False
        if existing_plan and not force_regenerate:
            # Check staleness
            is_stale, reasons = TestPlanGenerator.is_plan_stale(
                plan=existing_plan,
                current_instrument=inst_dict,
                current_standard=std_dict
            )
            if is_stale:
                existing_plan.status = TestPlanStatus.STALE
            return existing_plan, None

        # Generate new plan
        supersedes_id = existing_plan.id if existing_plan else None
        new_plan = TestPlanGenerator.generate_plan(
            report_id=clean_rep_id,
            instrument_dict=inst_dict,
            standard_dict=std_dict,
            rule_set_version=rule_set_version,
            supersedes_plan_id=supersedes_id,
            user_id=user_id,
            rule_context=rule_context
        )

        diff = None
        if existing_plan:
            diff = TestPlanGenerator.compute_plan_diff(existing_plan, new_plan)

        # Persist new plan
        cls._persist_plan(new_plan, user_id=user_id)
        _LOCAL_TEST_PLANS[clean_rep_id] = new_plan

        return new_plan, diff

    @classmethod
    def _persist_plan(cls, plan: TestPlan, user_id: Optional[str] = None):
        """Persists plan and items into database and records audit ledger event."""
        supabase = get_supabase_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        if supabase:
            try:
                # 1. Insert plan header
                plan_row = {
                    "id": plan.id,
                    "report_id": plan.report_id,
                    "instrument_id": plan.instrument_id,
                    "reference_standard_id": plan.reference_standard_id,
                    "standard_version": plan.standard_version,
                    "rule_set_version": plan.rule_set_version,
                    "generator_version": plan.generator_version,
                    "status": plan.status.value,
                    "instrument_snapshot": plan.instrument_snapshot,
                    "issues": [i.model_dump() for i in plan.issues],
                    "supersedes_plan_id": plan.supersedes_plan_id,
                    "generated_by": user_id or plan.generated_by
                }
                supabase.table("test_plans").insert(plan_row).execute()

                # 2. Insert items
                item_rows = []
                for it in plan.items:
                    item_rows.append({
                        "id": it.id,
                        "test_plan_id": it.test_plan_id,
                        "test_type": it.test_type,
                        "test_code": it.test_code,
                        "title": it.title,
                        "description": it.description,
                        "standard_reference": it.standard_reference,
                        "sequence_order": it.sequence_order,
                        "applicable": it.applicable,
                        "configured": it.configured,
                        "execution_status": it.execution_status.value,
                        "compliance_status": it.compliance_status.value,
                        "blocked_reason": it.blocked_reason,
                        "prerequisites": it.prerequisites,
                        "required_standards": it.required_standards,
                        "observation_schema": it.observation_schema.model_dump(),
                        "procedure_config": it.procedure_config.model_dump(),
                        "rule_version": it.rule_version
                    })
                if item_rows:
                    supabase.table("test_plan_items").insert(item_rows).execute()

                # 3. Regulatory audit ledger
                action_name = "TEST_PLAN_REGENERATED" if plan.supersedes_plan_id else "TEST_PLAN_GENERATED"
                supabase.table("audit_ledger").insert({
                    "table_name": "test_plans",
                    "record_id": plan.id,
                    "action": action_name,
                    "performed_by": user_id or plan.generated_by,
                    "new_data": {
                        "report_id": plan.report_id,
                        "status": plan.status.value,
                        "items_count": len(plan.items),
                        "generator_version": plan.generator_version,
                        "supersedes_plan_id": plan.supersedes_plan_id
                    }
                }).execute()
            except Exception as e:
                print(f"[TestPlanService] Supabase persistence note: {e}")

    @classmethod
    def sync_plan_from_observations(cls, report_id: str):
        """
        Updates plan items based on completed observations and authoritative calculations.
        Marks completed procedures and sets compliance status (PASS / FAIL).
        """
        clean_rep_id = str(report_id)
        plan = cls.get_plan_for_report(clean_rep_id)
        if not plan:
            return

        rep = get_report_detail(clean_rep_id)
        if not rep:
            return

        # Check completed tests on report
        has_weighing = bool(rep.weighing_observations)
        has_eccentricity = bool(rep.eccentricity_results)
        has_repeatability = bool(rep.repeatability_results)

        for item in plan.items:
            if item.test_type == "WEIGHING" and has_weighing:
                item.execution_status = TestExecutionStatus.COMPLETED
                is_pass = all(w.is_compliant for w in rep.weighing_observations)
                item.compliance_status = TestComplianceStatus.PASS if is_pass else TestComplianceStatus.FAIL
            elif item.test_type == "ECCENTRICITY" and has_eccentricity:
                item.execution_status = TestExecutionStatus.COMPLETED
                is_pass = all(e.is_compliant for e in rep.eccentricity_results)
                item.compliance_status = TestComplianceStatus.PASS if is_pass else TestComplianceStatus.FAIL
            elif item.test_type == "REPEATABILITY" and has_repeatability:
                item.execution_status = TestExecutionStatus.COMPLETED
                is_pass = all(r.is_compliant for r in rep.repeatability_results)
                item.compliance_status = TestComplianceStatus.PASS if is_pass else TestComplianceStatus.FAIL

        # Check overall plan completion
        applicable_items = [it for it in plan.items if it.applicable and it.configured]
        if applicable_items and all(it.execution_status == TestExecutionStatus.COMPLETED for it in applicable_items):
            plan.status = TestPlanStatus.COMPLETED
        elif any(it.execution_status == TestExecutionStatus.COMPLETED for it in applicable_items):
            plan.status = TestPlanStatus.IN_PROGRESS

        _LOCAL_TEST_PLANS[clean_rep_id] = plan
