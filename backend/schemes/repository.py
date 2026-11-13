"""Load and query the Gram Saathi scheme knowledge base (JSON)."""
from __future__ import annotations

import json
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

    def all_schemes(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        return list(self._schemes)

    def get_scheme(self, scheme_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        return next((s for s in self._schemes if s["scheme_id"] == scheme_id), None)

    def find_for_beneficiary(
        self, beneficiary_group: str, state: str = "Karnataka"
    ) -> list[dict[str, Any]]:
        self._ensure_loaded()
        matches = []
        for scheme in self._schemes:
            groups = scheme.get("beneficiary_groups", [])
            states = scheme.get("applicable_states", [])
            if beneficiary_group in groups and (not states or state in states):
                matches.append(scheme)
        return matches

    def sources_for_scheme(self, scheme_id: str) -> list[dict[str, Any]]:
        self._ensure_loaded()
        scheme = self.get_scheme(scheme_id)
        if scheme is None:
            return []
        ids = set(scheme.get("source_ids", []))
        return [source for source in self._sources if source.get("source_id") in ids]

    def _ensure_loaded(self) -> None:
        if not self._schemes:
            self.load()
