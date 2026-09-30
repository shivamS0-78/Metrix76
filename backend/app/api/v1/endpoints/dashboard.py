from typing import Optional
from fastapi import APIRouter, Query
from datetime import datetime, date, timedelta, timezone
from app.schemas.dashboard import DashboardData, DashboardMetrics
from app.schemas.reference_standard import ReferenceStandardOut
from app.schemas.report import TestReportSummary, ReportStatus
from app.schemas.metrology import AccuracyClass
from app.core.supabase import get_supabase_client

router = APIRouter()


@router.get("/metrics", response_model=DashboardData)
def get_dashboard_data(
    user_id: Optional[str] = Query(None, description="Current authenticated user UUID"),
    role: Optional[str] = Query(None, description="Current user role (TECHNICIAN, APPROVER, ADMIN)")
):
    """
    Returns executive operational metrics, work queues, and expiring standards alerts
    computed dynamically from Supabase database with multi-user isolation.
    """
    now = datetime.now(timezone.utc)
    today = date.today()
    supabase = get_supabase_client()

    expiring_standards = []
    technician_work_queue = []
    approver_work_queue = []

    active_evals = 0
    pending_approvals = 0
    approved_month = 0
    approved_year = 0
    total_rejected_all = 0
    class_counts = {
        "CLASS_I": {"total": 0, "rejected": 0},
        "CLASS_II": {"total": 0, "rejected": 0},
        "CLASS_III": {"total": 0, "rejected": 0},
        "CLASS_IIII": {"total": 0, "rejected": 0}
    }

    if supabase:
        try:
            # 1. Fetch expiring standards
            std_res = supabase.table("reference_standards").select("*").order("expiry_date", desc=False).execute()
            if std_res.data:
                for s in std_res.data:
                    exp_date = date.fromisoformat(s["expiry_date"])
                    diff = (exp_date - today).days
                    if diff <= 90:  # Expiring within 90 days
                        expiring_standards.append(
                            ReferenceStandardOut(
                                id=str(s["id"]),
                                set_identifier=s["set_identifier"],
                                accuracy_class=s["accuracy_class"],
                                certificate_number=s["certificate_number"],
                                calibrated_by=s["calibrated_by"],
                                calibration_date=date.fromisoformat(s["calibration_date"]),
                                expiry_date=exp_date,
                                expanded_uncertainty_k2=float(s.get("expanded_uncertainty_k2") or 0.0001),
                                nominal_range=s.get("nominal_range") or "1 mg to 50 kg",
                                is_active=s.get("is_active", True),
                                is_expired=diff < 0,
                                days_to_expiry=diff,
                                created_at=now
                            )
                        )

            # 2. Fetch reports for queues and metrics
            rep_res = supabase.table("test_reports").select("*, instruments(*)").order("created_at", desc=True).execute()
            if rep_res.data:
                for r in rep_res.data:
                    inst = r.get("instruments") or {}
                    rep_status = r.get("status", "DRAFT")
                    conducted_by_id = str(r.get("conducted_by", ""))
                    created_at = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")) if "created_at" in r else now
                    updated_at = datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00")) if "updated_at" in r else now

                    summary_item = TestReportSummary(
                        id=str(r["id"]),
                        report_number=r["report_number"],
                        instrument_serial=inst.get("serial_number", "N/A"),
                        instrument_model=inst.get("model_name", "N/A"),
                        manufacturer_name=inst.get("manufacturer_name", "N/A"),
                        accuracy_class=AccuracyClass(inst.get("accuracy_class", "CLASS_III")),
                        status=ReportStatus(rep_status),
                        overall_verdict=r.get("overall_verdict"),
                        conducted_by_name=str(r.get("conducted_by", "Testing Metrologist")),
                        created_at=created_at,
                        updated_at=updated_at
                    )

                    if rep_status in ("DRAFT", "REJECTED"):
                        # If user is a technician, only show their own draft tasks
                        if role != "TECHNICIAN" or not user_id or conducted_by_id == user_id:
                            technician_work_queue.append(summary_item)
                        active_evals += 1
                    elif rep_status == "PENDING_APPROVAL":
                        approver_work_queue.append(summary_item)
                        pending_approvals += 1
                    elif rep_status == "APPROVED":
                        approved_month += 1
                        approved_year += 1

                    # Track class totals for rejection rate computation
                    c_name = inst.get("accuracy_class", "CLASS_III")
                    if c_name in class_counts:
                        class_counts[c_name]["total"] += 1
                        if rep_status == "REJECTED" or r.get("overall_verdict") is False:
                            class_counts[c_name]["rejected"] += 1
                            total_rejected_all += 1
        except Exception as e:
            print(f"[Supabase] Error computing dashboard metrics: {e}")

    total_finished = approved_year + total_rejected_all
    compliance_rate = round((approved_year / total_finished) * 100, 1) if total_finished > 0 else 100.0

    rejection_rates = {}
    for c_name, stats in class_counts.items():
        rejection_rates[c_name] = round((stats["rejected"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0.0

    metrics = DashboardMetrics(
        active_evaluations_count=active_evals,
        pending_approval_count=pending_approvals,
        completed_approvals_month=approved_month,
        completed_approvals_year=approved_year,
        overall_compliance_rate_pct=compliance_rate,
        rejection_rate_by_class=rejection_rates
    )

    return DashboardData(
        metrics=metrics,
        expiring_standards=expiring_standards,
        technician_work_queue=technician_work_queue,
        approver_work_queue=approver_work_queue
    )
