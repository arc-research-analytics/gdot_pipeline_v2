# This script is Part 1 of a pipeline to get transportation projects from the GDOT API
# This script will simply query the API and save the results to 2 files:
# 1. A file with the project data to be scraped (with unique ID)
# 2. A file with the project geometry to be joined back up later (with unique ID)
# Ask Mike A (or any other 🔑🥩 holders) if filters need to be applied

import requests
import pandas as pd
import geopandas as gpd
from datetime import datetime

# Fields kept (beyond the original 5) so the monitoring pipeline can track them
# month-over-month. Maps the raw API field name -> friendly column name carried
# downstream in 1_projects_to_scrape.csv. The 15-hour scrape ignores these extra
# columns; 3-finalize.py reads them back to build the monthly snapshot.
MONITOR_COLS = {
    'CONSTRUCTION_PERCENT_COMPLETE': 'Construction_pct_complete',
    'PAYMENT_PERCENT_COMPLETE':      'Payment_pct_complete',
    'CURR_COMPLETION_DATE':          'Curr_completion_date',
    'TPRO_PROJ_COMPLETE_DT':         'Programmed_completion_date',
    'AWARD_DATE':                    'Award_date',
    'TIME_STOPPED_DATE':             'Time_stopped_date',
    'SUBSTL_WORK_COMPL_DATE':        'Substl_work_compl_date',
    'IS_TIA_PROJECT':                'Is_TIA',
    'CONTRACTOR_NAME':               'Contractor',
    'LAST_REFRESH_DTTM':             'Last_refresh',
}
# Of those, these arrive as epoch-milliseconds and are converted to YYYY-MM-DD.
MONITOR_DATE_COLS = {
    'CURR_COMPLETION_DATE', 'TPRO_PROJ_COMPLETE_DT', 'AWARD_DATE',
    'TIME_STOPPED_DATE', 'SUBSTL_WORK_COMPL_DATE', 'LAST_REFRESH_DTTM',
}


def epoch_ms_to_date(value):
    """Convert an epoch-milliseconds value to a 'YYYY-MM-DD' string ('' if missing)."""
    if value is None or pd.isna(value):
        return ''
    try:
        return datetime.utcfromtimestamp(float(value) / 1000).strftime('%Y-%m-%d')
    except (ValueError, OverflowError, OSError):
        return ''

# Define the base URL of the MapServer layer
base_url = "https://enterprisegis.dot.ga.gov/hosting/rest/services/GDOT_Public_Outreach/Hub_Project_Search/MapServer/2/query"

# Define query parameters
params = {
    # filter by construction status to include both under construction and pre-construction
    "where": "CONSTRUTION_STATUS_DERIVED LIKE '%'",
    "outFields": "*",  # Get all fields
    "f": "geojson",  # Request data in GeoJSON format
    "returnGeometry": "true",  # Include geometry data
    "resultOffset": 0,  # Start from the first record
    "resultRecordCount": 1000  # Get 1000 records
}

# list to store each batch of GeoDataFrames
gdfs = []

while True:

    # Make the GET request
    response = requests.get(base_url, params=params)

    # Check if the request was successful
    if response.status_code == 200:
        data = response.json()

        batch_gdf = gpd.GeoDataFrame.from_features(data["features"])

        # if no more data is returned, break the loop
        if batch_gdf.empty:
            break

        gdfs.append(batch_gdf)

        print(
            f"Fetched {len(batch_gdf)} records (offset: {params['resultOffset']})")

        # increase offset by the batch size to fetch the next chunk
        params["resultOffset"] += params["resultRecordCount"]

    else:
        print(
            f"❌ Error fetching data: {response.status_code} - {response.text}")
        break

# Filter out empty GeoDataFrames
gdfs = [gdf.dropna(axis=1, how='all') for gdf in gdfs if not gdf.empty]

# Combine all batches into a single GeoDataFrame
if gdfs:
    gdot_projects = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
else:
    print("❌ No data retrieved.")

# drop any columns that ONLY contain NaN values
gdot_projects = gdot_projects.dropna(axis=1, how="all")

# replace spaces in the 'CONSTRUTION_STATUS_DERIVED' column with hyphens
gdot_projects['CONSTRUTION_STATUS_DERIVED'] = gdot_projects['CONSTRUTION_STATUS_DERIVED'].str.replace(
    " ", "-")
gdot_projects['CONSTRUCTION_STATUS_DERIVED'] = gdot_projects['CONSTRUTION_STATUS_DERIVED'].str.strip()

# if the 'CONTRACT_DESCRIPTION' column is empty, replace it with the 'SHORT_DESCR' column
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].fillna(
    gdot_projects['SHORT_DESCR'])

# define a list of sub-strings to keep in all caps; everything else in the 'SHORT_DESCR' column should be converted to title case
keep_all_caps = ["SR ", "CO ", "CR ", "US ", "RD", "SO ",
                 "CS ", "MI ", "SE ", "NE ", "SW ", "NW ",
                 "NS ", "CSX", "CCTV", "-TIA", " - TIA", "LCI", "GRTA"]

# convert to title case
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.title()
for sub_str in keep_all_caps:
    gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
        sub_str.title(), sub_str)

# clean up some of the description sub-strings
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Brdg", "Bridge")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Mtn ", "Mountain ")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Phase Ii", "Phase II")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Ph Ii", "Phase II")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Phase IIi", "Phase III")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Ph IIi", "Phase III")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Phase Iv", "Phase IV")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Phase Vi", "Phase VI")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Resf ", "Resurface ")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Rsrf ", "Resurface ")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Shldr ", "Shoulder ")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Recnst", "Reconstruction")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Cnst ", "Construction ")
gdot_projects['CONTRACT_DESCRIPTION'] = gdot_projects['CONTRACT_DESCRIPTION'].str.replace(
    "Fm ", "From ")

# drop unneeded columns
# NOTE: monitoring fields (percent-complete, completion/award/stop dates, TIA flag,
# contractor, last-refresh) are intentionally NOT dropped here — see MONITOR_COLS.
gdot_projects = gdot_projects.drop(columns=[
    'OBJECTID',
    'PRIORITY_CD',
    'SOURCE_OF_CONSTRUCTION_DATES',
    'CONTRACT_ID',
    'CONSTRUTION_STATUS_DERIVED_RSN',
    'ESRI_OID',
    'SHORT_DESCR',
    'REC_STATUS',
    'LET_RESP_CD',
    'PRIORITY_CD_DESCR',
    'CONST_STAT_CD',
    'PROJECT_COUNTIES',
], errors='ignore')

# create URL column
gdot_projects['URL'] = 'https://www.dot.ga.gov/applications/geopi/Pages/Dashboard.aspx?ProjectId=' + \
    gdot_projects['PROJ_ID'].astype(str)

# drop any duplicate columns.
# IMPORTANT: set the monitoring columns aside first. The dedup below drops columns
# that are value-identical to another column — and CONSTRUCTION_PERCENT_COMPLETE is
# always equal to PAYMENT_PERCENT_COMPLETE in this dataset, so it would be silently
# dropped (and then resurrected blank by the guard below). Preserving them verbatim
# keeps both columns and also spares them the dtype-mangling the transpose causes.
monitor_present = [c for c in MONITOR_COLS if c in gdot_projects.columns]
preserved = gdot_projects[monitor_present].copy()
deduped = gdot_projects.drop(columns=monitor_present).T.drop_duplicates().T
gdot_projects = pd.concat([deduped, preserved], axis=1)

# Ensure every monitoring column exists (some, e.g. TIME_STOPPED_DATE, can be all-null
# and get dropped earlier), then normalize the epoch-ms date fields to YYYY-MM-DD strings.
for src_col in MONITOR_COLS:
    if src_col not in gdot_projects.columns:
        gdot_projects[src_col] = ''
for date_col in MONITOR_DATE_COLS:
    gdot_projects[date_col] = gdot_projects[date_col].apply(epoch_ms_to_date)

# pare down (& create) the GeoDataFrame of projects
gdot_projects_gdf = gpd.GeoDataFrame(gdot_projects[[
    'PROJ_ID',
    'URL',
    'CONTRACT_DESCRIPTION',
    'CONSTRUTION_STATUS_DERIVED',
    'EXPANDED_DESCR',
    *MONITOR_COLS.keys(),
    'geometry',
]], crs="EPSG:4326")

# rename columns
gdot_projects_gdf = gdot_projects_gdf.rename(columns={
    'PROJ_ID': 'ID',
    'CONSTRUTION_STATUS_DERIVED': 'Status',
    'CONTRACT_DESCRIPTION': 'Desc_short',
    'EXPANDED_DESCR': 'Description',
    **MONITOR_COLS,
})

# sort the gdot_projects_gdf GeoDataFrame by Project_ID
gdot_projects_gdf = gdot_projects_gdf.sort_values(by=['ID'])

# Dedupe
gdot_projects_gdf = gdot_projects_gdf.drop_duplicates(
    subset=['ID'], keep='first')

# export 2 files: a CSV to scrape & a GeoJSON to retain the geometry (to be later joined back up)
gdot_projects_gdf.drop(columns=['geometry']).to_csv(
    '../data/projects/1_projects_to_scrape.csv', index=False)
gdot_projects_gdf[[
    'ID',
    'geometry'
]].to_file('../data/projects/GDOT_export_geometry.geojson', driver='GeoJSON')

print(f"✅ {len(gdot_projects_gdf):,} projects exported into data/projects folder.")