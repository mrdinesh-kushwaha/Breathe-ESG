# Breathe ESG — Emissions Ingestion & Review Platform

A production-grade prototype for ingesting, normalising, and reviewing corporate emissions data from SAP exports, utility portals, and travel management systems.

---

## Architecture Overview

```
breathe-esg/
├── backend/          Django + DRF API (Python 3.11+)
├── frontend/         React + Vite + Tailwind SPA
├── sample_data/      Realistic SAP, utility, and travel fixtures
└── docs/             Architecture and decision documents
```

The backend is a multi-tenant Django application. Each `Tenant` (company) has isolated data. JWT authentication gates all API endpoints. Ingestion is synchronous for this prototype (a task queue would be added for production at scale).

The frontend is a React SPA that communicates exclusively via the REST API — there is no server-side rendering.

---

## Credentials (demo seed)

| Role     | Email                   | Password   |
|----------|-------------------------|------------|
| Analyst  | analyst@acme.com        | demo1234   |
| Reviewer | reviewer@acme.com       | demo1234   |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend

# Create virtualenv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env: set DB_NAME, DB_USER, DB_PASSWORD

# Create database
createdb breathe_esg

# Run migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Seed demo data (recommended)
python manage.py seed_demo

# Start dev server
python manage.py runserver
```

Backend runs at: http://localhost:8000
Django admin: http://localhost:8000/admin

### Frontend

```bash
cd frontend

npm install

# Configure API URL
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000

npm run dev
```

Frontend runs at: http://localhost:5173

---

## API Overview

All endpoints are prefixed `/api/`. JWT required (pass `Authorization: Bearer <token>`).

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Obtain access + refresh tokens |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/me/` | Current user profile |

### Ingestion
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-sources/` | List configured data sources |
| POST | `/api/data-sources/` | Create data source |
| GET | `/api/batches/` | List upload batches |
| POST | `/api/upload/sap/` | Upload SAP export CSV |
| POST | `/api/upload/utility/` | Upload utility CSV |
| POST | `/api/upload/travel/` | Upload travel JSON |

### Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/records/` | List normalised records (filterable) |
| GET | `/api/records/{id}/` | Record detail with raw data |
| POST | `/api/records/{id}/review/` | Approve / reject / flag |
| POST | `/api/records/bulk-review/` | Bulk approve / reject |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/` | Tenant-scoped audit log |
| GET | `/api/records/{id}/audit/` | Audit trail for one record |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats/` | Aggregated stats for dashboard widgets |

---

## Deployment on Railway

See [Railway Deployment Guide](#railway-deployment-guide) below.

---

## Railway Deployment Guide

### Step 1 — Create a Railway project

1. Go to https://railway.app and create a new project
2. Click **New Service → GitHub Repo** and connect this repository

### Step 2 — Add PostgreSQL

In your Railway project, click **New → Database → PostgreSQL**. Railway will provision a database and expose `DATABASE_URL` automatically.

### Step 3 — Configure the backend service

Create a backend service pointing to the `/backend` directory.

Set these environment variables in Railway:

```
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(50))">
DEBUG=False
ALLOWED_HOSTS=<your-backend-railway-domain>.railway.app
CORS_ALLOWED_ORIGINS=https://<your-frontend-railway-domain>.railway.app
DATABASE_URL=<auto-set by Railway PostgreSQL>
```

Railway will auto-detect the `Procfile` and run:
```
gunicorn breathe_esg.wsgi --log-file -
```

The `release` command in the Procfile runs `migrate` and `collectstatic` automatically on each deploy.

### Step 4 — Seed demo data (one-time)

In Railway's shell panel for the backend service:
```bash
python manage.py seed_demo
```

### Step 5 — Configure the frontend service

Create a frontend service pointing to the `/frontend` directory.

Set:
```
VITE_API_BASE_URL=https://<your-backend-railway-domain>.railway.app
```

Railway will detect Vite and run `npm run build` automatically. The output is served as static files.

---

## Pages

| Route | Description |
|-------|-------------|
| `/login` | JWT login |
| `/` | Dashboard with stats and scope breakdown |
| `/upload` | Upload CSV/JSON files by source type |
| `/review` | Review queue with filter and bulk actions |
| `/records/:id` | Record detail with raw data and audit trail |
| `/audit` | Platform-wide audit timeline |

---

## Assumptions

- Emission factors are DEFRA 2023 / IEA 2022 approximations. Production would use a versioned factor database.
- All ingestion is synchronous. At scale (>10k rows), this moves to Celery + Redis.
- Multi-tenancy is row-level (tenant FK on every table). Schema-per-tenant would be considered for enterprise deployments with strict data isolation requirements.
- The travel distance lookup covers major airport pairs only. A full dataset or external API (e.g. Great Circle Mapper) would be used in production.
