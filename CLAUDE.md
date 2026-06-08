# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GDOT Tracker is an interactive web mapping tool for visualizing Georgia Department of Transportation (GDOT) projects across Georgia. It is a static single-page application deployed to GitHub Pages.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), no build tools, no npm
- **Mapping**: Mapbox GL JS v3.10.0
- **UI Components**: Web Awesome (web components)
- **Data Pipeline**: Python (GeoPandas, Pandas) — runs offline to prepare data, not part of deployment
- **Deployment**: GitHub Actions → GitHub Pages

## Development

Since there is no build process, open `index.html` directly in a browser or use a local server:

```bash
python3 -m http.server 8000
```

The Mapbox token lives in `js/config.js` (gitignored). In CI/CD it is injected from GitHub Secrets (`MAPBOX_TOKEN`). Locally, create `js/config.js` manually:

```js
export const MAPBOX_TOKEN = 'your_token_here';
```

There are no tests, linting, or build commands.

## Architecture

### Data Flow

1. **Python pipeline** (offline, `python-prep/`) fetches from the GDOT REST API, scrapes metadata, spatially joins projects to boundaries, allocates costs proportionally, outputs GeoJSON files to `data/`, and appends a monthly monitoring snapshot to `data/history/`.
2. **Frontend** reads those GeoJSON files directly — no server, no API at runtime.
3. User changes a filter → `ProjectLoader.js` filters GeoJSON → map updates → `ProjectStats.js` recalculates statistics → `URLManager.js` encodes state into URL query params.

### Module Responsibilities (`js/modules/`)

| Module | Role |
|---|---|
| `MapCore.js` | Map initialization, basemap setup |
| `GeoBoundaryLoader.js` | Load/display geography boundaries (districts, counties, cities) |
| `ProjectLoader.js` | Core filtering logic — filters by status, type, jurisdiction |
| `ProjectDetail.js` | Click popups with project details |
| `ThemeManager.js` | Light/dark theme toggle, localStorage persistence |
| `URLManager.js` | URL query params as filter state (enables bookmarking/sharing) |
| `ProjectStats.js` | Calculates allocated costs and counts for filtered data |
| `MapLegend.js` | Dynamic legend based on active filters |
| `csvExport.js` | Download visible projects as CSV or GeoJSON |
| `LoadingManager.js` | Spinner overlay; only shows if load takes >500ms |
| `AdditionalGeos.js` | Optional reference layers (workforce areas, aging agencies, etc.) |

### Geography Levels

The app has four levels controlled by a `level` URL param:
- `statewide` — one aggregated view
- `congressional_district` — by U.S. congressional district
- `county` — by county
- `city` — by city

Each level has its own GeoJSON in `data/projects/` and boundary files in `data/<geography>/`.

### URL State

All filter state is encoded in query params: `level`, `jurisdiction`, `status`, `type`. This makes every filter state bookmarkable and shareable.

### Dual-Path Pattern

Modules detect the runtime environment to handle both local development (relative paths) and GitHub Pages (absolute paths) via a `BASE_URL` variable set in each module.

### Cost Allocation

"Allocated cost" = project cost × (fraction of project geometry within jurisdiction). Computed during the Python pipeline via spatial joins, not at runtime.

## Python Data Pipeline (`python-prep/`)

The pipeline is orchestrated by `pipeline.py`, run monthly from the `python-prep/` directory:

```bash
cd python-prep
pip install -r requirements.txt
playwright install chromium
python pipeline.py
```

`pipeline.py` first prompts whether to start **fresh** (re-pull from the API and
re-scrape everything — ~15 hours) or **resume** (re-attempt only the still-failed
scrapes), then runs these stages from `sub-scripts/`:

1. `1-api-call.py` — Fetch projects from the GDOT REST API. Writes the scrape worklist
   + geometry, and carries monitoring fields (construction/payment %, completion/award/
   stop dates, TIA flag, contractor) downstream.
2. `2-scraper.py` — Scrape per-project cost/type/manager from the GeoPI detail pages
   (~15 hours). Failures stay retryable and recoveries are checkpointed atomically, so a
   kill never loses progress; re-running and choosing "resume" shrinks the residual.
3. `3-finalize.py` — Join geometry, allocate costs, write GeoJSON per geography level,
   and append this run's row-per-project snapshot to `data/history/snapshots.csv`.
4. `6-monitor.py` — Diff the two most-recent snapshots → `data/history/changes.csv`
   and `run_summary.csv`.
5. Commit & push `data/` (triggers the GitHub Pages deploy).

`4-boundary-prep.py` and `5-categorize.py` are standalone helpers (boundary prep and
project categorization), run only when those inputs change — they are **not** part of
the monthly `pipeline.py` flow.

Output GeoJSON files go into `data/` and are committed to the repo. The GDOT REST API is
public and unauthenticated — **no credentials or `.env` file are required.**

### Monitoring / diagnostics

`data/history/` is an append-only time series for tracking month-over-month change — new
projects, status transitions, pre-construction cost revisions, construction-% movement,
completion-date slippage, and data anomalies. It exists partly to answer how often the
pipeline actually needs to run (monthly vs. quarterly). See
`python-prep/MONITORING_DESIGN.md` for the full design and run-cadence strategy. The
frontend does not read these files.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which injects the Mapbox token from `MAPBOX_TOKEN` secret into `js/config.js` and deploys to GitHub Pages.
