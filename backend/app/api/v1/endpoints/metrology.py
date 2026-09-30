from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse
import io
from app.schemas.metrology import (
    WeighingBatchRequest,
    WeighingBatchResponse,
    RepeatabilityBatchRequest,
    RepeatabilityBatchResponse,
    EccentricityBatchRequest,
    EccentricityBatchResponse,
    TareZeroBatchRequest,
    TareZeroEvaluationResponse,
    UncertaintyCalculationRequest
)
from app.services.metrology import (
    OIMLR76Engine,
    RepeatabilityEvaluator,
    EccentricityEvaluator,
    TareZeroEvaluator,
    UncertaintyCalculator,
    UncertaintyBudget
)
from app.services.reporting import OIMLErrorChartEngine

router = APIRouter()

@router.post("/evaluate-weighing", response_model=WeighingBatchResponse)
def evaluate_weighing(payload: WeighingBatchRequest):
    """
    Clause A.4.4: Evaluates Weighing Performance with turning point discrete error correction.
    Computes P = I + 0.5e - ΔL, E = P - L, and Ec = E - E0 against statutory ±mpe.
    """
    return OIMLR76Engine.evaluate_weighing_batch(payload.instrument, payload.points)

@router.post("/evaluate-repeatability", response_model=RepeatabilityBatchResponse)
def evaluate_repeatability(payload: RepeatabilityBatchRequest):
    """
    Clause A.4.10: Evaluates Repeatability (3 series of 10 measurements at 0.5Max and 1.0Max).
    Computes spread ΔI = Pmax - Pmin, standard deviation s, and validates ΔI <= |mpe(L)|.
    """
    return RepeatabilityEvaluator.evaluate_batch(payload.instrument, payload.series)

@router.post("/evaluate-eccentricity", response_model=EccentricityBatchResponse)
def evaluate_eccentricity(payload: EccentricityBatchRequest):
    """
    Clause A.4.7: Evaluates Eccentricity (Corner Load) for 4-point platforms and circular pans.
    Calculates center reference error and validates quadrant deviations against ±mpe.
    """
    return EccentricityEvaluator.evaluate_batch(payload.instrument, payload.points, payload.geometry)

@router.post("/evaluate-tare-zero", response_model=TareZeroEvaluationResponse)
def evaluate_tare_zero(payload: TareZeroBatchRequest):
    """
    Clauses A.4.2 & A.4.6: Evaluates Zero-Setting Accuracy (|E0| <= 0.25e) and Tare Linearity.
    """
    return TareZeroEvaluator.evaluate_full_tare_zero(
        payload.instrument,
        payload.zero_setting,
        payload.tare_balancing
    )

@router.post("/calculate-uncertainty", response_model=UncertaintyBudget)
def calculate_uncertainty(payload: UncertaintyCalculationRequest):
    """
    ISO/IEC Guide 98-3 (GUM): Computes Combined Standard Uncertainty (uc) and Expanded Uncertainty (U, k=2).
    """
    return UncertaintyCalculator.calculate_expanded_uncertainty(
        scale_interval_d=payload.scale_interval_d,
        repeatability_std_dev=payload.repeatability_std_dev,
        n_repeat_observations=payload.n_repeat_observations,
        standard_expanded_uncertainty_k2=payload.standard_expanded_uncertainty_k2,
        coverage_factor_k=payload.coverage_factor_k
    )

@router.post("/render-chart-png")
def render_chart_png(payload: WeighingBatchRequest):
    """
    Renders high-resolution 300 DPI Matplotlib error-of-indication vector plot as PNG binary stream.
    """
    eval_res = OIMLR76Engine.evaluate_weighing_batch(payload.instrument, payload.points)
    png_bytes = OIMLErrorChartEngine.generate_error_curve_image(payload.instrument, eval_res.results)
    return StreamingResponse(
        io.BytesIO(png_bytes),
        media_type="image/png",
        headers={"Content-Disposition": 'inline; filename="error_curve.png"'}
    )

@router.post("/render-chart-svg")
def render_chart_svg(payload: WeighingBatchRequest):
    """
    Renders scalable vector graphic (SVG) error-of-indication plot.
    """
    eval_res = OIMLR76Engine.evaluate_weighing_batch(payload.instrument, payload.points)
    svg_content = OIMLErrorChartEngine.generate_error_curve_svg(payload.instrument, eval_res.results)
    return Response(content=svg_content, media_type="image/svg+xml")
