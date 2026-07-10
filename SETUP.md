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

Production-style build:

```bash
npm run lint
npm run build
npm start
```

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

The active app and backend load:

```text
data/cleaned/*.csv
```

Dashboard filters are encoded in the URL as `dataset`, `from`, and `to` query parameters.

## Legacy Python tools

The old Streamlit dashboard, notebooks, and ML scripts are retained for reference. They are not the production runtime.
