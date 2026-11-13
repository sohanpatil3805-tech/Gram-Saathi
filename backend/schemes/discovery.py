"""Candidate scheme discovery for Gram Saathi.

Discovery is deliberately separate from eligibility decisions:
- beneficiary group/state select relevant catalogue entries;
- only fully structured rules with verification_status == "verified"
  are passed to the deterministic eligibility evaluator;
- prose descriptions and statuses such as "verified_from_official_guideline"
  are never treated as executable rules.
"""
from __future__ import annotations

from typing import Any

from backend.schemes.eligibility import evaluate_scheme
from backend.schemes.repository import SchemeRepository


SUPPORTED_LANGUAGES = {"en", "kn", "hi"}


class SchemeDiscoveryService:
    def __init__(self, repository: SchemeRepository | None = None) -> None:
        self.repository = repository or SchemeRepository()

    @staticmethod
    def _localized(value: Any, language: str, fallback: str = "en") -> str:
        if isinstance(value, dict):
            return str(value.get(language) or value.get(fallback) or next(iter(value.values()), ""))
        return str(value or "")

    @staticmethod
    def _has_executable_rules(scheme: dict[str, Any]) -> bool:
        rules = scheme.get("eligibility_rules")
        if not isinstance(rules, list) or not rules:
            return False
        required_keys = {"rule_id", "field", "operator", "value", "effect", "verification_status"}
        return all(
            isinstance(rule, dict)
            and required_keys.issubset(rule.keys())
            and rule.get("verification_status") == "verified"
            for rule in rules
        )

    def discover(
        self,
        beneficiary_group: str,
        state: str = "Karnataka",
        applicant_facts: dict[str, Any] | None = None,
        language: str = "en",
    ) -> dict[str, Any]:
        """Return relevant scheme candidates without overstating eligibility."""
        group = beneficiary_group.strip().lower()
        if not group:
            raise ValueError("beneficiary_group must not be empty")
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"language must be one of: {', '.join(sorted(SUPPORTED_LANGUAGES))}")

        candidates = self.repository.find_for_beneficiary(group, state)
        results: list[dict[str, Any]] = []

        for scheme in candidates:
            scheme_id = scheme["scheme_id"]
            sources = self.repository.sources_for_scheme(scheme_id)
            has_rules = self._has_executable_rules(scheme)

            if has_rules:
                eligibility = evaluate_scheme(scheme, applicant_facts or {}).to_dict()
                eligibility_status = eligibility["outcome"]
            else:
                eligibility = None
                eligibility_status = "not_configured"

            results.append({
                "scheme_id": scheme_id,
                "name": self._localized(scheme.get("name"), language),
                "summary": self._localized(scheme.get("summary"), language),
                "benefit": scheme.get("benefit", {}),
                "jurisdiction": scheme.get("jurisdiction", "unknown"),
                "verification_status": scheme.get("verification_status", "unknown"),
                "eligibility_status": eligibility_status,
                "eligibility": eligibility,
                "required_documents": scheme.get("required_documents", []),
                "important_current_notes": scheme.get("important_current_notes", []),
                "official_urls": scheme.get("official_urls", []),
                "sources": [
                    {
                        "source_id": source.get("source_id"),
                        "title": source.get("title"),
                        "publisher": source.get("publisher"),
                        "url": source.get("url"),
                    }
                    for source in sources
                ],
                "last_checked": scheme.get("last_checked"),
            })

        return {
            "beneficiary_group": group,
            "state": state,
            "language": language,
            "candidate_count": len(results),
            "schemes": results,
            "notice": (
                "These are potentially relevant scheme candidates, not confirmed "
                "eligibility or an official decision. Check the linked official "
                "sources and current local notifications before applying."
            ),
        }
