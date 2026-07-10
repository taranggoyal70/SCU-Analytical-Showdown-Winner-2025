# Nazava Analytics Web

Production-style analytics web app for the SCU Analytical Showdown Shopee/Nazava dataset.

Live app: [https://scu-analytical-showdown.vercel.app](https://scu-analytical-showdown.vercel.app)

The primary product is now a proper Next.js web app, not Streamlit. It reads the committed cleaned CSVs from `data/cleaned`, computes metrics on the server, renders a polished dashboard, and exposes JSON APIs for the same source-backed analytics.

## What is included

- Next.js App Router dashboard in `app/`
- Server-side CSV analytics engine in `lib/analytics.ts`
- JSON summary API at `/api/summary`
- Optional FastAPI backend in `backend/`
- Shared source-of-truth data in `data/cleaned/*.csv`
- URL-based filters for dataset/date state
- Dataset audit and data-quality visibility
- Docker, Render, and compose config updated for the web app/backend split

## What was fixed

- Replaced the Streamlit production entrypoint.
- Removed hardcoded demo-login UX from the active product path.
- Removed local absolute data path defaults from the active web app and backend.
- Rebuilt the backend so it starts without missing service imports.
- Removed mandatory Postgres/Redis dependencies from the active backend analytics API.
- Trimmed backend dependencies to the packages it actually needs.
- Kept old Python notebooks/scripts as reference assets, not production runtime.

## Run the web app locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build the web app

```bash
npm run lint
npm run build
npm start
```

## Web API

The Next app exposes the server-computed summary as JSON:

```bash
curl "http://localhost:3000/api/summary"
curl "http://localhost:3000/api/summary?dataset=traffic_overview_cleaned&from=2025-01-01&to=2025-12-31"
```

## Optional FastAPI backend

The backend is functional and uses the same `data/cleaned` CSV source.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000
```

Useful backend endpoints:

```text
GET /health
GET /api/summary
GET /api/analytics/kpis
GET /api/analytics/datasets
GET /api/analytics/trends/revenue
GET /api/analytics/funnel
GET /api/analytics/campaigns
GET /api/insights/summary
GET /api/predictions/forecast/revenue
GET /api/reports/export
```

Example:

```bash
curl "http://localhost:8000/api/summary?dataset=traffic_overview_cleaned&from=2025-01-01&to=2025-12-31"
```

## Docker Compose

Run the web app and backend together:

```bash
docker compose up --build
```

Services:

- Web: `http://localhost:3000`
- Backend: `http://localhost:8000`

## Data source

The source of truth is:

```text
data/cleaned/*.csv
```

The dashboard and backend calculate visible values from those files. KPI/chart values are not hardcoded.

## Legacy folders

The old Streamlit dashboard, notebook, Python scripts, and ML experiments remain in the repository for reference. They are not the production entrypoint.
