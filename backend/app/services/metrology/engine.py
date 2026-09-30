import numpy as np
from app.schemas.metrology import (
    AccuracyClass,
    InstrumentMeta,
    WeighingPointInput,
    WeighingEvaluationResult,
    WeighingBatchResponse,
    ComplianceVerdict,
    RepeatabilitySeriesInput,
    RepeatabilitySeriesResult,
    RepeatabilityBatchResponse,
    EccentricityPointInput,
    EccentricityEvaluationResult,
    EccentricityBatchResponse,
    ZeroSettingInput,
    TareBalancingInput,
    TareZeroEvaluationResponse
)

class OIMLR76Engine:
    @staticmethod
    def get_mpe(load: float, spec: InstrumentMeta) -> float:
        """
        Determines the Maximum Permissible Error (mpe) based on OIML R 76-1 Table 6.
        """
        e = spec.verification_interval_e
        if e <= 0:
            raise ValueError("Verification scale interval 'e' must be > 0")
        
        m = abs(load) / e

        if spec.accuracy_class == AccuracyClass.CLASS_I:
            if m <= 50000: return round(0.5 * e, 10)
            if m <= 200000: return round(1.0 * e, 10)
            return round(1.5 * e, 10)

        elif spec.accuracy_class == AccuracyClass.CLASS_II:
            if m <= 5000: return round(0.5 * e, 10)
            if m <= 20000: return round(1.0 * e, 10)
            return round(1.5 * e, 10)

        elif spec.accuracy_class == AccuracyClass.CLASS_III:
            if m <= 500: return round(0.5 * e, 10)
            if m <= 2000: return round(1.0 * e, 10)
            return round(1.5 * e, 10)

        elif spec.accuracy_class == AccuracyClass.CLASS_IIII:
            if m <= 50: return round(0.5 * e, 10)
            if m <= 200: return round(1.0 * e, 10)
            return round(1.5 * e, 10)

        raise ValueError(f"Unsupported accuracy class: {spec.accuracy_class}")

    @classmethod
    def evaluate_weighing_batch(
        cls, 
        spec: InstrumentMeta, 
        points: list[WeighingPointInput]
    ) -> WeighingBatchResponse:
        """
        Evaluates Clause A.4.4 Weighing Performance with turning point correction.
        """
        if not points:
            return WeighingBatchResponse(zero_error_e0=0.0, results=[], overall_compliant=True)

        e = spec.verification_interval_e
        zero_point = next((p for p in points if abs(p.load_applied) < 1e-7), points[0])
        p0 = zero_point.indication_observed + (0.5 * e) - zero_point.delta_load
        e0 = p0 - zero_point.load_applied

        results = []
        overall_compliant = True

        for pt in points:
            p = pt.indication_observed + (0.5 * e) - pt.delta_load
            err_e = p - pt.load_applied
            err_ec = err_e - e0
            mpe = cls.get_mpe(pt.load_applied, spec)

            abs_ec = abs(err_ec)
            abs_mpe = abs(mpe)

            if abs_ec <= (abs_mpe * 0.9 + 1e-9):
                status = ComplianceVerdict.PASS
                is_pass = True
            elif abs_ec <= (abs_mpe + 1e-9):
                status = ComplianceVerdict.WARN
                is_pass = True
            else:
                status = ComplianceVerdict.FAIL
                is_pass = False
                overall_compliant = False

            results.append(
                WeighingEvaluationResult(
                    load_applied=round(pt.load_applied, 5),
                    indication_observed=round(pt.indication_observed, 5),
                    delta_load=round(pt.delta_load, 5),
                    calculated_p=round(p, 5),
                    true_error_e=round(err_e, 5),
                    corrected_error_ec=round(err_ec, 5),
                    mpe_allowed=round(mpe, 5),
                    status=status,
                    is_compliant=is_pass,
                    direction=pt.direction
                )
            )

        return WeighingBatchResponse(
            zero_error_e0=round(e0, 5),
            results=results,
            overall_compliant=overall_compliant
        )

    @classmethod
    def evaluate_repeatability_batch(
        cls,
        spec: InstrumentMeta,
        series_list: list[RepeatabilitySeriesInput]
    ) -> RepeatabilityBatchResponse:
        """
        Evaluates Clause A.4.10 Repeatability Test (3 series of 10 observations).
        """
        e = spec.verification_interval_e
        overall_compliant = True
        series_results = []

        for s in series_list:
            p_values = []
            for obs in s.observations:
                p = obs.indication_observed + (0.5 * e) - obs.delta_load
                p_values.append(p)

            if not p_values:
                continue

            p_max = float(np.max(p_values))
            p_min = float(np.min(p_values))
            delta_i = p_max - p_min
            mpe = cls.get_mpe(s.nominal_load, spec)
            s_dev = float(np.std(p_values, ddof=1)) if len(p_values) > 1 else 0.0

            is_compliant = delta_i <= (mpe + 1e-9)
            if not is_compliant:
                overall_compliant = False

            series_results.append(
                RepeatabilitySeriesResult(
                    nominal_load=round(s.nominal_load, 5),
                    p_max=round(p_max, 5),
                    p_min=round(p_min, 5),
                    delta_i=round(delta_i, 5),
                    mpe_allowed=round(mpe, 5),
                    standard_deviation_s=round(s_dev, 6),
                    is_compliant=is_compliant
                )
            )

        return RepeatabilityBatchResponse(
            series_results=series_results,
            overall_compliant=overall_compliant
        )

    @classmethod
    def evaluate_eccentricity_batch(
        cls,
        spec: InstrumentMeta,
        points: list[EccentricityPointInput]
    ) -> EccentricityBatchResponse:
        """
        Evaluates Clause A.4.7 Eccentricity Test (Corner Load).
        Recommended load is 1/3 Max (or 1/4 Max depending on support).
        """
        e = spec.verification_interval_e
        rec_load = spec.max_capacity / 3.0

        # Center reading is used for zero/reference baseline
        center_pt = next((p for p in points if p.position_tag.upper() == 'CENTER'), points[0] if points else None)
        e0 = 0.0
        if center_pt:
            p0 = center_pt.indication_observed + (0.5 * e) - center_pt.delta_load
            e0 = p0 - center_pt.load_applied

        results = []
        overall_compliant = True

        for pt in points:
            p = pt.indication_observed + (0.5 * e) - pt.delta_load
            err_e = p - pt.load_applied
            err_ec = err_e - e0
            mpe = cls.get_mpe(pt.load_applied, spec)
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
            recommended_load=round(rec_load, 5),
            zero_error_e0=round(e0, 5),
            results=results,
            overall_compliant=overall_compliant
        )
