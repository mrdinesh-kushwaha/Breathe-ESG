# Breathe ESG — Emissions Intelligence Platform

<div align="center">

![Breathe ESG](https://img.shields.io/badge/Breathe-ESG-22c55e?style=for-the-badge&logo=leaf&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?style=for-the-badge&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Railway](https://img.shields.io/badge/Deployed-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

**Enterprise-grade ESG emissions ingestion, normalization, and review platform.**  
Ingest messy data from SAP, utility portals, and travel systems — normalize, flag, review, and report with full audit trail.

[Live Demo](#) · [API Docs](#api-overview) · [Architecture](#architecture-overview)

</div>

---

## Demo Access

> Use these credentials to explore the platform:

| Role | Email | Password |
|------|-------|----------|
| **Analyst** | `analyst@acme.com` | `demo1234` |
| **Reviewer** | `reviewer@acme.com` | `demo1234` |

---

## What It Does

Breathe ESG solves a real enterprise problem — companies receive emissions data from dozens of sources in inconsistent formats. This platform:

- **Ingests** SAP fuel exports (German headers, mixed units), utility CSVs (billing periods, kWh), and travel JSON (Concur/Navan style)
- **Normalizes** every row to a canonical unit with DEFRA 2023 emission factors
- **Flags** suspicious rows automatically — negative values, unknown airport codes, implausible consumption
- **Routes** flagged records to an analyst review queue
- **Locks** approved records as immutable — approved data cannot be modified
- **Tracks** every action in an append-only audit log

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│         Dashboard · Upload · Review · Audit              │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API (JWT)
┌───────────────────────▼─────────────────────────────────┐
│                   Django + DRF Backend                   │
│                                                          │
│  ┌──────────┐  ┌───────────┐  ┌─────────┐  ┌────────┐  │
│  │ tenants  │  │ ingestion │  │emissions│  │ audit  │  │
│  └──────────┘  └─────┬─────┘  └────┬────┘  └────────┘  │
│                      │             │                     │
│            ┌─────────▼─────────────▼──────┐             │
│            │    Normalization Service      │             │
│            │  (Pure Python · Testable)     │             │
│            └──────────────────────────────┘             │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                    PostgreSQL                            │
│     Multi-tenant · UUID PKs · Row-level isolation       │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Django 4.2 + Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) |
| Database | PostgreSQL 14 |
| Deployment | Railway |
| Emissions Factors | DEFRA 2023 / IEA 2022 |

---

## Key Features

### 3 Realistic Ingestion Pipelines

**SAP Export (Scope 1)**
- Handles German headers — `Menge`, `Einheit`, `Buchungsdatum`, `Werk`
- Mixed date formats — `DD.MM.YYYY`, `YYYYMMDD`, `YYYY-MM-DD`
- German decimal commas — `1.234,56`
- Configurable column mapping per tenant (no code changes needed)

**Utility Portal CSV (Scope 2)**
- Meter ID, billing periods, kWh consumption
- Handles billing periods that don't align to calendar months
- Detects renewable/green tariffs for market-based accounting note

**Travel API JSON (Scope 3)**
- Concur/Navan-style booking payloads
- Flight, hotel, ground transport, rail
- IATA code validation + distance imputation for missing values
- Economy vs business class emission factors

### Smart Suspicion Flagging
Every ingested row is automatically checked for:
- Negative consumption values
- Unusually high volumes (e.g. 98,000L diesel in one posting)
- Missing or ambiguous units (`ST` = Stück in SAP)
- Unknown IATA airport codes
- Implausible hotel stays (45 nights flagged)

### Immutable Audit Trail
- Every approve/reject action writes to `AuditLog` with field-level diffs
- Approved records cannot be modified — enforced at model layer
- Full timeline visible per record and platform-wide

### Multi-Tenant Architecture
- Every table carries a `tenant` FK
- All queries filtered by `request.user.tenant`
- Tenant-scoped data sources and upload batches

---

## Data Model

```
Tenant
  └── User (analyst / reviewer / admin)
  └── DataSource (SAP / Utility / Travel)
       └── UploadBatch
            └── RawRecord (immutable source copy)
                 └── NormalizedRecord
                      ├── scope_category (Scope 1/2/3)
                      ├── estimated_emissions (kg CO₂e)
                      ├── suspicious_flag + reason
                      ├── review_status (pending/approved/rejected)
                      └── ReviewDecision[]
                           └── AuditLog[]
```

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env — set your DB_PASSWORD
```

```bash
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000
npm run dev
# → http://localhost:5173
```

---

## API Overview

All endpoints require `Authorization: Bearer <token>` except login.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login/` | Obtain JWT tokens |
| `GET` | `/api/auth/me/` | Current user profile |
| `GET` | `/api/dashboard/stats/` | Dashboard aggregates |
| `GET` | `/api/data-sources/` | List data sources |
| `POST` | `/api/upload/sap/` | Upload SAP CSV |
| `POST` | `/api/upload/utility/` | Upload utility CSV |
| `POST` | `/api/upload/travel/` | Upload travel JSON |
| `GET` | `/api/records/` | List normalised records |
| `GET` | `/api/records/{id}/` | Record detail + raw data |
| `POST` | `/api/records/{id}/review/` | Approve / Reject / Flag |
| `POST` | `/api/records/bulk-review/` | Bulk approve / reject |
| `GET` | `/api/records/{id}/audit/` | Audit trail for record |
| `GET` | `/api/audit/` | Platform-wide audit log |

---

## Sample Data Files

| File | Description |
|------|-------------|
| `sample_data/sap_sample.csv` | SAP export with German headers, negative qty, ST unit miscoding |
| `sample_data/utility_sample.csv` | Mixed date formats, negative kWh, mid-month billing period |
| `sample_data/travel_sample.json` | Null distance, unknown IATA, 45-night hotel, cancelled booking |

---

## Pages

| Route | Page |
|-------|------|
| `/login` | Premium split-panel login |
| `/` | Dashboard — stats, scope breakdown, recent uploads |
| `/upload` | Upload Center — SAP / Utility / Travel |
| `/review` | Review Queue — filter, bulk approve/reject |
| `/records/:id` | Record Detail — calculation, raw data, audit timeline |
| `/audit` | Platform Audit Timeline |

---

## Deployment (Railway)

```
backend/   → Railway service (Python/Django)
frontend/  → Railway service (Node/Vite)
database/  → Railway PostgreSQL (auto-provisioned)
```

Environment variables required for backend:
```
SECRET_KEY=<generate>
DEBUG=False
ALLOWED_HOSTS=.railway.app
CORS_ALLOWED_ORIGINS=https://your-frontend.railway.app
DATABASE_URL=<auto-set by Railway>
```

---

## Deliberate Tradeoffs

| Omitted | Why |
|---------|-----|
| Celery / async ingestion | Adds broker + worker complexity; sync handles files up to 50MB fine |
| Schema-per-tenant | Row-level tenancy is correct for a prototype; schema isolation adds migration overhead |
| Live Concur API | OAuth + polling adds infra; JSON upload demonstrates identical data flow |
| Test suite | Normalization layer is pure Python — trivially testable when needed |
| Emission factor DB | Hardcoded DEFRA 2023 factors; versioning is a product feature, not architecture |

---

## Project Structure

```
breathe-esg/
├── backend/
│   ├── breathe_esg/        # Django project (settings, urls, wsgi)
│   ├── tenants/            # Tenant + User models, JWT auth
│   ├── ingestion/          # DataSource, UploadBatch, RawRecord + 3 ingestors
│   ├── emissions/          # NormalizedRecord, dashboard stats
│   ├── reviews/            # ReviewDecision, approve/reject views
│   ├── audit/              # AuditLog, log_event() helper
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   └── src/
│       ├── pages/          # Login, Dashboard, Upload, Review, Detail, Audit
│       ├── components/     # Layout, sidebar
│       ├── api/            # Axios client with JWT interceptors
│       └── hooks/          # useAuth context
├── sample_data/
│   ├── sap_sample.csv
│   ├── utility_sample.csv
│   └── travel_sample.json
└── docs/
    ├── MODEL.md
    ├── DECISIONS.md
    ├── TRADEOFFS.md
    ├── SOURCES.md
    └── FINAL_REVIEW.md
```

---

<div align="center">

Built with Django · React · PostgreSQL · Railway

**Scope 1 · Scope 2 · Scope 3 · Full Audit Trail**

</div>
