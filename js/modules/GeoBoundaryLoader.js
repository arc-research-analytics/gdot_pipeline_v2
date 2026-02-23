// Maps geography types to their corresponding geojson files.
// Using a base URL approach to handle both local and GitHub Pages deployments
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '../..'  // Local development
  : '.';     // GitHub Pages or production

const GEOGRAPHY_FILE_PATHS = {
  Statewide: `${BASE_URL}/data/statewide/stateGA.geojson`,
  County: `${BASE_URL}/data/counties/ATL_counties.geojson`,
  City: `${BASE_URL}/data/cities/ATL_cities.geojson`,
  District: `${BASE_URL}/data/congressional_districts/cdistricts.geojson`,
};

// Maps geography types to their corresponding label (centroid) geojson files
const GEOGRAPHY_LABEL_FILE_PATHS = {
  District: `${BASE_URL}/data/congressional_districts/cdistricts_centroids.geojson`,
  County: `${BASE_URL}/data/counties/ATL_counties_labels.geojson`,
};

// Import getBoundaryStyle from ThemeManager 
import { getBoundaryStyle, getLabelStyle } from './ThemeManager.js';
// Import map view configuration functions
import { applyMapView } from './MapViewConfig.js';
// Import jurisdiction management functions
import { getCurrentJurisdiction } from './ProjectLoader.js';

// Loads boundary GeoJSON data based on the selected geography type
export async function loadBoundaryGeoJSON(geographyType) {
  
  
  const filePath = GEOGRAPHY_FILE_PATHS[geographyType];
  

  if (!filePath) {
    console.error(`❌ Invalid geography type: ${geographyType}`);
    throw new Error(`Invalid geography type: ${geographyType}`);
  }

  try {
    
    const response = await fetch(filePath);
    
    
    if (!response.ok) {
      console.error(`❌ Fetch failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch geojson: ${response.statusText}`);
    }
    
    
    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error(`❌ Error loading boundary geojson for ${geographyType}:`, error);
    throw error;
  }
}

// Loads label (centroid) GeoJSON data for Districts and Counties
export async function loadLabelGeoJSON(geographyType) {
  // Only load labels for District and County
  if (geographyType !== "District" && geographyType !== "County") {
    return null;
  }

  const filePath = GEOGRAPHY_LABEL_FILE_PATHS[geographyType];
  if (!filePath) {
    return null;
  }

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch label geojson: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading label geojson for ${geographyType}:`, error);
    return null;
  }
}

// Helper function to check if a feature matches the selected value
function isFeatureSelected(feature, selectedValue, geographyType) {
  if (!feature.properties) return false;

  switch (geographyType) {
    case "District":
      const districtNumber = parseInt(selectedValue, 10);
      return feature.properties.DISTRICT === districtNumber;

    case "County":
      return (
        feature.properties.NAME === selectedValue
      );

    case "City":
      return (
        feature.properties.NAME === selectedValue
      );

    default:
      return false;
  }
}

// Updates the map with boundary layer based on the selected geography type
export async function updateBoundaryLayer(map, geographyType) {
  
  
  const sourceId = "boundary-source";
  const selectedLayerId = "selected-boundary";
  const unselectedLayerId = "unselected-boundary";
  const selectedOutlineLayerId = "selected-boundary-outline";
  const unselectedOutlineLayerId = "unselected-boundary-outline";
  const labelSourceId = "label-source";
  const labelLayerId = "boundary-labels";

  

  // Get the current jurisdiction selection using the new system
  let selectedValue = getCurrentJurisdiction(geographyType);
  
  // For District geography, ensure we have a valid default
  if (geographyType === "District" && (selectedValue === null || selectedValue === undefined)) {
    selectedValue = 4; // Default to District 4
    
  }
  
  // Convert to string for boundary matching if it's a number (District)
  if (typeof selectedValue === 'number') {
    selectedValue = selectedValue.toString();
  }
  
  
  
  // For map view configuration, we need the value with spaces (not underscores)
  // selectedValue already has spaces since getCurrentJurisdiction handles the conversion

  try {
    

    // Load the GeoJSON data for the selected geography type
    
    let boundaryData = await loadBoundaryGeoJSON(geographyType);
    

    // We're already being called from within a map load event, so skip the load check
    
    
    // Note: map.loaded() can sometimes return false even after the load event fires
    // due to Mapbox internal timing, but we know the map is ready since we're 
    // being called from the load event handler

    // Remove existing layers and source if they exist
    
    const layersToRemove = [
      selectedOutlineLayerId,
      unselectedOutlineLayerId,
      selectedLayerId,
      unselectedLayerId,
      labelLayerId,
      `${labelLayerId}-unselected`
    ];

    
    layersToRemove.forEach(layerId => {
      if (map.getLayer(layerId)) {
        
        map.removeLayer(layerId);
      }
    });

    
    if (map.getSource(sourceId)) {
      
      map.removeSource(sourceId);
    }

    if (map.getSource(labelSourceId)) {
      
      map.removeSource(labelSourceId);
    }
    
    
    
    

    // For City geography type, filter to only show the selected city
    if (geographyType === "City" && selectedValue) {
      // Filter the features to only include the selected city
      boundaryData.features = boundaryData.features.filter(feature =>
        isFeatureSelected(feature, selectedValue, geographyType)
      );

      // Mark the selected feature
      if (boundaryData.features.length > 0) {
        boundaryData.features[0].properties.isSelected = true;
      }
    } else {
      // For other geography types, mark selected features
      if (selectedValue && geographyType !== "Statewide") {
        boundaryData.features.forEach(feature => {
          feature.properties.isSelected = isFeatureSelected(feature, selectedValue, geographyType);
        });
      }
    }

    // Add the new source with all features
    map.addSource(sourceId, {
      type: "geojson",
      data: boundaryData,
    });

    // Get styles for selected and unselected boundaries
    const unselectedStyle = getBoundaryStyle(geographyType, false);
    const selectedStyle = getBoundaryStyle(geographyType, true);

    // Add the unselected features layer with transparent fill
    map.addLayer({
      id: unselectedLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0
      },
      filter: ["!=", ["get", "isSelected"], true]
    });

    // Add the selected feature layer with transparent fill (no fill color)
    map.addLayer({
      id: selectedLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0
      },
      filter: ["==", ["get", "isSelected"], true]
    });

    // Add the unselected features outline
    map.addLayer({
      id: unselectedOutlineLayerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": unselectedStyle["line-color"],
        "line-width": unselectedStyle["line-width"]
      },
      filter: ["!=", ["get", "isSelected"], true]
    });

    // Add the selected feature outline
    map.addLayer({
      id: selectedOutlineLayerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": selectedStyle["line-color"],
        "line-width": selectedStyle["line-width"]
      },
      filter: ["==", ["get", "isSelected"], true]
    });

    // Add label layer if geography type is District or County
    if (geographyType === "District" || geographyType === "County") {
      try {
        const labelData = await loadLabelGeoJSON(geographyType);

        if (labelData) {
          // Mark labels as selected based on the selected boundary
          if (selectedValue) {
            labelData.features.forEach(feature => {
              if (geographyType === "District") {
                const districtNum = parseInt(selectedValue, 10);
                const featureDistrict = feature.properties.DISTRICT;
                const isMatching = featureDistrict === districtNum;
                feature.properties.isSelected = isMatching;
              } else if (geographyType === "County") {
                const isSelected =
                  feature.properties.NAME === selectedValue;
                feature.properties.isSelected = isSelected;
              }
            });
          } else {
            // If no value is selected, mark all as unselected
            labelData.features.forEach(feature => {
              feature.properties.isSelected = false;
            });
          }

          // Add label source
          map.addSource(labelSourceId, {
            type: "geojson",
            data: labelData
          });

          // Force a data refresh to ensure labels update correctly
          // This is a crucial step to make labels refresh properly when changing selection
          setTimeout(() => {
            if (map.getSource(labelSourceId)) {
              map.getSource(labelSourceId).setData(labelData);
            }
          }, 50);

          // Get styles for selected and unselected labels
          const selectedLabelStyle = getLabelStyle(true);
          const unselectedLabelStyle = getLabelStyle(false);

          // Add label layer for unselected features
          map.addLayer({
            id: `${labelLayerId}-unselected`,
            type: "symbol",
            source: labelSourceId,
            layout: {
              "text-field": geographyType === "District" ?
                ["concat", "District ", ["to-string", ["get", "DISTRICT"]]] :
                ["upcase", ["get", "NAME"]],
              "text-font": geographyType === "District"
                ? ["DIN Pro Bold", "Arial Unicode MS Bold"]
                : ["DIN Pro Bold Italic", "Arial Unicode MS Bold"],
              "text-size": 16,
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "symbol-sort-key": 1, // Lower priority (render under)
            },
            paint: {
              "text-color": unselectedLabelStyle["text-color"],
              "text-halo-color": unselectedLabelStyle["text-halo-color"],
              "text-halo-width": unselectedLabelStyle["text-halo-width"]
            },
            filter: ["!=", ["get", "isSelected"], true]
          });

          // Add label layer for selected feature
          map.addLayer({
            id: labelLayerId,
            type: "symbol",
            source: labelSourceId,
            layout: {
              "text-field": geographyType === "District" ?
                ["concat", "District ", ["to-string", ["get", "DISTRICT"]]] :
                ["upcase", ["get", "NAME"]],
              "text-font": geographyType === "District"
                ? ["DIN Pro Bold", "Arial Unicode MS Bold"]
                : ["DIN Pro Bold Italic", "Arial Unicode MS Bold"],
              "text-size": 16,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "symbol-sort-key": 0, // Higher priority (render on top)
            },
            paint: {
              "text-color": selectedLabelStyle["text-color"],
              "text-halo-color": selectedLabelStyle["text-halo-color"],
              "text-halo-width": selectedLabelStyle["text-halo-width"]
            },
            filter: ["==", ["get", "isSelected"], true]
          });
        }
      } catch (error) {
        console.error(`Error adding label layer for ${geographyType}:`, error);
      }
    }

    // Apply the appropriate map view based on geography type and selection
    applyMapView(map, geographyType, selectedValue);

    
    return boundaryData;
  } catch (error) {
    console.error(`❌ Error updating boundary layer for ${geographyType}:`, error);
    console.error(`❌ Error stack:`, error.stack);
    throw error;
  }
}

// Sets up an event listener for the geography selection radio buttons
export function setupGeographyRadioListener(map) {
  const geographySelect = document.getElementById("geographySelect");
  if (!geographySelect) {
    console.error("Geography select element not found");
    return;
  }

  // Use hardcoded default to ensure consistent initial state
  const initialGeography = "District";
  
  // Ensure HTML element has correct default value
  if (geographySelect.value !== initialGeography) {
    geographySelect.value = initialGeography;
  }
  
  

  // Wait for the map to be loaded before setting up the initial boundary
  if (map.loaded()) {
    updateBoundaryLayer(map, initialGeography);
  } else {
    map.on("load", () => {
      updateBoundaryLayer(map, initialGeography);
    });
  }

  // Set up event listener for changes to the geography selection
  geographySelect.addEventListener("change", (event) => {
    const selectedGeography = event.target.value;

    // Update the boundary layer for the new geography type
    updateBoundaryLayer(map, selectedGeography);
  });

}


