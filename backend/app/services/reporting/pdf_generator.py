import io
import os
import base64
from typing import Dict, Any, Optional
from jinja2 import Environment, FileSystemLoader

try:
    from weasyprint import HTML, CSS
except (ImportError, OSError):  # pragma: no cover - optional on systems lacking GTK/Pango libraries
    HTML = None
    CSS = None

from app.services.reporting.chart_engine import OIMLErrorChartEngine


class OIMLPDFGenerator:
    """
    Statutory PDF Document Generation Pipeline conforming to OIML R 76-2:2007 (Annex A).
    Compiles Jinja2 HTML/CSS templates and embeds headless Matplotlib charts & QR seals.
    """

    def __init__(self, template_dir: Optional[str] = None):
        if template_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            template_dir = os.path.join(base_dir, "templates", "reports")
        self.template_dir = template_dir
        self.env = Environment(loader=FileSystemLoader(template_dir), autoescape=True)

    def render_pdf(
        self,
        report_context: Dict[str, Any],
        chart_png_bytes: Optional[bytes] = None,
        qr_png_base64: Optional[str] = None
    ) -> bytes:
        """
        Renders an OIML R 76-2 Annex A PDF report as an in-memory byte buffer.
        """
        context = dict(report_context)

        # 1. Inject Matplotlib error curve as inline base64 if provided
        if chart_png_bytes:
            b64_chart = base64.b64encode(chart_png_bytes).decode('utf-8')
            context['chart_base64'] = f"data:image/png;base64,{b64_chart}"
        elif 'chart_base64' not in context and 'instrument' in context and 'weighing_observations' in context:
            # Auto-generate chart from context if objects are available
            try:
                auto_chart = OIMLErrorChartEngine.generate_error_curve_image(
                    spec=context['instrument'],
                    results=context['weighing_observations']
                )
                b64_chart = base64.b64encode(auto_chart).decode('utf-8')
                context['chart_base64'] = f"data:image/png;base64,{b64_chart}"
            except Exception as e:
                context['chart_base64'] = None

        # 2. Inject QR code image as inline base64 if provided
        if qr_png_base64:
            if qr_png_base64.startswith("data:image"):
                context['qr_code_base64'] = qr_png_base64
            else:
                context['qr_code_base64'] = f"data:image/png;base64,{qr_png_base64}"

        # 3. Compile with WeasyPrint if available, otherwise fallback to ReportLab
        if HTML is not None:
            try:
                template = self.env.get_template("oiml_r76_annex_a.html")
                html_content = template.render(**context)
                css_path = os.path.join(self.template_dir, "report_styles.css")
                stylesheets = [CSS(filename=css_path)] if os.path.exists(css_path) else []

                pdf_buffer = io.BytesIO()
                HTML(string=html_content, base_url=self.template_dir).write_pdf(
                    target=pdf_buffer,
                    stylesheets=stylesheets
                )
                pdf_buffer.seek(0)
                return pdf_buffer.getvalue()
            except Exception as e:
                print(f"[WeasyPrint] Compilation warning ({e}), falling back to ReportLab...")

        # Fallback to pure-Python ReportLab generator
        from app.services.reporting.reportlab_generator import ReportLabOIMLGenerator
        return ReportLabOIMLGenerator.render_pdf(
            report_context=context,
            chart_png_bytes=chart_png_bytes,
            qr_png_base64=qr_png_base64
        )


