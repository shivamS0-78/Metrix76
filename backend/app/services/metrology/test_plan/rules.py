"""
Rule Layer & Applicability Engine for OIML Test Procedures.
Determines test applicability, prerequisites, and standards readiness without UI intervention.
"""
from typing import Dict, Any, List, Optional
from app.schemas.metrology import InstrumentMeta
from .models import (
    TestDefinition,
    TestPlanItem,
    TestExecutionStatus,
    TestComplianceStatus,
)
from .definitions import (
    SUPPORTED_TEST_DEFINITIONS,
    build_weighing_procedure,
    build_repeatability_procedure,
    build_eccentricity_procedure,
    build_tare_zero_procedure,
)
from .validators import validate_reference_standard_status


class TestPlanRuleEngine:
    """
    Evaluates statutory OIML applicability rules and produces initialized TestPlanItem entities.
    """

    @classmethod
    def evaluate_test_applicability(
        cls,
        test_type: str,
        spec: InstrumentMeta,
        rule_set_version: str = "2006",
        rule_context: Optional[Dict[str, Any]] = None
    ) -> tuple[bool, bool, Optional[str]]:
        """
        Determines if a test procedure is (applicable, configured, unconfigured_reason).
        """
        rule_context = rule_context or {}
        disabled_tests = rule_context.get("disabled_tests", [])
        unconfigured_tests = rule_context.get("unconfigured_tests", [])

        if test_type in unconfigured_tests:
            return True, False, "This procedure is not configured for the current rule set."

        if test_type in disabled_tests:
            return False, True, "Procedure disabled by testing authority override."

        test_def = SUPPORTED_TEST_DEFINITIONS.get(test_type)
        if not test_def:
            return False, False, f"Unknown procedure '{test_type}'."

        if not test_def.enabled or test_def.configuration_status == "NOT_CONFIGURED":
            return True, False, "This procedure is not configured for the current rule set."

        # All 4 core OIML R 76-1 procedures apply to non-automatic weighing instruments
        return True, True, None

    @classmethod
    def create_plan_item(
        cls,
        test_plan_id: str,
        test_type: str,
        spec: InstrumentMeta,
        standard_dict: Optional[Dict[str, Any]],
        rule_set_version: str = "2006",
        rule_context: Optional[Dict[str, Any]] = None
    ) -> TestPlanItem:
        """
        Constructs a fully configured TestPlanItem with observation schema,
        procedural parameters, prerequisites, and standard validation status.
        """
        import uuid
        test_def = SUPPORTED_TEST_DEFINITIONS[test_type]
        applicable, configured, config_issue = cls.evaluate_test_applicability(
            test_type=test_type,
            spec=spec,
            rule_set_version=rule_set_version,
            rule_context=rule_context
        )

        # Build procedure configuration
        if test_type == "WEIGHING":
            obs_schema, proc_config = build_weighing_procedure(spec)
        elif test_type == "REPEATABILITY":
            obs_schema, proc_config = build_repeatability_procedure(spec)
        elif test_type == "ECCENTRICITY":
            obs_schema, proc_config = build_eccentricity_procedure(spec)
        elif test_type == "TARE_ZERO":
            obs_schema, proc_config = build_tare_zero_procedure(spec)
        else:
            from .models import ObservationSchema, ProcedureConfig
            obs_schema, proc_config = ObservationSchema(), ProcedureConfig()

        # Validate reference standard requirement
        std_valid, std_err = validate_reference_standard_status(standard_dict)

        # Determine execution status
        if not configured:
            exec_status = TestExecutionStatus.NOT_CONFIGURED
            blocked_msg = config_issue or "This procedure is not configured for the current rule set."
        elif not applicable:
            exec_status = TestExecutionStatus.ABORTED
            blocked_msg = config_issue or "Not applicable for this instrument setup."
        elif not std_valid:
            exec_status = TestExecutionStatus.BLOCKED
            blocked_msg = std_err
        else:
            exec_status = TestExecutionStatus.READY
            blocked_msg = None

        return TestPlanItem(
            id=f"tpi-{uuid.uuid4().hex[:12]}",
            test_plan_id=test_plan_id,
            test_type=test_def.test_type,
            test_code=test_def.test_code,
            title=test_def.title,
            description=test_def.description,
            standard_reference=test_def.standard_reference,
            sequence_order=test_def.sequence_order,
            applicable=applicable,
            configured=configured,
            execution_status=exec_status,
            compliance_status=TestComplianceStatus.NOT_EVALUATED,
            blocked_reason=blocked_msg,
            prerequisites=list(test_def.prerequisites),
            required_standards=dict(test_def.required_standards),
            observation_schema=obs_schema,
            procedure_config=proc_config,
            rule_version=rule_set_version
        )
