// import modules
import { initializeMap } from "./modules/MapCore.js";
import { setupGeographyRadioListener } from "./modules/GeoBoundaryLoader.js";
import { initThemeManager } from "./modules/ThemeManager.js";
import { setupProjectLoaderListener } from './modules/ProjectLoader.js';
import { setupCSVExportListener } from './modules/csvExport.js';
import { setupAdditionalGeosListener } from './modules/AdditionalGeos.js';
import { initializeURLState, setupBrowserNavigation } from './modules/URLManager.js';

// Initialize map
const map = initializeMap();

// Initialize the theme manager
initThemeManager(map);

// Initialize URL state and set up browser navigation
const initialFilters = initializeURLState();

// Helper function to toggle legend visibility based on projects layer visibility
function toggleLegendVisibility(shouldShowProjects) {
  const legendContainer = document.getElementById('map-legend');
  if (legendContainer) {
    legendContainer.style.display = shouldShowProjects ? 'block' : 'none';
  }
}

// Set up browser back/forward navigation
setupBrowserNavigation((filters) => {
  // When user navigates back/forward, update the UI to match URL
  updateUIFromFilters(filters);
  // Trigger a reload of projects with new filters
  triggerFilterReload();
});

// Wait for map to load before setting up listeners
map.on('load', () => {
  // Set up the event listener for geography selection
  setupGeographyRadioListener(map);

  // Set up the event listener for project loading
  setupProjectLoaderListener(map);

  // Set up listener for optional additional geo boundaries
  setupAdditionalGeosListener(map);
});

// Helper functions for URL-based navigation
function updateUIFromFilters(filters) {
  // Update geography radio selection
  const geographySelect = document.getElementById("geographySelect");
  if (geographySelect && geographySelect.value !== filters.level) {
    geographySelect.value = filters.level;
  }

  // Update status dropdown
  const statusSelect = document.getElementById("statusSelect");
  if (statusSelect && statusSelect.value !== filters.status) {
    statusSelect.value = filters.status;
  }

  // Update jurisdiction dropdowns based on level
  if (filters.level === "District") {
    const districtSelect = document.getElementById("geoDropdownSelect");
    if (districtSelect && filters.jurisdiction && districtSelect.value !== filters.jurisdiction.toString()) {
      districtSelect.value = filters.jurisdiction.toString();
    }
  } else if (filters.level === "County") {
    const countySelect = document.getElementById("countyDropdownSelect");
    if (countySelect && filters.jurisdiction && countySelect.value !== filters.jurisdiction) {
      countySelect.value = filters.jurisdiction;
    }
  } else if (filters.level === "City") {
    const citySelect = document.getElementById("cityDropdownSelect");
    if (citySelect && filters.jurisdiction) {
      // Convert spaces back to underscores for the dropdown value
      const dropdownValue = filters.jurisdiction.replace(/ /g, '_');
      if (citySelect.value !== dropdownValue) {
        citySelect.value = dropdownValue;
      }
    }
  }
}

function triggerFilterReload() {
  // Trigger a change event on geography select to reload everything
  const geographySelect = document.getElementById("geographySelect");
  if (geographySelect) {
    geographySelect.dispatchEvent(new CustomEvent('sl-change', { 
      detail: { value: geographySelect.value },
      bubbles: true 
    }));
  }
}

// Run this once on page load to apply the filter from URL
document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI elements from URL parameters
  updateUIFromFilters(initialFilters);

  const downloadBtn = document.getElementById("downloadBtn");
  const drawer = document.querySelector(".drawer-placement");
  const openButton = document.querySelector(".openDrawer");
  const closeButton = drawer.querySelector(".close-button");

  // if window.innerWidth is less than 768, remove downloadBtn
  if (window.innerWidth < 768) {
    downloadBtn.remove();
  }

  // Set up CSV export functionality for download button
  setupCSVExportListener();

  openButton.addEventListener("click", () => drawer.show());

  // Attach event listener to close button
  if (drawer && closeButton) {
    closeButton.addEventListener("click", () => drawer.hide());
  } else {
    console.error("drawer or closeButton not found at DOMContentLoaded.");
  }

  // Initialize projects visibility flag
  if (typeof window.__GDOT_PROJECTS_VISIBLE__ === 'undefined') {
    window.__GDOT_PROJECTS_VISIBLE__ = true;
  }

  // Open the drawer on desktop by default, keep closed on mobile
  // Wait until the web component is defined to avoid timing issues
  if (drawer) {
    // Hide until ready to avoid flash
    drawer.style.visibility = 'hidden';
    customElements.whenDefined('sl-drawer').then(() => {
      const isDesktop = window.innerWidth >= 768; // match CSS breakpoint
      drawer.open = isDesktop;
      // reveal after applying state
      requestAnimationFrame(() => {
        drawer.style.visibility = '';
      });
    });
  }

  // Hook up the projects visibility switch
  const toggleProjectsSwitch = document.getElementById('toggleProjectsSwitch');
  if (toggleProjectsSwitch) {
    // Initialize switch state to reflect current visibility (Show projects layer)
    toggleProjectsSwitch.checked = window.__GDOT_PROJECTS_VISIBLE__ ? true : false;
    
    // Initialize legend visibility based on switch state
    toggleLegendVisibility(toggleProjectsSwitch.checked);

    toggleProjectsSwitch.addEventListener('sl-change', () => {
      const shouldShow = toggleProjectsSwitch.checked === true; // switch ON means show projects
      window.__GDOT_PROJECTS_VISIBLE__ = shouldShow;
      const layerId = 'projects-layer';
      const sourceId = 'projects-source';

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', window.__GDOT_PROJECTS_VISIBLE__ ? 'visible' : 'none');
      }

      // Toggle legend visibility based on projects layer visibility
      toggleLegendVisibility(shouldShow);

      // If user turned off projects, we do not remove sources/layers other than visibility
      // If user turned them back on and the layer doesn't exist (e.g., after filters reload),
      // the addProjectsToMap call will create it with visibility set according to the flag
    });
  }
});
