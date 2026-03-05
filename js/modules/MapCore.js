// Handles core map initialization and basic map controls
import { MAPBOX_ACCESS_TOKEN } from '../config.js';
import { DEFAULT_THEME } from '../app-config.js';
import { getBasemapUrl } from './ThemeManager.js';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;


// Base URL for relative paths (same approach as in other modules)
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '../..'  // Local development
  : '.';     // GitHub Pages or production

// Define private variables for the module
let mapInstance = null;

// Constants
const bounds = [
  [-90.46816803404282, 28.138365147624448], // Southwest coordinates
  [-74.77089467122902, 37.588973762609974], // Northeast coordinates
];

export function initializeMap() {
  // Create the map instance
  mapInstance = new mapboxgl.Map({
    container: "map", // container ID
    style: {
      version: 8,
      sources: {
        carto: {
          type: "raster",
          tiles: [
            getBasemapUrl(DEFAULT_THEME),
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.mapbox.com/">Mapbox</a> | <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        },
      },
      glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
      layers: [
        {
          id: "carto-layer",
          type: "raster",
          source: "carto",
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    },
    center: [-84.05, 32.84],
    zoom: 6.5,
    minZoom: 3,
    maxZoom: 20,
    crossOrigin: "anonymous",
    maxBounds: bounds,
  });

  // add scale bar
  const scale = new mapboxgl.ScaleControl({
    maxWidth: 175,
    unit: "imperial",
  });
  mapInstance.addControl(scale, 'bottom-left');

  // disable map rotation
  mapInstance.dragRotate.disable();
  mapInstance.touchZoomRotate.disableRotation();


  // Populate Info Dialog with last updated date and static info
  fetch(`${BASE_URL}/data/current_date.txt`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(dateRaw => {
      const lines = (dateRaw || '').toString().trim().split('\n');
      const rawDateText = lines[0].trim();
      const excludedCount = parseInt(lines[1], 10) || 0;

      // Format the date to remove zero-padding from days
      let dateText = rawDateText;
      try {
        const parsedDate = new Date(rawDateText);
        if (!isNaN(parsedDate.getTime())) {
          dateText = parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (error) {
        console.warn('Could not parse date, using original format:', error);
      }

      const invalidGeoNote = excludedCount > 0
        ? ` Note that ${excludedCount} project${excludedCount === 1 ? '' : 's'} featured invalid geography and ${excludedCount === 1 ? 'was' : 'were'} unable to be included on the map.`
        : '';

      const lastUpdatedText = `Welcome to an interactive tracker of Georgia Department of Transportation (GDOT) projects. This application was developed and is maintained by the <a href="https://atlantaregional.org/what-we-do/research-and-data/" target="_blank">Research and Innovation</a> Team at the Atlanta Regional Commission. <br/><br/> Project data last accessed ${dateText} from the GDOT API. Click <a href="https://enterprisegis.dot.ga.gov/hosting/rest/services/GDOT_Public_Outreach/Hub_Project_Search/MapServer/2/query" target="_blank">here</a> to access the GDOT REST endpoint used to populate this map.${invalidGeoNote}`;
      const contentEl = document.getElementById('infoDialogContent');
      if (contentEl) {
        contentEl.innerHTML = `${lastUpdatedText} <br/><br/> The "total allocated cost" as reported in the tool's side panel is an estimate of a project's total value that falls within the selected jurisdiction's boundaries. It is calculated by determining the proportion of each project's roadway that falls within those boundaries and then applying that proportion to the project's total cost. <br/><br/> For questions, please reach out to <a href="mailto:wwright@atlantaregional.org?subject=GDOT%20tracker%20inquiry">Will Wright</a>, data engineer and lead project developer.`;
      } else {
        console.warn('Info dialog content element not found');
      }
    })
    .catch(error => {
      console.error('Error fetching current date for Info dialog:', error);
      const contentEl = document.getElementById('infoDialogContent');
      if (contentEl) {
        contentEl.innerHTML = `Data date unavailable. <br/> Allocated cost calculates the total project cost and assigns the commensurate dollar value within the filtered jurisdiction. <br/> For questions, please reach out to <a href="mailto:wwright@atlantaregional.org?subject=GDOT%20tracker%20inquiry">Will Wright</a>, data engineer and web developer on the project.`;
      }
    });

  // Project loader setup is now handled in main.js to avoid duplicate initialization

  // Theme management will be handled by ThemeManager.js

  return mapInstance;
}
