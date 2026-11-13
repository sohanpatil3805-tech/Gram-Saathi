# Gram Saathi — Frontend (Citizen PWA & Officer Dashboard)

This directory contains the unified React + TypeScript frontend for **Gram Saathi**, delivering two distinct, synchronized interfaces:

1. **Citizen Chatbot PWA (Mobile-first)** — WhatsApp-like citizen interface with Kannada and Hindi support, dynamic scheme discovery, interactive eligibility assessment, local OCR document verification, and 5-minute single-use consequential confirmation tokens.
2. **Officer Management Dashboard (Desktop-first)** — Professional government administration portal for Panchayat, Tehsil, and State Administrative Officers to review applications, inspect side-by-side OCR extractions, issue official orders, or request corrections.

---

## 🚀 Quick Start

### 1. Installation
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:5173`.

### 3. Run Unit Tests (Vitest)
```bash
npm test
```

### 4. Production Build & PWA Generation
```bash
npm run build
npm run preview
```

---

## 📱 Routes & Interfaces

### 1. Citizen Interface (`/`)
- Mobile-first, responsive, accessible conversational PWA.
- **Languages**: Complete Kannada (ಕನ್ನಡ) & Hindi (हिंदी) dictionary switcher.
- **View Modes**: Toggle between clean Web App view and WhatsApp Simulator chat UI.
- **Key Capabilities**:
  - Scheme recommendations for Farmers, Students, Women Entrepreneurs, and Wage Workers.
  - Interactive deterministic eligibility questionnaire with instant score & criteria match.
  - Camera & document upload simulation with local Tesseract OCR scanning animation.
  - Masked Aadhaar extraction (`XXXX-XXXX-8912`) and land record (RTC/Pahani) verification.
  - Blurry/unreadable document detection with proactive correction loops.
  - Consequential 5-minute single-use countdown confirmation token timer.
  - Printable official application summary PDF generator (`Form GS-A1`).
  - Application status tracker by reference (`SIM-2024-XXXXX`).

### 2. Officer Dashboard (`/officer/*`)
- Desktop-first, government-grade administration portal.
- **`/officer/login`**: Quick-access one-click role selector for demonstration.
- **`/officer/dashboard`**: Statistics KPI cards, scheme distribution charts, jurisdiction load, and SLA metrics.
- **`/officer/applications`**: Searchable, filterable queue by status, village, or keyword with pagination.
- **`/officer/applications/:id`**: Deep review screen with:
  - Applicant profile & claimed details.
  - Side-by-side local OCR comparison panel with discrepancy flags.
  - Official decision actions (Approve with official order number, Reject with reason, Request correction via WhatsApp).
  - Complete immutable audit trail.
  - Official printable summary PDF viewer with government seals.
- **`/officer/reports`**: Village and scheme disbursement analytics with simulated CSV and PDF export.

---

## 👥 Demo Personas & Roles

| Persona | Role / Group | Language | Default Jurisdiction / Scheme |
|---|---|---|---|
| **Ramu Nayak** | Farmer (Citizen) | Kannada (ಕನ್ನಡ) | Maddur, Mandya • PM-KISAN & Raitha Siri |
| **Priya Sharma** | Student (Citizen) | Hindi (हिंदी) | Koppa, Mandya • NSP Post-Matric Scholarship |
| **Suresh Gowda** | Panchayat Officer (PDO) | Kannada | Maddur Gram Panchayat (Local verification) |
| **Ramesh Patil** | Tahsildar (Tehsil Staff) | Kannada | Maddur Taluk (Formal approval order issuance) |
| **Dr. Anita Rao, IAS** | District Administrator | English/Kannada | Mandya District / State Oversight |

---

## 🔒 Privacy & Security Implementation

1. **Aadhaar Data Minimization**: Full 12-digit numbers are never handled or displayed; only masked format (`XXXX-XXXX-8912`) is extracted and stored.
2. **Bank Details Protection**: No bank account numbers or IFSC codes are collected; boolean verification (`has_bank_account: true`) is used.
3. **Local OCR Guarantee**: Raw images are processed via local pytesseract/Pillow pipelines and never sent to external LLMs.
4. **Single-Use Confirmation Tokens**: Consequential submissions require a valid, 5-minute countdown token before generating a `SIM-` reference.
5. **Private Storage Isolation**: File access requires authenticated jurisdiction scopes.

---

## 🔌 Backend Integration Status

The frontend includes a typed API service layer (`src/services/api.ts`) pointing to `VITE_API_BASE_URL` (`/api/v1`).
- When the FastAPI backend is running, live endpoints are invoked.
- When the backend is offline, the comprehensive in-memory mock service (`src/services/mockService.ts`) seamlessly activates so hackathon demonstrations run without interruption.
