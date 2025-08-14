// Map view configurations for different geography levels and selections
// Format: [longitude, latitude, zoom]

// Default view for the entire state of Georgia [lon, lat, desktopZoom, mobileZoom]
export const STATEWIDE_VIEW = [-83.643, 32.9, 6.5, 6.0];

// District views - Congressional districts
export const DISTRICT_VIEWS = {
    "1": [-81.81, 31.2, 7.5, 6.8],
    "2": [-84.46, 31.62, 7.5, 6.6],
    "3": [-84.74, 33.18, 8.0, 7.2],
    "4": [-84.18, 33.82, 9.9, 9.0],
    "5": [-84.37, 33.68, 10.1, 9.2],
    "6": [-84.59, 33.70, 9.6, 8.6],
    "7": [-84.11, 34.33, 8.9, 8.2],
    "8": [-83.25, 31.93, 7.4, 6.7],
    "9": [-83.9, 34.5, 8.5, 7.4],
    "10": [-83.4, 33.85, 7.9, 7.2],
    "11": [-84.68, 34.31, 9.0, 8.1],
    "12": [-82.20, 32.94, 7.5, 6.8],
    "13": [-84.1, 33.68, 9.3, 8.6],
    "14": [-85.0, 34.45, 8.2, 7.3]
};

// County views
export const COUNTY_VIEWS = {
    "Barrow": [-83.7, 34.0, 10.0, 9.25],
    "Bartow": [-84.83, 34.2, 9.5, 8.7],
    "Carroll": [-85.08, 33.6, 9.5, 8.7],
    "Cherokee": [-84.46, 34.23, 9.5, 8.7],
    "Clayton": [-84.35, 33.5, 10.0, 9.2],
    "Cobb": [-84.56, 33.9, 9.7, 8.9],
    "Coweta": [-84.8, 33.4, 9.5, 8.7],
    "Dawson": [-84.1, 34.45, 10.0, 9.2],
    "DeKalb": [-84.2, 33.8, 9.7, 8.9],
    "Douglas": [-84.8, 33.7, 10.0, 9.2],
    "Fayette": [-84.5, 33.4, 10.0, 9.2],
    "Forsyth": [-84.1, 34.2, 10.0, 9.2],
    "Fulton": [-84.4, 33.8, 9.0, 8.2],
    "Gwinnett": [-84.0, 34.0, 9.5, 8.7],
    "Hall": [-83.8, 34.3, 9.5, 8.7],
    "Henry": [-84.2, 33.5, 9.5, 8.7],
    "Newton": [-83.8, 33.58, 10.0, 9.2],
    "Paulding": [-84.9, 33.9, 9.7, 8.9],
    "Rockdale": [-84.0, 33.65, 10.5, 9.6],
    "Spalding": [-84.3, 33.3, 10.0, 9.2],
    "Walton": [-83.7, 33.79, 10.0, 9.2]
};

// City views | Pan west: MORE negative | Pan north: HIGHER number | zoom in: HIGHER number
export const CITY_VIEWS = {
    "Acworth": [-84.68, 34.07, 11.2, 10.4],
    "Alpharetta": [-84.28, 34.07, 11.1, 10.3],
    "Atlanta": [-84.39, 33.78, 10.5, 9.7],
    "Auburn": [-83.83, 34.02, 11.9, 11.0],
    "Austell": [-84.66, 33.82, 12.0, 11.1],
    "Avondale Estates": [-84.26, 33.78, 11.9, 11.0],
    "Ball Ground": [-84.38, 34.35, 11.9, 11.0],
    "Berkeley Lake": [-84.18, 33.98, 12.1, 11.2],
    "Braselton": [-83.80, 34.11, 11.9, 11.0],
    "Brookhaven": [-84.33, 33.87, 11.9, 11.0],
    "Brooks": [-84.45, 33.29, 11.9, 11.0],
    "Buford": [-84.00, 34.12, 11.8, 11.0],
    "Canton": [-84.5, 34.25, 11.6, 10.8],
    "Carrollton": [-85.10, 33.58, 11.5, 10.7],
    "Cartersville": [-84.80, 34.18, 11.2, 10.4],
    "Chamblee": [-84.29, 33.88, 11.9, 11.0],
    "Chattahoochee Hills": [-84.75, 33.58, 11.3, 10.5],
    "Clarkston": [-84.24, 33.81, 11.9, 11.0],
    "Clermont": [-83.77, 34.48, 12.1, 11.2],
    "College Park": [-84.45, 33.64, 11.9, 11.0],
    "Conyers": [-84.0, 33.67, 11.5, 10.7],
    "Covington": [-83.85, 33.61, 11.9, 11.0],
    "Cumming": [-84.14, 34.21, 12.1, 11.2],
    "Dacula": [-83.89, 33.98, 11.9, 11.0],
    "Dallas": [-84.85, 33.92, 11.9, 11.0],
    "Dawsonville": [-84.12, 34.44, 11.9, 11.0],
    "Decatur": [-84.28, 33.78, 12.0, 11.1],
    "Doraville": [-84.28, 33.90, 11.9, 11.0],
    "Douglasville": [-84.71, 33.75, 11.9, 11.0],
    "Duluth": [-84.14, 34.01, 12.0, 11.1],
    "Dunwoody": [-84.33, 33.94, 12.0, 11.1],
    "East Point": [-84.46, 33.66, 11.2, 10.4],
    "Emerson": [-84.75, 34.127, 11.5, 10.7],
    "Fairburn": [-84.61, 33.55, 11.9, 11.0],
    "Fayetteville": [-84.46, 33.45, 12.0, 11.1],
    "Flowery Branch": [-83.92, 34.18, 11.9, 11.0],
    "Forest Park": [-84.36, 33.62, 11.9, 11.0],
    "Gainesville": [-83.82, 34.29, 11.5, 10.7],
    "Grayson": [-83.96, 33.89, 12.1, 11.2],
    "Griffin": [-84.25, 33.24, 11.9, 11.0],
    "Hampton": [-84.29, 33.38, 11.9, 11.0],
    "Hapeville": [-84.41, 33.66, 12.1, 11.2],
    "Holly Springs": [-84.48, 34.17, 11.9, 11.0],
    "Hoschton": [-83.75, 34.08, 11.9, 11.0],
    "Johns Creek": [-84.2, 34.04, 11.5, 10.7],
    "Jonesboro": [-84.35, 33.51, 11.9, 11.0],
    "Kennesaw": [-84.62, 34.03, 12.0, 11.1],
    "Lake City": [-84.34, 33.61, 12.1, 11.2],
    "Lawrenceville": [-84.0, 33.96, 12.0, 11.1],
    "Lilburn": [-84.12, 33.89, 11.9, 11.0],
    "Lithonia": [-84.11, 33.71, 12.1, 11.2],
    "Locust Grove": [-84.11, 33.34, 11.9, 11.0],
    "Loganville": [-83.88, 33.84, 11.9, 11.0],
    "Lovejoy": [-84.30, 33.44, 11.9, 11.0],
    "Mableton": [-84.58, 33.81, 11.4, 10.6],
    "Marietta": [-84.55, 33.95, 11.5, 10.7],
    "McDonough": [-84.15, 33.44, 11.9, 11.0],
    "Milton": [-84.31, 34.14, 11.5, 10.7],
    "Monroe": [-83.70, 33.80, 11.9, 11.0],
    "Morrow": [-84.33, 33.58, 11.9, 11.0],
    "Mount Zion": [-85.18, 33.64, 11.9, 11.0],
    "Mulberry": [-83.87, 34.06, 11.8, 11.0],
    "Newnan": [-84.78, 33.38, 11.5, 10.7],
    "Norcross": [-84.20, 33.94, 12.0, 11.1],
    "Oakwood": [-83.88, 34.23, 11.9, 11.0],
    "Oxford": [-83.87, 33.62, 12.0, 11.1],
    "Palmetto": [-84.65, 33.53, 11.5, 10.7],
    "Peachtree City": [-84.57, 33.39, 11.5, 10.7],
    "Peachtree Corners": [-84.22, 33.97, 12.0, 11.1],
    "Powder Springs": [-84.69, 33.86, 11.8, 11.0],
    "Riverdale": [-84.40, 33.56, 11.9, 11.0],
    "Roswell": [-84.35, 34.05, 11.5, 10.7],
    "Sandy Springs": [-84.37, 33.93, 11.0, 10.2],
    "Senoia": [-84.55, 33.31, 11.9, 11.0],
    "Smyrna": [-84.50, 33.85, 11.9, 11.0],
    "Snellville": [-84.00, 33.86, 12.0, 11.1],
    "Social Circle": [-83.70, 33.65, 12.0, 11.1],
    "South Fulton": [-84.55, 33.64, 10.5, 9.7],
    "Statham": [-83.60, 33.965, 12.0, 11.1],
    "Stockbridge": [-84.23, 33.53, 11.9, 11.0],
    "Stonecrest": [-84.12, 33.68, 11.4, 10.6],
    "Stone Mountain": [-84.17, 33.80, 12.0, 11.1],
    "Sugar Hill": [-84.05, 34.11, 11.9, 11.0],
    "Suwanee": [-84.06, 34.06, 11.9, 11.0],
    "Tucker": [-84.20, 33.85, 12.0, 11.1],
    "Tyrone": [-84.59, 33.48, 12.0, 11.1],
    "Union City": [-84.56, 33.58, 11.9, 11.0],
    "Villa Rica": [-84.92, 33.72, 11.9, 11.0],
    "Waleska": [-84.55, 34.32, 12.1, 11.2],
    "Winder": [-83.72, 33.99, 11.9, 11.0],
    "Woodstock": [-84.52, 34.12, 12.0, 11.1]
};

/**
 * Get map view configuration based on geography type and selection
 * @param {string} geographyType - The type of geography (Statewide, District, County, City)
 * @param {string} selection - The selected value within that geography type
 * @returns {Array} - [longitude, latitude, zoom] configuration
 */
export function getMapView(geographyType, selection) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    let view;
    switch (geographyType) {
        case "Statewide":
            view = STATEWIDE_VIEW;
            break;
        case "District":
            view = DISTRICT_VIEWS[selection] || STATEWIDE_VIEW;
            break;
        case "County":
            view = COUNTY_VIEWS[selection] || STATEWIDE_VIEW;
            break;
        case "City":
            view = CITY_VIEWS[selection] || STATEWIDE_VIEW;
            break;
        default:
            view = STATEWIDE_VIEW;
    }

    // Support [lon, lat, desktopZoom, mobileZoom?]
    const longitude = view[0];
    const latitude = view[1];
    const desktopZoom = view[2];
    const mobileZoom = view[3];
    const zoom = isMobile && typeof mobileZoom === 'number' ? mobileZoom : desktopZoom;
    return [longitude, latitude, zoom];
}

/**
 * Apply the map view configuration to the map
 * @param {object} map - The Mapbox GL map object
 * @param {string} geographyType - The type of geography
 * @param {string} selection - The selected value
 * @param {boolean} animate - Whether to animate the transition (default: true)
 */
export function applyMapView(map, geographyType, selection, animate = true) {
    const [longitude, latitude, zoom] = getMapView(geographyType, selection);

    if (animate) {
        map.flyTo({
            center: [longitude, latitude],
            zoom: zoom,
            essential: true,
            duration: 1500
        });
    } else {
        map.jumpTo({
            center: [longitude, latitude],
            zoom: zoom
        });
    }
} 