import numpy as np
from typing import List
from app.schemas.metrology import (
    InstrumentMeta,
    RepeatabilitySeriesInput,
    RepeatabilitySeriesResult,
    RepeatabilityBatchResponse,
    WeighingPointInput
)
from .engine import OIMLR76Engine

class RepeatabilityEvaluator:
    """
    Evaluates Clause A.4.10 Repeatability Test conforming to OIML R 76-1:2006.
    Evaluates 3 series of 10 measurements at 0.5 Max and 1.0 Max.
    Calculates ΔI = Pmax - Pmin <= |mpe(L)|, sample variance (s^2), and standard deviation (s).
    """

    @staticmethod
    def calculate_precise_indication(obs: WeighingPointInput, e: float) -> float:
        """P = I + 0.5e - ΔL"""
        return obs.indication_observed + (0.5 * e) - obs.delta_load

    @classmethod
    def evaluate_series(
        cls,
        spec: InstrumentMeta,
        series: RepeatabilitySeriesInput
    ) -> RepeatabilitySeriesResult:
        e = spec.verification_interval_e
        p_values = [cls.calculate_precise_indication(obs, e) for obs in series.observations]

        if not p_values:
            raise ValueError(f"No observations provided for series at load {series.nominal_load}")

        p_max = float(np.max(p_values))
        p_min = float(np.min(p_values))
        delta_i = p_max - p_min
        mpe = OIMLR76Engine.get_mpe(series.nominal_load, spec)
        
        # Experimental sample standard deviation s (ddof=1 for unbiased sample variance)
        n = len(p_values)
        std_dev = float(np.std(p_values, ddof=1)) if n > 1 else 0.0

        is_compliant = delta_i <= (mpe + 1e-9)

        return RepeatabilitySeriesResult(
            nominal_load=round(series.nominal_load, 5),
            p_max=round(p_max, 5),
            p_min=round(p_min, 5),
            delta_i=round(delta_i, 5),
            mpe_allowed=round(mpe, 5),
            standard_deviation_s=round(std_dev, 6),
            is_compliant=is_compliant
        )

    @classmethod
    def evaluate_batch(
        cls,
        spec: InstrumentMeta,
        series_list: List[RepeatabilitySeriesInput]
    ) -> RepeatabilityBatchResponse:
        results = [cls.evaluate_series(spec, s) for s in series_list]
        overall_compliant = all(r.is_compliant for r in results) if results else True
        return RepeatabilityBatchResponse(
            series_results=results,
            overall_compliant=overall_compliant
        )
