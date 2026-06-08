# Master pipeline script for the GDOT Tracker data update.
# Run once a month from the python-prep/ directory: python pipeline.py
#
# Steps:
#   1. Deletes the old scrape output and calls the GDOT API (fast)
#   2. Scrapes project detail pages (12-15 hours)
#      → Pauses here for manual review of scrape summary
#   3. Finalizes data (spatial joins, cost allocation, GeoJSON output, monthly snapshot)
#   4. Monitors month-over-month changes (snapshot diff → changes.csv, run_summary.csv)
#   5. Commits and pushes new data/ contents to GitHub

import json
import os
import subprocess
import sys
import pandas as pd
from datetime import datetime

# Paths relative to python-prep/
SCRAPED_CSV = '../data/projects/2_scraped.csv'
STATEWIDE_GEOJSON = '../data/projects/statewide_projects.geojson'
REPO_ROOT = '..'


def step(label):
    print(f"\n{'─' * 52}")
    print(f"  {label}")
    print(f"{'─' * 52}")


def run_script(script):
    """Run a python-prep script using the same interpreter as this script."""
    subprocess.run([sys.executable, script], check=True)


def prompt_fresh_or_resume():
    """
    If an existing scrape file is found, ask whether to start fresh or resume.
    Returns True if starting fresh, False if resuming.
    If no scrape file exists, returns True (fresh start) automatically.
    """
    if not os.path.exists(SCRAPED_CSV):
        return True

    existing = pd.read_csv(SCRAPED_CSV)
    count = len(existing)
    print(
        f"\n Found existing 2_scraped.csv file ({count:,} projects already scraped).")
    print(f"\n What next?")
    print(f"  a) Start so fresh and so clean clean! (Delete existing scrape and re-pull from API)")
    print(f"  b) Resume. (Pick up where the scrape left off)")
    while True:
        answer = input("\n  Enter a or b: ").strip().lower()
        if answer == 'a':
            os.remove(SCRAPED_CSV)
            print("  Deleted existing scrape file. Starting fresh.")
            return True
        elif answer == 'b':
            print("  Resuming existing scrape.")
            return False
        print("  Please enter a or b.")


def print_scrape_summary():
    df = pd.read_csv(SCRAPED_CSV)
    total = len(df)
    unable = int((df['Cost_estimate'] == 'Unable to scrape').sum())
    no_data = int((df['Cost_estimate'] == 'No data found').sum())
    success = total - unable - no_data

    print(f"\n{'═' * 52}")
    print(f"  SCRAPE SUMMARY")
    print(f"{'═' * 52}")
    print(f"  Total projects:        {total:>6,}")
    print(
        f"  Successfully scraped:  {success:>6,}  ({success / total * 100:.1f}%)")
    print(
        f"  Unable to scrape:      {unable:>6,}  ({unable / total * 100:.1f}%)")
    if no_data > 0:
        print(
            f"  ⚠ Still 'No data found': {no_data:>4,}  — retry may not have completed")
    print(f"{'═' * 52}")


def prompt_proceed():
    while True:
        answer = input(
            "\nProceed with finalization and deploy? (y/n): ").strip().lower()
        if answer in ('y', 'n'):
            return answer == 'y'
        print("Please enter y or n.")


def run_git(project_count):
    date_str = datetime.now().strftime("%B %d, %Y")
    commit_msg = f"data update: {project_count:,} projects as of {date_str}"
    subprocess.run(['git', 'add', 'data/'],
                   check=True, cwd=REPO_ROOT)
    subprocess.run(['git', 'commit', '-m', commit_msg],
                   check=True, cwd=REPO_ROOT)
    subprocess.run(['git', 'push'],
                   check=True, cwd=REPO_ROOT)
    print(f"\nCommitted and pushed: \"{commit_msg}\"")


def main():
    print("╔══════════════════════════════════════════════════╗")
    print("║         GDOT Tracker Data Pipeline               ║")
    print("╚══════════════════════════════════════════════════╝")

    # ── Step 1: API call (skipped if resuming) ────────────
    fresh_start = prompt_fresh_or_resume()
    if fresh_start:
        step("Step 1 — API call")
        run_script('sub-scripts/1-api-call.py')
    else:
        step("Step 1 — API call (skipped — resuming existing scrape)")

    # ── Step 2: Scrape ────────────────────────────────────
    step("Step 2 — Scraping  (this will take ~15 hours)")
    run_script('sub-scripts/2-scraper.py')

    # Summary + manual gate
    print_scrape_summary()
    # if not prompt_proceed():
    #     print("\nExiting. Review 2_scraped.csv and run 3-finalize.py manually when ready.")
    #     sys.exit(0)

    # ── Step 3: Finalize ──────────────────────────────────
    step("Step 3 — Finalization")
    run_script('sub-scripts/3-finalize.py')

    # ── Step 4: Monitor month-over-month changes ──────────
    step("Step 4 — Monitoring (snapshot diff)")
    run_script('sub-scripts/6-monitor.py')

    # ── Step 5: Commit & push ─────────────────────────────
    step("Step 5 — Commit & push")
    with open(STATEWIDE_GEOJSON) as f:
        project_count = len(json.load(f)['features'])
    run_git(project_count)

    print("\n✅ Pipeline complete!")


if __name__ == '__main__':
    main()
