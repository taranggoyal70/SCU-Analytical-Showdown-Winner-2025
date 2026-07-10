# Nazava Analytics Web

Production-style web dashboard for the SCU Analytical Showdown Shopee/Nazava dataset.

The user-facing app has been migrated from Streamlit to a proper Next.js web app. It reads the cleaned CSV files in `data/cleaned` on the server, computes KPIs dynamically, and exposes both a polished dashboard and a JSON summary API.

## What changed

- Replaced the Streamlit entrypoint with a Next.js App Router web app.
- Removed hardcoded demo-login UX from the primary app path.
- Removed browser-only saved state. Filters are URL query parameters.
- Removed local absolute data paths from the active web app.
- Added server-side CSV ingestion from `data/cleaned`.
- Added derived KPIs, trends, funnel, campaign performance, generated insights, and dataset audit.
- Updated Docker, Render, and Procfile deployment commands for Node/Next.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## API

The app exposes the same server-computed summary as JSON:

```bash
curl "http://localhost:3000/api/summary"
curl "http://localhost:3000/api/summary?dataset=traffic_overview_cleaned&from=2025-01-01&to=2025-12-31"
```

## Data source

The source of truth is the committed cleaned CSV dataset:

```text
data/cleaned/*.csv
```

The dashboard does not hardcode KPI values. It calculates visible numbers from the rows loaded from those files.

## Legacy folders

The old Streamlit dashboard, notebook, Python scripts, and ML experiments remain in the repository for reference. The production web entrypoint is now the Next.js app in `app/`.
