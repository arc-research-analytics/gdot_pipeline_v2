// Handles all theme-related functionality for the application

// from config.js, import MAPBOX_ACCESS_TOKEN
import { MAPBOX_ACCESS_TOKEN } from '../config.js';
// from app-config.js, import non-sensitive configuration
import { DEFAULT_THEME } from '../app-config.js';
// import popup management for theme changes
import { closeCurrentPopup } from './ProjectDetail.js';

// Theme constants
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
};

// Theme-specific styles
const THEME_STYLES = {
    [THEMES.LIGHT]: {
        // mapbox
        basemapUrl: 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=' + MAPBOX_ACCESS_TOKEN,

        // // OR use cartodb
        // basemapUrl: 'https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',

        unselectedBoundaryColor: '#b0b0b0',
        selectedBoundaryColor: '#58585A',
        unselectedLineWidth: 0.5,
        selectedLineWidth: 2,
        textColor: '#000000',
        // Label styles — agency gray for selected, lighter gray for unselected
        selectedLabelColor: '#58585A',
        unselectedLabelColor: '#b0b0b0',
        selectedLabelHaloColor: '#ffffff',
        unselectedLabelHaloColor: '#ffffff',
        selectedLabelHaloWidth: 2,
        unselectedLabelHaloWidth: 0.5
    },
    [THEMES.DARK]: {
        // mapbox
        basemapUrl: 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=' + MAPBOX_ACCESS_TOKEN,

        // // OR use cartodb
        // basemapUrl: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',

        unselectedBoundaryColor: '#787878',
        selectedBoundaryColor: '#c8c8c8',
        unselectedLineWidth: 0.5,
        selectedLineWidth: 2,
        textColor: '#ffffff',
        // Label styles — light gray for selected, darker gray for unselected
        selectedLabelColor: '#c8c8c8',
        unselectedLabelColor: '#787878',
        selectedLabelHaloColor: '#000000',
        unselectedLabelHaloColor: '#262626',
        selectedLabelHaloWidth: 2,
        unselectedLabelHaloWidth: 0.5
    }
};

// Keep track of the current theme - initialize with the configured default
let currentTheme = DEFAULT_THEME;

/**
 * Initializes the theme manager and sets up event listeners
 * @param {Object} map - The Mapbox GL map instance
 * @returns {Object} - The theme manager API
 */
export function initThemeManager(map) {
    // Set up theme toggle button listener
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
            applyTheme(map, newTheme);

            const icon = themeToggleBtn.querySelector('wa-icon');
            const tooltip = document.getElementById('themeTooltip');
            if (newTheme === THEMES.DARK) {
                if (icon) icon.name = 'sun';
                if (tooltip) tooltip.textContent = 'Enable light mode';
            } else {
                if (icon) icon.name = 'moon';
                if (tooltip) tooltip.textContent = 'Enable dark mode';
            }
        });
    }

    // apply initial theme
    applyTheme(map, currentTheme);

    // Return the theme manager API
    return {
        getCurrentTheme: () => currentTheme,
        applyTheme: (theme) => applyTheme(map, theme),
        updateBoundaryColors: () => updateBoundaryColors(map)
    };
}

/**
 * Applies the specified theme to the map and boundaries
 * @param {Object} map - The Mapbox GL map instance
 * @param {string} theme - The theme to apply ('light' or 'dark')
 */
function applyTheme(map, theme) {
    if (!THEME_STYLES[theme]) {
        console.error(`Invalid theme: ${theme}`);
        return;
    }

    currentTheme = theme;

    // Close any open popups before theme change to avoid styling conflicts
    closeCurrentPopup(map);

    // Update the basemap tiles
    updateBasemap(map, theme);

    // Update boundary colors if they exist
    updateBoundaryColors(map);

    // Update text color
    updateTextColors(theme);
}

/**
 * Updates the basemap tiles based on the current theme
 * @param {Object} map - The Mapbox GL map instance
 * @param {string} theme - The theme to apply
 */
function updateBasemap(map, theme) {
    if (!map.getSource('carto')) {
        console.warn('Carto source not found on map');
        return;
    }

    const newTileUrl = THEME_STYLES[theme].basemapUrl;
    map.getSource('carto').setTiles([newTileUrl]);
}

/**
 * Updates the boundary layer colors based on the current theme
 * @param {Object} map - The Mapbox GL map instance
 */
function updateBoundaryColors(map) {
    const themeStyle = THEME_STYLES[currentTheme];

    // Update selected boundary outline
    if (map.getLayer('selected-boundary-outline')) {
        map.setPaintProperty(
            'selected-boundary-outline',
            'line-color',
            themeStyle.selectedBoundaryColor
        );
        map.setPaintProperty(
            'selected-boundary-outline',
            'line-width',
            themeStyle.selectedLineWidth
        );
    }

    // Update unselected boundary outline
    if (map.getLayer('unselected-boundary-outline')) {
        map.setPaintProperty(
            'unselected-boundary-outline',
            'line-color',
            themeStyle.unselectedBoundaryColor
        );
        map.setPaintProperty(
            'unselected-boundary-outline',
            'line-width',
            themeStyle.unselectedLineWidth
        );
    }

    // Make sure fills are transparent
    if (map.getLayer('selected-boundary')) {
        map.setPaintProperty(
            'selected-boundary',
            'fill-opacity',
            0
        );
    }

    // Update label styles
    // Selected labels
    if (map.getLayer('boundary-labels')) {
        map.setPaintProperty(
            'boundary-labels',
            'text-color',
            themeStyle.selectedLabelColor
        );
        map.setPaintProperty(
            'boundary-labels',
            'text-halo-color',
            themeStyle.selectedLabelHaloColor
        );
        map.setPaintProperty(
            'boundary-labels',
            'text-halo-width',
            themeStyle.selectedLabelHaloWidth
        );
    }

    // Unselected labels
    if (map.getLayer('boundary-labels-unselected')) {
        map.setPaintProperty(
            'boundary-labels-unselected',
            'text-color',
            themeStyle.unselectedLabelColor
        );
        map.setPaintProperty(
            'boundary-labels-unselected',
            'text-halo-color',
            themeStyle.unselectedLabelHaloColor
        );
        map.setPaintProperty(
            'boundary-labels-unselected',
            'text-halo-width',
            themeStyle.unselectedLabelHaloWidth
        );
    }

    // Force label source refresh if it exists
    if (map.getSource('label-source')) {
        try {
            const data = map.getSource('label-source')._data;
            setTimeout(() => {
                map.getSource('label-source').setData(data);
            }, 50);
        } catch (error) {
            console.warn('Could not refresh label source:', error);
        }
    }
}

/**
 * Returns the appropriate boundary style based on the current theme and selection state
 * @param {string} geographyType - The type of geography (Statewide, County, etc.)
 * @param {boolean} isSelected - Whether this is for the selected area
 * @returns {Object} - The boundary style object
 */
export function getBoundaryStyle(geographyType, isSelected = false) {
    const themeStyle = THEME_STYLES[currentTheme];

    if (isSelected) {
        return {
            "line-color": themeStyle.selectedBoundaryColor,
            "line-width": themeStyle.selectedLineWidth,
        };
    } else {
        return {
            "line-color": themeStyle.unselectedBoundaryColor,
            "line-width": themeStyle.unselectedLineWidth,
        };
    }
}

/**
 * Updates text elements based on the current theme
 * @param {string} theme - The theme to apply
 */
function updateTextColors(theme) {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        lastUpdatedElement.style.color = THEME_STYLES[theme].textColor;
        // Remove text shadow in dark mode, add it in light mode
        lastUpdatedElement.style.textShadow = 'none';
    }
}

/**
 * Returns the current theme
 * @returns {string} - The current theme ('light' or 'dark')
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * Returns the basemap URL for the specified theme (or current theme if not specified)
 * @param {string} [theme] - The theme to get the basemap URL for (optional)
 * @returns {string} - The basemap URL
 */
export function getBasemapUrl(theme = currentTheme) {
    if (!THEME_STYLES[theme]) {
        console.error(`Invalid theme: ${theme}`);
        return THEME_STYLES[THEMES.LIGHT].basemapUrl; // fallback to light theme
    }
    return THEME_STYLES[theme].basemapUrl;
}

/**
 * Returns the appropriate label style based on the current theme and selection state
 * @param {boolean} isSelected - Whether this is for the selected area
 * @returns {Object} - The label style object
 */
export function getLabelStyle(isSelected = false) {
    const themeStyle = THEME_STYLES[currentTheme];

    if (isSelected) {
        return {
            "text-color": themeStyle.selectedLabelColor,
            "text-halo-color": themeStyle.selectedLabelHaloColor,
            "text-halo-width": themeStyle.selectedLabelHaloWidth
        };
    } else {
        return {
            "text-color": themeStyle.unselectedLabelColor,
            "text-halo-color": themeStyle.unselectedLabelHaloColor,
            "text-halo-width": themeStyle.unselectedLabelHaloWidth
        };
    }
}
