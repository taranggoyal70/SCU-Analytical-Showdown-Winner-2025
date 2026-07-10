# Nazava Analytics Web

Production-style analytics web app for the SCU Analytical Showdown Shopee/Nazava dataset.

Live app: [https://scu-analytical-showdown.vercel.app](https://scu-analytical-showdown.vercel.app)

The primary product is now a proper Next.js web app, not Streamlit. A seller can upload fresh Shopee CSV/XLSX exports, the app stores them privately in Vercel Blob, validates and normalizes them, and activates the complete batch without a rebuild. The committed CSVs remain only as bootstrap data for a new environment with no active Blob manifest.

## What is included

- Next.js App Router dashboard in `app/`
- Multi-page analytics routes instead of a single compressed page
- Server-side CSV/XLSX analytics engine in `lib/analytics.ts`
- Protected seller upload workspace at `/upload`
- Direct-to-Blob CSV/XLSX uploads up to 100 MB per file
- Atomic batch manifests: failed uploads never replace the live dashboard
- Private raw exports plus normalized Blob artifacts
- 30-second analytics cache with immediate invalidation after publish
- JSON summary API at `/api/summary`
- Optional FastAPI backend in `backend/`
- Bundled bootstrap data in `data/cleaned/*.csv`
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

Each section has its own route, navigation entry, KPIs, charts, recommendations, and source audit. Pages use the active Blob batch when one exists and the bundled CSVs only as bootstrap data; model-style pages are labeled as baseline/readiness views unless a trained model artifact is wired into the web runtime.

## What was fixed

- Replaced the Streamlit production entrypoint.
- Removed the legacy Streamlit dashboard, ML scripts, and automation bot entirely — they relied on machine-local absolute paths, demo-only auth, and simulated data, and could not run anywhere else.
- Removed hardcoded demo-login UX, placeholder secrets, and unused Postgres/Redis/JWT settings.
- Parsed the official Shopee income reports (`revenue_2_cleaned.csv`) into a structured Income Statements dataset instead of loading them as 372 rows of zero-metric noise. Income statements are kept out of blended KPI totals to avoid double-counting the per-channel sales reports.
- Made the normalized export loader resilient: one malformed dataset can no longer take the whole app down, and Blob reads are refreshed on a short cache TTL.
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

## Live export workflow

1. Open `/upload` and enter the password stored in `UPLOAD_SECRET`.
2. Drag in one or more Shopee `.csv` or `.xlsx` exports.
3. Select every export that should make up the new live batch.
4. Choose **Validate and publish**.
5. The browser uploads directly to private Vercel Blob. The server validates file type, export family, rows, and size before writing the active manifest.
6. The analytics cache is invalidated and the next dashboard request reads the new batch.

The upload session is held in a signed, HTTP-only, same-site cookie and expires after eight hours. No authentication state or export data is stored in browser local storage.

## Vercel Blob configuration

Create and connect a private Blob store to the Vercel project:

```bash
vercel blob create-store nazava-datasets --access private --yes
vercel env add UPLOAD_SECRET production
vercel env add UPLOAD_SECRET preview
vercel env pull .env.local --yes
```

Vercel injects `BLOB_READ_WRITE_TOKEN` when the store is connected. To seed the committed judge dataset into an empty store:

```bash
npm run blob:seed
```

## Data source

The runtime source of truth is the latest valid manifest under `shopee-exports/manifests/` in private Vercel Blob. Raw and normalized objects are versioned by batch ID. If no manifest exists, the app falls back to:

```text
data/cleaned/*.csv
```

The Next.js dashboard calculates visible values from the active Blob batch. KPI/chart values are not hardcoded. The optional FastAPI backend continues to read the bundled bootstrap CSVs.

## History

This project won the SCU Analytical Showdown 2025. The original hackathon
Streamlit dashboard and ML experiments were removed after the Next.js rewrite;
the analysis notebook and presentation decks are kept as artifacts of the win.
