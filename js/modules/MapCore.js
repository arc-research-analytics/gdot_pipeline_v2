// Handles core map initialization and basic map controls
import { MAPBOX_ACCESS_TOKEN } from '../config.js';

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
            "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://carto.com/">CARTO</a> | <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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
  mapInstance.addControl(scale);

  // Populate Info Dialog with last updated date and static info
  fetch(`${BASE_URL}/data/current_date.txt`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(dateRaw => {
      const rawDateText = (dateRaw || '').toString().trim();
      
      // Format the date to remove zero-padding from days
      let dateText = rawDateText;
      try {
        const parsedDate = new Date(rawDateText);
        if (!isNaN(parsedDate.getTime())) {
          // Format as "Month D, YYYY" without zero-padding
          dateText = parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (error) {
        console.warn('Could not parse date, using original format:', error);
        // Fall back to original dateText if parsing fails
      }
      
      const lastUpdatedText = `Welcome to an interactive tracker of Georgia Department of Transportation projects! This application was developed and is maintained by the Atlanta Regional Commission's <a href="https://atlantaregional.org/what-we-do/research-and-data/" target="_blank">Research and Analytics Department</a>. <br/><br/> Project data last accessed on ${dateText} from the GDOT API.`;
      const contentEl = document.getElementById('infoDialogContent');
      if (contentEl) {
        contentEl.innerHTML = `${lastUpdatedText} <br/> <br/> The "total allocated cost" is an estimate of a project's total value that falls within the selected jurisdiction's boundaries. It is calculated by determining the proportion of each project's roadway that falls within the selected jurisdiction's boundaries and then applying that proportion to the project's total cost. <br/><br/> For questions about this map or the source data, please reach out to <a href="mailto:wwright@atlantaregional.org?subject=GDOT%20tracker%20inquiry">Will Wright</a>, lead developer on the project at the ARC.`;
      } else {
        console.warn('Info dialog content element not found');
      }
    })
    .catch(error => {
      console.error('Error fetching current date for Info dialog:', error);
      const contentEl = document.getElementById('infoDialogContent');
      if (contentEl) {
        contentEl.innerHTML = `Data date unavailable. <br/> Allocated cost calculates the total project cost and assigns the commensurate dollar value within the filtered jurisdiction. <br/> For questions, please reach out to <a href="mailto:wwright@atlantaregional.org?subject=GDOT%20tracker%20inquiry">Will Wright</a>.`;
      }
    });

  // Project loader setup is now handled in main.js to avoid duplicate initialization

  // Theme management will be handled by ThemeManager.js

  return mapInstance;
}
