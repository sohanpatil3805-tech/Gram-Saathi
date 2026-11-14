# Gram Saathi — Production & Deployment Guide

This document outlines system prerequisites, environment configuration, database migration, and service operations for deploying Gram Saathi.

---

## 1. System Requirements

| Component | Minimum Version | Description |
|---|---|---|
| **Python** | 3.11+ (Tested on 3.11, 3.12, 3.13) | Backend runtime for FastAPI, SQLAlchemy, and Gemini SDK |
| **Node.js** | 18.x or 20.x LTS | Frontend build environment for Vite, React 18, and Tailwind CSS |
| **npm / pnpm** | 9.x+ | Node package manager |
| **Tesseract OCR** | 5.0+ | Local OCR engine (Ubuntu: `apt install tesseract-ocr tesseract-ocr-kan tesseract-ocr-hin`) |
| **Google Gemini API Key** | v1 / v2 Flash access | AI reasoning and multilingual assistance |

---

## 2. Environment Configuration

Gram Saathi strictly loads secrets from environment variables and `.env` via `backend/config.py`.  
Never commit `.env` to version control.

### Setup Step:
```bash
# From repository root
cp .env.example .env
```

### Essential Environment Variables (Reference `.env.example`):
- `GEMINI_API_KEY`: Google Gemini API key (stored as `SecretStr`; never logged or serialized).
- `GEMINI_MODEL`: Default model (`gemini-2.0-flash`).
- `JWT_SECRET_KEY`: High-entropy random secret for signing citizen and officer JWTs (generate using `python -c "import secrets; print(secrets.token_hex(32))"`).
- `JWT_ALGORITHM`: `HS256` (default).
- `JWT_CITIZEN_EXPIRE_MINUTES`: Citizen token validity window (default: 60 minutes or 30 days via `CITIZEN_JWT_EXPIRY_DAYS`).
- `JWT_OFFICER_EXPIRE_MINUTES`: Officer session validity window (default: 480 minutes / 8 hours).
- `DATABASE_URL`: Asynchronous DB connection string.
- `STORAGE_PATH`: Private document storage directory (default: `./storage`).
- `MAX_UPLOAD_SIZE_MB`: Maximum citizen document upload size (default: 5 MB).
- `SIMULATION_MODE`: `true` for synthetic external filings with `SIM-` prefix.
- `DEMO_MODE`: `true` enables demo seeds and dev helpers.
- `OTP_DEV_MODE`: `true` outputs OTP to console logs without sending real SMS.
- `OCR_ENABLED`: `true` activates local pytesseract pipeline.
- `NOTIFICATION_PROVIDER`: `console` for local dev/demo stubbing.
- `CORS_ORIGINS`: Comma-separated list of allowed web origins (e.g., `http://localhost:5173,http://localhost:3000`).

---

## 3. Backend Startup Commands

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Database Initialization & Seeding
```bash
# Initialize schema and seed synthetic data
python -c "from backend.db.session import init_db; init_db()"
```

### Start Development Server
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Start Production Server (Gunicorn + Uvicorn Workers)
```bash
gunicorn backend.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

---

## 4. Frontend Build & Serve Commands

### Install Dependencies
```bash
cd frontend
npm install
```

### Local Development Server
```bash
npm run dev
# Running on http://localhost:5173
```

### Production Build & Preview
```bash
# Build optimized production bundle to dist/
npm run build

# Preview production build locally
npm run preview -- --port 3000
```

### Serving via Nginx (Production Static Hosting)
Point Nginx `root` directive to `frontend/dist/` with fallback to `index.html`:
```nginx
server {
    listen 80;
    server_name gramsaathi.gov.in;

    root /var/www/gram-saathi/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Database Migration (SQLite → PostgreSQL)

Gram Saathi is designed for dialect-independent database management using SQLAlchemy 2.0 and Alembic.

### Local Development (Default):
```env
DATABASE_URL=sqlite+aiosqlite:///./gram_saathi.db
```

### Production PostgreSQL Deployment:
1. Provision a PostgreSQL 14+ instance.
2. Update `.env`:
   ```env
   DATABASE_URL=postgresql+asyncpg://gram_user:SecurePassword123@postgres-host:5432/gram_saathi
   ```
3. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```
*Note: `backend/config.py` automatically derives the synchronous connection string for Alembic by stripping `+asyncpg` or `+aiosqlite`.*

---

## 6. Known Limitations & Demo Notes

1. **Simulation Mode**:
   - Official government service submissions produce simulated references prefixed with `SIM-GS-` (e.g., `SIM-GS-2026-ABCD`).
   - No actual state or central government portal credentials are required for demonstrations.
2. **Citizen Authentication**:
   - In dev mode (`OTP_DEV_MODE=true`), OTPs are printed to standard output (`[DEV OTP] Phone: +919876543210 OTP: 123456`) and not sent via real telecom SMS gateways.
3. **WhatsApp Channel**:
   - Meta WhatsApp Cloud API integration is supported. In local dev, the built-in WhatsApp web simulator (`WASimulator.tsx`) or REST API fallback can be used.
4. **Local Document Storage**:
   - Files are saved in private disk storage (`storage/documents/`) using UUID filenames. Direct HTTP public URL downloads are prevented by IDOR authentication checks.
5. **OCR Processing**:
   - OCR runs locally using pytesseract. If Tesseract is not installed on the host, the system gracefully falls back to pending validation status.
6. **AI Orchestration**:
   - Gemini API calls are strictly used for NLU and multilingual translation. Deterministic business rules, eligibility evaluations, confirmation token verification, and database operations remain entirely within the Python backend.
