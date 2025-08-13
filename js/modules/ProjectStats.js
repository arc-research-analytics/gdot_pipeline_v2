// Project Statistics Module
// Calculates and displays summary statistics for filtered project data

/**
 * Formats a number as currency (USD)
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '$0';
    }
    
    // Handle very large numbers with abbreviations
    if (amount >= 1000000000) {
        return '$' + (amount / 1000000000).toFixed(1) + 'B';
    } else if (amount >= 1000000) {
        return '$' + (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return '$' + (amount / 1000).toFixed(1) + 'K';
    } else {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

/**
 * Formats a large number with commas
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Calculates project statistics from filtered GeoJSON features
 * @param {Array} features - Array of GeoJSON features
 * @returns {Object} Statistics object with totalCount, totalAllocatedCost, and averageCost
 */
function calculateProjectStats(features) {
    
    
    if (!features || features.length === 0) {
        return {
            totalCount: 0,
            totalAllocatedCost: 0,
            averageCost: 0
        };
    }
    
    let totalAllocatedCost = 0;
    let validCostCount = 0;
    
    features.forEach(feature => {
        if (feature.properties && feature.properties.allocated_cost !== null && feature.properties.allocated_cost !== undefined) {
            const cost = parseFloat(feature.properties.allocated_cost);
            if (!isNaN(cost) && cost >= 0) {
                totalAllocatedCost += cost;
                validCostCount++;
            }
        }
    });
    
    const totalCount = features.length;
    const averageCost = totalCount > 0 ? totalAllocatedCost / totalCount : 0;
    
    
    
    return {
        totalCount,
        totalAllocatedCost,
        averageCost
    };
}

/**
 * Updates the project statistics table in the UI
 * @param {Object} stats - Statistics object from calculateProjectStats
 * @param {string} geographyType - Current geography type for context
 * @param {string|number} jurisdictionValue - Current jurisdiction value for context
 */
function updateStatsTable(stats, geographyType = '', jurisdictionValue = '') {
    const totalProjectsEl = document.getElementById('totalProjects');
    const totalAllocatedCostEl = document.getElementById('totalAllocatedCost');
    const averageProjectCostEl = document.getElementById('averageProjectCost');
    
    if (!totalProjectsEl || !totalAllocatedCostEl || !averageProjectCostEl) {
        console.warn('📊 Project stats table elements not found');
        return;
    }
    
    // Update the values
    totalProjectsEl.textContent = formatNumber(stats.totalCount);
    totalAllocatedCostEl.textContent = formatCurrency(stats.totalAllocatedCost);
    averageProjectCostEl.textContent = formatCurrency(stats.averageCost);
    
    
}

/**
 * Clears the project statistics table (shows dashes)
 */
function clearStatsTable() {
    const totalProjectsEl = document.getElementById('totalProjects');
    const totalAllocatedCostEl = document.getElementById('totalAllocatedCost');
    const averageProjectCostEl = document.getElementById('averageProjectCost');
    
    if (totalProjectsEl) totalProjectsEl.textContent = '-';
    if (totalAllocatedCostEl) totalAllocatedCostEl.textContent = '-';
    if (averageProjectCostEl) averageProjectCostEl.textContent = '-';
    
    
}

/**
 * Main function to update project statistics based on filtered data
 * This should be called whenever the map data is updated
 * @param {Object} filteredGeoJSON - The filtered GeoJSON data being displayed on the map
 * @param {string} geographyType - Current geography type (City, County, District, Statewide)
 * @param {string} statusFilter - Current status filter
 * @param {string|number} jurisdictionFilter - Current jurisdiction filter
 */
export function updateProjectStats(filteredGeoJSON, geographyType, statusFilter = 'All', jurisdictionFilter = null) {
    
    
    try {
        if (!filteredGeoJSON || !filteredGeoJSON.features) {
            console.warn('📊 No filtered data provided, clearing stats table');
            clearStatsTable();
            return;
        }
        
        // Calculate statistics from the filtered features
        const stats = calculateProjectStats(filteredGeoJSON.features);
        
        // Update the UI table
        updateStatsTable(stats, geographyType, jurisdictionFilter);
        
    } catch (error) {
        console.error('📊 Error updating project stats:', error);
        clearStatsTable();
    }
}

/**
 * Initializes the project statistics table with default values
 */
export function initializeProjectStats() {
    clearStatsTable();
}
