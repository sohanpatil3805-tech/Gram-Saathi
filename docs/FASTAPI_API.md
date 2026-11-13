# Gram Saathi FastAPI API

## Install dependencies
From the project root in PowerShell:

```powershell
py -m pip install -r requirements-api.txt
```

## Start the server

```powershell
py -m uvicorn backend.main:app --reload
```

Open:
- Health: http://127.0.0.1:8000/health
- Interactive API docs: http://127.0.0.1:8000/docs

## Endpoints

### `GET /health`
Returns service health.

### `GET /api/schemes`
Returns the scheme catalogue. Optional query parameters: `beneficiary_group`, `state`.

Example:
`GET /api/schemes?beneficiary_group=farmers&state=Karnataka`

### `GET /api/schemes/{scheme_id}`
Returns one scheme or HTTP 404.

### `POST /api/schemes/discover`
Request:
```json
{
  "beneficiary_group": "farmers",
  "state": "Karnataka",
  "language": "en",
  "applicant_facts": {}
}
```

### `POST /api/eligibility/check`
Request:
```json
{
  "scheme_id": "PM_KISAN",
  "applicant_facts": {}
}
```

Eligibility is preliminary guidance only. If structured rules are absent or unverified, the engine returns `manual_review`; it never infers eligibility from prose.

## Tests

```powershell
py -m unittest discover -s tests -p "test_api.py" -v
```

The tests use synthetic data and do not modify the real scheme database.

## Privacy note
Do not log applicant facts or uploaded document contents. Before production, add authentication, authorization, rate limiting, consent handling, request-size limits, secure deployment configuration, and a documented retention policy. Do not expose officer-only operations without backend-enforced role checks.
