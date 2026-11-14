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
        category: str | None = None,
        jurisdiction: str | None = None,
        operational_status: str | None = None,
        search_query: str | None = None,
        page: int | None = None,
        page_size: int | None = None,
    ) -> dict[str, Any]:
        """Return relevant scheme candidates without overstating eligibility or artificial caps."""
        group = beneficiary_group.strip().lower()
        if not group:
            raise ValueError("beneficiary_group must not be empty")
        if language not in SUPPORTED_LANGUAGES:
            raise ValueError(f"language must be one of: {', '.join(sorted(SUPPORTED_LANGUAGES))}")

        # Fetch candidate schemes without pagination first to get total count
        try:
            all_candidates = self.repository.find_for_beneficiary(
                beneficiary_group=group,
                state=state,
                category=category,
                jurisdiction=jurisdiction,
                operational_status=operational_status,
                search_query=search_query,
                include_discontinued=False,
            )
        except TypeError:
            # Backward compatibility for simple test mocks (positional args)
            try:
                all_candidates = self.repository.find_for_beneficiary(group, state)
            except TypeError:
                all_candidates = self.repository.find_for_beneficiary(group)
        total_count = len(all_candidates)

        # Slice candidates if pagination is requested
        if page is not None and page_size is not None and page > 0 and page_size > 0:
            start = (page - 1) * page_size
            candidates = all_candidates[start : start + page_size]
        else:
            candidates = all_candidates

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

            official_url = (
                scheme.get("official_url")
                or scheme.get("official_application_url")
                or (scheme.get("official_urls", [None])[0] if scheme.get("official_urls") else None)
            )

            results.append({
                "scheme_id": scheme_id,
                "name": self._localized(scheme.get("name"), language),
                "summary": self._localized(scheme.get("summary"), language),
                "description": self._localized(scheme.get("description"), language),
                "category": scheme.get("category", "General"),
                "department": scheme.get("department", ""),
                "operational_status": scheme.get("operational_status", "ACTIVE"),
                "application_status": scheme.get("application_status", "Open"),
                "application_window": scheme.get("application_window", ""),
                "benefit": scheme.get("benefit", {}),
                "jurisdiction": scheme.get("jurisdiction", "unknown"),
                "verification_status": scheme.get("verification_status", "unknown"),
                "eligibility_status": eligibility_status,
                "eligibility": eligibility,
                "required_documents": scheme.get("required_documents", []),
                "document_requirements": scheme.get("document_requirements", []),
                "mandatory_documents": scheme.get("mandatory_documents", []),
                "important_dates": scheme.get("important_dates", {}),
                "official_url": official_url,
                "official_application_url": scheme.get("official_application_url") or official_url,
                "important_current_notes": scheme.get("important_current_notes", []),
                "official_urls": scheme.get("official_urls", []),
                "alternative_names": scheme.get("alternative_names", []),
                "geographic_applicability": scheme.get("geographic_applicability", ""),
                "sources": [
                    {
                        "source_id": source.get("source_id"),
                        "title": source.get("title"),
                        "publisher": source.get("publisher"),
                        "url": source.get("url"),
                    }
                    for source in sources
                ],
                "last_checked": scheme.get("last_checked") or scheme.get("verification_date"),
            })

        notices = {
            "kn": (
                "ಇವು ಸಂಭಾವ್ಯ ಹೊಂದಾಣಿಕೆಯಾಗುವ ಯೋಜನೆಗಳು, ದೃಢೀಕರಿಸಿದ ಅರ್ಹತೆ ಅಥವಾ ಅಧಿಕೃತ ನಿರ್ಧಾರವಲ್ಲ. "
                "ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಲಿಂಕ್ ಮಾಡಲಾದ ಅಧಿಕೃತ ಮೂಲಗಳು ಮತ್ತು ಪ್ರಸ್ತುತ ಸ್ಥಳೀಯ ಅಧಿಸೂಚನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ."
            ),
            "hi": (
                "ये संभावित रूप से प्रासंगिक योजना उम्मीदवार हैं, पुष्ट पात्रता या आधिकारिक निर्णय नहीं। "
                "आवेदन करने से पहले लिंक किए गए आधिकारिक स्रोतों और वर्तमान स्थानीय सूचनाओं की जांच करें।"
            ),
            "en": (
                "These are potentially relevant scheme candidates, not confirmed "
                "eligibility or an official decision. Check the linked official "
                "sources and current local notifications before applying."
            ),
        }

        return {
            "beneficiary_group": group,
            "state": state,
            "language": language,
            "candidate_count": len(results),
            "total_candidates": total_count,
            "page": page,
            "page_size": page_size,
            "schemes": results,
            "notice": notices.get(language, notices["en"]),
        }
