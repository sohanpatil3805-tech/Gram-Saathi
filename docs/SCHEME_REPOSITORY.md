# Scheme repository

The repository loads `database/schemes.json` and supports:
- listing all scheme records;
- retrieving one record by `scheme_id`;
- filtering records by beneficiary group and state;
- retrieving source records linked to a scheme.

It does not decide eligibility. Feed a scheme into the deterministic eligibility engine only after its machine-readable rules have been independently verified.

## Test
From the project root:

```powershell
py -m unittest discover -s tests -p "test_scheme_repository.py" -v
```

The tests use temporary synthetic JSON and do not require network access.
