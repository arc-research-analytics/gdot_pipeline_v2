// Project Detail Module
// Handles interactive tooltips and popups for individual projects on the map

import { DEFAULT_THEME } from '../app-config.js';
import { getCurrentTheme } from './ThemeManager.js';
import { getFiltersFromURL } from './URLManager.js';

// Popup theme configuration - colors that work well against each basemap theme
const POPUP_THEMES = {
    light: {
        // For light basemap - branded blue background
        backgroundColor: '#1270B3',
        textColor: '#ffffff',
        accentColor: '#7ab8e4',
        borderColor: '#0d5a8e',
        linkColor: '#b8d9f2'
    },
    dark: {
        // For dark basemap - light gray background
        backgroundColor: '#E8E8E9',
        textColor: '#2c2c2e',
        accentColor: '#58585A',
        borderColor: '#c8c8ca',
        linkColor: '#1270B3'
    }
};

/**
 * Gets the current popup theme based on the active map theme
 * @returns {Object} - The popup theme object
 */
function getPopupTheme() {
    const currentTheme = getCurrentTheme();
    return POPUP_THEMES[currentTheme] || POPUP_THEMES[DEFAULT_THEME];
}

/**
 * Styles the popup tip/anchor to match the popup background color
 * @param {HTMLElement} popupElement - The popup DOM element
 * @param {string} backgroundColor - The popup background color
 */
function stylePopupTip(popupElement, backgroundColor) {
    if (!popupElement) return;
    
    const tip = popupElement.querySelector('.mapboxgl-popup-tip');
    if (!tip) return;
    
    // Reset all border colors first
    tip.style.borderTopColor = 'transparent';
    tip.style.borderBottomColor = 'transparent';
    tip.style.borderLeftColor = 'transparent';
    tip.style.borderRightColor = 'transparent';
    
    // Check the popup's anchor class to determine tip direction
    const classList = popupElement.classList;
    
    if (classList.contains('mapboxgl-popup-anchor-top') || 
        classList.contains('mapboxgl-popup-anchor-top-left') || 
        classList.contains('mapboxgl-popup-anchor-top-right')) {
        // Popup is above click point, tip points down
        tip.style.borderBottomColor = backgroundColor;
    } else if (classList.contains('mapboxgl-popup-anchor-bottom') || 
               classList.contains('mapboxgl-popup-anchor-bottom-left') || 
               classList.contains('mapboxgl-popup-anchor-bottom-right')) {
        // Popup is below click point, tip points up
        tip.style.borderTopColor = backgroundColor;
    } else if (classList.contains('mapboxgl-popup-anchor-left')) {
        // Popup is to the left of click point, tip points right
        tip.style.borderRightColor = backgroundColor;
    } else if (classList.contains('mapboxgl-popup-anchor-right')) {
        // Popup is to the right of click point, tip points left
        tip.style.borderLeftColor = backgroundColor;
    }
}

/**
 * Formats a number as currency (USD)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === '' || isNaN(parseFloat(amount))) {
        return '$0';
    }

    const numAmount = parseFloat(amount);

    // Handle very large numbers with abbreviations
    if (numAmount >= 1000000000) {
        return '$' + (numAmount / 1000000000).toFixed(1) + 'B';
    } else if (numAmount >= 1000000) {
        return '$' + (numAmount / 1000000).toFixed(1) + 'M';
    } else if (numAmount >= 1000) {
        return '$' + (numAmount / 1000).toFixed(1) + 'K';
    } else {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numAmount);
    }
}

/**
 * Generates the jurisdiction-specific text for the allocated cost label
 * @returns {string} The jurisdiction-specific label text
 */
function getJurisdictionLabel() {
    const filters = getFiltersFromURL();
    const level = filters.level;
    const jurisdiction = filters.jurisdiction;

    switch (level) {
        case 'Statewide':
            return 'Total Allocated Cost in the State';
        case 'District':
            return `Total Allocated Cost in District ${jurisdiction}`;
        case 'County':
            return `Total Allocated Cost in ${jurisdiction} County`;
        case 'City':
            return `Total Allocated Cost in ${jurisdiction}`;
        default:
            return 'Total Allocated Cost in Jurisdiction';
    }
}

/**
 * Creates and shows a simple hover tooltip
 * @param {Object} map - Mapbox map instance
 * @param {Object} e - Mouse event
 */
function showHoverTooltip(map, e) {
    // Remove any existing hover tooltip
    removeHoverTooltip(map);

    // Tooltip colors: #58585A in light mode; 20% tint (~#DEDEDE) in dark mode
    const isDark = getCurrentTheme() === 'dark';
    const bgColor   = isDark ? '#DEDEDE' : '#58585A';
    const textColor = isDark ? '#1a1a1a' : '#ffffff';
    const borderColor = isDark ? '#c0c0c0' : '#3d3d3f';

    // Create tooltip div
    const tooltip = document.createElement('div');
    tooltip.id = 'project-hover-tooltip';
    tooltip.innerHTML = 'Click for project detail';
    tooltip.style.cssText = `
        position: absolute;
        background: ${bgColor};
        color: ${textColor};
        padding: 6px 10px;
        border-radius: 4px;
        pointer-events: none;
        font-size: 14px;
        font-family: 'DINPro', Arial, sans-serif;
        font-weight: 400;
        z-index: 1000;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid ${borderColor};
    `;
    
    // Add to document first to get dimensions
    document.body.appendChild(tooltip);
    
    // Position tooltip with smart horizontal positioning
    positionTooltip(map, tooltip, e);
}

/**
 * Positions tooltip with smart edge detection
 * @param {Object} map - Mapbox map instance
 * @param {HTMLElement} tooltip - The tooltip element
 * @param {Object} e - Mouse event
 */
function positionTooltip(map, tooltip, e) {
    const rect = map.getContainer().getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const margin = 15; // Space from edge
    
    // Calculate proposed position (default: right of cursor)
    const cursorX = e.point.x + rect.left;
    const cursorY = e.point.y + rect.top;
    const defaultLeft = cursorX + 10;
    
    // Check if tooltip would extend beyond right edge
    const wouldOverflow = (defaultLeft + tooltipRect.width + margin) > viewportWidth;
    
    // Position horizontally
    if (wouldOverflow) {
        // Flip to left side of cursor
        const leftPosition = cursorX - tooltipRect.width - 10;
        // Ensure it doesn't go off the left edge
        tooltip.style.left = Math.max(margin, leftPosition) + 'px';
    } else {
        // Default right side of cursor
        tooltip.style.left = defaultLeft + 'px';
    }
    
    // Position vertically (above cursor, but not off-screen)
    const topPosition = cursorY - 30;
    tooltip.style.top = Math.max(margin, topPosition) + 'px';
}

/**
 * Removes the hover tooltip
 * @param {Object} map - Mapbox map instance
 */
function removeHoverTooltip(map) {
    const existingTooltip = document.getElementById('project-hover-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
}

/**
 * Updates hover tooltip position as mouse moves
 * @param {Object} map - Mapbox map instance
 * @param {Object} e - Mouse event
 */
function updateHoverTooltip(map, e) {
    const tooltip = document.getElementById('project-hover-tooltip');
    if (tooltip) {
        // Use the same smart positioning logic
        positionTooltip(map, tooltip, e);
    }
}

// Keep a single reference to the currently open popup to avoid stacking
let currentProjectPopup = null;

// Track the currently selected feature for highlighting
let selectedFeature = null;
let selectedLayerId = null;

// Track the currently hovered feature for highlighting
let hoveredFeature = null;
let hoveredLayerId = null;

/**
 * Creates and shows a detailed project popup
 * @param {Object} map - Mapbox map instance
 * @param {Object} e - Click event
 * @param {string} layerId - ID of the project layer
 */
function showProjectPopup(map, e, layerId) {
    // Remove hover tooltip when showing popup
    removeHoverTooltip(map);
    
    // Get the feature properties
    const feature = e.features[0];
    const props = feature.properties;
    
    // Get theme-appropriate colors
    const theme = getPopupTheme();
    
    // Extract and format the required fields
    const description = props.Description_short || "No description";
    const type = props.Type || "Unknown";
    const allocatedCost = formatCurrency(props.allocated_cost);
    const projectUrl = props.URL;
    const jurisdictionLabel = getJurisdictionLabel();

    // Create popup content HTML with theme-aware styling
    let popupContent = `
        <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 400; max-width: 300px;">
            <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 700; font-size: 17px; margin-bottom: 12px; color: ${theme.textColor}; border-bottom: 2px solid ${theme.accentColor}; padding-bottom: 8px;">
                Project Details
            </div>

            <div style="margin-bottom: 10px;">
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 500; color: ${theme.textColor}; margin-bottom: 2px;">Description:</div>
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 400; color: ${theme.textColor}; line-height: 1.4; font-size: 15px;">${description}</div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 500; color: ${theme.textColor}; margin-bottom: 2px;">Project Type:</div>
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 400; color: ${theme.textColor}; font-size: 15px;">${type}</div>
            </div>

            <div style="margin-bottom: 10px;">
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 500; color: ${theme.textColor}; margin-bottom: 2px;">${jurisdictionLabel}:</div>
                <div style="font-family: 'DINPro', Arial, sans-serif; font-weight: 400; color: ${theme.textColor}; font-size: 15px;">${allocatedCost}</div>
            </div>
    `;
    
    // Add project URL if it exists
    if (projectUrl && projectUrl.trim() !== '' && projectUrl !== 'null') {
        popupContent += `
			<div style="margin-top: 10px; margin-bottom: 2px;">
				<a href="${projectUrl}" target="_blank" style="font-family: 'DINPro', Arial, sans-serif; font-weight: 400; color: ${theme.linkColor}; text-decoration: none; word-break: break-all; font-size: 15px;"
				   onmouseover="this.style.textDecoration='underline'"
				   onmouseout="this.style.textDecoration='none'">
					Visit Project Site ↗
				</a>
			</div>
        `;
    }
    
    popupContent += `</div>`;
    
    // If there's an existing popup, remove it first to prevent duplicates
    if (currentProjectPopup) {
        try { currentProjectPopup.remove(); } catch (err) { console.warn('⚠️ Error removing previous popup:', err); }
        currentProjectPopup = null;
    }

    // Create and show the popup
    const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
        className: `gdot-popup gdot-popup-${getCurrentTheme()}`
    })
    .setLngLat(e.lngLat)
    .setHTML(popupContent)
    .addTo(map);
    
    // Apply theme-specific background styling to the popup
    const popupElement = popup.getElement();
    if (popupElement) {
        const popupContent = popupElement.querySelector('.mapboxgl-popup-content');
        if (popupContent) {
            popupContent.style.backgroundColor = theme.backgroundColor;
            popupContent.style.borderColor = theme.borderColor;
            popupContent.style.border = `1px solid ${theme.borderColor}`;
        }
        
        // Style the close button to match theme
        const closeButton = popupElement.querySelector('.mapboxgl-popup-close-button');
        if (closeButton) {
            closeButton.style.color = theme.textColor;
            closeButton.style.fontSize = '20px';
        }
        
        // Style the popup tip to match background - delay to ensure anchor classes are applied
        setTimeout(() => {
            stylePopupTip(popupElement, theme.backgroundColor);
        }, 0);
    }
    
    
    
    // Save reference as the current popup
    currentProjectPopup = popup;

    // Highlight the selected feature by making it thicker
    highlightSelectedFeature(map, feature, layerId);

    // Stop click propagation from popup container and close button to avoid re-triggering map click
    const popupEl = popup.getElement();
    if (popupEl) {
        popupEl.addEventListener('click', (ev) => {
            ev.stopPropagation();
        });
        const closeBtn = popupEl.querySelector('.mapboxgl-popup-close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
            });
        } else {
            console.warn('⚠️ Popup close button not found in DOM');
        }
    } else {
        console.warn('⚠️ Popup element not available to attach stopPropagation handlers');
    }

    // Remove hover tooltip when popup is closed
    popup.on('close', () => {
        removeHoverTooltip(map);
        clearSelectedFeature(map);
        if (currentProjectPopup === popup) {
            currentProjectPopup = null;
        }
    });
}

/**
 * Updates line width for a layer based on current hover and selection states
 * @param {Object} map - Mapbox map instance
 * @param {string} layerId - ID of the project layer
 */
function updateLineWidth(map, layerId) {
    if (!map.getLayer(layerId)) return;

    // Collect all Description_short values that should be highlighted (thick)
    const highlightDescriptions = [];

    if (selectedFeature && selectedLayerId === layerId) {
        highlightDescriptions.push(selectedFeature.properties.Description_short);
    }

    if (hoveredFeature && hoveredLayerId === layerId) {
        const hoveredDesc = hoveredFeature.properties.Description_short;
        // Only add if not already in the list
        if (!highlightDescriptions.includes(hoveredDesc)) {
            highlightDescriptions.push(hoveredDesc);
        }
    }

    if (highlightDescriptions.length > 0) {
        // Make any hovered or selected features thick (12), others normal (4)
        map.setPaintProperty(layerId, 'line-width', [
            'case',
            ['in', ['get', 'Description_short'], ['literal', highlightDescriptions]],
            12,  // 3x the normal width for hovered or selected features
            4    // normal width for other features
        ]);
    } else {
        // No highlights needed, all features get normal width
        map.setPaintProperty(layerId, 'line-width', 4);
    }
}

/**
 * Highlights a hovered feature by making its line thicker
 * @param {Object} map - Mapbox map instance
 * @param {Object} feature - The hovered feature
 * @param {string} layerId - ID of the project layer
 */
function highlightHoveredFeature(map, feature, layerId) {
    // Store the hovered feature and layer
    hoveredFeature = feature;
    hoveredLayerId = layerId;

    // Update line width to reflect hover state
    updateLineWidth(map, layerId);
}

/**
 * Clears the hovered feature highlight
 * @param {Object} map - Mapbox map instance
 */
function clearHoveredFeature(map) {
    if (hoveredFeature && hoveredLayerId) {
        const layerId = hoveredLayerId;

        // Clear the stored hover state
        hoveredFeature = null;
        hoveredLayerId = null;

        // Update line width to remove hover highlight
        if (map.getLayer(layerId)) {
            updateLineWidth(map, layerId);
        }
    }
}

/**
 * Highlights a selected feature by making its line thicker
 * @param {Object} map - Mapbox map instance
 * @param {Object} feature - The selected feature
 * @param {string} layerId - ID of the project layer
 */
function highlightSelectedFeature(map, feature, layerId) {
    // Store the selected feature and layer
    selectedFeature = feature;
    selectedLayerId = layerId;

    // Update line width to reflect selection state
    updateLineWidth(map, layerId);
}

/**
 * Clears the selected feature highlight and returns line width to normal
 * @param {Object} map - Mapbox map instance
 */
function clearSelectedFeature(map) {
    if (selectedFeature && selectedLayerId) {
        const layerId = selectedLayerId;

        // Clear the stored selection
        selectedFeature = null;
        selectedLayerId = null;

        // Update line width to remove selection highlight
        if (map.getLayer(layerId)) {
            updateLineWidth(map, layerId);
        }
    }
}

/**
 * Sets up interactive hover and click events for project layers
 * @param {Object} map - Mapbox map instance
 * @param {string} layerId - ID of the project layer
 */
// Track per-layer event handler references so we can reliably remove them
const layerEventHandlers = {};

export function setupProjectInteractivity(map, layerId) {
    

    // If we previously attached handlers to this layer, remove them first
    if (layerEventHandlers[layerId]) {
        const { mouseenter, mouseleave, mousemove, click } = layerEventHandlers[layerId];
        try { map.off('mouseenter', layerId, mouseenter); } catch {}
        try { map.off('mouseleave', layerId, mouseleave); } catch {}
        try { map.off('mousemove', layerId, mousemove); } catch {}
        try { map.off('click', layerId, click); } catch {}
        
        delete layerEventHandlers[layerId];
    }

    // Define stable handler functions and store them
    const handleMouseEnter = (e) => {
        map.getCanvas().style.cursor = 'pointer';
        showHoverTooltip(map, e);
        // Highlight the hovered feature by making it thicker
        if (e.features && e.features.length > 0) {
            highlightHoveredFeature(map, e.features[0], layerId);
        }
    };
    const handleMouseMove = (e) => {
        updateHoverTooltip(map, e);
    };
    const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
        removeHoverTooltip(map);
        // Remove hover highlight (but keep selection highlight if clicked)
        clearHoveredFeature(map);
    };
    const handleClick = (e) => {
        showProjectPopup(map, e, layerId);
    };

    layerEventHandlers[layerId] = {
        mouseenter: handleMouseEnter,
        mouseleave: handleMouseLeave,
        mousemove: handleMouseMove,
        click: handleClick,
    };

    // Attach handlers
    map.on('mouseenter', layerId, handleMouseEnter);
    map.on('mousemove', layerId, handleMouseMove);
    map.on('mouseleave', layerId, handleMouseLeave);
    map.on('click', layerId, handleClick);

    
}

/**
 * Closes any currently open project popup
 * This is useful when switching themes to avoid styling conflicts
 */
export function closeCurrentPopup(map) {
    if (currentProjectPopup) {
        try {
            currentProjectPopup.remove();
        } catch (err) {
            console.warn('⚠️ Error closing popup:', err);
        }
        currentProjectPopup = null;
    }
    // Also clear any selected feature highlighting
    if (map) {
        clearSelectedFeature(map);
    }
}

/**
 * Removes all project interactivity event listeners
 * @param {Object} map - Mapbox map instance
 * @param {string} layerId - ID of the project layer
 */
export function removeProjectInteractivity(map, layerId) {


    if (layerEventHandlers[layerId]) {
        const { mouseenter, mouseleave, mousemove, click } = layerEventHandlers[layerId];
        try { map.off('mouseenter', layerId, mouseenter); } catch {}
        try { map.off('mouseleave', layerId, mouseleave); } catch {}
        try { map.off('mousemove', layerId, mousemove); } catch {}
        try { map.off('click', layerId, click); } catch {}
        delete layerEventHandlers[layerId];

    } else {
        // Fallback in case we missed storing handlers for some reason
        try { map.off('mouseenter', layerId); } catch {}
        try { map.off('mouseleave', layerId); } catch {}
        try { map.off('mousemove', layerId); } catch {}
        try { map.off('click', layerId); } catch {}

    }

    // Clean up any remaining tooltips
    removeHoverTooltip(map);

    // Clear any hovered feature highlighting if this layer is being removed
    if (hoveredLayerId === layerId) {
        clearHoveredFeature(map);
    }

    // Clear any selected feature highlighting if this layer is being removed
    if (selectedLayerId === layerId) {
        clearSelectedFeature(map);
    }

}
