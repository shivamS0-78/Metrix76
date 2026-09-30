from typing import List
from app.schemas.metrology import (
    InstrumentMeta,
    EccentricityGeometry,
    EccentricityPointInput,
    EccentricityEvaluationResult,
    EccentricityBatchResponse
)
from .engine import OIMLR76Engine

class EccentricityEvaluator:
    """
    Evaluates Clause A.4.7 Eccentricity / Corner Load Test conforming to OIML R 76-1:2006.
    Supports 4-point platform scale geometry (L = 1/3 Max) and circular pan balances (L = 1/3 or 1/4 Max).
    Calculates Ec = E - E0 at each position against statutory mpe.
    """

    @staticmethod
    def get_recommended_test_load(spec: InstrumentMeta, geometry: EccentricityGeometry) -> float:
        if geometry == EccentricityGeometry.FOUR_CORNERS or geometry == EccentricityGeometry.FOUR_QUADRANTS:
            return round(spec.max_capacity / 3.0, 5)
        elif geometry == EccentricityGeometry.AXLE_POINTS:
            return round(spec.max_capacity / 4.0, 5)
        return round(spec.max_capacity / 3.0, 5)

    @classmethod
    def evaluate_batch(
        cls,
        spec: InstrumentMeta,
        points: List[EccentricityPointInput],
        geometry: EccentricityGeometry = EccentricityGeometry.FOUR_CORNERS
    ) -> EccentricityBatchResponse:
        e = spec.verification_interval_e
        rec_load = cls.get_recommended_test_load(spec, geometry)

        if not points:
            return EccentricityBatchResponse(
                recommended_load=rec_load,
                zero_error_e0=0.0,
                results=[],
                overall_compliant=True
            )

        # Baseline error E0 from CENTER position
        center_pt = next((p for p in points if p.position_tag.upper() == 'CENTER'), points[0])
        p0 = center_pt.indication_observed + (0.5 * e) - center_pt.delta_load
        e0 = p0 - center_pt.load_applied

        results = []
        overall_compliant = True

        for pt in points:
            p = pt.indication_observed + (0.5 * e) - pt.delta_load
            err_e = p - pt.load_applied
            err_ec = err_e - e0
            mpe = OIMLR76Engine.get_mpe(pt.load_applied, spec)

            is_pass = abs(err_ec) <= (mpe + 1e-9)
            if not is_pass:
                overall_compliant = False

            results.append(
                EccentricityEvaluationResult(
                    position_tag=pt.position_tag,
                    load_applied=round(pt.load_applied, 5),
                    indication_observed=round(pt.indication_observed, 5),
                    calculated_p=round(p, 5),
                    corrected_error_ec=round(err_ec, 5),
                    mpe_allowed=round(mpe, 5),
                    is_compliant=is_pass
                )
            )

        return EccentricityBatchResponse(
            recommended_load=rec_load,
            zero_error_e0=round(e0, 5),
            results=results,
            overall_compliant=overall_compliant
        )
