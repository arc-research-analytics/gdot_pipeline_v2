# Script 5 in the GDOT Tracker pipeline — EXPLORATORY / NOT PART OF MAIN OUTPUT.
# This was an attempt to further categorize projects using the long Description field
# from the scraper. It is not used by the frontend and its outputs (categorized_projects.geojson
# and categorized_projects.csv) are written to python-prep/ rather than data/.
# Reads the scraped project CSV, joins geometry from statewide_projects.geojson,
# assigns a high-level category to each project based on Description keywords
# (falling back to Description_short when Description is blank), applies
# Type-based overrides for remaining uncategorized projects, and exports
# the result as both a GeoJSON and a flat CSV.

import geopandas as gpd
import pandas as pd
import re

# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
# FILE PATHS (relative to python-prep/)
# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
INPUT_CSV        = '../data/projects/2_scraped.csv'
GEOMETRY_GEOJSON = '../data/projects/statewide_projects.geojson'
OUTPUT_GEOJSON   = 'categorized_projects.geojson'
OUTPUT_CSV       = 'categorized_projects.csv'

# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
# CATEGORY DEFINITIONS
# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
# Two keyword lists per category:
#   'keywords'       — for the full Description field
#   'short_keywords' — for Description_short (includes GDOT abbreviations like Rsrf, Pvmnt, Sdwlk)
#
# Order = priority. First match wins. Specific categories are listed before broad ones.

CATEGORIES = [
    {
        'name': 'Roundabout',
        'keywords':       ['roundabout'],
        'short_keywords': ['roundabout'],
    },
    {
        'name': 'Bike / Pedestrian',
        'keywords':       ['bicycle', 'pedestrian', 'sidewalk', 'shared-use', 'shared use path',
                           'bike lane', 'bike route', 'bike path', 'bike', 'greenway', 'trail'],
        'short_keywords': ['bicycle', 'pedestrian', 'sidewalk', 'greenway', 'trail',
                           'bike', 'ped', 'sdwlk'],
    },
    {
        'name': 'Road Widening',
        'keywords':       ['widen', 'lane addition', 'add lanes'],
        'short_keywords': ['widen'],
    },
    {
        'name': 'Bridge',
        'keywords':       ['bridge'],
        'short_keywords': ['bridge', 'br repl', 'br rehab'],
    },
    {
        'name': 'Rail',
        'keywords':       ['passenger rail', 'commuter rail', 'rail line', 'rail service'],
        'short_keywords': ['passenger rail', 'commuter rail'],
    },
    {
        'name': 'Airport',
        'keywords':       ['airport'],
        'short_keywords': ['airport'],
    },
    {
        'name': 'Signals / Traffic Control',
        'keywords':       ['signal', 'fiber optic', 'interconnect'],
        'short_keywords': ['signal', 'fiber optic', 'interconnect'],
    },
    {
        'name': 'Lighting',
        'keywords':       ['lighting', 'hps', 'led fixture', 'led light', 'led upgrade', 'led system'],
        'short_keywords': ['lighting', 'led'],
    },
    {
        'name': 'Safety',
        'keywords':       ['guardrail', 'rumble strip', 'barrier'],
        'short_keywords': ['guardrail', 'rumble', 'barrier'],
    },
    {
        'name': 'Drainage',
        'keywords':       ['drainage', 'stormwater', 'erosion'],
        'short_keywords': ['drainage', 'stormwater', 'erosion'],
    },
    {
        'name': 'Pavement Work',
        'keywords':       ['resurface', 'resurfacing', 'mill and inlay', 'mill & inlay',
                           'surface treatment', 'asphalt', 'restrip', 'restriping',
                           'pavement marking', 'pavement preservation', 'pavement', 'striping'],
        'short_keywords': ['resurf', 'rsrf', 'pavement', 'pvmnt', 'mill &', 'mill and',
                           'milling', 'restrip', 'striping', 'marking', 'mrkg', 'asphalt'],
    },
]


def match_keywords(text, keywords):
    """
    True if any keyword appears in text at a word boundary.
    \\b at the start prevents partial matches like 'rail' in 'guardrail'
    or 'ped' in 'speed'. Multi-word phrases match as contiguous substrings.
    """
    for kw in keywords:
        if re.search(r'\b' + re.escape(kw), text, re.IGNORECASE):
            return True
    return False


def categorize_row(row):
    """
    Return the first matching category for a project row.
    Uses Description when available; falls back to Description_short.
    """
    desc       = row['Description']
    desc_short = row['Description_short']

    if pd.notna(desc) and str(desc).strip() != '':
        text   = str(desc)
        kw_key = 'keywords'
    else:
        text   = str(desc_short)
        kw_key = 'short_keywords'

    for cat in CATEGORIES:
        if match_keywords(text, cat[kw_key]):
            return cat['name']

    return 'Other'


def apply_type_overrides(df):
    """
    Use the Type column to resolve projects that keyword matching left as 'Other'.
      - Intermodal  → Airport  (applied to all Intermodal rows, not just Other)
      - New Construction → keeps 'New Construction' as its own category
    """
    # All Intermodal projects become Airport regardless of keyword result
    df.loc[df['Type'] == 'Intermodal', 'Category'] = 'Airport'

    # New Construction projects that weren't caught by keywords keep the Type as Category
    df.loc[(df['Category'] == 'Other') & (df['Type'] == 'New Construction'), 'Category'] = 'New Construction'

    return df


def main():
    print("Loading scraped project data...")
    df = pd.read_csv(INPUT_CSV)
    print(f"  {len(df):,} projects loaded")

    print("Loading geometry...")
    gdf = gpd.read_file(GEOMETRY_GEOJSON)
    print(f"  {len(gdf):,} features loaded")

    # IDs: CSV = plain integers | GeoJSON = 7-digit zero-padded strings
    df['ID']  = df['ID'].astype(str).str.zfill(7)
    gdf['ID'] = gdf['ID'].astype(str).str.zfill(7)

    # Join — geometry from GeoJSON, project data from CSV
    print("Joining on ID...")
    merged = gdf[['ID', 'geometry']].merge(df, on='ID', how='inner')
    merged = gpd.GeoDataFrame(merged, geometry='geometry', crs=gdf.crs)
    print(f"  {len(merged):,} features joined successfully")

    # Categorize via keywords, then fill remaining gaps using the Type column
    print("Categorizing projects...")
    merged['Category'] = merged.apply(categorize_row, axis=1)
    merged = apply_type_overrides(merged)

    # Summary
    print("\n--- Category Breakdown ---")
    counts = merged['Category'].value_counts()
    for cat, count in counts.items():
        print(f"  {cat:30s} {count:>6,}  ({count / len(merged) * 100:5.1f}%)")
    print(f"  {'TOTAL':30s} {len(merged):>6,}")

    # Export GeoJSON
    print(f"\nExporting GeoJSON to {OUTPUT_GEOJSON}...")
    merged.to_file(OUTPUT_GEOJSON, driver='GeoJSON')

    # Export flat CSV (drop geometry)
    print(f"Exporting CSV to {OUTPUT_CSV}...")
    merged.drop(columns='geometry').to_csv(OUTPUT_CSV, index=False)

    print("Done!")


if __name__ == "__main__":
    main()
