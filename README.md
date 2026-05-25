# Breathe ESG — Monorepo

```
breathe-esg/
├── backend/          Django + DRF API
├── frontend/         React + Vite SPA
├── sample_data/      SAP, utility, and travel sample files
└── docs/             Architecture, model, decisions, tradeoffs
```

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env   # configure DB credentials
python manage.py migrate
python manage.py seed_demo
python manage.py runserver

# Frontend (new terminal)
cd frontend && npm install
cp .env.example .env   # set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173 — login with `analyst@acme.com` / `demo1234`

## Documentation

| File | Contents |
|------|----------|
| [docs/README.md](docs/README.md) | Setup, API overview, Railway deployment guide |
| [docs/MODEL.md](docs/MODEL.md) | Data model, entities, audit design |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectural decisions and open PM questions |
| [docs/TRADEOFFS.md](docs/TRADEOFFS.md) | Deliberate omissions and scale considerations |
| [docs/SOURCES.md](docs/SOURCES.md) | SAP, utility, and travel API research |
| [docs/FINAL_REVIEW.md](docs/FINAL_REVIEW.md) | Interview defence and "no AI slop" rationale |
