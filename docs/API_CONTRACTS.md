# Gram Saathi — API Contracts

> **Backend**: FastAPI (Python 3.11+, async)
> **Base URL**: `/api/v1`
> **Auth**: Bearer JWT in `Authorization: Bearer <token>` header (all endpoints except `/auth/*` and `/whatsapp/webhook`)
> **Content-Type**: `application/json` for all requests and responses
> **Version**: 2.0 (WhatsApp-First Platform Architecture)

---

## Standard Error Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of the error.",
    "details": {}
  }
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body, media type, or query params failed validation |
| 401 | `UNAUTHORIZED` | Missing, expired, or invalid JWT token |
| 403 | `FORBIDDEN` | Authenticated but insufficient permissions or jurisdiction mismatch |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Invalid state transition or duplicate action |
| 422 | `INVALID_CONFIRMATION_TOKEN` | Confirmation token expired (> 5 min) or already consumed |
| 422 | `UNPROCESSABLE_ENTITY` | Semantic validation failure |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit threshold exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Rate Limiting

| Endpoint Group | Limit | Window | Key |
|----------------|-------|--------|-----|
| `/auth/*` | 5 requests | 1 minute | Per IP |
| `/ai/chat` | 20 requests | 1 minute | Per `citizen_id` |
| `/documents/upload` | 10 requests | 10 minutes | Per `citizen_id` |
| `/whatsapp/webhook` | 100 requests | 1 minute | Per Meta Phone Number ID |
| All other endpoints | 60 requests | 1 minute | Per JWT subject |

---

## 1. Authentication

### POST `/auth/citizen/otp-request`
Request a simulated SMS OTP for phone number authentication.

**Request Body**:
```json
{
  "phone_number": "+919876543210"
}
```
**Response `200 OK`**:
```json
{
  "message": "OTP sent successfully to +919876543210.",
  "expires_in_seconds": 300,
  "is_simulated": true
}
```

---

### POST `/auth/citizen/otp-verify`
Verify citizen OTP and receive JWT.

**Request Body**:
```json
{
  "phone_number": "+919876543210",
  "otp": "123456"
}
```
**Response `200 OK`**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "citizen": {
    "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "phone_number": "+919876543210",
    "preferred_language": "kn",
    "citizen_group": "FARMER"
  }
}
```

---

### POST `/auth/officer/login`
Officer username and password login.

**Request Body**:
```json
{
  "username": "maddur_secretary",
  "password": "CorrectPassword123!"
}
```
**Response `200 OK`**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 28800,
  "officer": {
    "id": "9a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "username": "maddur_secretary",
    "full_name": "Suresh Gowda",
    "role": "PANCHAYAT_STAFF",
    "jurisdiction_district": "Mandya",
    "jurisdiction_village": "Maddur"
  }
}
```

---

## 2. Schemes & Eligibility

### GET `/schemes`
Search and filter welfare schemes. Multilingual support via `lang` query param.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | `AGRICULTURE`, `EDUCATION`, `WOMEN_WELFARE`, etc. |
| `target_group`| string | No | `FARMER`, `STUDENT`, `WOMAN_ENTREPRENEUR`, etc. |
| `lang` | string | No | `kn` (default), `hi`, or `en` |
| `search` | string | No | Search text in title/description |
| `page` | integer | No | Default `1` |
| `page_size` | integer | No | Default `10`, max `50` |

---

### GET `/schemes/{scheme_id}`
Retrieve full details, benefits, and eligibility criteria for a specific scheme.

---

### GET `/schemes/{scheme_id}/required-documents`
**Key Endpoint for Dynamic Document Requests**: Returns the list of mandatory and optional documents needed for this scheme, with localized WhatsApp instructions.

**Response `200 OK`**:
```json
{
  "scheme_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "scheme_code": "PM_KISAN_2024",
  "required_documents": [
    {
      "requirement_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "document_type_code": "AADHAAR",
      "name": "Aadhaar Card",
      "is_mandatory": true,
      "order_index": 1,
      "instructions": {
        "kn": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆಧಾರ್ ಕಾರ್ಡ್‌ನ ಸ್ಪಷ್ಟ ಫೋಟೋ ಕಳುಹಿಸಿ.",
        "hi": "कृपया अपने आधार कार्ड की साफ़ फ़ोटो भेजें।",
        "en": "Please send a clear photo of your Aadhaar card."
      }
    },
    {
      "requirement_id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
      "document_type_code": "LAND_RECORD",
      "name": "Land Record (Pahani / RTC)",
      "is_mandatory": true,
      "order_index": 2,
      "instructions": {
        "kn": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪಹಣಿ/ಆರ್‌ಟಿಸಿ (ಭೂ ದಾಖಲೆ) ಪ್ರತಿಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ಕಳುಹಿಸಿ.",
        "hi": "कृपया अपनी खतौनी/भूमि अभिलेख की साफ़ फ़ोटो भेजें।",
        "en": "Please send a clear photo of your Pahani/RTC."
      }
    }
  ]
}
```

---

### POST `/schemes/assess-eligibility`
Deterministic evaluation of citizen profile against scheme criteria.

**Request Body**:
```json
{
  "scheme_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "citizen_profile": {
    "citizen_group": "FARMER",
    "annual_income": 80000,
    "land_holding_acres": 1.5,
    "has_bank_account": true,
    "caste_category": "OBC"
  }
}
```

**Response `200 OK`**:
```json
{
  "eligible": true,
  "score": 100,
  "confidence": "HIGH",
  "matched_criteria": [
    {"criterion_key": "citizen_group", "citizen_value": "FARMER"},
    {"criterion_key": "land_holding_acres", "citizen_value": 1.5},
    {"criterion_key": "has_bank_account", "citizen_value": true}
  ],
  "unmet_criteria": [],
  "missing_data_fields": []
}
```

---

## 3. Documents & OCR Validation

### POST `/documents/upload`
Upload a document file (image or PDF). Stored with UUID filename in private `storage/`.

**Request**: `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | Document file (Max 5MB; `image/jpeg`, `image/png`, `application/pdf`) |
| `document_type_code`| string | Yes | `AADHAAR`, `LAND_RECORD`, `INCOME_CERT`, etc. |
| `application_id` | UUID | No | Application to attach document to |

**Response `201 Created`**:
```json
{
  "document_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "document_type": "AADHAAR",
  "ocr_status": "PENDING",
  "validation_status": "PENDING",
  "message": "Document uploaded successfully. Local OCR processing initiated."
}
```

---

### POST `/documents/{document_id}/validate`
Trigger OCR extraction and deterministic validation against scheme rules.

**Response `200 OK`**:
```json
{
  "document_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "ocr_status": "DONE",
  "validation_status": "VALID",
  "confidence_score": 88,
  "extracted_fields": {
    "name": "Ramu Nayak",
    "masked_aadhaar": "XXXX-XXXX-8912",
    "yob": 1982
  },
  "is_verified": true
}
```

---

### POST `/documents/{document_id}/request-correction`
Mark document upload as invalid/blurry and trigger proactive WhatsApp re-upload prompt.

**Request Body**:
```json
{
  "reason": "BLURRY_IMAGE",
  "notes": "Photo is blurry and survey number is not legible.",
  "language": "kn"
}
```
**Response `200 OK`**:
```json
{
  "document_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "validation_status": "NEEDS_CORRECTION",
  "notification_dispatched": true,
  "message": "Correction request sent to citizen via WhatsApp."
}
```

---

## 4. Application Lifecycle & PDF Generation

### POST `/applications/draft`
Initialize a new draft application.

**Request Body**:
```json
{
  "scheme_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "submission_mode": "DIRECT_CITIZEN"
}
```

---

### POST `/applications/{application_id}/generate-pdf`
Compile application data and render an official-format printable PDF in private `storage/`.

**Response `200 OK`**:
```json
{
  "application_id": "1fa1a2b3-1234-5678-abcd-ef0123456789",
  "pdf_generated": true,
  "pdf_generated_at": "2024-11-13T07:45:00Z",
  "download_url": "/api/v1/applications/1fa1a2b3-1234-5678-abcd-ef0123456789/pdf",
  "message": "Official application summary PDF generated successfully."
}
```

---

### GET `/applications/{application_id}/pdf`
Stream the rendered application PDF.

**Auth required**: Citizen JWT (owner) or Officer JWT (jurisdiction).
**Response**: `Content-Type: application/pdf` with inline or attachment disposition.

---

### POST `/applications/{application_id}/preview`
Generate preview summary and issue a **5-minute single-use confirmation token**.

**Response `200 OK`**:
```json
{
  "application_id": "1fa1a2b3-1234-5678-abcd-ef0123456789",
  "scheme_name": "PM Kisan Samman Nidhi",
  "preview_summary": {
    "applicant_name": "Ramu Nayak",
    "village": "Maddur",
    "land_acres": 1.5,
    "benefit": "₹6,000 / year"
  },
  "confirmation_token": "k9F3...xR2a90",
  "token_expires_at": "2024-11-13T07:50:00Z",
  "ttl_seconds": 300
}
```

---

### POST `/applications/{application_id}/submit`
Consequential application submission. Validates single-use confirmation token.

**Request Body**:
```json
{
  "confirmation_token": "k9F3...xR2a90"
}
```

**Response `200 OK`**:
```json
{
  "application_id": "1fa1a2b3-1234-5678-abcd-ef0123456789",
  "status": "SUBMITTED",
  "submission_reference": "SIM-2024-00042",
  "submitted_at": "2024-11-13T07:48:00Z",
  "is_simulated": true,
  "message": "Application submitted successfully! Reference: SIM-2024-00042"
}
```

**Response `422 Unprocessable Entity` (Token Expired or Invalid)**:
```json
{
  "error": {
    "code": "INVALID_CONFIRMATION_TOKEN",
    "message": "The confirmation token is invalid, expired (> 5 min), or already consumed.",
    "details": {"token_expired": true}
  }
}
```

---

## 5. WhatsApp Webhook & Local Simulator

### GET `/whatsapp/webhook`
Meta Webhook Verification Challenge.
Responds with `hub.challenge` when `hub.verify_token` matches configured secret.

---

### POST `/whatsapp/webhook`
Primary citizen intake endpoint for Meta WhatsApp Cloud API.
Validates `X-Hub-Signature-256` HMAC-SHA256 header.

Supports:
1. **Text messages** (`type="text"`)
2. **Media messages** (`type="image"`, `type="document"` with `media_id`)
3. **Interactive button replies** (`type="interactive"`, `button_reply.id`)
4. **List replies** (`type="interactive"`, `list_reply.id`)

**Response `200 OK`**:
```json
{"status": "EVENT_RECEIVED"}
```

---

### POST `/whatsapp/simulator/message`
**Developer Simulator Endpoint**: Allows testing full WhatsApp flows locally without Meta credentials.

**Request Body**:
```json
{
  "from_phone": "+919876543210",
  "message_type": "TEXT",
  "text_body": "ನಮಸ್ಕಾರ, ನನಗೆ ರೈತರ ಯೋಜನೆಗಳ ಮಾಹಿತಿ ಬೇಕು",
  "media_url": null
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "bot_replies": [
    {
      "type": "text",
      "body": "ನಮಸ್ಕಾರ! ನೀವು ರೈತರಿಗಾಗಿ ಇರುವ ಪಿಎಂ ಕಿಸಾನ್ ಮತ್ತು ಬೆಳೆ ವಿಮೆ ಯೋಜನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಬಹುದು."
    }
  ],
  "session_stage": "DISCOVERY"
}
```

---

### GET `/whatsapp/simulator/history/{phone_number}`
Retrieve dialogue history for the WhatsApp Simulator UI panel.

---

## 6. Officer Portal & Decision Endpoints

### GET `/officer/applications`
Jurisdiction-filtered list of applications.

**Auth required**: Officer JWT (`PANCHAYAT_STAFF`, `TEHSIL_STAFF`, `ADMIN`).

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | `SUBMITTED`, `OFFICER_REVIEW`, `APPROVED`, etc. |
| `village` | string | No | Filter within officer's jurisdiction |
| `page` | integer | No | Default `1` |
| `page_size` | integer | No | Default `20` |

---

### GET `/officer/applications/{application_id}`
Retrieve full application detail, attached documents, and status timeline.

---

### GET `/officer/applications/{application_id}/document/{document_id}`
Stream document photo/PDF securely for officer verification. Validates jurisdiction.

---

### POST `/officer/applications/{application_id}/decision`
Record official government approval or rejection.

**Auth required**: `TEHSIL_STAFF` or `ADMIN` (or `PANCHAYAT_STAFF` for local recommendations).

**Request Body (Approval)**:
```json
{
  "decision": "APPROVE",
  "official_order_number": "KA-MND-AGR-2024-9912",
  "remarks": "Land holding verified in Bhoomi portal. Approved for PM-KISAN."
}
```

**Request Body (Rejection)**:
```json
{
  "decision": "REJECT",
  "rejection_reason": "Land holding exceeds 2 acres threshold.",
  "remarks": "Survey number 45/2 indicates 3.2 acres owned."
}
```

**Response `200 OK`**:
```json
{
  "application_id": "1fa1a2b3-1234-5678-abcd-ef0123456789",
  "status": "APPROVED",
  "official_order_number": "KA-MND-AGR-2024-9912",
  "notification_sent": true,
  "message": "Decision recorded and citizen notified via WhatsApp."
}
```

---

### POST `/officer/applications/{application_id}/assisted-submit`
Officer executes assisted submission on behalf of citizen after field verification.

---

## 7. Multilingual Outbound Notifications

### POST `/applications/{application_id}/notify`
Trigger an outbound WhatsApp template notification on status changes.

**Request Body**:
```json
{
  "notification_type": "STATUS_UPDATE",
  "language": "kn"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "recipient_phone": "+919876543210",
  "message_id": "wamid.NOTIF_123456",
  "is_simulated": true
}
```

---

*Last Updated: 2026-11-13 | API Contracts Revision 2.0 (WhatsApp-First)*
