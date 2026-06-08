# This script is Part 2 of a pipeline to get transportation projects from the GDOT API.
# It script will scrape the project data from the GDOT website and save it to a CSV file
# Start to finish, this script will take a while to run (12-15 hours), but it is designed
# to run in chunks, so you can stop and resume later.
# If just starting from scratch, make sure to delete the OUTPUT_CSV shown below file before running.

import csv
import pandas as pd
from playwright.sync_api import sync_playwright
from datetime import datetime
import os

# Define constants
INPUT_CSV = '../data/projects/1_projects_to_scrape.csv'
OUTPUT_CSV = '../data/projects/2_scraped.csv'


def scrape_project(project):
    # Use Playwright to scrape the project
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(project['URL'], timeout=15000)
            page.wait_for_load_state('networkidle', timeout=15000)

            # Get the project manager and construction type from central table
            manager = None
            construction_type = None
            rows = page.query_selector_all(
                "table.ProjectInformationTable tbody tr")
            if len(rows) >= 3:
                cells = rows[2].query_selector_all("td")
                if len(cells) >= 4:
                    manager = cells[1].inner_text().strip()
                cells = rows[8].query_selector_all("td")
                if len(cells) >= 2:
                    construction_type = cells[1].inner_text().strip()

            # Get the cost estimate (if available) from lower table
            cost_estimate = 0
            rows = page.query_selector_all("table.rgMasterTable tbody tr")
            for row in rows:
                cells = row.query_selector_all("td")
                text_data = [cell.inner_text() for cell in cells]
                clean_data = [cell.replace("\xa0", " ").replace(
                    "¬†", "").strip() for cell in text_data]
                if len(clean_data) == 4:
                    try:
                        cost_estimate += float(clean_data[2].replace(
                            "$", "").replace(",", ""))
                    except ValueError:
                        cost_estimate += 0

            return {
                'ID': project['ID'],
                'URL': project['URL'],
                'Status': project['Status'],
                'Description_short': project['Desc_short'],
                'Description': project['Description'],
                'Cost_estimate': cost_estimate,
                'Type': construction_type,
                'Manager': manager,
            }

        except Exception:
            return {
                'ID': project['ID'],
                'URL': project['URL'],
                'Status': project['Status'],
                'Description_short': project['Desc_short'],
                'Description': project['Description'],
                'Cost_estimate': 'No data found',
                'Type': 'No data found',
                'Manager': 'No data found',
            }

        finally:
            browser.close()


def save_scraped_project(scraped_info):
    file_exists = os.path.exists(OUTPUT_CSV)
    write_header = not file_exists or os.path.getsize(OUTPUT_CSV) == 0

    with open(OUTPUT_CSV, 'a', newline='') as csvfile:
        fieldnames = ['ID', 'URL', 'Status', 'Description_short', 'Description', 'Cost_estimate', 'Type', 'Manager']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow(scraped_info)


# Retry tuning. Failures are kept as a *retryable* sentinel (never permanently marked),
# so each resume ('b') pass attacks only what's still failing and the residual converges.
FAILURE_SENTINELS = ('No data found', 'Unable to scrape')
RETRYABLE_SENTINEL = 'No data found'
CHECKPOINT_EVERY = 25  # flush the CSV after this many recoveries, so a kill is never costly


def _atomic_write_csv(df):
    """Write df to OUTPUT_CSV via a temp file + atomic rename (kill-safe, never half-written)."""
    tmp = OUTPUT_CSV + '.tmp'
    df.to_csv(tmp, index=False)
    os.replace(tmp, OUTPUT_CSV)


def retry_failed_projects():
    """
    Re-scrape any project still marked as a failure sentinel, updating rows in place.

    Incremental & kill-safe: recoveries are checkpointed to disk every CHECKPOINT_EVERY,
    so interrupting a retry pass never loses confirmed recoveries. Projects that fail
    again are left as a *retryable* sentinel (not permanently marked), so re-running the
    pipeline and choosing 'b' attempts only the stubborn remainder — the residual shrinks
    with each pass. Genuinely dead pages will never recover, so stop re-running once the
    residual stops shrinking (or do a final pass and accept it).
    """
    if not os.path.exists(OUTPUT_CSV):
        return

    df = pd.read_csv(OUTPUT_CSV, dtype={'ID': str})
    failed_idx = df.index[df['Cost_estimate'].isin(FAILURE_SENTINELS)].tolist()
    failed_count = len(failed_idx)

    if failed_count == 0:
        print("No failed projects to retry.")
        return

    print(f"\n{failed_count:,} project(s) still failing — retrying (incremental, kill-safe)...")

    recovered = 0
    since_checkpoint = 0
    for i, idx in enumerate(failed_idx, 1):
        project = {
            'ID': df.at[idx, 'ID'],
            'URL': df.at[idx, 'URL'],
            'Status': df.at[idx, 'Status'],
            'Desc_short': df.at[idx, 'Description_short'],
            'Description': df.at[idx, 'Description'],
        }
        scraped_info = scrape_project(project)
        if scraped_info['Cost_estimate'] == 'No data found':
            # Keep retryable — do NOT mark permanently failed.
            df.at[idx, 'Cost_estimate'] = RETRYABLE_SENTINEL
            df.at[idx, 'Type'] = RETRYABLE_SENTINEL
            df.at[idx, 'Manager'] = RETRYABLE_SENTINEL
            result_label = 'still failed'
        else:
            df.at[idx, 'Cost_estimate'] = scraped_info['Cost_estimate']
            df.at[idx, 'Type'] = scraped_info['Type']
            df.at[idx, 'Manager'] = scraped_info['Manager']
            recovered += 1
            since_checkpoint += 1
            result_label = 'recovered'
        print(f"  Retry {i}/{failed_count}: project {project['ID']} — {result_label}")

        if since_checkpoint >= CHECKPOINT_EVERY:
            _atomic_write_csv(df)
            since_checkpoint = 0

    _atomic_write_csv(df)
    still_failed = failed_count - recovered
    print(f"Retry pass complete — {recovered:,} recovered, {still_failed:,} still failing "
          f"(retryable — re-run and choose 'b' to attempt them again).")


def main():
    universe = pd.read_csv(INPUT_CSV)

    universe['ID'] = universe['ID'].astype(str)
    print(f"{len(universe):,} total projects to scrape in this batch!")

    # If some projects have already been scraped...
    if os.path.exists(OUTPUT_CSV):
        scraped_projects = pd.read_csv(OUTPUT_CSV)
        scraped_projects['ID'] = scraped_projects['ID'].astype(
            str).str.zfill(7)
        print(f"{len(scraped_projects):,} projects already scraped")
        unscraped_projects = universe[~universe['ID'].astype(
            str).isin(scraped_projects['ID'].astype(str))]

    # If starting from scratch...
    else:
        # If output CSV doesn't exist, scrape all projects
        unscraped_projects = universe
        print("starting from scratch")

    total_projects = len(universe)
    scraped_so_far = len(
        scraped_projects) if 'scraped_projects' in locals() else 0
    project_count = 0
    start_time = datetime.now()

    for _, project in unscraped_projects.iterrows():
        scraped_info = scrape_project(project)
        save_scraped_project(scraped_info)
        project_count += 1
        progress = (scraped_so_far + project_count) / total_projects * 100
        elapsed = datetime.now() - start_time
        elapsed_str = f"{int(elapsed.total_seconds() // 3600)}h {int((elapsed.total_seconds() % 3600) // 60)}m"
        print(
            f"Scraped project {project.ID}, {scraped_so_far + project_count:,} out of {total_projects:,} ({progress:.1f}% complete, {elapsed_str} elapsed)",
            end='\r', flush=True)

    print()  # move cursor to new line after progress updates
    retry_failed_projects()


if __name__ == '__main__':
    main()
    print("✅ Scraping complete!")
