import math
from typing import Optional
from pydantic import BaseModel, Field

class UncertaintyBudget(BaseModel):
    u_cal: float = Field(..., description="Standard uncertainty of reference weights [kg]")
    u_res: float = Field(..., description="Standard uncertainty due to finite scale resolution d [kg]")
    u_rep: float = Field(..., description="Standard uncertainty due to repeatability [kg]")
    combined_uncertainty_uc: float = Field(..., description="Combined standard uncertainty u_c [kg]")
    coverage_factor_k: float = Field(2.0, description="Coverage factor k (typically k=2 for ~95% confidence)")
    expanded_uncertainty_U: float = Field(..., description="Expanded measurement uncertainty U = k * u_c [kg]")

class UncertaintyCalculator:
    """
    ISO/IEC Guide 98-3 (GUM) Metrological Measurement Uncertainty Engine.
    Combines:
    1. Reference Standard Uncertainty (u_cal = U_cal / k_cal)
    2. Resolution / Rounding Uncertainty (u_res = d / (2 * sqrt(3)))
    3. Repeatability Variance Uncertainty (u_rep = s / sqrt(n))
    """

    @staticmethod
    def calculate_expanded_uncertainty(
        scale_interval_d: float,
        repeatability_std_dev: float,
        n_repeat_observations: int = 10,
        standard_expanded_uncertainty_k2: Optional[float] = None,
        coverage_factor_k: float = 2.0
    ) -> UncertaintyBudget:
        # 1. Reference weights standard uncertainty (assumed rectangular or normal k=2)
        if standard_expanded_uncertainty_k2 and standard_expanded_uncertainty_k2 > 0:
            u_cal = standard_expanded_uncertainty_k2 / 2.0
        else:
            # Default conservative assumption: 1/3 of scale interval d if certificate unspecified
            u_cal = (scale_interval_d / 3.0) / 2.0

        # 2. Digital display resolution uncertainty (rectangular distribution: d / 2sqrt(3))
        u_res = scale_interval_d / (2.0 * math.sqrt(3.0))

        # 3. Repeatability component (Type A evaluation)
        if n_repeat_observations > 1 and repeatability_std_dev > 0:
            u_rep = repeatability_std_dev / math.sqrt(n_repeat_observations)
        else:
            u_rep = 0.0

        # Combined standard uncertainty u_c
        u_c = math.sqrt(u_cal**2 + u_res**2 + u_rep**2)

        # Expanded uncertainty U (k=2)
        U = coverage_factor_k * u_c

        return UncertaintyBudget(
            u_cal=round(u_cal, 7),
            u_res=round(u_res, 7),
            u_rep=round(u_rep, 7),
            combined_uncertainty_uc=round(u_c, 7),
            coverage_factor_k=coverage_factor_k,
            expanded_uncertainty_U=round(U, 7)
        )
