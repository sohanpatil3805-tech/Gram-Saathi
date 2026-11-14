"""Load and query the Gram Saathi scheme knowledge base (JSON)."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


class SchemeDataError(ValueError):
    """Raised when the scheme knowledge base is missing or malformed."""


class SchemeRepository:
    def __init__(self, database_path: str | Path = "database/schemes.json") -> None:
        self.database_path = Path(database_path)
        self._schemes: list[dict[str, Any]] = []
        self._sources: list[dict[str, Any]] = []

    def load(self) -> None:
        if not self.database_path.exists():
            raise SchemeDataError(f"Scheme file not found: {self.database_path}")
        try:
            payload = json.loads(self.database_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SchemeDataError(f"Invalid JSON in {self.database_path}: {exc}") from exc

        if not isinstance(payload, dict):
            raise SchemeDataError("Scheme database root must be a JSON object.")
        if not isinstance(payload.get("schemes"), list):
            raise SchemeDataError("Scheme database must contain a 'schemes' array.")
        if not isinstance(payload.get("sources"), list):
            raise SchemeDataError("Scheme database must contain a 'sources' array.")

        seen: set[str] = set()
        for item in payload["schemes"]:
            if not isinstance(item, dict):
                raise SchemeDataError("Every scheme record must be an object.")
            scheme_id = item.get("scheme_id")
            if not isinstance(scheme_id, str) or not scheme_id.strip():
                raise SchemeDataError("Every scheme must have a non-empty scheme_id.")
            if scheme_id in seen:
                raise SchemeDataError(f"Duplicate scheme_id: {scheme_id}")
            seen.add(scheme_id)

        self._schemes = payload["schemes"]
        self._sources = payload["sources"]

    def all_schemes(self, include_discontinued: bool = True) -> list[dict[str, Any]]:
        self._ensure_loaded()
        if include_discontinued:
            return list(self._schemes)
        return [s for s in self._schemes if s.get("operational_status") != "DISCONTINUED"]

    def get_scheme(self, scheme_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        return next((s for s in self._schemes if s["scheme_id"] == scheme_id), None)

    def find_for_beneficiary(
        self,
        beneficiary_group: str,
        state: str = "Karnataka",
        category: str | None = None,
        jurisdiction: str | None = None,
        operational_status: str | None = None,
        search_query: str | None = None,
        include_discontinued: bool = False,
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[dict[str, Any]]:
        self._ensure_loaded()
        target = beneficiary_group.strip().lower()

        def _normalize(val: str) -> set[str]:
            v = val.strip().lower().replace("-", " ").replace("_", " ")
            forms = {v, v.rstrip("s"), v + "s"}
            if "farmer" in v:
                forms.update({"farmer", "farmers"})
            if "student" in v:
                forms.update({"student", "students"})
            if "woman" in v or "women" in v:
                forms.update({"woman", "women", "woman entrepreneur", "women entrepreneur", "women entrepreneurs"})
            if "worker" in v:
                forms.update({"worker", "workers", "wage worker", "wage workers"})
            return forms

        target_set = _normalize(target)
        matches: list[dict[str, Any]] = []

        for scheme in self._schemes:
            # Exclude discontinued by default
            if not include_discontinued and scheme.get("operational_status") == "DISCONTINUED":
                continue

            # Group matching
            groups = scheme.get("beneficiary_groups", [])
            states = scheme.get("applicable_states", [])
            scheme_groups: set[str] = set()
            for g in groups:
                scheme_groups.update(_normalize(g))

            group_matched = (target in groups or bool(target_set.intersection(scheme_groups)))
            state_matched = (not states or state in states or "All States" in states)
            if not (group_matched and state_matched):
                continue

            # Category filter
            if category:
                sc_cat = scheme.get("category", "").lower()
                if category.lower() not in sc_cat:
                    continue

            # Jurisdiction filter (central, state, district)
            if jurisdiction:
                sc_jur = scheme.get("jurisdiction", "").lower()
                if jurisdiction.lower() != sc_jur:
                    continue

            # Operational status filter
            if operational_status:
                sc_stat = scheme.get("operational_status", "").upper()
                if operational_status.upper() != sc_stat:
                    continue

            # Search query filter (search across name, summary, alternative_names, department)
            if search_query:
                sq = search_query.strip().lower()
                names = scheme.get("name", {})
                name_strs = [str(v).lower() for v in names.values()] if isinstance(names, dict) else [str(names).lower()]
                alt_names = [str(a).lower() for a in scheme.get("alternative_names", [])]
                summary = scheme.get("summary", {})
                summary_strs = [str(v).lower() for v in summary.values()] if isinstance(summary, dict) else [str(summary).lower()]
                dept = str(scheme.get("department", "")).lower()
                sid = str(scheme.get("scheme_id", "")).lower()

                searchable = " ".join([*name_strs, *alt_names, *summary_strs, dept, sid])
                if sq not in searchable:
                    continue

            matches.append(scheme)

        # Pagination
        effective_page = page if (page is not None and page > 0) else 1
        if page_size is not None and page_size > 0:
            start = (effective_page - 1) * page_size
            return matches[start : start + page_size]

        return matches

    def search_schemes(
        self,
        query: str = "",
        beneficiary_group: str | None = None,
        state: str = "Karnataka",
        category: str | None = None,
        jurisdiction: str | None = None,
        operational_status: str | None = None,
        include_discontinued: bool = False,
        page: int | None = None,
        page_size: int | None = None,
    ) -> list[dict[str, Any]]:
        """Search all schemes with query across full scheme catalogue."""
        self._ensure_loaded()
        if beneficiary_group:
            return self.find_for_beneficiary(
                beneficiary_group=beneficiary_group,
                state=state,
                category=category,
                jurisdiction=jurisdiction,
                operational_status=operational_status,
                search_query=query,
                include_discontinued=include_discontinued,
                page=page,
                page_size=page_size,
            )

        sq = query.strip().lower()
        matches: list[dict[str, Any]] = []
        for scheme in self._schemes:
            if not include_discontinued and scheme.get("operational_status") == "DISCONTINUED":
                continue

            states = scheme.get("applicable_states", [])
            if states and state not in states and "All States" not in states:
                continue

            if category and category.lower() not in scheme.get("category", "").lower():
                continue

            if jurisdiction and jurisdiction.lower() != scheme.get("jurisdiction", "").lower():
                continue

            if operational_status and operational_status.upper() != scheme.get("operational_status", "").upper():
                continue

            if sq:
                names = scheme.get("name", {})
                name_strs = [str(v).lower() for v in names.values()] if isinstance(names, dict) else [str(names).lower()]
                alt_names = [str(a).lower() for a in scheme.get("alternative_names", [])]
                summary = scheme.get("summary", {})
                summary_strs = [str(v).lower() for v in summary.values()] if isinstance(summary, dict) else [str(summary).lower()]
                dept = str(scheme.get("department", "")).lower()
                sid = str(scheme.get("scheme_id", "")).lower()

                searchable = " ".join([*name_strs, *alt_names, *summary_strs, dept, sid])
                if sq not in searchable:
                    continue

            matches.append(scheme)

        effective_page = page if (page is not None and page > 0) else 1
        if page_size is not None and page_size > 0:
            start = (effective_page - 1) * page_size
            return matches[start : start + page_size]

        return matches

    def get_categories(self, beneficiary_group: str | None = None) -> list[str]:
        """Return unique list of scheme categories."""
        self._ensure_loaded()
        schemes = self.find_for_beneficiary(beneficiary_group) if beneficiary_group else self._schemes
        categories = {s["category"] for s in schemes if s.get("category")}
        return sorted(categories)

    def sources_for_scheme(self, scheme_id: str) -> list[dict[str, Any]]:
        self._ensure_loaded()
        scheme = self.get_scheme(scheme_id)
        if scheme is None:
            return []
        ids = set(scheme.get("source_ids", []))
        return [source for source in self._sources if source.get("source_id") in ids]

    def get_document_requirements(self, scheme_id: str) -> list[dict[str, Any]]:
        """Return the structured list of document requirements for a scheme."""
        self._ensure_loaded()
        scheme = self.get_scheme(scheme_id)
        if not scheme:
            return []
        if "document_requirements" in scheme:
            return list(scheme["document_requirements"])
        reqs = []
        for doc in scheme.get("mandatory_documents", []):
            reqs.append({
                "doc_type": doc,
                "label_en": doc.replace("_", " ").title(),
                "label_kn": doc,
                "label_hi": doc,
                "mandatory": True,
            })
        return reqs

    def get_mandatory_documents(self, scheme_id: str) -> list[str]:
        """Return doc_type identifiers of all mandatory documents for a scheme."""
        self._ensure_loaded()
        scheme = self.get_scheme(scheme_id)
        if not scheme:
            return []
        if "mandatory_documents" in scheme:
            return list(scheme["mandatory_documents"])
        reqs = self.get_document_requirements(scheme_id)
        return [r["doc_type"] for r in reqs if r.get("mandatory", False)]

    def _ensure_loaded(self) -> None:
        if not self._schemes:
            self.load()
