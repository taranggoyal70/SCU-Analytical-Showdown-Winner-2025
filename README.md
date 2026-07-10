# Nazava Analytics Web

Production-style analytics web app for the SCU Analytical Showdown Shopee/Nazava dataset.

Live app: [https://scu-analytical-showdown.vercel.app](https://scu-analytical-showdown.vercel.app)

The primary product is now a proper Next.js web app, not Streamlit. It reads the committed cleaned CSVs from `data/cleaned`, computes metrics on the server, renders a polished dashboard, and exposes JSON APIs for the same source-backed analytics.

## What is included

- Next.js App Router dashboard in `app/`
- Multi-page analytics routes instead of a single compressed page
- Server-side CSV analytics engine in `lib/analytics.ts`
- JSON summary API at `/api/summary`
- Optional FastAPI backend in `backend/`
- Shared source-of-truth data in `data/cleaned/*.csv`
- URL-based filters for dataset/date state
- Dataset audit and data-quality visibility
- Docker, Render, and compose config updated for the web app/backend split

## Restored web app sections

The Streamlit app had a broad feature surface. The Next.js app now restores that structure as proper web routes:

```text
/                       Overview
/traffic                Traffic Analysis
/sales                  Sales Analysis
/campaigns              Campaign Performance
/customer-service       Customer Service Analytics
/products               Product Analytics
/forecast               Sales Forecast baseline
/segments               Customer Segments
/recommendations        Product Recommendations
/campaign-optimizer     Campaign ROI Optimizer
/automation             Automation Bot command center
/mass-chat              Mass Chat Broadcasts
/off-platform           Off-Platform Traffic
/paylater               Shopee PayLater
/income                 Income Statements (official Shopee income reports)
/comparison             Period Comparison
/adaptive-learning      Adaptive Learning readiness
/spend-optimizer        Promotional Spend Optimizer
```

Each section has its own route, navigation entry, KPIs, charts, recommendations, and source audit. Pages use the committed CSV data where available; model-style pages are labeled as baseline/readiness views unless a trained model artifact is wired into the web runtime.

## What was fixed

- Replaced the Streamlit production entrypoint.
- Removed the legacy Streamlit dashboard, ML scripts, and automation bot entirely — they relied on machine-local absolute paths, demo-only auth, and simulated data, and could not run anywhere else.
- Removed hardcoded demo-login UX, placeholder secrets, and unused Postgres/Redis/JWT settings.
- Parsed the official Shopee income reports (`revenue_2_cleaned.csv`) into a structured Income Statements dataset instead of loading them as 372 rows of zero-metric noise. Income statements are kept out of blended KPI totals to avoid double-counting the per-channel sales reports.
- Made the CSV loader resilient: one malformed file can no longer take the whole app down, and a failed load is retried on the next request instead of being cached forever.
- Added error handling to the summary API, a root error boundary, and a not-found page.

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

## History

This project won the SCU Analytical Showdown 2025. The original hackathon
Streamlit dashboard and ML experiments were removed after the Next.js rewrite;
the analysis notebook and presentation decks are kept as artifacts of the win.
