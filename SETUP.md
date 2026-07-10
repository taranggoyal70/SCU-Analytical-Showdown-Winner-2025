# Setup

## Primary web app

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Key routes to verify:

```text
/traffic
/sales
/campaigns
/customer-service
/products
/forecast
/segments
/recommendations
/campaign-optimizer
/automation
/mass-chat
/off-platform
/paylater
/income
/comparison
/adaptive-learning
/spend-optimizer
```

Production-style build:

```bash
npm run lint
npm run build
npm start
```

## Live CSV/XLSX uploads

The `/upload` route uses private Vercel Blob and a password-protected, HTTP-only admin session.

Required environment variables:

```text
BLOB_READ_WRITE_TOKEN   Added automatically when a Blob store is linked
UPLOAD_SECRET           Long seller-admin password
```

Create a private store and sync local development variables:

```bash
vercel blob create-store nazava-datasets --access private --yes
vercel env add UPLOAD_SECRET production
vercel env add UPLOAD_SECRET preview
vercel env pull .env.local --yes
```

For a brand-new store, seed the bundled dataset once:

```bash
npm run blob:seed
```

Uploads go directly from the browser to Blob, then `/api/uploads/finalize` validates and activates the complete batch. The cache TTL is 30 seconds and a successful publish invalidates it immediately.

## Optional backend API

The backend is FastAPI and reads the same committed CSV files from `data/cleaned`.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=backend uvicorn app.main:app --reload --port 8000
```

Check it:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/summary?dataset=traffic_overview_cleaned&from=2025-01-01&to=2025-12-31"
```

## Docker Compose

```bash
docker compose up --build
```

Then open:

```text
Web:     http://localhost:3000
Backend: http://localhost:8000
```

## Data

The Next.js app loads the latest valid Vercel Blob manifest. It falls back to the following bootstrap files when Blob is not configured or empty:

```text
data/cleaned/*.csv
```

The optional backend still reads these files directly. Dashboard filters are encoded in the URL as `dataset`, `from`, and `to` query parameters.

## History

The original hackathon Streamlit dashboard and ML scripts were removed after the
Next.js rewrite (they relied on machine-local paths and demo-only auth). The
analysis notebook and presentation decks are kept as artifacts of the win.
