"""Deterministic eligibility evaluator.

The evaluator does not use an LLM. It evaluates only explicit, structured rules.
Unknown facts produce NEEDS_INFORMATION. Rules that are not approved/verified
produce MANUAL_REVIEW rather than an eligibility decision.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Iterable


class Outcome(str, Enum):
    POTENTIALLY_ELIGIBLE = "potentially_eligible"
    NOT_ELIGIBLE = "not_eligible"
    NEEDS_INFORMATION = "needs_information"
    MANUAL_REVIEW = "manual_review"


@dataclass
class RuleResult:
    rule_id: str
    outcome: Outcome
    message: str
    field: str | None = None


@dataclass
class EligibilityResult:
    scheme_id: str
    outcome: Outcome
    rule_results: list[RuleResult]
    missing_fields: list[str]
    disclaimer: str = (
        "This is a preliminary guidance result, not an official eligibility "
        "decision. The competent department makes the final decision."
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "scheme_id": self.scheme_id,
            "outcome": self.outcome.value,
            "rule_results": [
                {**asdict(item), "outcome": item.outcome.value}
                for item in self.rule_results
            ],
            "missing_fields": self.missing_fields,
            "disclaimer": self.disclaimer,
        }


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    """Evaluate a small allowlist of safe comparison operators."""
    op = operator.strip().lower() if isinstance(operator, str) else str(operator)
    if op in ("eq", "=="):
        return actual == expected
    if op in ("neq", "!="):
        return actual != expected
    if op in ("in",):
        return actual in expected
    if op in ("not_in",):
        return actual not in expected
    if op in ("gte", ">="):
        return actual >= expected
    if op in ("lte", "<="):
        return actual <= expected
    if op in ("gt", ">"):
        return actual > expected
    if op in ("lt", "<"):
        return actual < expected
    if op in ("truthy",):
        return bool(actual)
    if op in ("falsy",):
        return not bool(actual)
    raise ValueError(f"Unsupported rule operator: {operator}")


def evaluate_rule(rule: dict[str, Any], applicant: dict[str, Any]) -> RuleResult:
    """Evaluate one structured rule.

    Expected rule format:
      {
        "rule_id": "EXAMPLE_1",
        "field": "has_cultivable_land_record",
        "operator": "eq",
        "value": true,
        "effect": "require",  # or "exclude"
        "verification_status": "verified",
        "message": "Applicant must have..."
      }
    """
    rule_id = str(rule.get("rule_id", "UNNAMED_RULE"))
    field = rule.get("field")
    status = rule.get("verification_status")
    message = rule.get("description") or rule.get("message") or f"Rule {rule_id} requires review."

    if status != "verified":
        return RuleResult(rule_id, Outcome.MANUAL_REVIEW, message, field)

    if not field or "operator" not in rule or "value" not in rule:
        return RuleResult(rule_id, Outcome.MANUAL_REVIEW,
                          "Rule definition is incomplete and needs review.", field)

    if field not in applicant or applicant[field] is None:
        return RuleResult(rule_id, Outcome.NEEDS_INFORMATION,
                          f"More information is needed: {message}", field)

    try:
        matched = _compare(applicant[field], rule["operator"], rule["value"])
    except (TypeError, ValueError):
        return RuleResult(rule_id, Outcome.MANUAL_REVIEW,
                          "Rule could not be safely evaluated; officer review is needed.", field)

    effect = rule.get("effect", "require")
    if effect not in {"require", "exclude"}:
        return RuleResult(rule_id, Outcome.MANUAL_REVIEW,
                          "Rule effect is invalid and needs review.", field)

    # A required condition fails => not eligible; an exclusion condition matches => not eligible.
    fails = (effect == "require" and not matched) or (effect == "exclude" and matched)
    if fails:
        return RuleResult(rule_id, Outcome.NOT_ELIGIBLE, message, field)

    return RuleResult(rule_id, Outcome.POTENTIALLY_ELIGIBLE,
                      f"Condition satisfied: {message}", field)


def evaluate_scheme(scheme: dict[str, Any], applicant: dict[str, Any]) -> EligibilityResult:
    """Evaluate a scheme's machine-readable eligibility rules.

    Free-text rules are intentionally not interpreted. If no structured rules
    exist, the result is MANUAL_REVIEW.
    """
    scheme_id = scheme.get("scheme_id", "UNKNOWN_SCHEME")
    rules: Iterable[dict[str, Any]] = scheme.get("eligibility_rules", [])
    rules = list(rules)

    if not rules:
        return EligibilityResult(
            scheme_id, Outcome.MANUAL_REVIEW,
            [RuleResult("NO_STRUCTURED_RULES", Outcome.MANUAL_REVIEW,
                        "No approved machine-readable eligibility rules are available.")],
            [],
        )

    results = [evaluate_rule(rule, applicant) for rule in rules]
    missing = sorted({r.field for r in results
                      if r.outcome == Outcome.NEEDS_INFORMATION and r.field})

    outcomes = {r.outcome for r in results}
    if Outcome.NOT_ELIGIBLE in outcomes:
        overall = Outcome.NOT_ELIGIBLE
    elif Outcome.MANUAL_REVIEW in outcomes:
        overall = Outcome.MANUAL_REVIEW
    elif Outcome.NEEDS_INFORMATION in outcomes:
        overall = Outcome.NEEDS_INFORMATION
    else:
        overall = Outcome.POTENTIALLY_ELIGIBLE

    return EligibilityResult(scheme_id, overall, results, missing)
