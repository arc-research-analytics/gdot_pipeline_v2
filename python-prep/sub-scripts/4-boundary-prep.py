# This script prepares the city and county boundary files for use in the map
# Update this script if you need to add or remove cities or counties from the map
# Note that this script only generates labels for the counties NOT the cities
# This is because the CartoDB basemap already has city labels

import geopandas as gpd
import os

# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
# CITY BOUNDARY PREP
# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
def prep_city_boundaries(output_dir='../data/cities/'):
    """
    Prepare city boundary files for the Atlanta metro area.
    
    Args:
        output_dir: Directory to save output files
    
    Returns:
        GeoDataFrame of prepared city boundaries
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Read in data from Geographies folder
    cities_gdf = gpd.read_file('../../Geographies/GA_cities.gpkg')

    # Clean up city names
    cities_gdf['NAME'] = cities_gdf['NAME'].str.replace(' city', '', regex=True)
    cities_gdf['NAME'] = cities_gdf['NAME'].str.replace(' town', '', regex=True)

    # Keep only name and geometry
    cities_gdf = cities_gdf[['NAME', 'geometry']]

    # List of cities to keep
    cities_to_keep = [
        "Acworth", 
        "Alpharetta", 
        "Atlanta", 
        "Auburn", 
        "Austell", 
        "Avondale Estates", 
        "Ball Ground", 
        "Berkeley Lake", 
        "Braselton", 
        "Brookhaven", 
        "Buford", 
        "Canton", 
        "Carrollton", 
        "Cartersville", 
        "Chamblee", 
        "Chattahoochee Hills", 
        "Clarkston", 
        "Clermont", 
        "College Park", 
        "Conyers", 
        "Covington", 
        "Cumming", 
        "Dacula", 
        "Dallas", 
        "Dawsonville", 
        "Decatur", 
        "Doraville", 
        "Douglasville", 
        "Duluth", 
        "Dunwoody", 
        "East Point", 
        "Emerson",
        "Fairburn", 
        "Fayetteville", 
        # "Flowery Branch", 
        "Forest Park", 
        # "Gainesville", 
        "Grayson", 
        "Griffin", 
        "Hampton", 
        "Hapeville", 
        "Holly Springs", 
        "Hoschton", 
        "Johns Creek", 
        "Jonesboro", 
        "Kennesaw", 
        "Lake City", 
        "Lawrenceville", 
        "Lithonia",
        "Locust Grove", 
        "Loganville", 
        "Lovejoy", 
        "Lilburn", 
        "Mableton", 
        "Marietta", 
        "McDonough", 
        "Milton", 
        "Monroe", 
        "Morrow", 
        "Mount Zion", 
        "Mulberry", 
        "Newnan", 
        "Norcross", 
        # "Oakwood", 
        "Oxford",
        "Palmetto", 
        "Peachtree City", 
        "Peachtree Corners", 
        "Powder Springs", 
        "Riverdale", 
        "Roswell", 
        "Sandy Springs", 
        "Senoia", 
        "Smyrna", 
        "Snellville", 
        "Social Circle", 
        "South Fulton", 
        "Statham", 
        "Stockbridge", 
        "Stonecrest", 
        "Stone Mountain", 
        "Sugar Hill", 
        "Suwanee", 
        "Tucker", 
        "Tyrone", 
        "Union City", 
        "Villa Rica", 
        "Waleska", 
        "Winder", 
        "Woodstock"
    ]
    
    cities_atl = cities_gdf[cities_gdf['NAME'].isin(cities_to_keep)]

    # Convert CRS to 4326
    cities_atl = cities_atl.to_crs(epsg=4326)

    # Export boundary file
    output_path = os.path.join(output_dir, 'ATL_cities.geojson')
    cities_atl.to_file(output_path, driver='GeoJSON')
    print(f"Saved city boundaries to {output_path}")
    
    return cities_atl

# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
# COUNTY BOUNDARY PREP
# - # - # - # - # - # - # - # - # - # - # - # - # - # - # - # -
def prep_county_boundaries(output_dir='../data/counties/'):
    """
    Prepare county boundary files for the Atlanta metro area.
    Generates both boundary and label (centroid) files.
    
    Args:
        output_dir: Directory to save output files
    
    Returns:
        Tuple of (county_boundaries, county_labels) GeoDataFrames
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Read in data
    counties_gdf = gpd.read_file('../../Geographies/GA_counties_geo.geojson')

    # Convert CRS to 4326
    counties_gdf = counties_gdf.to_crs(epsg=4326)

    # Keep only name and geometry
    counties_gdf = counties_gdf[['county_name', 'geometry']]

    # List of counties to keep
    counties_to_keep = [
        "Barrow", 
        "Bartow", 
        "Butts", 
        "Carroll", 
        "Cherokee", 
        "Clayton", 
        "Cobb", 
        "Coweta", 
        "Dawson", 
        "DeKalb", 
        "Douglas", 
        "Fayette", 
        "Forsyth", 
        "Fulton", 
        "Gwinnett", 
        # "Hall", 
        # "Haralson", 
        # "Heard", 
        "Henry", 
        # "Jasper",
        # "Lumpkin",
        # "Meriwether",
        # "Morgan", 
        "Newton", 
        "Pickens", 
        # "Pike", 
        "Paulding", 
        "Rockdale", 
        "Spalding", 
        "Walton"
    ]

    counties_atl = counties_gdf[counties_gdf['county_name'].isin(counties_to_keep)]

    # rename the county_name column to NAME
    counties_atl = counties_atl.rename(columns={'county_name': 'NAME'})

    # Create label points from centroids
    counties_atl_labels = counties_atl.copy()
    counties_atl_labels['geometry'] = counties_atl_labels.geometry.centroid

    # Export both files
    boundary_path = os.path.join(output_dir, 'ATL_counties.geojson')
    label_path = os.path.join(output_dir, 'ATL_counties_labels.geojson')
    
    counties_atl.to_file(boundary_path, driver='GeoJSON')
    counties_atl_labels.to_file(label_path, driver='GeoJSON')
    
    print(f"Saved county boundaries to {boundary_path}")
    print(f"Saved county label points to {label_path}")
    
    return counties_atl, counties_atl_labels



if __name__ == "__main__":
    print("Starting boundary file preparation...")
    
    # Prepare city boundaries (no labels needed, as the basemap contains labels)
    cities = prep_city_boundaries()
    
    # Prepare county boundaries & labels
    counties, county_labels = prep_county_boundaries()
    
    print("Boundary preparation complete!")