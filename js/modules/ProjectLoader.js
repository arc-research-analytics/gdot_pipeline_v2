// Maps geography types to their corresponding project GeoJSON files.
// Using a base URL approach to handle both local and GitHub Pages deployments
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '../..'  // Local development
    : '.';     // GitHub Pages or production

const PROJECT_FILE_PATHS = {
    Statewide: `${BASE_URL}/data/projects/statewide_projects.geojson`,
    District: `${BASE_URL}/data/projects/district_projects.geojson`,
    County: `${BASE_URL}/data/projects/county_projects.geojson`,
    City: `${BASE_URL}/data/projects/city_projects.geojson`,
};

// Map HTML select option values to GeoJSON status values
export const STATUS_MAPPING = {
    "Pre_Construction": "PRE-CONSTRUCTION",
    "Under_Construction": "UNDER-CONSTRUCTION",
    "Completed_Construction": "COMPLETED-CONSTRUCTION",
    "All": null // null indicates no filter should be applied
};

// Default jurisdiction values for each geography type (using spaces as they appear in GeoJSON)
export const DEFAULT_JURISDICTIONS = {
    "City": "Atlanta",
    "County": "Fulton", 
    "District": 4,
    "Statewide": null // No jurisdiction filtering for statewide
};

// Define colors for each status
export const STATUS_COLORS = {
    "PRE-CONSTRUCTION": "#3498db", // Blue
    "UNDER-CONSTRUCTION": "#f39c12", // Orange
    "COMPLETED-CONSTRUCTION": "#27ae60" // Green
};

// Import the map legend module
import { initLegend, updateLegend } from './MapLegend.js';
// Import boundary management functions
import { updateBoundaryLayer } from './GeoBoundaryLoader.js';
// Import project statistics module
import { updateProjectStats, initializeProjectStats } from './ProjectStats.js';
// Import project detail interactivity module
import { setupProjectInteractivity, removeProjectInteractivity } from './ProjectDetail.js';

/**
 * Loads project GeoJSON data based on the selected geography type.
 * @param {string} geographyType - The selected geography type (Statewide, District, County, or City).
 * @returns {Promise<Object>} - A Promise resolving to the GeoJSON data.
 */
export async function loadProjectGeoJSON(geographyType) {
    const filePath = PROJECT_FILE_PATHS[geographyType];

    if (!filePath) {
        throw new Error(`Invalid geography type: ${geographyType}`);
    }

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch project GeoJSON: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error loading project GeoJSON for ${geographyType}:`, error);
        throw error;
    }
}

/**
 * Filters GeoJSON data based on the selected status
 * @param {Object} data - The GeoJSON data to filter
 * @param {string} status - The selected status filter value
 * @returns {Object} - Filtered GeoJSON data
 */
function filterProjectsByStatus(data, status) {
    // If status is "All" (maps to null), return all data
    if (!STATUS_MAPPING[status]) {
        return data;
    }

    // Create a deep copy of the GeoJSON to avoid modifying the original
    const filteredData = JSON.parse(JSON.stringify(data));

    // Filter features based on status
    filteredData.features = filteredData.features.filter(feature =>
        feature.properties && feature.properties.Status === STATUS_MAPPING[status]
    );

    return filteredData;
}

/**
 * Filters GeoJSON data based on the selected jurisdiction
 * @param {Object} data - The GeoJSON data to filter
 * @param {string|number|null} jurisdiction - The selected jurisdiction value
 * @param {string} geographyType - The geography type (City, County, District, Statewide)
 * @returns {Object} - Filtered GeoJSON data
 */
function filterProjectsByJurisdiction(data, jurisdiction, geographyType) {
    
    
    // If no jurisdiction specified or Statewide, return all data
    if (jurisdiction === null || geographyType === "Statewide") {
        
        return data;
    }

    // Create a deep copy of the GeoJSON to avoid modifying the original
    const filteredData = JSON.parse(JSON.stringify(data));

    // Filter features based on jurisdiction
    filteredData.features = filteredData.features.filter(feature => {
        if (!feature.properties || !feature.properties.hasOwnProperty('jurisdiction')) {
            return false;
        }
        
        // For District, jurisdiction is a number, so convert for comparison
        if (geographyType === "District") {
            const matches = feature.properties.jurisdiction === parseInt(jurisdiction);
            return matches;
        }
        
        // For City and County, jurisdiction is a string
        const matches = feature.properties.jurisdiction === jurisdiction;
        return matches;
    });

    
    
    // Log a sample of what we're filtering against
    if (data.features.length > 0) {
        const sampleJurisdictions = data.features.slice(0, 5).map(f => f.properties?.jurisdiction);
    }

    return filteredData;
}

/**
 * Gets the current jurisdiction value based on geography type
 * @param {string} geographyType - The selected geography type
 * @returns {string|number|null} - The current jurisdiction value
 */
export function getCurrentJurisdiction(geographyType) {
    
    
    switch (geographyType) {
        case "City":
            const citySelect = document.getElementById("cityDropdownSelect");
            let cityValue = citySelect && citySelect.value ? citySelect.value : DEFAULT_JURISDICTIONS.City;
            
            // Convert underscores back to spaces for GeoJSON filtering
            const cityResult = cityValue.replace(/_/g, ' ');
            
            return cityResult;
        case "County":
            const countySelect = document.getElementById("countyDropdownSelect");
            const countyResult = countySelect && countySelect.value ? countySelect.value : DEFAULT_JURISDICTIONS.County;
            
            return countyResult;
        case "District":
            const districtSelect = document.getElementById("geoDropdownSelect");
            let districtValue;
            if (districtSelect && districtSelect.value) {
                districtValue = parseInt(districtSelect.value);
            } else {
                districtValue = DEFAULT_JURISDICTIONS.District;
            }
            // Ensure we always have a valid district number
            if (isNaN(districtValue) || districtValue < 1 || districtValue > 14) {
                districtValue = DEFAULT_JURISDICTIONS.District;
            }
            
            return districtValue;
        case "Statewide":
        default:
            
            return DEFAULT_JURISDICTIONS.Statewide;
    }
}

/**
 * Shows/hides jurisdiction dropdowns based on selected geography type
 * @param {string} geographyType - The selected geography type
 */
function updateJurisdictionDropdownVisibility(geographyType) {
    
    
    const cityDropdown = document.getElementById("cityDropdownSelect");
    const countyDropdown = document.getElementById("countyDropdownSelect");
    const districtDropdown = document.getElementById("geoDropdownSelect");

    

    // Hide all dropdowns first
    if (cityDropdown) cityDropdown.style.display = "none";
    if (countyDropdown) countyDropdown.style.display = "none";
    if (districtDropdown) districtDropdown.style.display = "none";

    // Show the appropriate dropdown and ensure it has the correct default value
    switch (geographyType) {
        case "City":
            if (cityDropdown) {
                cityDropdown.style.display = "block";
                // Ensure default value is set
                if (!cityDropdown.value || cityDropdown.value === "") {
                    cityDropdown.value = "Atlanta";
                }
                
            }
            break;
        case "County":
            if (countyDropdown) {
                countyDropdown.style.display = "block";
                // Ensure default value is set
                if (!countyDropdown.value || countyDropdown.value === "") {
                    countyDropdown.value = "Fulton";
                }
                
            }
            break;
        case "District":
            if (districtDropdown) {
                districtDropdown.style.display = "block";
                // Ensure default value is set to District 4
                if (!districtDropdown.value || districtDropdown.value === "" || districtDropdown.value === "0") {
                    districtDropdown.value = "4";
                }
                
            }
            break;
        case "Statewide":
            
            // No dropdown needed for statewide
            break;
    }
}

/**
 * Adds project data to the map as a line layer
 * @param {Object} map - The Mapbox GL JS map instance
 * @param {Object} projectData - The GeoJSON project data
 * @param {string} geographyType - The geography type
 * @param {string} statusFilter - The selected status filter
 * @param {string|number|null} jurisdictionFilter - The selected jurisdiction filter
 */
export function addProjectsToMap(map, projectData, geographyType, statusFilter = "All", jurisdictionFilter = null) {
    
    
    const sourceId = "projects-source";
    const layerId = "projects-layer";

    // Remove existing layers and source if they exist
    if (map.getLayer(layerId)) {
        // Clean up interactive events before removing layer
        removeProjectInteractivity(map, layerId);
        map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }

    // If no jurisdiction filter provided, get current jurisdiction
    if (jurisdictionFilter === null) {
        jurisdictionFilter = getCurrentJurisdiction(geographyType);
    }

    // Apply both status and jurisdiction filters
    let filteredData = filterProjectsByStatus(projectData, statusFilter);
    filteredData = filterProjectsByJurisdiction(filteredData, jurisdictionFilter, geographyType);
    
    

    // Add the GeoJSON as a source
    map.addSource(sourceId, {
        type: "geojson",
        data: filteredData
    });

    // Look for existing label layers to place projects below them
    const labelLayerId = "boundary-labels";
    const unselectedLabelLayerId = "boundary-labels-unselected";
    let beforeLayerId = null;

    // If we're loading District geography, check if labels exist
    // and add projects below the bottom-most label layer
    if (geographyType === "District") {
        // Check for both label layers and choose the bottom one to place projects below
        if (map.getLayer(unselectedLabelLayerId)) {
            beforeLayerId = unselectedLabelLayerId;
        } else if (map.getLayer(labelLayerId)) {
            beforeLayerId = labelLayerId;
        }
    }

    // Add the layer with appropriate styling for lines
    // If beforeLayerId is set, add the layer below that layer
    const layerConfig = {
        id: layerId,
        type: "line",
        source: sourceId,
        layout: {
            "line-join": "round",
            "line-cap": "round",
            // Use a global flag to control initial visibility based on switch state
            "visibility": (window.__GDOT_PROJECTS_VISIBLE__ === false) ? "none" : "visible"
        },
        paint: {
            // Color lines based on status
            "line-color": [
                "match",
                ["get", "Status"],
                "PRE-CONSTRUCTION", STATUS_COLORS["PRE-CONSTRUCTION"],
                "UNDER-CONSTRUCTION", STATUS_COLORS["UNDER-CONSTRUCTION"],
                "COMPLETED-CONSTRUCTION", STATUS_COLORS["COMPLETED-CONSTRUCTION"],
                "#FF6B6B" // Default color for any other status
            ],
            "line-width": 4,
            "line-opacity": 1
        }
    };
    if (beforeLayerId) {
        map.addLayer(layerConfig, beforeLayerId);
    } else {
        map.addLayer(layerConfig);
    }

    // Set up interactive hover tooltips and click popups for projects
    setupProjectInteractivity(map, layerId);

    // Update the legend to match the current status filter
    updateLegend(STATUS_COLORS, statusFilter, STATUS_MAPPING);
    
    // Update project statistics based on the filtered data
    updateProjectStats(filteredData, geographyType, statusFilter, jurisdictionFilter);
}

/**
 * Sets up an event listener for the geography selection radio buttons.
 * When the selection changes, it loads the corresponding project GeoJSON.
 * @param {Object} map - The Mapbox GL JS map instance
 */
export function setupProjectLoaderListener(map) {
    
    
    const geographySelect = document.getElementById("geographySelect");
    const statusSelect = document.getElementById("statusSelect");

    if (!geographySelect) {
        console.error("❌ Geography select element not found");
        return;
    }

    if (!statusSelect) {
        console.error("❌ Status select element not found");
        return;
    }
    
    

    // Initialize the legend
    initLegend(map, STATUS_COLORS, STATUS_MAPPING);
    
    
    // Initialize the project statistics table
    initializeProjectStats();
    

    // Wait for the map to be fully loaded
    if (!map.loaded()) {
        
        map.on("load", () => {
            
            loadInitialProjects();
        });
    } else {
        
        loadInitialProjects();
    }

    function loadInitialProjects() {
        
        
        // Hardcode defaults to ensure consistent initial state
        const initialGeography = "District";
        const initialStatus = "All";
        const initialJurisdiction = 4;
        
        
        
        // Debug file path resolution
        

        // Ensure HTML elements have correct default values
        if (geographySelect.value !== initialGeography) {
            
            geographySelect.value = initialGeography;
        }
        if (statusSelect.value !== initialStatus) {
            
            statusSelect.value = initialStatus;
        }
        
        // Ensure district dropdown has correct default value
        const districtDropdown = document.getElementById("geoDropdownSelect");
        if (districtDropdown && districtDropdown.value !== initialJurisdiction.toString()) {
            
            districtDropdown.value = initialJurisdiction.toString();
        }

        // Update dropdown visibility for initial geography
        
        updateJurisdictionDropdownVisibility(initialGeography);
        
        // Use a more conservative delay and add retry logic
        
        setTimeout(() => {
            
            
            // Test each promise individually to see which one is failing
            
            loadProjectGeoJSON(initialGeography)
                .then(projectData => {
                    
                    
                    return updateBoundaryLayer(map, initialGeography)
                        .then(boundaryResult => {
                            
                            
                            if (!projectData || !projectData.features || projectData.features.length === 0) {
                                console.warn(`⚠️ No features found in project data:`, projectData);
                            } else {
                                
                            }
                            
                            addProjectsToMap(map, projectData, initialGeography, initialStatus, initialJurisdiction);
                        })
                        .catch(boundaryError => {
                            console.error("❌ updateBoundaryLayer failed:", boundaryError);
                            console.error("❌ Boundary error details:", boundaryError.stack || boundaryError);
                            
                            // Try to add projects anyway without boundaries
                            
                            addProjectsToMap(map, projectData, initialGeography, initialStatus, initialJurisdiction);
                        });
                })
                .catch(projectError => {
                    console.error("❌ loadProjectGeoJSON failed:", projectError);
                    console.error("❌ Project error details:", projectError.stack || projectError);
                    console.error("❌ Failed URL:", PROJECT_FILE_PATHS[initialGeography]);
                    
                    // Try to test if the file exists
                    fetch(PROJECT_FILE_PATHS[initialGeography], { method: 'HEAD' })
                        .then(response => {
                            
                            if (!response.ok) {
                                console.error(`❌ File does not exist or is not accessible: ${PROJECT_FILE_PATHS[initialGeography]}`);
                            }
                        })
                        .catch(headError => {
                            console.error(`❌ Could not check file existence:`, headError);
                        });
                });
        }, 300); // Increased delay for better reliability
    }

    // Set up event listener for changes to the geography selection
    geographySelect.addEventListener("sl-change", (event) => {
        const selectedGeography = event.target.value;
        const selectedStatus = statusSelect.value;
        
        

        // Update dropdown visibility when geography changes
        updateJurisdictionDropdownVisibility(selectedGeography);
        
        // Add a delay to ensure dropdown visibility changes take effect
        setTimeout(() => {
            // Get jurisdiction after dropdown visibility is updated
            const selectedJurisdiction = getCurrentJurisdiction(selectedGeography);
            

            // Update both projects and boundaries when geography changes
            Promise.all([
                loadProjectGeoJSON(selectedGeography),
                updateBoundaryLayer(map, selectedGeography)
            ]).then(([data]) => {
                
                addProjectsToMap(map, data, selectedGeography, selectedStatus, selectedJurisdiction);
            }).catch(console.error);
        }, 100); // Delay for dropdown initialization
    });

    // Set up event listener for changes to the status selection
    statusSelect.addEventListener("sl-change", (event) => {
        const selectedGeography = geographySelect.value;
        const selectedStatus = event.target.value;
        const selectedJurisdiction = getCurrentJurisdiction(selectedGeography);

        loadProjectGeoJSON(selectedGeography)
            .then(data => addProjectsToMap(map, data, selectedGeography, selectedStatus, selectedJurisdiction))
            .catch(console.error);
    });

    // Set up event listeners for jurisdiction dropdowns
    setupJurisdictionEventListeners(map, geographySelect, statusSelect);
}

/**
 * Sets up event listeners for jurisdiction dropdown changes
 * @param {Object} map - The Mapbox GL JS map instance
 * @param {HTMLElement} geographySelect - The geography selection element
 * @param {HTMLElement} statusSelect - The status selection element
 */
function setupJurisdictionEventListeners(map, geographySelect, statusSelect) {
    const cityDropdown = document.getElementById("cityDropdownSelect");
    const countyDropdown = document.getElementById("countyDropdownSelect");
    const districtDropdown = document.getElementById("geoDropdownSelect");

    // Helper function to reload projects with current filters
    function reloadProjectsWithCurrentFilters() {
        const selectedGeography = geographySelect.value;
        const selectedStatus = statusSelect.value;
        const selectedJurisdiction = getCurrentJurisdiction(selectedGeography);
        
        

        // Update both projects and boundaries when jurisdiction changes
        Promise.all([
            loadProjectGeoJSON(selectedGeography),
            updateBoundaryLayer(map, selectedGeography)
        ]).then(([data]) => {
            addProjectsToMap(map, data, selectedGeography, selectedStatus, selectedJurisdiction);
        }).catch(console.error);
    }

    // City dropdown change listener
    if (cityDropdown) {
        cityDropdown.addEventListener("sl-change", reloadProjectsWithCurrentFilters);
    }

    // County dropdown change listener
    if (countyDropdown) {
        countyDropdown.addEventListener("sl-change", reloadProjectsWithCurrentFilters);
    }

    // District dropdown change listener (existing one, just need to update it)
    if (districtDropdown) {
        districtDropdown.addEventListener("sl-change", reloadProjectsWithCurrentFilters);
    }
}