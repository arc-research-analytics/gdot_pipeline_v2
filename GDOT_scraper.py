import csv
import pandas as pd
from playwright.sync_api import sync_playwright
from playwright._impl._errors import TimeoutError
import os

# Define constants
INPUT_CSV = 'data/GDOT_export_table.csv'
OUTPUT_CSV = 'scraped/scraped_projects.csv'


def scrape_project(project):
    # Use Playwright to scrape the project
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto(project['URL'], timeout=15000)
            page.wait_for_load_state('networkidle', timeout=15000)
        except TimeoutError:
            browser.close()
            scraped_info = {
                'ID': project['ID'],
                'URL': project['URL'],
                'County': project['County'],
                'District': project['District'],
                'Status': project['Status'],
                'Cost_estimate': 'No data found',
                'Description': 'No data found',
                'Manager': 'No data found',
                'Type': 'No data found',
            }
            return scraped_info

        # Extract additional information from the page
        description = None
        rows = page.query_selector_all(
            "table.ProjectDescriptionTable tbody tr")
        if len(rows) >= 2:
            cells = rows[1].query_selector_all("td")
            if cells:
                description = cells[0].inner_text().strip()

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

        # Create a dictionary with the scraped information
        scraped_info = {
            'ID': project['ID'],
            'URL': project['URL'],
            'County': project['County'],
            'District': project['District'],
            'Status': project['Status'],
            'Cost_estimate': cost_estimate,
            'Description': description,
            'Manager': manager,
            'Type': construction_type,
        }

        browser.close()
        return scraped_info


def save_scraped_project(scraped_info):
    file_exists = os.path.exists(OUTPUT_CSV)
    write_header = not file_exists or os.path.getsize(OUTPUT_CSV) == 0

    with open(OUTPUT_CSV, 'a', newline='') as csvfile:
        fieldnames = ['ID', 'URL', 'County', 'District',
                      'Status', 'Cost_estimate', 'Description', 'Manager', 'Type', ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow(scraped_info)


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

    for _, project in unscraped_projects.iterrows():
        scraped_info = scrape_project(project)
        save_scraped_project(scraped_info)
        project_count += 1
        progress = (scraped_so_far + project_count) / total_projects * 100
        print(
            f"Scraped project {project.ID}, {scraped_so_far + project_count:,} out of {total_projects:,} ({progress:.1f}% complete)")


if __name__ == '__main__':
    main()
    print("✅ Scraping complete!")
