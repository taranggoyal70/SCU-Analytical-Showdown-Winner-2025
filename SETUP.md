# Setup

## Web app

Install dependencies:

```bash
npm install
```

Run the dashboard:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production build

```bash
npm run build
npm start
```

## Data

The active app loads CSV files from:

```text
data/cleaned
```

No browser-only saved state is used. Dashboard filters are encoded in the URL as `dataset`, `from`, and `to` query parameters.

## Legacy Python tools

The Streamlit dashboard and Python ML scripts remain in the repo for historical reference, but they are not the production web entrypoint.
