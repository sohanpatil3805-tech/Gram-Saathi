import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.schemes.repository import SchemeRepository


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "schemes.json"
        payload = {
            "schema_version": "1.0.0",
            "sources": [{"source_id": "SRC1", "title": "Official source",
                         "publisher": "Government", "url": "https://example.gov.in"}],
            "schemes": [{
                "scheme_id": "DEMO_FARM",
                "name": {"en": "Demo Farmer Scheme", "kn": "ರೈತ ಯೋಜನೆ", "hi": "किसान योजना"},
                "summary": {"en": "Support for farmers."},
                "beneficiary_groups": ["farmers"],
                "applicable_states": ["Karnataka"],
                "jurisdiction": "central",
                "verification_status": "partially_verified",
                "eligibility_rules": [],
                "source_ids": ["SRC1"],
                "official_urls": ["https://example.gov.in"],
                "required_documents": [],
                "important_current_notes": []
            }]
        }
        self.database_path.write_text(json.dumps(payload), encoding="utf-8")
        self.client = TestClient(create_app_with_repository(SchemeRepository(self.database_path)))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_list_schemes(self):
        response = self.client.get("/api/schemes")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_discover_schemes(self):
        response = self.client.post("/api/schemes/discover", json={
            "beneficiary_group": "farmers", "state": "Karnataka", "language": "kn"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["schemes"][0]["name"], "ರೈತ ಯೋಜನೆ")
        self.assertEqual(response.json()["schemes"][0]["eligibility_status"], "not_configured")

    def test_unknown_scheme(self):
        response = self.client.get("/api/schemes/DOES_NOT_EXIST")
        self.assertEqual(response.status_code, 404)

    def test_eligibility_without_rules_requires_manual_review(self):
        response = self.client.post("/api/eligibility/check", json={
            "scheme_id": "DEMO_FARM", "applicant_facts": {}
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["outcome"], "manual_review")


def create_app_with_repository(repository):
    from fastapi import FastAPI
    from backend.api.routes import create_router

    app = FastAPI()
    app.include_router(create_router(repository))

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "gram-saathi-api"}

    return app


if __name__ == "__main__":
    unittest.main()
