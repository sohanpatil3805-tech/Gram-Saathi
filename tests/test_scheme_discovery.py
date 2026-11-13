import unittest

from backend.schemes.discovery import SchemeDiscoveryService


class FakeRepository:
    def __init__(self, schemes):
        self.schemes = schemes

    def find_for_beneficiary(self, beneficiary_group, state):
        return [
            item for item in self.schemes
            if beneficiary_group in item.get("beneficiary_groups", [])
            and (not item.get("applicable_states") or state in item["applicable_states"])
        ]

    def sources_for_scheme(self, scheme_id):
        return [{"source_id": "SRC1", "title": "Official guideline",
                 "publisher": "Government", "url": "https://example.gov.in"}]


class SchemeDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.prose_scheme = {
            "scheme_id": "DEMO_PROSE",
            "name": {"en": "Demo farmer scheme", "kn": "ರೈತ ಯೋಜನೆ"},
            "summary": "Support for farmers.",
            "beneficiary_groups": ["farmers"],
            "applicable_states": ["Karnataka"],
            "eligibility_rules": [{
                "description": "Must be a farmer.",
                "verification_status": "verified_from_official_guideline"
            }],
            "verification_status": "partially_verified",
            "official_urls": ["https://example.gov.in"],
        }
        self.service = SchemeDiscoveryService(FakeRepository([self.prose_scheme]))

    def test_returns_candidate_without_claiming_eligibility(self):
        result = self.service.discover("farmers")
        self.assertEqual(result["candidate_count"], 1)
        self.assertEqual(result["schemes"][0]["eligibility_status"], "not_configured")
        self.assertIsNone(result["schemes"][0]["eligibility"])

    def test_localized_name(self):
        result = self.service.discover("farmers", language="kn")
        self.assertEqual(result["schemes"][0]["name"], "ರೈತ ಯೋಜನೆ")

    def test_wrong_beneficiary_returns_no_candidates(self):
        result = self.service.discover("students")
        self.assertEqual(result["candidate_count"], 0)

    def test_invalid_language_rejected(self):
        with self.assertRaises(ValueError):
            self.service.discover("farmers", language="xx")

    def test_empty_beneficiary_rejected(self):
        with self.assertRaises(ValueError):
            self.service.discover(" ")


if __name__ == "__main__":
    unittest.main()
