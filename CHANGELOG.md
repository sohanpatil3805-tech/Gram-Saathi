# CHANGELOG.md — Gram Saathi

All notable changes to this project are documented here.
Format: `[YYYY-MM-DD HH:MM IST] <category>: <description>`

---

## [2026-11-13 13:35 IST] — Architecture Revision 2.0 (WhatsApp-First Platform Update)

### Architectural Changes & Refinements
- **WhatsApp as Primary Citizen Interface**: Defined Gram Saathi not as a chatbot, but as an end-to-end service execution platform using WhatsApp as the primary citizen channel.
- **Ten Core Capabilities Defined**: (1) Scheme Discovery, (2) Eligibility Assessment, (3) Dynamic Document Requests, (4) WhatsApp Image/PDF Uploads, (5) OCR & Validation with Correction Prompts, (6) Application Preparation & PDF Generation, (7) Citizen Review & Confirmation, (8) Authorised / Assisted Submission, (9) Officer Review & Decision, (10) Multilingual Notifications.
- **Persistent Conversation Engine**: Upgraded `conversation_sessions` to support multi-day session persistence keyed by phone number, surviving server restarts and resuming users' active applications seamlessly.
- **Dynamic Document Requests & Validation**: Added `scheme_document_requirements`, document validation status (`PENDING`, `VALID`, `NEEDS_CORRECTION`), and automated WhatsApp correction prompts on blurry/unreadable images.
- **Official Application PDF Generation**: Integrated `pdf_service.py` to compile verified fields into official printable A4 summary PDFs stored privately in `storage/`.
- **Strict Separation of AI vs Deterministic Authority**: Enforced that Gemini is strictly the reasoning and NLU dialogue layer (in Kannada and Hindi) — deterministic backend services handle eligibility scoring, token verification, state transitions, and submission execution.
- **Dual Submission Flows**: Direct citizen filing (`SIM-` portal execution) vs Assisted official filing (routing to local Panchayat/Tehsil staff queue).
- **Officer Decision Portal**: Formal approval with registration order numbers or rejection with reasons, immediately triggering multilingual outbound WhatsApp notifications.
- **Aligned 9-Step Development Order**:
  1. Backend Foundation
  2. WhatsApp Integration
  3. Persistent Conversation Engine
  4. Gemini Orchestrator
  5. Scheme Discovery & Eligibility
  6. Document Upload & OCR
  7. Application Preparation & PDF
  8. Officer Dashboard
  9. Tracking & Notifications

### Updated Documentation Files
- `AGENTS.md` — Updated project directives, vision, file structure, and 9-step development order.
- `PRIVACY_SECURITY.md` — Clarified WhatsApp phone routing security and private storage of generated PDFs.
- `README.md` — Updated overview, capabilities, and quickstart for WhatsApp-first execution.
- `docs/ARCHITECTURE.md` — Upgraded system architecture, component flows, capability groups, and principles.
- `docs/DATABASE_SCHEMA.md` — Added `scheme_document_requirements`, `whatsapp_messages`, enhanced `document_uploads`, `applications`, and `conversation_sessions`.
- `docs/SERVICE_EXECUTION_ARCHITECTURE.md` — Detailed application FSM, conversation FSM, dynamic doc loop, PDF rendering, confirmation token protocol, and officer decisions.
- `docs/API_CONTRACTS.md` — Added required document endpoints, document validation/correction endpoints, PDF generation/stream endpoints, WhatsApp simulator APIs, and officer decision endpoints.
- `docs/PRIVACY_DATA_FLOW.md` — Updated WhatsApp media intake flow, OCR boundary, and strict Gemini privacy guarantees.
- `docs/DEVELOPMENT_STATUS.md` — Realigned roadmap to the 9 development phases with detailed acceptance criteria.
- `docs/AGENT_HANDOFF.md` — Updated shared model registry, Pydantic contracts, and decision log.

---

## [2026-11-13 13:10 IST] — Foundation Sprint 1.0

### Added
- Complete initial architecture, security policy, database schema, and project scaffolds.
