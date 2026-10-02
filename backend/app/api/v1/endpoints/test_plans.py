"""
FastAPI Endpoints for Automatic OIML Test Plan Generation & Management.
Provides endpoints to generate, retrieve, regenerate, and update test plan execution states.
"""
from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional

from app.services.metrology.test_plan import (
    TestPlan,
    TestPlanItem,
    TestPlanResponse,
    TestPlanGenerateRequest,
    TestPlanService,
    TestPlanStatus,
    TestExecutionStatus,
)
from app.api.v1.endpoints.reports import get_report_detail

router = APIRouter()


@router.post("/reports/{report_id}/test-plan/generate", response_model=TestPlanResponse, status_code=status.HTTP_200_OK)
def generate_or_get_report_test_plan(
    report_id: str,
    payload: Optional[TestPlanGenerateRequest] = None
):
    """
    Authoritative Test Plan Generator:
    Inspects instrument specifications (accuracy class, capacity, intervals, multi-interval specs),
    validates rules, sequences applicable OIML R 76 procedures, and returns the structured plan.
    Idempotent: Reuses active plan unless inputs changed or force_regenerate=True.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")

    if not rep.instrument:
        raise HTTPException(
            status_code=422,
            detail="Cannot generate test plan: Report does not have an associated instrument passport."
        )

    force_reg = payload.force_regenerate if payload else False
    rule_ver = payload.rule_set_version if payload and payload.rule_set_version else "2006"

    try:
        plan, diff = TestPlanService.generate_or_get_plan(
            report_id=report_id,
            force_regenerate=force_reg,
            rule_set_version=rule_ver
        )
        msg = "New test plan generated" if (diff or force_reg) else "Active test plan retrieved"
        return TestPlanResponse(
            plan=plan,
            diff=diff,
            message=msg
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/reports/{report_id}/test-plan", response_model=TestPlanResponse)
def get_report_test_plan(
    report_id: str,
    auto_generate: bool = Query(True, description="Automatically generate plan if none exists for this draft")
):
    """
    Retrieves the currently active OIML test plan for the report.
    Checks staleness against current instrument configuration.
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")

    plan = TestPlanService.get_plan_for_report(report_id)
    if not plan and auto_generate and rep.instrument:
        try:
            plan, _ = TestPlanService.generate_or_get_plan(report_id=report_id, force_regenerate=False)
        except Exception:
            pass

    if not plan:
        raise HTTPException(
            status_code=404,
            detail=f"No active test plan found for report '{report_id}'. Call POST /test-plan/generate."
        )

    return TestPlanResponse(
        plan=plan,
        diff=None,
        message="Active test plan loaded"
    )


@router.post("/reports/{report_id}/test-plan/regenerate", response_model=TestPlanResponse)
def regenerate_report_test_plan(
    report_id: str,
    payload: Optional[TestPlanGenerateRequest] = None
):
    """
    Explicitly regenerates the test plan, archiving the previous version as superseded
    and computing structured diffs (added/removed/modified tests).
    """
    rep = get_report_detail(report_id)
    if not rep:
        raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")

    rule_ver = payload.rule_set_version if payload and payload.rule_set_version else "2006"

    try:
        plan, diff = TestPlanService.generate_or_get_plan(
            report_id=report_id,
            force_regenerate=True,
            rule_set_version=rule_ver
        )
        return TestPlanResponse(
            plan=plan,
            diff=diff,
            message="Test plan regenerated successfully"
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
