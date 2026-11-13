import unittest

from backend.schemes.eligibility import Outcome, evaluate_scheme


class EligibilityEngineTests(unittest.TestCase):
    def setUp(self):
        self.scheme = {
            "scheme_id": "DEMO",
            "eligibility_rules": [
                {
                    "rule_id": "AGE",
                    "field": "age",
                    "operator": "gte",
                    "value": 18,
                    "effect": "require",
                    "verification_status": "verified",
                    "message": "Applicant must be at least 18."
                }
            ]
        }

    def test_missing_information(self):
        result = evaluate_scheme(self.scheme, {})
        self.assertEqual(result.outcome, Outcome.NEEDS_INFORMATION)
        self.assertEqual(result.missing_fields, ["age"])

    def test_rule_passes(self):
        result = evaluate_scheme(self.scheme, {"age": 22})
        self.assertEqual(result.outcome, Outcome.POTENTIALLY_ELIGIBLE)

    def test_required_rule_fails(self):
        result = evaluate_scheme(self.scheme, {"age": 16})
        self.assertEqual(result.outcome, Outcome.NOT_ELIGIBLE)

    def test_unverified_rule_requires_manual_review(self):
        scheme = {
            "scheme_id": "UNVERIFIED",
            "eligibility_rules": [{
                "rule_id": "R1",
                "field": "age",
                "operator": "gte",
                "value": 18,
                "effect": "require",
                "verification_status": "needs_review",
                "message": "Age rule"
            }]
        }
        result = evaluate_scheme(scheme, {"age": 22})
        self.assertEqual(result.outcome, Outcome.MANUAL_REVIEW)

    def test_no_structured_rules_requires_manual_review(self):
        result = evaluate_scheme({"scheme_id": "PM_KISAN", "eligibility_rules": []}, {})
        self.assertEqual(result.outcome, Outcome.MANUAL_REVIEW)


if __name__ == "__main__":
    unittest.main()
