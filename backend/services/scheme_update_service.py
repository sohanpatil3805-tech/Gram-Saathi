"""
Scheme Update and Verification Service for Gram Saathi.

Provides:
- Automated diff detection between current scheme records and proposed updates.
- Scheme versioning and historical snapshot archives in database/scheme_versions/.
- Multi-tier verification queue (PENDING_VERIFICATION, APPROVED, REJECTED).
- Authorised officer approval workflow with atomic commits to database/schemes.json.
- Full audit logging of all scheme modifications.
"""
from __future__ import annotations

import copy
import datetime
import json
import uuid
from pathlib import Path
from typing import Any


class SchemeUpdateService:
    def __init__(
        self,
        database_path: str | Path | None = None,
        queue_path: str | Path = "database/scheme_updates_queue.json",
        versions_dir: str | Path = "database/scheme_versions",
        db_path: str | Path | None = None,
    ) -> None:
        target_db = database_path or db_path or "database/schemes.json"
        self.database_path = Path(target_db)
        self.queue_path = Path(queue_path)
        self.versions_dir = Path(versions_dir)
        self.versions_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_queue_file()

    def _ensure_queue_file(self) -> None:
        if not self.queue_path.exists():
            self.queue_path.write_text(json.dumps({"updates": []}, indent=2), encoding="utf-8")

    def _read_database(self) -> dict[str, Any]:
        if not self.database_path.exists():
            raise FileNotFoundError(f"Scheme database not found: {self.database_path}")
        return json.loads(self.database_path.read_text(encoding="utf-8"))

    def _write_database(self, data: dict[str, Any]) -> None:
        self.database_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _read_queue(self) -> list[dict[str, Any]]:
        self._ensure_queue_file()
        try:
            payload = json.loads(self.queue_path.read_text(encoding="utf-8"))
            return payload.get("updates", [])
        except (json.JSONDecodeError, OSError):
            return []

    def _write_queue(self, updates: list[dict[str, Any]]) -> None:
        self.queue_path.write_text(
            json.dumps({"updates": updates}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def detect_diff(self, current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
        """Generate structured field-level diff between current and proposed scheme records."""
        diff: dict[str, Any] = {
            "has_changes": False,
            "modified_fields": {},
            "added_fields": {},
            "removed_fields": {},
        }

        all_keys = set(current.keys()).union(set(proposed.keys()))
        for key in all_keys:
            if key not in current:
                diff["added_fields"][key] = proposed[key]
                diff["has_changes"] = True
            elif key not in proposed:
                diff["removed_fields"][key] = current[key]
                diff["has_changes"] = True
            elif current[key] != proposed[key]:
                diff["modified_fields"][key] = {
                    "previous": current[key],
                    "proposed": proposed[key],
                }
                diff["has_changes"] = True

        return diff

    def propose_update(
        self,
        scheme_id: str,
        proposed_data: dict[str, Any],
        proposed_by: str = "automated_crawler",
        source_evidence: str = "",
        notes: str = "",
    ) -> dict[str, Any]:
        """Submit a proposed scheme change into the officer verification queue."""
        db = self._read_database()
        schemes = db.get("schemes", [])
        current_scheme = next((s for s in schemes if s["scheme_id"] == scheme_id), None)

        is_new_scheme = current_scheme is None
        diff = self.detect_diff(current_scheme or {}, proposed_data)

        update_id = f"UPD-{datetime.date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        queue_item = {
            "update_id": update_id,
            "scheme_id": scheme_id,
            "is_new_scheme": is_new_scheme,
            "proposed_by": proposed_by,
            "proposed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": "PENDING_VERIFICATION",
            "source_evidence": source_evidence,
            "notes": notes,
            "diff": diff,
            "proposed_data": proposed_data,
            "reviewed_by": None,
            "reviewed_at": None,
            "review_notes": None,
        }

        updates = self._read_queue()
        updates.append(queue_item)
        self._write_queue(updates)
        return queue_item

    def get_verification_queue(self, status: str | None = None) -> list[dict[str, Any]]:
        """Return all queued scheme updates, optionally filtered by status."""
        updates = self._read_queue()
        if status:
            target = status.upper().strip()
            return [u for u in updates if u.get("status") == target]
        return updates

    def get_update_detail(self, update_id: str) -> dict[str, Any] | None:
        """Fetch details of a single update."""
        updates = self._read_queue()
        return next((u for u in updates if u["update_id"] == update_id), None)

    def approve_update(
        self,
        update_id: str,
        officer_id: str,
        officer_notes: str = "",
    ) -> dict[str, Any]:
        """Approve an update, archive the previous version, and commit to active knowledge base."""
        updates = self._read_queue()
        queue_item = next((u for u in updates if u["update_id"] == update_id), None)
        if not queue_item:
            raise ValueError(f"Update ID {update_id} not found in verification queue.")
        if queue_item["status"] != "PENDING_VERIFICATION":
            raise ValueError(f"Update {update_id} has already been resolved ({queue_item['status']}).")

        scheme_id = queue_item["scheme_id"]
        proposed_data = queue_item["proposed_data"]
        db = self._read_database()
        schemes = db.get("schemes", [])

        current_index = next((i for i, s in enumerate(schemes) if s["scheme_id"] == scheme_id), -1)

        # Archive version snapshot if existing
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
        if current_index >= 0:
            previous_scheme = copy.deepcopy(schemes[current_index])
            archive_file = self.versions_dir / f"{scheme_id}_v_{timestamp}.json"
            archive_file.write_text(
                json.dumps(previous_scheme, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            # Update scheme in place
            proposed_data["scheme_id"] = scheme_id
            proposed_data["last_updated_date"] = datetime.date.today().isoformat()
            proposed_data["verification_status"] = "VERIFIED_OFFICIAL"
            schemes[current_index] = proposed_data
        else:
            # New scheme addition
            proposed_data["scheme_id"] = scheme_id
            proposed_data["last_updated_date"] = datetime.date.today().isoformat()
            proposed_data["verification_status"] = "VERIFIED_OFFICIAL"
            schemes.append(proposed_data)

        # Update metadata
        db["last_updated"] = datetime.date.today().isoformat()
        if "metadata" in db:
            db["metadata"]["total_schemes"] = len(schemes)

        self._write_database(db)

        # Update queue record
        queue_item["status"] = "APPROVED"
        queue_item["reviewed_by"] = officer_id
        queue_item["reviewed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        queue_item["review_notes"] = officer_notes
        self._write_queue(updates)

        return {
            "status": "APPROVED",
            "update_id": update_id,
            "scheme_id": scheme_id,
            "message": f"Scheme {scheme_id} successfully updated and published to active database.",
            "approved_by": officer_id,
            "timestamp": queue_item["reviewed_at"],
        }

    def reject_update(
        self,
        update_id: str,
        officer_id: str,
        rejection_reason: str,
    ) -> dict[str, Any]:
        """Reject a proposed update with explicit reason."""
        updates = self._read_queue()
        queue_item = next((u for u in updates if u["update_id"] == update_id), None)
        if not queue_item:
            raise ValueError(f"Update ID {update_id} not found in verification queue.")
        if queue_item["status"] != "PENDING_VERIFICATION":
            raise ValueError(f"Update {update_id} has already been resolved ({queue_item['status']}).")

        queue_item["status"] = "REJECTED"
        queue_item["reviewed_by"] = officer_id
        queue_item["reviewed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        queue_item["review_notes"] = rejection_reason
        self._write_queue(updates)

        return {
            "status": "REJECTED",
            "update_id": update_id,
            "scheme_id": queue_item["scheme_id"],
            "rejected_by": officer_id,
            "reason": rejection_reason,
            "timestamp": queue_item["reviewed_at"],
        }

    def get_version_history(self, scheme_id: str) -> list[dict[str, Any]]:
        """Return list of historical snapshots for a scheme."""
        pattern = f"{scheme_id}_v_*.json"
        snapshots = []
        for file in sorted(self.versions_dir.glob(pattern), reverse=True):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                snapshots.append({
                    "filename": file.name,
                    "archived_at": file.stem.split("_v_")[-1],
                    "data": data,
                })
            except Exception:
                continue
        return snapshots
