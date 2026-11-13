# Gram Saathi deterministic eligibility engine

## Purpose
Evaluate only structured, approved eligibility rules. The engine is deterministic and does not ask an LLM to decide eligibility.

## Outcomes
- `potentially_eligible`: every configured verified rule passed. This is not an official decision.
- `not_eligible`: at least one verified required condition failed or an exclusion matched.
- `needs_information`: one or more required applicant facts are missing.
- `manual_review`: rules are absent, unverified, malformed or could not be evaluated safely.

## Rule format
Each rule contains:
- `rule_id`
- `field`: applicant profile key
- `operator`: one of `eq`, `neq`, `in`, `not_in`, `gte`, `lte`, `gt`, `lt`, `truthy`, `falsy`
- `value`
- `effect`: `require` or `exclude`
- `verification_status`: must be exactly `verified` to run
- `message`: citizen-friendly explanation

## Safety
1. Do not convert prose into rules automatically.
2. Do not mark a rule `verified` until it is checked against a current official guideline/notification and reviewed.
3. Unknown facts must produce `needs_information`, not a negative decision.
4. Missing/unverified rules must produce `manual_review`.
5. Final eligibility is decided by the competent government department.
6. Keep Aadhaar, bank account numbers and actual documents out of rule fixtures and test data.

## Run tests from project root
```powershell
py -m unittest discover -s tests -p "test_eligibility_engine.py" -v
```

No third-party package is required for this starter engine.
