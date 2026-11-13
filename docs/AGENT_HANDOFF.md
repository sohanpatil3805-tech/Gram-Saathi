# AGENT_HANDOFF.md — Cross-Agent Coordination

> **Primary Coordination Registry for Coding Agents**
> WhatsApp-First Platform Architecture (Revision 2.0)
> When you modify a shared interface (DB model, Pydantic schema, API route), update this file immediately.

---

## Shared Interface Registry

### Database Models (`backend/db/models.py`)

| Model | Status | Key Fields & Relationships |
|---|---|---|
| `Citizen` | ⬜ Ready | `id`, `phone_number` (indexed), `preferred_language`, `citizen_group`, `district`, `village` |
| `CitizenProfile` | ⬜ Ready | `citizen_id` (FK), `annual_income`, `land_holding_acres`, `has_bank_account` |
| `Scheme` | ⬜ Ready | `id`, `scheme_code`, `name_kn`, `name_hi`, `category`, `target_groups`, `benefit_amount` |
| `EligibilityCriteria` | ⬜ Ready | `scheme_id` (FK), `criterion_key`, `criterion_type`, `criterion_value`, `is_mandatory` |
| `DocumentType` | ⬜ Ready | `type_code`, `name_kn`, `name_hi`, `ocr_field_schema`, `is_identity_doc` |
| `SchemeDocumentRequirement`| ⬜ Ready | `scheme_id` (FK), `document_type_id` (FK), `is_mandatory`, `order_index`, `instruction_kn`, `instruction_hi` |
| `DocumentUpload` | ⬜ Ready | `citizen_id` (FK), `storage_uuid`, `file_hash`, `validation_status`, `ocr_extracted_fields` |
| `Application` | ⬜ Ready | `citizen_id` (FK), `scheme_id` (FK), `status`, `generated_pdf_storage_uuid`, `confirmation_token` |
| `ApplicationDocument` | ⬜ Ready | `application_id` (FK), `requirement_id` (FK), `document_upload_id` (FK), `status` |
| `ApplicationStatusHistory` | ⬜ Ready | `application_id` (FK), `old_status`, `new_status`, `changed_by_user_id`, `change_reason` |
| `Officer` | ⬜ Ready | `username`, `password_hash`, `role`, `jurisdiction_district`, `jurisdiction_village` |
| `ConversationSession` | ⬜ Ready | `phone_number` (indexed), `conversation_stage`, `active_scheme_id`, `active_application_id`, `awaiting_input_type` |
| `WhatsAppMessage` | ⬜ Ready | `citizen_id` (FK), `phone_number`, `direction`, `message_type`, `status` |
| `AuditLog` | ⬜ Ready | `citizen_id`, `tool_name`, `action`, `input_summary` (no PII), `result_code` |

---

### Pydantic Shared Schemas

```python
# Shared across API routers, services, and AI tools

class CitizenProfileInput(BaseModel):
    citizen_group: str
    annual_income: Optional[int] = None
    land_holding_acres: Optional[float] = None
    has_bank_account: Optional[bool] = None
    caste_category: Optional[str] = None

class DocumentRequirementItem(BaseModel):
    requirement_id: UUID
    document_type_code: str
    name: str
    is_mandatory: bool
    order_index: int
    instruction: str

class ApplicationPreviewSummary(BaseModel):
    application_id: UUID
    scheme_name: str
    applicant_name: Optional[str]
    village: Optional[str]
    benefit_description: str
    confirmation_token: str
    token_expires_at: datetime
    ttl_seconds: int = 300

class OfficerDecisionInput(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    official_order_number: Optional[str] = None
    rejection_reason: Optional[str] = None
    remarks: Optional[str] = None
```

---

### AI Tool Contract

All allowlisted tools must adhere to this structured return type:

```python
class ToolResult(TypedDict):
    success: bool
    data: Optional[dict]       # structured data payload
    error_code: Optional[str]  # e.g. "CRITERIA_UNMET", "DOCUMENT_BLURRY"
    message: str               # human-readable message for citizen
    is_simulated: bool         # always True in MVP
```

---

## Architectural Decision Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | SQLite with PostgreSQL migration path | Zero local DB dependencies; change `DATABASE_URL` for PostgreSQL | 2026-11-13 |
| 2 | WhatsApp is primary citizen interface | Solves digital literacy barrier; meets rural citizens where they already communicate | 2026-11-13 |
| 3 | Gemini as reasoning layer ONLY | Avoids hallucinations in eligibility and submission; deterministic rules enforce decisions | 2026-11-13 |
| 4 | Persistent conversation engine | WhatsApp users take days to find documents; state survives server restarts | 2026-11-13 |
| 5 | Dynamic document requirements | Schemes specify required documents; bot prompts only for missing ones | 2026-11-13 |
| 6 | Local pytesseract OCR | Zero external document leakage; runs completely locally with Pillow enhancement | 2026-11-13 |
| 7 | Application PDF generation | Provides a formal, printable government record for citizen preview and officer verification | 2026-11-13 |
| 8 | 5-minute single-use confirmation token | Consequential actions require explicit citizen consent; prevents accidental submissions | 2026-11-13 |
| 9 | Dual submission modes | Direct citizen filing (simulated portal) and assisted official submission (officer queue) | 2026-11-13 |
| 10 | Developer WhatsApp Simulator | Enables complete local end-to-end testing without Meta Cloud API credentials | 2026-11-13 |

---

## Known Implementation Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Low-quality mobile photos on WhatsApp** | Medium | Pillow pre-processing (contrast + deskew) + automated WhatsApp correction prompt |
| **Tesseract missing Kannada/Hindi packs** | Medium | Support English OCR as baseline for names/numbers; download `kan`/`hin` traineddata |
| **Meta WhatsApp webhook localhost exposure** | Low | Built-in WhatsApp Simulator tests identical backend code without external tunnels |
| **Gemini function calling token limits** | Low | Pass minimal structured contexts to Gemini; never send raw text dumps or document bytes |
| **ReportLab / PDF styling dependencies** | Low | Keep PDF template simple, standard A4 layout using basic ReportLab Canvas / Flowables |

---

*Last Updated: 2026-11-13 | AGENT_HANDOFF.md Revision 2.0*
