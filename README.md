# Gram Saathi — Village Companion (ಗ್ರಾಮ ಸಾಥಿ / ग्राम साथी)

> **AI-Powered Rural Government Service Execution Platform**
> WhatsApp-First Architecture | 18-Hour Hackathon Build

---

## What Is Gram Saathi?

**Gram Saathi is NOT an ordinary conversational chatbot.**
It is an end-to-end **government service execution platform** that uses **WhatsApp** as the primary citizen channel to bridge the rural digital divide in India.

Supported in **Kannada (ಕನ್ನಡ)** and **Hindi (हिंदी)**:
1. **Scheme Discovery & Recommendation**: Intelligent, personalized matching for rural citizens.
2. **Eligibility Assessment**: Deterministic rule evaluation (not AI guesses) against land, income, and demographic criteria.
3. **Dynamic Document Requests**: Identifies exactly what documents are needed and prompts for them sequentially on WhatsApp.
4. **WhatsApp Image & PDF Uploads**: Citizens upload photos of documents (RTC, Aadhaar, marksheet) directly in chat.
5. **OCR & Document Validation**: Runs local OCR to extract structured data and triggers automated WhatsApp correction prompts if photos are blurry.
6. **Application Preparation & PDF Generation**: Compiles verified fields and renders an official printable A4 application summary PDF.
7. **Citizen Review & Confirmation**: Sends preview card and requires explicit consent via a **5-minute single-use confirmation token**.
8. **Authorised & Assisted Submission**: Executes direct simulated portal submission or routes to Panchayat/Tehsil staff queue.
9. **Officer Review & Decision**: Dedicated role-protected web portal for Panchayat and Tehsil officers to verify documents and formally record decisions.
10. **Application Tracking & Notifications**: Proactive multilingual WhatsApp template alerts on status changes.

---

## Target Citizen Groups

| Group | Key Schemes Supported (Synthetic MVP) | Primary Channel |
|---|---|---|
| **Farmers** | PM-KISAN, PM Fasal Bima Yojana (PMFBY) | WhatsApp |
| **Students** | NSP Post-Matric SC Scholarship, Karnataka Vidyasiri | WhatsApp |
| **Women Entrepreneurs / SHGs** | PMMY MUDRA Shishu Loan | WhatsApp |
| **Home/Wage Workers** | PM SVANidhi, e-Shram | WhatsApp |
| **Panchayat Staff** | Local verification and assisted application routing | Officer Web Portal |
| **Tehsil Staff** | Formal application approval / rejection with order numbers | Officer Web Portal |

---

## Architecture Overview

```
[Citizen on WhatsApp]
         │
         ▼
FastAPI Central Backend
  ├── Persistent Conversation Engine (30-day session resumption by phone)
  ├── Central AI Orchestrator (Gemini 2.0 Flash — Reasoning & Dialogue ONLY)
  ├── Allowlisted Tool Layer (Scheme, Eligibility, Documents, Application, Execution, Tracking)
  ├── Deterministic Eligibility Engine (Database rules)
  ├── Local OCR Engine (pytesseract + Pillow — zero document bytes sent to AI)
  ├── Application PDF Generator (ReportLab / HTML)
  └── Private Document Storage (storage/ — opaque UUIDs, zero public URLs)
         ▲
         │
[Officer Web Portal (React + Tailwind)]
```

---

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Tesseract OCR installed (`tesseract --version`)
- Google Gemini API Key

### 2. Setup Backend
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env
# Edit .env and set GEMINI_API_KEY
python db/seed.py
uvicorn main:app --reload --port 8000
```
- Backend runs at `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`

### 3. Setup Frontend (Officer Portal & WhatsApp Simulator)
```bash
cd frontend
npm install
npm run dev
```
- Frontend runs at `http://localhost:5173`
- Includes interactive **WhatsApp Simulator Panel** to test the entire flow without Meta Cloud credentials!

---

## Demo Personas (Synthetic Data)

- **Ramu Nayak** (Farmer, Mandya, Karnataka) — Applying for PM-KISAN in **Kannada**.
- **Priya Sharma** (Student, Lucknow, UP) — Applying for NSP Scholarship in **Hindi**.

---

*Last Updated: 2026-11-13 | Version 2.0 (WhatsApp-First)*
