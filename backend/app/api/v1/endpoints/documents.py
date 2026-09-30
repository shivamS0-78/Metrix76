from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
import os
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.services.reporting import OIMLPDFGenerator, OIMLDOCXGenerator, OIMLErrorChartEngine
from app.services.document.crypto import CryptoAuditService
from app.api.v1.endpoints.reports import get_report_detail
from app.core.supabase import get_supabase_client
from app.config import settings

router = APIRouter()


class DirectDocumentPayload(BaseModel):
    report_context: Dict[str, Any]


@router.post("/generate-pdf")
def generate_pdf_direct(payload: DirectDocumentPayload):
    """
    Renders an in-memory OIML R 76-2 Annex A PDF certificate from the provided report context.
    Streams back as application/pdf binary.
    """
    try:
        pdf_gen = OIMLPDFGenerator()
        pdf_bytes = pdf_gen.render_pdf(payload.report_context)
        rep_num = payload.report_context.get("report_number", "OIML-TR-Report")
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{rep_num}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF Generation Failed: {str(e)}")


@router.post("/generate-docx")
def generate_docx_direct(payload: DirectDocumentPayload):
    """
    Renders an in-memory editable OIML R 76-2 Annex A Word (.docx) document.
    Streams back as application/vnd.openxmlformats-officedocument.wordprocessingml.document.
    """
    try:
        chart_bytes = None
        ctx = payload.report_context
        if "instrument" in ctx and "weighing_observations" in ctx:
            try:
                chart_bytes = OIMLErrorChartEngine.generate_error_curve_image(
                    spec=ctx["instrument"],
                    results=ctx["weighing_observations"],
                    dpi=150
                )
            except Exception:
                chart_bytes = None

        docx_bytes = OIMLDOCXGenerator.render_docx(payload.report_context, chart_png_bytes=chart_bytes)
        rep_num = payload.report_context.get("report_number", "OIML-TR-Report")
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{rep_num}.docx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX Generation Failed: {str(e)}")


def _generate_and_return_pdf_response(report_id: str):
    try:
        rep = get_report_detail(report_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Report not found: {str(e)}")

    supabase = get_supabase_client()

    # If already in Supabase Storage bucket, try downloading from storage directly
    if supabase:
        storage_paths = [
            rep.pdf_storage_path if hasattr(rep, "pdf_storage_path") and rep.pdf_storage_path else None,
            f"certificates/{report_id}.pdf"
        ]
        for path in storage_paths:
            if path:
                try:
                    clean_path = path.replace("generated-reports/", "") if path.startswith("generated-reports/") else path
                    pdf_bytes = supabase.storage.from_(settings.STORAGE_BUCKET_REPORTS).download(clean_path)
                    if pdf_bytes and len(pdf_bytes) > 100:
                        return StreamingResponse(
                            io.BytesIO(pdf_bytes),
                            media_type="application/pdf",
                            headers={"Content-Disposition": f'inline; filename="{rep.report_number}.pdf"'}
                        )
                except Exception:
                    pass

    # Check local filesystem cache
    local_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "storage", "certificates")
    local_file = os.path.join(local_dir, f"{report_id}.pdf")
    if os.path.exists(local_file):
        try:
            with open(local_file, "rb") as f:
                pdf_bytes = f.read()
            if pdf_bytes and len(pdf_bytes) > 100:
                return StreamingResponse(
                    io.BytesIO(pdf_bytes),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{rep.report_number}.pdf"'}
                )
        except Exception:
            pass

    # Generate QR verification URL
    verification_url = f"https://lims.metrology.gov.in/verify/{rep.id}"
    qr_b64 = CryptoAuditService.generate_qr_code_base64(verification_url)

    created_d = str(rep.created_at.date()) if hasattr(rep.created_at, "date") else str(rep.created_at)[:10]
    approved_d = str(rep.approved_at.date()) if rep.approved_at and hasattr(rep.approved_at, "date") else created_d

    # Convert Pydantic model to dictionary context
    report_dict = {
        "report_number": rep.report_number,
        "created_date": created_d,
        "approved_date": approved_d,
        "overall_verdict": rep.overall_verdict if rep.overall_verdict is not None else True,
        "zero_error_e0": 0.0,
        "instrument": rep.instrument.model_dump() if hasattr(rep.instrument, "model_dump") else rep.instrument,
        "reference_standard": rep.reference_standard.model_dump() if hasattr(rep.reference_standard, "model_dump") else rep.reference_standard,
        "environment": rep.environment.model_dump() if hasattr(rep.environment, "model_dump") else rep.environment,
        "weighing_observations": [obs.model_dump() if hasattr(obs, "model_dump") else obs for obs in (rep.weighing_observations or [])],
        "conducted_by": rep.conducted_by,
        "approved_by": rep.approved_by or "Director of Legal Metrology",
        "sha256_hash": rep.sha256_hash or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "qr_code_base64": qr_b64
    }

    # Render error curve
    chart_png = None
    if rep.weighing_observations:
        try:
            chart_png = OIMLErrorChartEngine.generate_error_curve_image(
                spec=rep.instrument,
                results=rep.weighing_observations,
                dpi=150
            )
        except Exception as e:
            print(f"Chart render warning: {e}")

    try:
        pdf_gen = OIMLPDFGenerator()
        pdf_bytes = pdf_gen.render_pdf(
            report_context=report_dict,
            chart_png_bytes=chart_png,
            qr_png_base64=qr_b64
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc)
        )

    # If Supabase is connected, cache/upload the generated PDF to the bucket
    if supabase and pdf_bytes:
        try:
            storage_path = f"certificates/{report_id}.pdf"
            supabase.storage.from_(settings.STORAGE_BUCKET_REPORTS).upload(
                path=storage_path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )
        except Exception as e:
            print(f"[Supabase Storage] Cache upload note: {e}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{rep.report_number}.pdf"'}
    )


@router.get("/{report_id}/pdf")
def get_pdf_direct_path(report_id: str):
    return _generate_and_return_pdf_response(report_id)


@router.get("/reports/{report_id}/pdf")
def get_pdf_reports_path(report_id: str):
    return _generate_and_return_pdf_response(report_id)


@router.get("/reports/{report_id}/generate-pdf")
def get_generate_pdf_for_report(report_id: str):
    return _generate_and_return_pdf_response(report_id)


@router.post("/reports/{report_id}/generate-pdf")
def post_generate_pdf_for_report(report_id: str):
    return _generate_and_return_pdf_response(report_id)


def _generate_and_return_docx_response(report_id: str):
    try:
        rep = get_report_detail(report_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Report not found: {str(e)}")

    chart_png = None
    if rep.weighing_observations:
        try:
            chart_png = OIMLErrorChartEngine.generate_error_curve_image(
                spec=rep.instrument,
                results=rep.weighing_observations,
                dpi=150
            )
        except Exception:
            chart_png = None

    created_d = str(rep.created_at.date()) if hasattr(rep.created_at, "date") else str(rep.created_at)[:10]
    approved_d = str(rep.approved_at.date()) if rep.approved_at and hasattr(rep.approved_at, "date") else created_d

    report_dict = {
        "report_number": rep.report_number,
        "created_date": created_d,
        "approved_date": approved_d,
        "overall_verdict": rep.overall_verdict if rep.overall_verdict is not None else True,
        "zero_error_e0": 0.0,
        "instrument": rep.instrument,
        "reference_standard": rep.reference_standard,
        "environment": rep.environment,
        "weighing_observations": rep.weighing_observations,
        "conducted_by": rep.conducted_by,
        "approved_by": rep.approved_by or "Director of Legal Metrology",
        "sha256_hash": rep.sha256_hash or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }

    docx_bytes = OIMLDOCXGenerator.render_docx(
        report_context=report_dict,
        chart_png_bytes=chart_png
    )

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{rep.report_number}.docx"'}
    )


@router.get("/reports/{report_id}/generate-docx")
def get_generate_docx_for_report(report_id: str):
    return _generate_and_return_docx_response(report_id)


@router.post("/reports/{report_id}/generate-docx")
def post_generate_docx_for_report(report_id: str):
    return _generate_and_return_docx_response(report_id)
