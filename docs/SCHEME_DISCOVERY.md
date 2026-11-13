# Scheme Discovery Service

## Purpose
`SchemeDiscoveryService` finds catalogue entries relevant to a beneficiary group and state. It does not decide whether a person qualifies.

## Usage
Run from the repository root:

```python
from backend.schemes.discovery import SchemeDiscoveryService

service = SchemeDiscoveryService()
result = service.discover(
    beneficiary_group="farmers",
    state="Karnataka",
    applicant_facts={},
    language="en",  # "en", "kn", or "hi"
)
print(result)
```

The default repository reads `database/schemes.json`.

## Eligibility safety
The service evaluates rules only when every rule contains `rule_id`, `field`, `operator`, `value`, `effect`, and `verification_status == "verified"`. Free-text descriptions and other verification labels are not executable rules. Schemes without such rules return `eligibility_status: "not_configured"` and remain discovery candidates.

## Response
The response includes candidate count, localized scheme name, summary, benefit, verification status, required documents, official URLs, source metadata, last checked date, and an explicit notice that discovery is not an official eligibility decision.

## Tests
```powershell
py -m unittest discover -s tests -p "test_scheme_discovery.py" -v
```
