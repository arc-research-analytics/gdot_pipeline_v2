# This script is Part 3 of a pipeline to get transportation projects from the GDOT API
# This script will take the project data and geometry files and join them together
# It will also allocate the cost of the projects to the various jurisdictions, 
# save the output to GeoJSON files for each geography level, and save a timestamp file to the data folder


import geopandas as gpd
import pandas as pd
from datetime import datetime
from shapely.geometry import LineString
import os
import warnings
warnings.filterwarnings('ignore', 'GeoSeries.isna', UserWarning)

# Statewide bounding-box placeholder geometry — projects assigned this geometry
# have no real location data and must be excluded before spatial joins.
STATEWIDE_BBOX = LineString([
    (-85.60516500023209, 30.3557570005398),
    (-85.60516500023209, 35.000659000790286),
    (-80.7514289999175,  35.000659000790286),
    (-80.7514289999175,  30.3557570005398),
    (-85.60516500023209, 30.3557570005398),
])

# Define file paths
SCRAPED_CSV = '../data/projects/2_scraped.csv'
API_FIELDS_CSV = '../data/projects/1_projects_to_scrape.csv'  # carries monitoring fields from the API
PROJECT_GEOMETRY = '../data/projects/GDOT_export_geometry.geojson' # geometry file from export

# Monthly monitoring snapshot — one slim row per project per run, appended over time.
# Read by 6-monitor.py to diff month-over-month. See MONITORING_DESIGN.md.
HISTORY_DIR = '../data/history'
SNAPSHOT_CSV = os.path.join(HISTORY_DIR, 'snapshots.csv')
SNAPSHOT_COLUMNS = [
    'snapshot_date', 'ID', 'Status', 'Cost_estimate',
    'Construction_pct_complete', 'Payment_pct_complete',
    'Curr_completion_date', 'Programmed_completion_date', 'Award_date',
    'Time_stopped_date', 'Substl_work_compl_date',
    'Is_TIA', 'Contractor', 'Last_refresh',
]
DISTRICT_BOUNDARIES = '../data/congressional_districts/cdistricts.geojson'
COUNTY_BOUNDARIES = '../data/counties/ATL_counties.geojson'
CITY_BOUNDARIES = '../data/cities/ATL_cities.geojson'
OUTPUT_DIR = '../data/projects/'

# Output file names
STATEWIDE_OUTPUT = os.path.join(OUTPUT_DIR, 'statewide_projects.geojson')
DISTRICT_OUTPUT = os.path.join(OUTPUT_DIR, 'district_projects.geojson')
COUNTY_OUTPUT = os.path.join(OUTPUT_DIR, 'county_projects.geojson')
CITY_OUTPUT = os.path.join(OUTPUT_DIR, 'city_projects.geojson')

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_and_prepare_data():
    """
    Load the scraped CSV data and join with geometry data to create a GeoDataFrame.
    Also load boundary files for districts, counties, and cities.
    """
    print("Loading scraped project data...")
    # Load the scraped CSV data
    scraped_data = pd.read_csv(SCRAPED_CSV)
    
    # Convert cost estimates to numeric values
    scraped_data['Cost_estimate'] = pd.to_numeric(scraped_data['Cost_estimate'], errors='coerce')
    scraped_data['Cost_estimate'] = scraped_data['Cost_estimate'].fillna(0)

    # Fill blank Type values with 'Other'
    scraped_data['Type'] = scraped_data['Type'].fillna('Other')

    print(f"Loaded {len(scraped_data):,} scraped projects")
    
    # Load the project geometries
    print("Loading project geometries...")
    project_geometries = gpd.read_file(PROJECT_GEOMETRY)
    
    # Ensure ID fields are string type for joining
    scraped_data['ID'] = scraped_data['ID'].astype(str)
    project_geometries['ID'] = project_geometries['ID'].astype(str)

    # zero-pad ID field of scraped data to 7 digits
    scraped_data['ID'] = scraped_data['ID'].str.zfill(7)
    
    # Join scraped data with geometries
    print("Joining scraped data with geometries...")
    projects_gdf = project_geometries.merge(scraped_data, on='ID', how='inner')
    
    # Check how many projects were successfully joined
    print(f"Successfully joined {len(projects_gdf):,} projects with geometries")
    
    # Load boundary files
    print("Loading boundary files...")
    districts_gdf = gpd.read_file(DISTRICT_BOUNDARIES)
    counties_gdf = gpd.read_file(COUNTY_BOUNDARIES)
    cities_gdf = gpd.read_file(CITY_BOUNDARIES)
    
    print(f"Loaded {len(districts_gdf):,} districts, {len(counties_gdf):,} counties, and {len(cities_gdf):,} cities")
    
    # Ensure all data is in the same CRS
    target_crs = projects_gdf.crs
    districts_gdf = districts_gdf.to_crs(target_crs)
    counties_gdf = counties_gdf.to_crs(target_crs)
    cities_gdf = cities_gdf.to_crs(target_crs)
    
    return projects_gdf, districts_gdf, counties_gdf, cities_gdf

def process_statewide_projects(projects_gdf):
    """
    Process statewide projects - no cost allocation needed.
    Simply format and prepare the data for output.
    """
    print("Processing statewide projects...")
    
    # Create a copy to avoid modifying the original
    statewide_gdf = projects_gdf.copy()
    
    # Add necessary fields
    statewide_gdf['jurisdiction'] = 'Georgia'
    statewide_gdf['jurisdiction_type'] = 'State'
    statewide_gdf['allocated_cost'] = statewide_gdf['Cost_estimate']
    statewide_gdf['percent_in_jurisdiction'] = 100.0
    
    # Select and rename columns for consistent output
    output_columns = [
        'ID', 'URL', 'Status', 'Description_short', 'Description', 
        'Cost_estimate', 'allocated_cost', 'Type', 'Manager',
        'jurisdiction', 'jurisdiction_type', 'percent_in_jurisdiction', 'geometry'
    ]
    
    statewide_gdf = statewide_gdf[output_columns]
    
    print(f"Processed {len(statewide_gdf):,} statewide projects")
    return statewide_gdf

def intersect_and_allocate_costs(projects_gdf, boundaries_gdf, id_field, name_field, jurisdiction_type):
    """
    Intersect projects with boundary geometries and allocate costs based on length.
    
    Parameters:
    - projects_gdf: GeoDataFrame of projects
    - boundaries_gdf: GeoDataFrame of boundaries (districts, counties, cities)
    - id_field: Field name for the boundary ID
    - name_field: Field name for the boundary name
    - jurisdiction_type: Type of jurisdiction (District, County, City)
    
    Returns:
    - GeoDataFrame with projects allocated to jurisdictions
    """
    print(f"Processing {jurisdiction_type.lower()} intersections...")
    
    # Create empty list to store results
    allocated_projects = []
    
    # Process each project
    for idx, project in projects_gdf.iterrows():
        if idx % 100 == 0:
            print(f"  Processing project {idx} of {len(projects_gdf):,}")
        
        # Get project geometry and total length
        project_geom = project.geometry
        total_length = project_geom.length
        
        if total_length == 0:
            # Skip projects with zero length (points or invalid geometries)
            continue
            
        # Find intersecting boundaries
        intersecting_boundaries = boundaries_gdf[boundaries_gdf.intersects(project_geom)]
        
        if len(intersecting_boundaries) == 0:
            # No intersections found, skip this project for this jurisdiction level
            # This has the effect of dropping projects not in a city or any of the counties
            continue
            
        # Process each intersecting boundary
        for b_idx, boundary in intersecting_boundaries.iterrows():
            try:
                # Get intersection
                intersection = project_geom.intersection(boundary.geometry)
                
                # Skip if intersection is empty or not a LineString/MultiLineString
                if intersection.is_empty:
                    continue
                    
                # Calculate length of intersection
                intersection_length = intersection.length
                
                # Calculate percentage of project in this boundary
                percentage = (intersection_length / total_length) * 100
                
                # Allocate cost based on percentage
                allocated_cost = project['Cost_estimate'] * (percentage / 100)
                
                # Create a new feature with the intersection geometry
                new_feature = project.copy()
                new_feature.geometry = intersection
                new_feature['jurisdiction'] = boundary[name_field]
                new_feature['jurisdiction_id'] = boundary[id_field] if id_field else None
                new_feature['jurisdiction_type'] = jurisdiction_type
                new_feature['allocated_cost'] = allocated_cost
                new_feature['percent_in_jurisdiction'] = percentage
                
                allocated_projects.append(new_feature)
            except Exception as e:
                print(f"Error processing project {project['ID']} with {jurisdiction_type} {boundary[name_field]}: {e}")
    
    # Create GeoDataFrame from results
    if allocated_projects:
        result_gdf = gpd.GeoDataFrame(allocated_projects, crs=projects_gdf.crs)
        print(f"Created {len(result_gdf):,} {jurisdiction_type.lower()} project segments")
        return result_gdf
    else:
        print(f"No intersections found for {jurisdiction_type.lower()} level")
        return gpd.GeoDataFrame([], crs=projects_gdf.crs)

def process_district_projects(projects_gdf, districts_gdf):
    """Process projects at district level with cost allocation"""
    # Identify the ID and name fields for districts
    id_field = 'DISTRICT'  # Adjust based on your actual field name
    name_field = 'DISTRICT'  # Adjust based on your actual field name
    
    return intersect_and_allocate_costs(projects_gdf, districts_gdf, id_field, name_field, 'District')

def process_county_projects(projects_gdf, counties_gdf):
    """Process projects at county level with cost allocation"""
    # Identify the ID and name fields for counties
    id_field = None  # Adjust if you have an ID field
    name_field = 'NAME'  # Adjust based on your actual field name
    
    return intersect_and_allocate_costs(projects_gdf, counties_gdf, id_field, name_field, 'County')

def process_city_projects(projects_gdf, cities_gdf):
    """Process projects at city level with cost allocation"""
    # Identify the ID and name fields for cities
    id_field = None  # Adjust if you have an ID field
    name_field = 'NAME'  # Adjust based on your actual field name
    
    return intersect_and_allocate_costs(projects_gdf, cities_gdf, id_field, name_field, 'City')

def save_geojson(gdf, output_path):
    """Save GeoDataFrame to GeoJSON file"""
    if len(gdf) > 0:
        print(f"Saving {len(gdf):,} features to {output_path}")
        gdf.to_file(output_path, driver='GeoJSON')
    else:
        print(f"No features to save to {output_path}")

def filter_invalid_geometry(projects_gdf):
    """
    Remove projects whose geometry is the statewide bounding-box placeholder.
    These projects have no real location data and cannot be placed on the map.
    Returns the filtered GeoDataFrame and the count of removed projects.
    """
    mask = projects_gdf.geometry.apply(lambda g: g is not None and g.equals(STATEWIDE_BBOX))
    excluded_count = int(mask.sum())
    if excluded_count > 0:
        print(f"Excluding {excluded_count:,} project(s) with statewide placeholder geometry")
    filtered_gdf = projects_gdf[~mask].copy()
    return filtered_gdf, excluded_count

def append_snapshot():
    """
    Append one slim row per project to data/history/snapshots.csv for month-over-month
    monitoring. Joins the scraped cost (2_scraped.csv) with the monitoring fields the
    API now carries (1_projects_to_scrape.csv). Idempotent: re-running on the same day
    replaces that day's rows rather than duplicating them.
    """
    os.makedirs(HISTORY_DIR, exist_ok=True)
    snapshot_date = datetime.now().strftime('%Y-%m-%d')
    print(f"Appending monitoring snapshot for {snapshot_date}...")

    # The API file is the full project universe (incl. monitoring fields).
    api = pd.read_csv(API_FIELDS_CSV, dtype={'ID': str})
    api['ID'] = api['ID'].str.zfill(7)

    # The scraped file supplies the cost estimate (only thing the scrape adds here).
    scraped = pd.read_csv(SCRAPED_CSV, dtype={'ID': str})
    scraped['ID'] = scraped['ID'].str.zfill(7)
    scraped['Cost_estimate'] = pd.to_numeric(scraped['Cost_estimate'], errors='coerce')

    snap = api.merge(scraped[['ID', 'Cost_estimate']], on='ID', how='left')
    snap['snapshot_date'] = snapshot_date

    # Guarantee every expected column exists, then keep only the snapshot schema.
    for col in SNAPSHOT_COLUMNS:
        if col not in snap.columns:
            snap[col] = ''
    snap = snap[SNAPSHOT_COLUMNS]

    # If today's rows already exist (re-run), drop them before appending.
    if os.path.exists(SNAPSHOT_CSV):
        existing = pd.read_csv(SNAPSHOT_CSV, dtype={'ID': str})
        existing = existing[existing['snapshot_date'] != snapshot_date]
        combined = pd.concat([existing, snap], ignore_index=True)
    else:
        combined = snap

    combined.to_csv(SNAPSHOT_CSV, index=False)
    print(f"Snapshot now holds {len(combined):,} rows across "
          f"{combined['snapshot_date'].nunique()} run(s) → {SNAPSHOT_CSV}")


# Export timestamp and excluded-project count to be read by the frontend
def export_timestamp(excluded_count=0):
    current_date = datetime.now().strftime("%B %d, %Y")
    with open("../data/current_date.txt", "w") as f:
        f.write(current_date + "\n")
        f.write(str(excluded_count))

# Main execution
if __name__ == "__main__":
    # Load and prepare data
    projects_gdf, districts_gdf, counties_gdf, cities_gdf = load_and_prepare_data()

    # Remove projects with invalid statewide placeholder geometry before any spatial joins
    projects_gdf, excluded_count = filter_invalid_geometry(projects_gdf)
    print(f"Proceeding with {len(projects_gdf):,} projects after excluding {excluded_count:,} with invalid geometry")

    # Export timestamp and excluded count
    export_timestamp(excluded_count)

    # Append this run's monitoring snapshot (full project universe, slim columns)
    append_snapshot()

    print("Data loading and preparation complete.")

    # Process each geography level
    statewide_gdf = process_statewide_projects(projects_gdf)
    district_gdf = process_district_projects(projects_gdf, districts_gdf)
    county_gdf = process_county_projects(projects_gdf, counties_gdf)
    city_gdf = process_city_projects(projects_gdf, cities_gdf)
    
    # Save output files
    save_geojson(statewide_gdf, STATEWIDE_OUTPUT)
    save_geojson(district_gdf, DISTRICT_OUTPUT)
    save_geojson(county_gdf, COUNTY_OUTPUT)
    save_geojson(city_gdf, CITY_OUTPUT)
    
    print("Processing complete!")

