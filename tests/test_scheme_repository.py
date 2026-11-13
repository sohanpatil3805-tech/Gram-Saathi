import json
import tempfile
import unittest
from pathlib import Path

from backend.schemes.repository import SchemeDataError, SchemeRepository


class SchemeRepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / "schemes.json"
        self.payload = {
            "schema_version": "1.0",
            "scope": {"state": "Karnataka"},
            "sources": [
                {"source_id": "SRC1", "title": "Official source", "url": "https://example.gov"}
            ],
            "schemes": [
                {
                    "scheme_id": "TEST_FARM",
                    "beneficiary_groups": ["farmers"],
                    "applicable_states": ["Karnataka"],
                    "source_ids": ["SRC1"]
                },
                {
                    "scheme_id": "TEST_STUDENT",
                    "beneficiary_groups": ["students"],
                    "applicable_states": ["Karnataka"],
                    "source_ids": []
                }
            ]
        }
        self.path.write_text(json.dumps(self.payload), encoding="utf-8")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_load_and_list(self):
        repo = SchemeRepository(self.path)
        self.assertEqual(len(repo.all_schemes()), 2)

    def test_filter_by_beneficiary(self):
        repo = SchemeRepository(self.path)
        result = repo.find_for_beneficiary("farmers")
        self.assertEqual([x["scheme_id"] for x in result], ["TEST_FARM"])

    def test_get_scheme(self):
        repo = SchemeRepository(self.path)
        self.assertEqual(repo.get_scheme("TEST_STUDENT")["scheme_id"], "TEST_STUDENT")
        self.assertIsNone(repo.get_scheme("DOES_NOT_EXIST"))

    def test_sources_for_scheme(self):
        repo = SchemeRepository(self.path)
        sources = repo.sources_for_scheme("TEST_FARM")
        self.assertEqual(sources[0]["source_id"], "SRC1")

    def test_duplicate_ids_rejected(self):
        self.payload["schemes"].append(dict(self.payload["schemes"][0]))
        self.path.write_text(json.dumps(self.payload), encoding="utf-8")
        repo = SchemeRepository(self.path)
        with self.assertRaises(SchemeDataError):
            repo.load()


if __name__ == "__main__":
    unittest.main()
