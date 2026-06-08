# GDOT Tracker

An interactive web map of Georgia Department of Transportation (GDOT) projects
across the state, built and maintained by the Atlanta Regional Commission.

**Live site:** https://arc-research-analytics.github.io/gdot_pipeline_v2/

The map lets users filter GDOT projects by status, type, and jurisdiction, and
view them aggregated at four geographic levels: statewide, congressional
district, county, and city. Project counts and allocated costs update live as
filters change.

---

## How it works (at a glance)

There are two halves to this project:

1. **The web app** — a static single-page site (vanilla JS + Mapbox GL JS, no
   build step). It reads pre-generated GeoJSON files from `data/` directly in
   the browser. There is no server or live API at runtime.
2. **The data pipeline** (`python-prep/`) — a set of Python scripts, run
   locally about once a month, that pull fresh data from GDOT, process it, and
   commit the updated GeoJSON files back to this repo. Pushing those updates is
   what refreshes the live site.

```
.
├── index.html            # App entry point
├── js/                   # App logic (ES modules); see js/modules/
├── styles/               # CSS
├── assets/               # Logos, fonts, icons
├── data/                 # Generated GeoJSON the app reads (committed)
├── python-prep/          # The monthly data pipeline (see below)
└── .github/workflows/    # Deploy-to-GitHub-Pages action
```

---

## Updating the data (monthly)

The data is refreshed by running one script. **Plan for it to run overnight —
the scrape step takes roughly 12–15 hours.**

### One-time setup

You need Python 3.11+ and the following packages. We recommend a dedicated
virtual environment (conda or venv):

```bash
pip install -r python-prep/requirements.txt
playwright install chromium    # required — the scraper drives a headless browser
```

You also need **write access to this repository** with git configured locally,
because the pipeline commits and pushes the results automatically.

### Running it

```bash
cd python-prep
python pipeline.py
```

The script walks through five steps:

1. **API call** — pulls the current project list from GDOT's public REST
   endpoint. (No credentials needed; the source is public.)
2. **Scrape** — visits each project's detail page to collect cost/status
   metadata. *This is the long step (~12–15 hrs).* You'll be prompted up front
   to either start fresh or resume a partial scrape.
3. **Finalize** — spatially joins projects to boundaries, allocates costs by
   jurisdiction, and writes the GeoJSON files into `data/projects/`.
4. **Monitor** — diffs this month against the prior snapshot and records
   month-over-month changes.
5. **Commit & push** — commits the updated `data/` files and pushes to `main`,
   which automatically triggers a redeploy of the live site.

> Note: `python-prep/sub-scripts/4-boundary-prep.py` and `5-categorize.py` are
> one-time setup scripts and are **not** part of the monthly run.

---

## Local development

No build step. Serve the folder and open it in a browser:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The Mapbox token lives in `js/config.js`, which is gitignored. To run locally,
create it manually:

```js
export const MAPBOX_ACCESS_TOKEN = "your_token_here";
```

---

## Deployment

Any push to `main` triggers `.github/workflows/deploy.yml`, which injects the
Mapbox token from the `MAPBOX_ACCESS_TOKEN` GitHub secret and publishes the site
to GitHub Pages. The monthly data push (above) therefore redeploys
automatically — no separate deploy step is needed.

## Maintainer responsibilities

- **Run the pipeline ~monthly** and confirm the live site updated afterward.
- **Repo write access** is required to push the monthly data updates.
- **Mapbox token:** the live map depends on the `MAPBOX_ACCESS_TOKEN` secret in
  this repo's settings (Settings → Secrets and variables → Actions). It should
  point at an ARC-owned Mapbox account, ideally with a URL restriction scoping
  it to the live site domain.
