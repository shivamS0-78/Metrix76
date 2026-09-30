import io
import matplotlib
matplotlib.use('Agg')  # Headless backend for web servers and background workers
import matplotlib.pyplot as plt
import numpy as np
from typing import List, Optional, Union
from app.schemas.metrology import InstrumentMeta, WeighingEvaluationResult, AccuracyClass, TestDirection
from app.services.metrology.engine import OIMLR76Engine

class OIMLErrorChartEngine:
    """
    Headless Matplotlib Error Vector Curve Generator conforming to OIML R 76-2:2007 Annex A.
    Renders publication-ready, static vector error-of-indication plots with step-like ±mpe corridors.
    Outputs in-memory PNG bytes and SVG strings (zero temporary disk writes).
    """

    @classmethod
    def _compute_mpe_step_corridor(
        cls,
        spec: InstrumentMeta,
        max_load: float,
        num_points: int = 600
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Computes the statutory step-like ±mpe corridor across the applied load range.
        """
        e = spec.verification_interval_e
        x_steps = np.linspace(0, max_load, num_points)
        upper_mpe = np.array([OIMLR76Engine.get_mpe(load, spec) for load in x_steps])
        lower_mpe = -upper_mpe
        return x_steps, upper_mpe, lower_mpe

    @classmethod
    def generate_error_curve_image(
        cls,
        spec: InstrumentMeta,
        results: List[WeighingEvaluationResult],
        dpi: int = 300,
        figsize: tuple[float, float] = (8.5, 4.5)
    ) -> bytes:
        """
        Generates an OIML R 76 Error of Indication Curve with statutory step ±mpe corridor as PNG bytes.
        """
        fig, ax = plt.subplots(figsize=figsize, dpi=dpi)

        max_load = spec.max_capacity if spec.max_capacity > 0 else 15.0
        if results:
            observed_max = max(r.load_applied for r in results)
            if observed_max > max_load:
                max_load = observed_max

        # 1. Compute and plot statutory tolerance corridor
        x_steps, upper_mpe, lower_mpe = cls._compute_mpe_step_corridor(spec, max_load)

        ax.step(x_steps, upper_mpe, where='post', color='#dc2626', linestyle='--', linewidth=1.3, label='+mpe Statutory Limit')
        ax.step(x_steps, lower_mpe, where='post', color='#dc2626', linestyle='--', linewidth=1.3, label='-mpe Statutory Limit')
        ax.axhline(0, color='#64748b', linestyle='-', linewidth=0.9, alpha=0.8)

        # 2. Segregate observation points into Increasing and Decreasing cycles
        increasing_pts = [r for r in results if r.direction == TestDirection.INCREASING]
        decreasing_pts = [r for r in results if r.direction == TestDirection.DECREASING]
        static_pts = [r for r in results if r.direction == TestDirection.STATIC]

        if increasing_pts:
            inc_loads = [r.load_applied for r in increasing_pts]
            inc_ec = [r.corrected_error_ec for r in increasing_pts]
            ax.plot(inc_loads, inc_ec, color='#2563eb', marker='o', markersize=4.5, linewidth=1.6, label='Increasing Load (Ec)')

        if decreasing_pts:
            dec_loads = [r.load_applied for r in decreasing_pts]
            dec_ec = [r.corrected_error_ec for r in decreasing_pts]
            ax.plot(dec_loads, dec_ec, color='#7c3aed', marker='s', markersize=4.5, linestyle='--', linewidth=1.6, label='Decreasing Load (Ec)')

        if static_pts:
            st_loads = [r.load_applied for r in static_pts]
            st_ec = [r.corrected_error_ec for r in static_pts]
            ax.plot(st_loads, st_ec, color='#059669', marker='^', markersize=4.5, linestyle=':', linewidth=1.4, label='Static/Tare Load (Ec)')

        # If results list was passed without direction separation
        if not increasing_pts and not decreasing_pts and not static_pts and results:
            all_loads = [r.load_applied for r in results]
            all_ec = [r.corrected_error_ec for r in results]
            ax.plot(all_loads, all_ec, color='#2563eb', marker='o', markersize=4.5, linewidth=1.6, label='Observed Error (Ec)')

        # 3. Styling & Annotations
        class_label = spec.accuracy_class.value if hasattr(spec.accuracy_class, 'value') else str(spec.accuracy_class)
        ax.set_title(
            f"OIML R 76 Error of Indication Curve vs. Statutory ±mpe (Class {class_label})\n"
            f"Max = {spec.max_capacity} {spec.unit}, e = {spec.verification_interval_e} {spec.unit}, d = {spec.scale_interval_d} {spec.unit}",
            fontsize=10,
            fontweight='bold',
            pad=12
        )
        ax.set_xlabel(f"Applied Standard Load L [{spec.unit}]", fontsize=8.5, fontweight='semibold')
        ax.set_ylabel(f"Corrected Indication Error Ec [{spec.unit}]", fontsize=8.5, fontweight='semibold')
        ax.grid(True, linestyle=':', alpha=0.6, color='#94a3b8')
        ax.legend(loc='upper right', fontsize=7.5, framealpha=0.95, edgecolor='#cbd5e1')

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=dpi, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    @classmethod
    def generate_error_curve_svg(
        cls,
        spec: InstrumentMeta,
        results: List[WeighingEvaluationResult],
        figsize: tuple[float, float] = (8.5, 4.5)
    ) -> str:
        """
        Generates an OIML R 76 Error of Indication Curve as an in-memory SVG string.
        """
        fig, ax = plt.subplots(figsize=figsize, dpi=150)

        max_load = spec.max_capacity if spec.max_capacity > 0 else 15.0
        if results:
            observed_max = max(r.load_applied for r in results)
            if observed_max > max_load:
                max_load = observed_max

        x_steps, upper_mpe, lower_mpe = cls._compute_mpe_step_corridor(spec, max_load)

        ax.step(x_steps, upper_mpe, where='post', color='#dc2626', linestyle='--', linewidth=1.3, label='+mpe Limit')
        ax.step(x_steps, lower_mpe, where='post', color='#dc2626', linestyle='--', linewidth=1.3, label='-mpe Limit')
        ax.axhline(0, color='#64748b', linestyle='-', linewidth=0.9, alpha=0.8)

        increasing_pts = [r for r in results if r.direction == TestDirection.INCREASING]
        decreasing_pts = [r for r in results if r.direction == TestDirection.DECREASING]

        if increasing_pts:
            ax.plot([r.load_applied for r in increasing_pts], [r.corrected_error_ec for r in increasing_pts],
                    color='#2563eb', marker='o', markersize=4.5, linewidth=1.6, label='Increasing Load (Ec)')
        if decreasing_pts:
            ax.plot([r.load_applied for r in decreasing_pts], [r.corrected_error_ec for r in decreasing_pts],
                    color='#7c3aed', marker='s', markersize=4.5, linestyle='--', linewidth=1.6, label='Decreasing Load (Ec)')

        class_label = spec.accuracy_class.value if hasattr(spec.accuracy_class, 'value') else str(spec.accuracy_class)
        ax.set_title(f"OIML R 76 Error of Indication Curve (Class {class_label})", fontsize=10, fontweight='bold', pad=10)
        ax.set_xlabel(f"Applied Load L [{spec.unit}]", fontsize=8.5)
        ax.set_ylabel(f"Corrected Error Ec [{spec.unit}]", fontsize=8.5)
        ax.grid(True, linestyle=':', alpha=0.6)
        ax.legend(loc='upper right', fontsize=7.5)

        plt.tight_layout()
        svg_buffer = io.StringIO()
        plt.savefig(svg_buffer, format='svg', bbox_inches='tight')
        plt.close(fig)
        return svg_buffer.getvalue()

    @classmethod
    def generate_error_curve_from_raw(
        cls,
        loads: List[float],
        ec_errors: List[float],
        e: float,
        accuracy_class: str = "CLASS_III",
        directions: Optional[List[str]] = None,
        unit: str = "kg",
        max_cap: Optional[float] = None,
        dpi: int = 300
    ) -> bytes:
        """
        Convenience wrapper generating PNG bytes from raw lists of loads and error points.
        """
        acc_enum = AccuracyClass[accuracy_class] if accuracy_class in AccuracyClass.__members__ else AccuracyClass.CLASS_III
        calculated_max = max_cap or (max(loads) if loads else 15.0)
        spec = InstrumentMeta(
            accuracy_class=acc_enum,
            max_capacity=calculated_max,
            min_capacity=e * 20,
            scale_interval_d=e,
            verification_interval_e=e,
            unit=unit
        )

        results = []
        for i, (l, ec) in enumerate(zip(loads, ec_errors)):
            dir_val = TestDirection.INCREASING
            if directions and i < len(directions):
                dir_str = directions[i].upper()
                if dir_str == "DECREASING":
                    dir_val = TestDirection.DECREASING
                elif dir_str == "STATIC":
                    dir_val = TestDirection.STATIC
            mpe = OIMLR76Engine.get_mpe(l, spec)
            results.append(
                WeighingEvaluationResult(
                    load_applied=l,
                    indication_observed=l + ec,
                    delta_load=0.0,
                    calculated_p=l + ec,
                    true_error_e=ec,
                    corrected_error_ec=ec,
                    mpe_allowed=mpe,
                    status="PASS" if abs(ec) <= mpe else "FAIL",
                    is_compliant=abs(ec) <= mpe,
                    direction=dir_val
                )
            )

        return cls.generate_error_curve_image(spec, results, dpi=dpi)

# Module-level alias matching starter signature
def generate_error_curve_image(
    loads: list[float], 
    ec_errors: list[float], 
    e: float, 
    accuracy_class: str
) -> bytes:
    """Starter signature compatibility function returning PNG bytes."""
    return OIMLErrorChartEngine.generate_error_curve_from_raw(
        loads=loads,
        ec_errors=ec_errors,
        e=e,
        accuracy_class=accuracy_class
    )
