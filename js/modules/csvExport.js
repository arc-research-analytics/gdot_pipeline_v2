// CSV Export Module for GDOT Projects
// Exports GeoJSON project data as CSV files without geometry

// Import project loading functionality
import { loadProjectGeoJSON } from './ProjectLoader.js';

/**
 * Converts GeoJSON features to CSV format
 * @param {Array} features - Array of GeoJSON features
 * @param {string} geographyType - The geography type for filename
 * @returns {string} CSV string
 */
function convertFeaturesToCSV(features, geographyType) {
    if (!features || features.length === 0) {
        console.warn('No features to export');
        return '';
    }

    // Define the desired column order and their display names
    const columnMapping = [
        { property: 'ID', displayName: 'Project ID' },
        { property: 'allocated_cost', displayName: 'Allocated Cost Estimate' },
        { property: 'Description', displayName: 'Description' },
        { property: 'Manager', displayName: 'Manager' },
        { property: 'Type', displayName: 'Project Type' },
        { property: 'Status', displayName: 'Status' },
        { property: 'URL', displayName: 'Project URL' },
        { property: 'jurisdiction', displayName: 'Jurisdiction' }
    ];

    // Create CSV header row with display names
    const csvRows = [];
    const displayHeaders = columnMapping.map(col => col.displayName);
    csvRows.push(displayHeaders.join(','));
    
    
    
    if (geographyType === 'District') {
        // Formatting handled below
    }
    
    // Add data rows
    features.forEach(feature => {
        if (feature.properties) {
            const row = columnMapping.map(col => {
                let value = feature.properties[col.property];
                
                // Special handling for District jurisdiction values
                if (col.property === 'jurisdiction' && geographyType === 'District' && value !== null && value !== undefined) {
                    // Convert district numbers to "District X" format
                    const districtNum = String(value).trim();
                    if (districtNum && !isNaN(districtNum)) {
                        value = `District ${districtNum}`;
                    }
                }
                
                // Handle values that might contain commas or quotes
                if (value === null || value === undefined) {
                    return '';
                }
                // Convert to string and escape quotes, wrap in quotes if contains comma
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvRows.push(row.join(','));
        }
    });
    
    
    return csvRows.join('\n');
}

/**
 * Triggers download of a CSV file
 * @param {string} csvContent - The CSV content string
 * @param {string} filename - The desired filename
 */
function downloadCSV(csvContent, filename) {
    // Create a blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a temporary download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    
}

/**
 * Gets the current geography type from the UI
 * @returns {string} The current geography type
 */
function getCurrentGeographyType() {
    const geographySelect = document.getElementById("geographySelect");
    return geographySelect ? geographySelect.value : "District";
}

/**
 * Exports the current geography level's projects as CSV
 */
export async function exportCurrentProjectsAsCSV() {
    try {
        const geographyType = getCurrentGeographyType();
        
        // Show some user feedback
        const downloadBtn = document.getElementById("downloadBtn");
        const originalContent = downloadBtn ? downloadBtn.innerHTML : '';
        
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<sl-icon name="hourglass" style="font-size: 18px; margin-top: 10px;"></sl-icon>';
        }
        
        // Load the full dataset for this geography type
        
        const projectData = await loadProjectGeoJSON(geographyType);
        
        if (!projectData || !projectData.features || projectData.features.length === 0) {
            throw new Error(`No project data found for ${geographyType}`);
        }
        
        
        
        // Convert to CSV
        
        const csvContent = convertFeaturesToCSV(projectData.features, geographyType);
        
        if (!csvContent) {
            throw new Error('Failed to generate CSV content');
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filename = `GDOT_${geographyType}_Projects_${timestamp}.csv`;
        
        // Trigger download
        
        downloadCSV(csvContent, filename);
        
        // Success feedback
        
        
        // Reset button
        if (downloadBtn) {
            setTimeout(() => {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalContent;
            }, 1000);
        }
        
    } catch (error) {
        console.error('❌ CSV export failed:', error);
        
        // Reset button and show error
        const downloadBtn = document.getElementById("downloadBtn");
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<sl-icon name="exclamation-triangle" style="font-size: 18px; margin-top: 10px; color: red;"></sl-icon>';
            
            setTimeout(() => {
                downloadBtn.innerHTML = '<sl-icon name="download" style="font-size: 18px; margin-top: 10px;"></sl-icon>';
            }, 3000);
        }
        
        // User-friendly error message
        alert(`Failed to export CSV: ${error.message}`);
    }
}

/**
 * Sets up the download button event listener
 */
export function setupCSVExportListener() {
    const downloadBtn = document.getElementById("downloadBtn");
    
    if (!downloadBtn) {
        return;
    }
    
    
    
    downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        
        exportCurrentProjectsAsCSV();
    });
    
    
}
