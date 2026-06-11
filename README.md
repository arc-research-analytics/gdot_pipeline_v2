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

You need Python 3.11+. Create a dedicated virtual environment first (recommended
to keep pipeline dependencies isolated):

```bash
# Using conda (recommended):
conda create -n gdot-tracker python=3.11
conda activate gdot-tracker

# Or using venv:
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

Then install dependencies:

```bash
pip install -r python-prep/requirements.txt
playwright install chromium    # required — the scraper drives a headless browser
```

You also need **write access to this repository** with git properly configured,
because the pipeline commits and pushes the results automatically.

### Git prerequisites

1. **Identity** — git needs your name and email to author the auto-commit:

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@atlantaregional.org"
   ```

2. **Authentication** — GitHub no longer accepts passwords over HTTPS. You have
   two options:
   - **SSH (recommended):** Add an SSH key to your GitHub account. See
     [GitHub's SSH setup guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).
     Clone the repo using the SSH URL (`git@github.com:arc-research-analytics/gdot_pipeline_v2.git`).
   - **HTTPS with a Personal Access Token:** Generate a token at
     GitHub → Settings → Developer settings → Personal access tokens. Use it
     in place of a password when prompted.

3. **Confirm push access** before starting an overnight scrape:

   ```bash
   git push --dry-run origin main
   ```

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

No build step. The recommended way to run locally is the **VS Code Live Server
extension**, which serves on `http://localhost:5501` — the port already on the
Mapbox token's URL allowlist. Just open the repo in VS Code and click "Go Live."

The Mapbox token lives in `js/config.js`, which is gitignored. Create it
manually before launching:

```js
export const MAPBOX_ACCESS_TOKEN = "your_token_here";
```

The token is URL-restricted to `http://localhost:5501`. If you need to serve on
a different port, ask whoever manages the ARC Mapbox account to add that URL to
the `gdot` token's allowlist.

---

## Deployment

Any push to `main` triggers `.github/workflows/deploy.yml`, which injects the
Mapbox token from the `MAPBOX_ACCESS_TOKEN` GitHub secret and publishes the site
to GitHub Pages. The monthly data push (above) therefore redeploys
automatically — no separate deploy step is needed.

## Taking over as maintainer

If you are inheriting this project, work through this checklist before your
first pipeline run.

### Access and credentials

- [ ] **GitHub repo access** — you need write (collaborator) access to
  `arc-research-analytics/gdot_pipeline_v2`. Contact the repo owner or an
  organization admin at ARC to be added.
- [ ] **GitHub Pages** — already enabled on this repo; no action needed unless
  it was somehow disabled. Check under Settings → Pages.
- [ ] **`MAPBOX_ACCESS_TOKEN` secret** — the live map is deployed using a
  Mapbox token stored as a GitHub secret. Confirm it exists under Settings →
  Secrets and variables → Actions. If it needs to be rotated, find the token
  named **`gdot`** in the ARC Mapbox account console, set URL restrictions to
  `https://arc-research-analytics.github.io/gdot_pipeline_v2/*`, and update
  the secret value.
- [ ] **Local `js/config.js`** — this file is gitignored and must be created
  manually for local development. Get the token named **`gdot`** from the ARC
  Mapbox account console and create the file:

  ```js
  export const MAPBOX_ACCESS_TOKEN = "your_token_here";
  ```

- [ ] **Python environment** — follow the one-time setup steps in the
  "Updating the data" section below. Make sure the environment is activated
  every time you run the pipeline.
- [ ] **Git push access confirmed** — the pipeline auto-commits and pushes at
  the end. Run `git push --dry-run origin main` to confirm your credentials
  work before starting an overnight scrape.

### Ongoing responsibilities

- **Run the pipeline ~monthly** and confirm the live site updated afterward.
- After each run, check `data/history/run_summary.csv` to review new projects,
  status changes, and any data anomalies (see "Monitoring" in the pipeline
  section below).
- Keep the `MAPBOX_ACCESS_TOKEN` GitHub secret current if the token is ever
  rotated or expires.
