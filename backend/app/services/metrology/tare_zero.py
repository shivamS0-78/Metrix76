from typing import List
from app.schemas.metrology import (
    InstrumentMeta,
    ZeroSettingInput,
    TareBalancingInput,
    TareZeroEvaluationResponse,
    WeighingEvaluationResult,
    ComplianceVerdict,
    TestDirection
)
from .engine import OIMLR76Engine

class TareZeroEvaluator:
    """
    Evaluates Clauses A.4.2 & A.4.6 conforming to OIML R 76-1:2006:
    - Zero-setting and zero-tracking accuracy: |E0| <= 0.25e
    - Tare balancing device linearity & error correction
    """

    @staticmethod
    def evaluate_zero_setting(spec: InstrumentMeta, zero_input: ZeroSettingInput) -> dict:
        e = spec.verification_interval_e
        p0 = zero_input.indication_observed + (0.5 * e) - zero_input.delta_load
        e0 = p0 - 0.0  # Zero applied load
        max_allowed_zero_error = 0.25 * e

        is_compliant = abs(e0) <= (max_allowed_zero_error + 1e-9)
        return {
            "zero_error_e0": round(e0, 5),
            "max_allowed_zero_error": round(max_allowed_zero_error, 5),
            "is_compliant": is_compliant
        }

    @classmethod
    def evaluate_tare_balancing(
        cls,
        spec: InstrumentMeta,
        tare_inputs: List[TareBalancingInput]
    ) -> List[WeighingEvaluationResult]:
        e = spec.verification_interval_e
        results = []

        for item in tare_inputs:
            p = item.indication_observed + (0.5 * e) - item.delta_load
            err_e = p - item.net_load_applied
            mpe = OIMLR76Engine.get_mpe(item.net_load_applied, spec)

            abs_err = abs(err_e)
            is_pass = abs_err <= (mpe + 1e-9)
            status = ComplianceVerdict.PASS if abs_err <= (mpe * 0.9) else (ComplianceVerdict.WARN if is_pass else ComplianceVerdict.FAIL)

            results.append(
                WeighingEvaluationResult(
                    load_applied=round(item.net_load_applied, 5),
                    indication_observed=round(item.indication_observed, 5),
                    delta_load=round(item.delta_load, 5),
                    calculated_p=round(p, 5),
                    true_error_e=round(err_e, 5),
                    corrected_error_ec=round(err_e, 5),
                    mpe_allowed=round(mpe, 5),
                    status=status,
                    is_compliant=is_pass,
                    direction=TestDirection.STATIC
                )
            )
        return results

    @classmethod
    def evaluate_full_tare_zero(
        cls,
        spec: InstrumentMeta,
        zero_input: ZeroSettingInput,
        tare_inputs: List[TareBalancingInput]
    ) -> TareZeroEvaluationResponse:
        zero_res = cls.evaluate_zero_setting(spec, zero_input)
        tare_res = cls.evaluate_tare_balancing(spec, tare_inputs)
        overall_compliant = zero_res["is_compliant"] and all(r.is_compliant for r in tare_res)

        return TareZeroEvaluationResponse(
            zero_setting_error=zero_res["zero_error_e0"],
            zero_setting_mpe=zero_res["max_allowed_zero_error"],
            zero_setting_compliant=zero_res["is_compliant"],
            tare_results=tare_res,
            overall_compliant=overall_compliant
        )
