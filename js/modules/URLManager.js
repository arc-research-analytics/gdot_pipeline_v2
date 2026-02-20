// URLManager.js - Handles URL query parameter management for GDOT Tracker filters

/**
 * Default values for URL parameters
 */
export const DEFAULT_PARAMS = {
    level: 'District',
    jurisdiction: '4', // Default to District 4
    status: 'All',
    type: ''
};

/**
 * Maps geography levels to their default jurisdictions
 */
export const DEFAULT_JURISDICTIONS = {
    'Statewide': null,
    'District': '4',
    'County': 'Fulton',
    'City': 'Atlanta'
};

/**
 * Reads current URL parameters and returns filter values
 * @returns {Object} Object containing level, jurisdiction, and status
 */
export function getFiltersFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const level = urlParams.get('level') || DEFAULT_PARAMS.level;
    const status = urlParams.get('status') || DEFAULT_PARAMS.status;
    
    // Get jurisdiction from URL or use default for the level
    let jurisdiction = urlParams.get('jurisdiction');
    if (!jurisdiction) {
        jurisdiction = DEFAULT_JURISDICTIONS[level];
    }
    
    // Validate the level parameter
    const validLevels = ['Statewide', 'District', 'County', 'City'];
    const finalLevel = validLevels.includes(level) ? level : DEFAULT_PARAMS.level;
    
    // Validate status parameter
    const validStatuses = ['All', 'Pre_Construction', 'Under_Construction', 'Completed_Construction'];
    const finalStatus = validStatuses.includes(status) ? status : DEFAULT_PARAMS.status;
    
    // Parse type parameter - stored as comma-separated string, returned as array
    const typeParam = urlParams.get('type') || '';
    const types = typeParam ? typeParam.split(',') : [];

    return {
        level: finalLevel,
        jurisdiction: jurisdiction,
        status: finalStatus,
        types: types
    };
}

/**
 * Updates URL parameters with current filter values
 * @param {string} level - Geography level (Statewide, District, County, City)
 * @param {string|number|null} jurisdiction - Selected jurisdiction
 * @param {string} status - Selected status filter
 */
export function updateURLParams(level, jurisdiction, status, types = []) {
    const params = new URLSearchParams();

    // Always set level and status
    params.set('level', level);
    params.set('status', status);

    // Only set jurisdiction if it's not null and not Statewide
    if (jurisdiction !== null && level !== 'Statewide') {
        params.set('jurisdiction', jurisdiction.toString());
    }

    // Only set type if types are selected
    if (types && types.length > 0) {
        params.set('type', types.join(','));
    }

    // Update URL without triggering page reload
    const newURL = `${window.location.pathname}?${params.toString()}`;

    // Only update if URL actually changed to avoid unnecessary history entries
    if (window.location.href !== new URL(newURL, window.location.origin).href) {
        window.history.pushState({ level, jurisdiction, status, types }, '', newURL);
    }
}

/**
 * Sets up browser back/forward navigation handling
 * @param {Function} callback - Function to call when user navigates back/forward
 */
export function setupBrowserNavigation(callback) {
    window.addEventListener('popstate', (event) => {
        // Get filters from URL after navigation
        const filters = getFiltersFromURL();
        
        // Call the callback with the new filter values
        if (callback && typeof callback === 'function') {
            callback(filters);
        }
    });
}

/**
 * Initializes URL state - called once on page load
 * This pushes initial state to history so back button works correctly
 */
export function initializeURLState() {
    const filters = getFiltersFromURL();
    
    // Push initial state to history if we don't already have state
    if (!window.history.state) {
        window.history.replaceState(
            { level: filters.level, jurisdiction: filters.jurisdiction, status: filters.status, types: filters.types },
            '',
            window.location.href
        );
    }
    
    return filters;
}
