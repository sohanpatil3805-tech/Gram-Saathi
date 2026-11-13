# DEVELOPMENT_STATUS.md — Gram Saathi

> **Live Task Tracker — WhatsApp-First Service Execution Platform**
> Target: 18-Hour Hackathon MVP
> Updated: 2026-11-13 13:30 IST

---

## Overall Architecture Progress

```
Documentation Foundation      ████████████████████  100% Complete (Revision 2.0)
1. Backend Foundation         ░░░░░░░░░░░░░░░░░░░░  Ready for Agent 1
2. WhatsApp Integration       ░░░░░░░░░░░░░░░░░░░░  Pending
3. Persistent Conversation    ░░░░░░░░░░░░░░░░░░░░  Pending
4. Gemini Orchestrator        ░░░░░░░░░░░░░░░░░░░░  Pending
5. Scheme Discovery & Elig.   ░░░░░░░░░░░░░░░░░░░░  Pending
6. Document Upload & OCR      ░░░░░░░░░░░░░░░░░░░░  Pending
7. Application Prep & PDF     ░░░░░░░░░░░░░░░░░░░░  Pending
8. Officer Dashboard          ░░░░░░░░░░░░░░░░░░░░  Pending
9. Tracking & Notifications   ░░░░░░░░░░░░░░░░░░░░  Pending
```

---

## 9-Step Development Plan

### Step 1: Backend Foundation (Hours 0–2)
Establish database models, config, async session, authentication, and seed data.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Pydantic settings | `backend/config.py` | P0 | ⬜ Ready | — | Read all secrets from `.env` |
| SQLAlchemy models (14 models) | `backend/db/models.py` | P0 | ⬜ Ready | — | See `docs/DATABASE_SCHEMA.md` v2.0 |
| DB session factory | `backend/db/session.py` | P0 | ⬜ Ready | — | Async aiosqlite; WAL mode |
| Seed data | `backend/db/seed.py` | P0 | ⬜ Ready | — | 5 schemes, criteria, requirements, Ramu + Priya |
| FastAPI app entrypoint | `backend/main.py` | P0 | ⬜ Ready | — | CORS, error handlers, router mounting |
| JWT handler & password hashing | `backend/auth/jwt_handler.py` | P0 | ⬜ Ready | — | HS256; citizen 1h, officer 8h |
| RBAC dependency | `backend/auth/rbac.py` | P0 | ⬜ Ready | — | Citizen vs Officer roles |
| Requirements file | `backend/requirements.txt` | P0 | ⬜ Ready | — | fastapi, uvicorn, sqlalchemy, aiosqlite, google-genai, etc. |

**Acceptance Criteria**: `uvicorn main:app --reload` boots cleanly, `/docs` loads, and `seed.py` seeds 14 tables.

---

### Step 2: WhatsApp Integration (Hours 2–4)
Implement the Meta WhatsApp Cloud API client, webhook signature verification, and the developer simulator.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| WhatsApp client abstraction | `backend/services/whatsapp_service.py` | P0 | ⬜ Queued | — | Sends text, buttons, and media; simulator fallback |
| Meta Webhook handler | `backend/api/v1/whatsapp.py` | P0 | ⬜ Queued | — | `hub.challenge` verification + HMAC-SHA256 signature check |
| Developer WhatsApp Simulator API | `backend/api/v1/whatsapp_sim.py` | P0 | ⬜ Queued | — | Emulates citizen incoming messages/media without Meta token |
| WhatsApp media intake | `backend/services/whatsapp_service.py` | P0 | ⬜ Queued | — | Downloads image/PDF bytes directly to `storage/` |

**Acceptance Criteria**: Webhook validates Meta signature; simulator endpoint can send and receive simulated WhatsApp messages.

---

### Step 3: Persistent Conversation Engine (Hours 4–6)
Implement database-backed session state machine that persists across server restarts and multi-day pauses.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Conversation service | `backend/services/conversation_service.py` | P0 | ⬜ Queued | — | State machine: GREETING to SUBMITTED_TRACKING |
| Phone number session lookup | `backend/services/conversation_service.py` | P0 | ⬜ Queued | — | 30-day multi-day persistence in `conversation_sessions` |
| Resumption prompt generator | `backend/services/conversation_service.py` | P0 | ⬜ Queued | — | Welcomes returning citizen and resumes pending step |

**Acceptance Criteria**: Sending a message from phone `919876543210` creates session; sending message after server restart continues exactly where left off.

---

### Step 4: Gemini Orchestrator (Hours 6–8)
Implement the central AI reasoning layer with strictly allowlisted tool calling and multilingual templates.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Tool registry | `backend/ai/tool_registry.py` | P0 | ⬜ Queued | — | Static allowlist; `ToolNotAllowedError` guard |
| Multilingual prompt templates | `backend/ai/prompt_templates.py` | P0 | ⬜ Queued | — | Empathetic Kannada & Hindi system prompts |
| Central Gemini orchestrator | `backend/ai/orchestrator.py` | P0 | ⬜ Queued | — | `google-genai` SDK; handles reasoning and tool dispatch |

**Acceptance Criteria**: Orchestrator responds in Kannada/Hindi to citizen questions and invokes allowlisted tools without hallucinating.

---

### Step 5: Scheme Discovery & Eligibility (Hours 8–10)
Connect schemes database and deterministic eligibility engine to the orchestrator.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Scheme tools | `backend/ai/tools/scheme_tools.py` | P0 | ⬜ Queued | — | `search_schemes`, `get_scheme_details` |
| Deterministic eligibility engine | `backend/ai/tools/eligibility_tools.py` | P0 | ⬜ Queued | — | Rule evaluator for income, land, caste (NOT AI guesses) |
| Scheme API router | `backend/api/v1/schemes.py` | P0 | ⬜ Queued | — | REST routes for schemes & criteria |

**Acceptance Criteria**: Ramu (farmer, 1.5 acres) evaluated as eligible for PM-KISAN with 100% confidence.

---

### Step 6: Document Upload & OCR (Hours 10–12)
Implement dynamic requirement requests, WhatsApp photo ingestion, local pytesseract OCR, and the correction loop.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Storage service | `backend/services/storage_service.py` | P0 | ⬜ Queued | — | UUID filenames in `storage/`; no public URLs |
| Local OCR engine | `backend/services/ocr_service.py` | P0 | ⬜ Queued | — | pytesseract + Pillow pre-processing (deskew, contrast) |
| Dynamic requirement manager | `backend/services/document_service.py` | P0 | ⬜ Queued | — | Determines missing docs from `scheme_document_requirements` |
| Document validation & correction | `backend/services/document_service.py` | P0 | ⬜ Queued | — | Low confidence (< 60%) sends WhatsApp correction prompt |

**Acceptance Criteria**: Uploading Aadhaar or land photo via WhatsApp extracts fields locally; blurry test image triggers WhatsApp correction prompt.

---

### Step 7: Application Preparation & PDF Generation (Hours 12–14)
Assemble verified fields, generate official printable PDF, deliver preview, and enforce 5-minute confirmation token.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Application service | `backend/services/application_service.py` | P0 | ⬜ Queued | — | Draft compiler and state machine transitions |
| PDF generation service | `backend/services/pdf_service.py` | P0 | ⬜ Queued | — | Renders official A4 application summary PDF |
| Citizen confirmation gateway | `backend/services/application_service.py` | P0 | ⬜ Queued | — | 32-byte single-use token; 5-min TTL; interactive confirm |
| Simulated submission execution | `backend/ai/tools/execution_tools.py` | P0 | ⬜ Queued | — | Issues `SIM-2024-XXXXXX` reference upon token verification |

**Acceptance Criteria**: PDF rendered in `storage/`; token expires in 5 minutes; confirmed submission issues `SIM-` reference.

---

### Step 8: Officer Dashboard (Hours 14–16)
Implement the role-protected web portal for Panchayat and Tehsil staff.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Officer API router | `backend/api/v1/officers.py` | P0 | ⬜ Queued | — | Jurisdiction-filtered queue, document stream, decisions |
| Officer frontend scaffold | `frontend/src/` | P0 | ⬜ Queued | — | React 18 + Vite + Tailwind CSS |
| Officer dashboard & queue | `frontend/src/pages/officer/` | P0 | ⬜ Queued | — | List view, application inspection, PDF preview |
| WhatsApp Simulator UI | `frontend/src/components/shared/WASimulator.tsx` | P0 | ⬜ Queued | — | Interactive phone UI for live demo |

**Acceptance Criteria**: Officer logs in, sees Ramu's application in Mandya jurisdiction, reviews PDF, clicks Approve, records order number.

---

### Step 9: Tracking & Multilingual Notifications (Hours 16–18)
Implement proactive WhatsApp alerts on status updates and tracking inquiries.

| Task | File | Priority | Status | Agent | Notes |
|---|---|---|---|---|---|
| Notification service | `backend/services/notification_service.py` | P0 | ⬜ Queued | — | Dispatches Kannada & Hindi WhatsApp templates on decisions |
| Tracking tools | `backend/ai/tools/tracking_tools.py` | P0 | ⬜ Queued | — | Citizen sends "Status" on WhatsApp -> gets live status |
| End-to-end demo polish | All components | P0 | ⬜ Queued | — | Full demo walk-through: Ramu (Kannada) + Priya (Hindi) |

**Acceptance Criteria**: When officer approves application, citizen receives instant WhatsApp notification in Kannada with order number.

---

*Last Updated: 2026-11-13 13:30 IST*
