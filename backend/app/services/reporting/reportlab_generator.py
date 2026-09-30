"""
ReportLab-based OIML R 76-2 Annex A PDF Certificate Generator
Provides pure-Python PDF generation conforming to OIML R 76-2:2007 requirements
without requiring external GTK/Pango C libraries.
"""
import io
import os
import base64
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from PIL import Image as PILImage


class ReportLabOIMLGenerator:
    """
    Renders official OIML R 76-2 Annex A Type Approval Certificates using ReportLab.
    """

    @classmethod
    def render_pdf(
        cls,
        report_context: Dict[str, Any],
        chart_png_bytes: Optional[bytes] = None,
        qr_png_base64: Optional[str] = None
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom Typography Styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#0f172a'),
            alignment=0
        )
        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#334155'),
            alignment=0
        )
        small_muted = ParagraphStyle(
            'SmallMuted',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#64748b')
        )
        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#0f172a'),
            spaceBefore=8,
            spaceAfter=4
        )
        cell_bold = ParagraphStyle(
            'CellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#1e293b')
        )
        cell_text = ParagraphStyle(
            'CellText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#334155')
        )
        cell_mono = ParagraphStyle(
            'CellMono',
            parent=styles['Normal'],
            fontName='Courier',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#0f172a')
        )
        pass_badge = ParagraphStyle(
            'PassBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#16a34a')
        )
        fail_badge = ParagraphStyle(
            'FailBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#dc2626')
        )

        elements = []

        rep_num = report_context.get("report_number", "OIML-TR-Report")
        approved_date = report_context.get("approved_date") or report_context.get("created_date", "2026-09-30")
        inst = report_context.get("instrument") or {}
        if hasattr(inst, "model_dump"):
            inst = inst.model_dump()
        std = report_context.get("reference_standard") or {}
        if hasattr(std, "model_dump"):
            std = std.model_dump()
        env = report_context.get("environment") or {}
        if hasattr(env, "model_dump"):
            env = env.model_dump()
        weighing_obs = report_context.get("weighing_observations") or []
        overall_verdict = report_context.get("overall_verdict")
        if overall_verdict is None:
            overall_verdict = True

        # ---------------------------------------------------------
        # Header Banner
        # ---------------------------------------------------------
        header_data = [
            [
                Paragraph("DIRECTORATE OF LEGAL METROLOGY", title_style),
                Paragraph(f"<b>REPORT IDENTIFIER</b><br/><font size='10' face='Courier-Bold'>{rep_num}</font>", cell_bold)
            ],
            [
                Paragraph("National Type Evaluation Laboratory • ISO/IEC 17025 Accredited", subtitle_style),
                Paragraph(f"<b>Issue Date:</b> {approved_date}", cell_text)
            ],
            [
                Paragraph("Statutory Type Evaluation Certificate • OIML R 76-1:2006 & R 76-2:2007 (Annex A)", small_muted),
                Paragraph(f"<b>Standard:</b> OIML R 76-1:2006", small_muted)
            ]
        ]
        header_table = Table(header_data, colWidths=[360, 160])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 6))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceBefore=2, spaceAfter=8))

        # ---------------------------------------------------------
        # Section 1: Instrument Passport
        # ---------------------------------------------------------
        elements.append(Paragraph("1. INSTRUMENT PASSPORT & TECHNICAL SPECIFICATIONS", section_heading))
        unit = inst.get("unit", "kg")
        passport_data = [
            [
                Paragraph("Manufacturer:", cell_bold), Paragraph(str(inst.get("manufacturer_name", "N/A")), cell_text),
                Paragraph("Accuracy Class:", cell_bold), Paragraph(str(inst.get("accuracy_class", "CLASS_III")), cell_mono)
            ],
            [
                Paragraph("Model Designation:", cell_bold), Paragraph(str(inst.get("model_name", "N/A")), cell_text),
                Paragraph("Max Capacity (Max):", cell_bold), Paragraph(f"{inst.get('max_capacity', 0)} {unit}", cell_mono)
            ],
            [
                Paragraph("Serial Number:", cell_bold), Paragraph(str(inst.get("serial_number", "N/A")), cell_mono),
                Paragraph("Min Capacity (Min):", cell_bold), Paragraph(f"{inst.get('min_capacity', 0)} {unit}", cell_mono)
            ],
            [
                Paragraph("Verification Interval (e):", cell_bold), Paragraph(f"{inst.get('verification_interval_e', 0)} {unit}", cell_mono),
                Paragraph("Scale Interval (d):", cell_bold), Paragraph(f"{inst.get('scale_interval_d', 0)} {unit}", cell_mono)
            ],
            [
                Paragraph("Receptor / Indicator:", cell_bold), Paragraph(f"{inst.get('load_receptor_type', 'Platform')} / {inst.get('indicator_make_model', 'Standard')}", cell_text),
                Paragraph("Total Intervals (n):", cell_bold), Paragraph(str(inst.get("calculated_n", int(round(float(inst.get('max_capacity', 0)) / float(inst.get('verification_interval_e', 1) or 1))))), cell_mono)
            ]
        ]
        passport_table = Table(passport_data, colWidths=[120, 140, 120, 140])
        passport_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(passport_table)
        elements.append(Spacer(1, 6))

        # ---------------------------------------------------------
        # Section 2: Reference Standard & Environmental Conditions
        # ---------------------------------------------------------
        elements.append(Paragraph("2. REFERENCE STANDARDS & ENVIRONMENTAL CONDITIONS (ISO/IEC 17025)", section_heading))
        env_data = [
            [
                Paragraph("Standard Weight Set:", cell_bold), Paragraph(f"{std.get('set_identifier', 'STD-01')} (Class {std.get('accuracy_class', 'E2')})", cell_text),
                Paragraph("Ambient Temperature:", cell_bold), Paragraph(f"{env.get('ambient_temperature_celsius', 22.5)} °C", cell_mono)
            ],
            [
                Paragraph("Calibration Certificate:", cell_bold), Paragraph(str(std.get("certificate_number", "CAL-2026-001")), cell_mono),
                Paragraph("Relative Humidity:", cell_bold), Paragraph(f"{env.get('relative_humidity_pct', 55.0)} % RH", cell_mono)
            ],
            [
                Paragraph("Calibrating Body:", cell_bold), Paragraph(str(std.get("calibrated_by", "National Metrology Lab")), cell_text),
                Paragraph("Atmospheric Pressure:", cell_bold), Paragraph(f"{env.get('atmospheric_pressure_hpa', 1013.25)} hPa", cell_mono)
            ],
            [
                Paragraph("Standard Validity:", cell_bold), Paragraph(f"{std.get('calibration_date', '')} to {std.get('expiry_date', '')}", cell_mono),
                Paragraph("Expanded Uncertainty:", cell_bold), Paragraph(f"k=2, U = {std.get('expanded_uncertainty_k2', 0.0001)} {unit}", cell_mono)
            ]
        ]
        env_table = Table(env_data, colWidths=[120, 140, 120, 140])
        env_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(env_table)
        elements.append(Spacer(1, 6))

        # ---------------------------------------------------------
        # Section 3: Weighing Performance Observations (Clause A.4.4)
        # ---------------------------------------------------------
        elements.append(Paragraph("3. CLAUSE A.4.4: WEIGHING PERFORMANCE TEST OBSERVATIONS", section_heading))
        
        obs_header = [
            Paragraph("Load (L)", cell_bold),
            Paragraph("Indication (I)", cell_bold),
            Paragraph("ΔL", cell_bold),
            Paragraph("Calc (P)", cell_bold),
            Paragraph("True Err (E)", cell_bold),
            Paragraph("Corr Err (Ec)", cell_bold),
            Paragraph("MPE (±)", cell_bold),
            Paragraph("Verdict", cell_bold),
        ]
        obs_rows = [obs_header]

        for o in weighing_obs:
            if hasattr(o, "model_dump"):
                o = o.model_dump()
            is_pass = o.get("is_compliant", True)
            v_style = pass_badge if is_pass else fail_badge
            v_text = "PASS" if is_pass else "FAIL"
            obs_rows.append([
                Paragraph(f"{float(o.get('load_applied', 0)):.4f}", cell_mono),
                Paragraph(f"{float(o.get('indication_observed', 0)):.4f}", cell_mono),
                Paragraph(f"{float(o.get('delta_load', 0)):.4f}", cell_mono),
                Paragraph(f"{float(o.get('calculated_p', 0)):.4f}", cell_mono),
                Paragraph(f"{float(o.get('true_error_e', 0)):.4f}", cell_mono),
                Paragraph(f"{float(o.get('corrected_error_ec', 0)):.4f}", cell_mono),
                Paragraph(f"±{float(o.get('mpe_allowed', 0)):.4f}", cell_mono),
                Paragraph(v_text, v_style),
            ])

        obs_table = Table(obs_rows, colWidths=[65, 65, 55, 65, 65, 65, 65, 75])
        obs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        # Fix text color for header row
        for j in range(len(obs_header)):
            obs_table.setStyle(TableStyle([('TEXTCOLOR', (j, 0), (j, 0), colors.white)]))
        elements.append(obs_table)
        elements.append(Spacer(1, 6))

        # ---------------------------------------------------------
        # Section 4: Chart (if provided)
        # ---------------------------------------------------------
        if chart_png_bytes:
            try:
                img_io = io.BytesIO(chart_png_bytes)
                chart_img = Image(img_io, width=480, height=140)
                elements.append(Paragraph("4. CLAUSE A.4.4 ERROR OF INDICATION CURVE vs STATUTORY MPE ENVELOPE", section_heading))
                elements.append(chart_img)
                elements.append(Spacer(1, 6))
            except Exception as e:
                print(f"[ReportLab] Warning embedding chart: {e}")

        # ---------------------------------------------------------
        # Section 5: Statutory Verdict & Approval Seal
        # ---------------------------------------------------------
        elements.append(Spacer(1, 4))
        verdict_text = "APPROVED / STATUTORILY COMPLIANT" if overall_verdict else "REJECTED / NON-COMPLIANT"
        verdict_color = "#16a34a" if overall_verdict else "#dc2626"
        verdict_badge_style = ParagraphStyle(
            'VerdictBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor(verdict_color)
        )

        sha_hash = report_context.get("sha256_hash", "PENDING_CRYPTOGRAPHIC_SEAL")
        approver = report_context.get("approved_by", "Director of Legal Metrology")
        conducted = report_context.get("conducted_by", "Testing Metrologist")

        qr_img = None
        if qr_png_base64:
            try:
                raw_b64 = qr_png_base64
                if raw_b64.startswith("data:image"):
                    raw_b64 = raw_b64.split(",", 1)[1]
                qr_bytes = base64.b64decode(raw_b64)
                qr_io = io.BytesIO(qr_bytes)
                qr_img = Image(qr_io, width=65, height=65)
            except Exception as e:
                print(f"[ReportLab] QR decode note: {e}")

        seal_data = [
            [
                qr_img if qr_img else Paragraph("<b>QR SEAL</b>", cell_bold),
                [
                    Paragraph(f"<b>FINAL METROLOGICAL VERDICT:</b> {verdict_text}", verdict_badge_style),
                    Spacer(1, 2),
                    Paragraph(f"<b>Conducted By:</b> {conducted} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Approved By:</b> {approver}", cell_text),
                    Paragraph(f"<b>Approval Timestamp:</b> {approved_date}", cell_text),
                    Spacer(1, 2),
                    Paragraph(f"<b>SHA-256 Document Integrity Digest:</b>", cell_bold),
                    Paragraph(f"<font face='Courier' size='6.5'>{sha_hash}</font>", cell_mono),
                ]
            ]
        ]
        seal_table = Table(seal_data, colWidths=[80, 440])
        seal_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0f172a')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(KeepTogether([seal_table]))

        doc.build(elements)
        return buffer.getvalue()
