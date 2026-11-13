# Gram Saathi chat API patch

Apply the included `backend/api/routes.py` over your current file after making a backup.
Copy `tests/test_chat_api.py` into your project's `tests` folder.

Run: `py -m pytest tests/test_api.py tests/test_chat_api.py -q`

Example POST `/api/chat`:
```json
{"message":"What schemes can help me?","beneficiary_group":"farmers","state":"Karnataka","language":"en"}
```

The chat route uses the configured provider unless a provider is injected for tests.
It does not silently replace a failed live Gemini call with a mock answer.
