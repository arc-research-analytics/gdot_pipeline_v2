// import modules
import { initializeMap } from "./modules/MapCore.js";
import { setupGeographyRadioListener } from "./modules/GeoBoundaryLoader.js";
import { initThemeManager } from "./modules/ThemeManager.js";
import { setupProjectLoaderListener } from './modules/ProjectLoader.js';
import { setupCSVExportListener } from './modules/csvExport.js';
import { setupAdditionalGeosListener } from './modules/AdditionalGeos.js';

// Base URL for relative paths (same approach as in other modules)
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '' // Local development - empty because we're already in js/
  : '.'; // GitHub Pages or production

// Initialize map
const map = initializeMap();

// Initialize the theme manager
const themeManager = initThemeManager(map);

// Wait for map to load before setting up listeners
map.on('load', () => {
  // Set up the event listener for geography selection
  setupGeographyRadioListener(map);

  // Set up the event listener for project loading
  setupProjectLoaderListener(map);

  // Set up listener for optional additional geo boundaries
  setupAdditionalGeosListener(map);
});

// Run this once on page load to apply the default filter
document.addEventListener("DOMContentLoaded", () => {
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

  // Hook up the projects visibility switch
  const toggleProjectsSwitch = document.getElementById('toggleProjectsSwitch');
  if (toggleProjectsSwitch) {
    // Initialize switch state to reflect current visibility (Show projects layer)
    toggleProjectsSwitch.checked = window.__GDOT_PROJECTS_VISIBLE__ ? true : false;

    toggleProjectsSwitch.addEventListener('sl-change', () => {
      const shouldShow = toggleProjectsSwitch.checked === true; // switch ON means show projects
      window.__GDOT_PROJECTS_VISIBLE__ = shouldShow;
      const layerId = 'projects-layer';
      const sourceId = 'projects-source';

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', window.__GDOT_PROJECTS_VISIBLE__ ? 'visible' : 'none');
      }

      // If user turned off projects, we do not remove sources/layers other than visibility
      // If user turned them back on and the layer doesn't exist (e.g., after filters reload),
      // the addProjectsToMap call will create it with visibility set according to the flag
    });
  }
});
