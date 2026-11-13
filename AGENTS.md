# AGENTS.md — Gram Saathi Coding Agent Instructions

> **This file is the primary directive for all AI coding agents working on this project.**
> Read it completely before writing any code. Rules here are non-negotiable.

---

## 0. Project Context & Vision

**Gram Saathi** is an AI-powered rural government service execution platform for India.

> [!IMPORTANT]
> **Gram Saathi is NOT an ordinary conversational AI chatbot.**
> **WhatsApp is the primary citizen interface for a complete, end-to-end government-service execution platform.**

The platform delivers 10 complete service capabilities:
1. **Scheme discovery and recommendation**
2. **Eligibility assessment**
3. **Dynamic document requests**
4. **WhatsApp image and PDF uploads**
5. **OCR and document validation (with automated correction prompts)**
6. **Application preparation and official PDF generation**
7. **Citizen review and confirmation (5-minute single-use token)**
8. **Authorised direct submission or assisted official submission**
9. **Officer review and decision (via role-protected web portal)**
10. **Application tracking and multilingual notifications**

Target groups: Farmers, Students, Women Entrepreneurs/SHGs, Home/Wage Workers, Panchayat Staff, Tehsil Staff.
Languages: **Kannada (ಕನ್ನಡ)** and **Hindi (हिंदी)**.
**Hackathon deadline: 18 hours.** The codebase must be runnable, demonstrable, and correct.

---

## 1. Tech Stack (Do Not Deviate)

| Layer | Technology |
|---|---|
| Primary Citizen Channel | WhatsApp (Meta WhatsApp Cloud API with Web Simulator fallback) |
| Officer Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Central Backend | Python 3.11+, FastAPI, SQLAlchemy (async), Pydantic v2 |
| Database | SQLite (MVP) via aiosqlite — `DATABASE_URL` controls dialect (PostgreSQL ready) |
| AI Reasoning & Dialogue | Gemini API (`google-genai` SDK) with controlled allowlisted function calling |
| Local OCR & Imaging | pytesseract (local binary) with Pillow pre-processing |
| PDF Generation | ReportLab / HTML template to PDF |
| Migrations | Alembic |
| Auth & RBAC | python-jose for JWT, passlib[bcrypt] for passwords |
| Testing | pytest + pytest-asyncio (backend), Vitest (frontend) |

---

## 2. Mandatory File Structure

```
Gram Saathi/
├── AGENTS.md                    ← this file
├── PRIVACY_SECURITY.md
├── README.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── api/v1/
│   │   ├── citizens.py
│   │   ├── schemes.py
│   │   ├── applications.py
│   │   ├── documents.py
│   │   ├── officers.py
│   │   ├── whatsapp.py          ← Meta Cloud API webhook
│   │   └── whatsapp_sim.py      ← Dev simulator endpoints
│   ├── ai/
│   │   ├── orchestrator.py      ← Central Gemini orchestrator (Reasoning ONLY)
│   │   ├── tool_registry.py     ← Allowlist registration & enforcement
│   │   ├── prompt_templates.py  ← Multilingual prompts (Kannada/Hindi)
│   │   └── tools/
│   │       ├── scheme_tools.py
│   │       ├── eligibility_tools.py
│   │       ├── document_tools.py
│   │       ├── application_tools.py
│   │       ├── execution_tools.py
│   │       └── tracking_tools.py
│   ├── services/
│   │   ├── conversation_service.py ← Persistent multi-day conversation engine
│   │   ├── whatsapp_service.py     ← Meta Cloud API client + media downloader
│   │   ├── ocr_service.py          ← Local pytesseract OCR
│   │   ├── document_service.py     ← Dynamic requirement & validation logic
│   │   ├── pdf_service.py          ← Official application PDF generator
│   │   ├── storage_service.py      ← Private UUID disk storage
│   │   ├── notification_service.py ← Outbound WhatsApp alerts
│   │   └── speech_service.py       ← BHASHINI abstraction stub
│   ├── db/
│   │   ├── models.py               ← SQLAlchemy models
│   │   ├── session.py              ← DB async session factory
│   │   └── seed.py                 ← Synthetic demo data (Ramu + Priya)
│   ├── auth/
│   │   ├── jwt_handler.py
│   │   └── rbac.py
│   └── middleware/
│       ├── audit_logger.py
│       └── rate_limiter.py
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/officer/           ← Officer portal screens
│       ├── components/shared/
│       │   └── WASimulator.tsx      ← WhatsApp Simulator Panel for local dev
│       ├── components/officer/
│       ├── services/api.ts
│       ├── store/
│       └── i18n/
│           ├── kn.json
│           └── hi.json
├── database/
│   └── alembic/
├── storage/                         ← Private document files (gitignored)
├── tests/
└── docs/
```

---

## 3. Security Rules (Absolute — Never Violate)

1. **Secrets**: Read all secrets from environment variables via `config.py`. Never commit `.env`.
2. **Aadhaar**: Never store full 12-digit Aadhaar. Store masked last-4 (`XXXX-XXXX-1234`) or SHA-256 hash. **Never send Aadhaar to Gemini API**.
3. **Bank Details**: Never store bank account numbers or IFSC codes. Use boolean `has_bank_account` only.
4. **Document Storage**: Store uploads and generated PDFs in private `storage/` with UUID filenames. **Never expose via public URLs**.
5. **Local OCR**: Run OCR locally via pytesseract. **Never send raw document bytes or raw images to Gemini API**.
6. **Gemini Scope**: Gemini is strictly the **reasoning and orchestration layer**, NOT the database, NOT the eligibility engine, and NOT the submission authority.
7. **Consequential Submissions**: Require a valid, single-use, 5-minute confirmation token before executing or routing any submission.
8. **Official Decisions**: Formal Approval or Rejection belongs exclusively to authorised officers via the web dashboard.
9. **Simulations**: Prefix all simulated references with `SIM-` and log `[SIMULATED]`.

---

## 4. AI Orchestrator Pattern

The orchestrator in `backend/ai/orchestrator.py` follows this strict pattern:

```python
async def run_orchestrator(session_context: OrchestratorContext) -> OrchestratorResponse:
    # 1. Fetch only registered allowlist declarations
    tools = tool_registry.get_declarations()
    
    # 2. Call Gemini for NLU, language translation, and tool selection
    response = await gemini_client.generate(
        prompt=build_prompt(session_context),
        tools=tools,
        tool_config={"mode": "AUTO"}
    )
    
    # 3. Backend executes tool deterministically
    if response.has_tool_call:
        tool_name = response.tool_call.name
        tool_fn = tool_registry.get_tool(tool_name)  # raises ToolNotAllowedError if not found
        result = await tool_fn(**response.tool_call.args)
        # Feed structured result back to orchestrator
        
    return OrchestratorResponse(reply=response.text, ...)
```

---

## 5. Explicit 9-Step Development Order

Build in this exact sequence to ensure an end-to-end demonstrable platform within the 18-hour hackathon window:

### Step 1: Backend Foundation
- `backend/config.py` — Pydantic settings from env vars
- `backend/db/models.py` — 14 SQLAlchemy models (see `DATABASE_SCHEMA.md`)
- `backend/db/session.py` — async session factory (SQLite WAL mode)
- `backend/db/seed.py` — synthetic demo data (5 schemes, criteria, requirements, Ramu + Priya)
- `backend/main.py` — FastAPI app with CORS and router registration
- `backend/auth/jwt_handler.py` + `rbac.py`
- `backend/requirements.txt`

### Step 2: WhatsApp Integration
- `backend/services/whatsapp_service.py` — Meta WhatsApp Cloud API provider abstraction
- `backend/api/v1/whatsapp.py` — Webhook handler with `X-Hub-Signature-256` HMAC validation
- `backend/api/v1/whatsapp_sim.py` — Local developer simulator endpoints
- WhatsApp media download pipeline directly to `storage/`

### Step 3: Persistent Conversation Engine
- `backend/services/conversation_service.py` — Multi-day session recovery by phone number
- State machine tracking `GREETING`, `DISCOVERY`, `ELIGIBILITY`, `DOC_COLLECTION`, `APPLICATION_REVIEW`, `CONFIRMATION_PENDING`, `SUBMITTED_TRACKING`
- 30-day session persistence in `conversation_sessions` table

### Step 4: Gemini Orchestrator
- `backend/ai/tool_registry.py` — Strict tool allowlist enforcement
- `backend/ai/prompt_templates.py` — Kannada and Hindi prompt templates
- `backend/ai/orchestrator.py` — Gemini 2.0 Flash integration with tool calling
- `backend/ai/tools/` — 6 allowlisted capability tool modules

### Step 5: Scheme Discovery & Eligibility
- `backend/ai/tools/scheme_tools.py` — Scheme search, category listing, multilingual details
- `backend/ai/tools/eligibility_tools.py` — Deterministic criteria evaluation against DB rules
- `backend/api/v1/schemes.py` — Scheme API endpoints

### Step 6: Document Upload & OCR
- `backend/services/storage_service.py` — Private UUID file storage
- `backend/services/ocr_service.py` — Local pytesseract + Pillow processing
- `backend/services/document_service.py` — Dynamic requirement matching & validation
- Automated correction loop: proactive WhatsApp prompt on blurry/unreadable docs

### Step 7: Application Preparation
- `backend/services/application_service.py` — Application compilation & draft management
- `backend/services/pdf_service.py` — Printable official application summary PDF generator
- Citizen confirmation gateway: 5-minute single-use token issuance & validation
- Direct filing (`SIM-` reference) vs Assisted official routing

### Step 8: Officer Dashboard
- Frontend: React + TypeScript + Vite + Tailwind CSS scaffold
- Officer login with role-based jurisdiction scoping
- Application review queue, OCR verification view, and PDF preview
- Officer decision endpoints: Approve (with order number) / Reject (with reason)

### Step 9: Tracking & Notifications
- `backend/services/notification_service.py` — Proactive WhatsApp template notifications
- Multilingual status updates on approval/rejection/correction needed
- Status inquiry handling via WhatsApp ("Status" message)

---

## 6. Demo Personas (Synthetic Data Only)

| Persona | Group | Language | Scheme Target | Channel |
|---|---|---|---|---|
| **Ramu Nayak** | Farmer | Kannada (ಕನ್ನಡ) | PM-KISAN (Synthetic) | WhatsApp |
| **Priya Sharma** | Student | Hindi (हिंदी) | NSP Scholarship (Synthetic) | WhatsApp |

Enable demo data with `DEMO_MODE=true` in `.env`.

---

## 7. Running the Project

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env
python db/seed.py
uvicorn main:app --reload --port 8000

# Frontend (Officer Dashboard + WhatsApp Simulator)
cd frontend
npm install
npm run dev
```

---

*Last Updated: 2026-11-13 | AGENTS.md Revision 2.0 (WhatsApp-First)*
