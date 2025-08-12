// Project Detail Module
// Handles interactive tooltips and popups for individual projects on the map

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
 * Creates and shows a simple hover tooltip
 * @param {Object} map - Mapbox map instance
 * @param {Object} e - Mouse event
 */
function showHoverTooltip(map, e) {
    // Remove any existing hover tooltip
    removeHoverTooltip(map);
    
    // Create tooltip div
    const tooltip = document.createElement('div');
    tooltip.id = 'project-hover-tooltip';
    tooltip.innerHTML = 'Click for project detail';
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        pointer-events: none;
        font-size: 14px;
        font-family: 'Roboto', Arial, sans-serif;
        z-index: 1000;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
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

/**
 * Creates and shows a detailed project popup
 * @param {Object} map - Mapbox map instance
 * @param {Object} e - Click event
 */
function showProjectPopup(map, e) {
    // Remove hover tooltip when showing popup
    removeHoverTooltip(map);
    
    // Get the feature properties
    const feature = e.features[0];
    const props = feature.properties;
    
    
    
    // Extract and format the required fields
    const description = props.Description_short || "No description";
    const type = props.Type || "Unknown";
    const allocatedCost = formatCurrency(props.allocated_cost);
    const projectUrl = props.URL;
    
    // Create popup content HTML
    let popupContent = `
        <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 300px;">
            <div style="font-weight: bold; font-size: 17px; margin-bottom: 12px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
                Project Details
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; color: #34495e; margin-bottom: 4px;">Description:</div>
                <div style="color: #2c3e50; line-height: 1.4; font-size: 15px;">${description}</div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; color: #34495e; margin-bottom: 4px;">Project Type:</div>
                <div style="color: #2c3e50; font-size: 15px;">${type}</div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; color: #34495e; margin-bottom: 4px;">Total Allocated Cost in Jurisdiction:</div>
                <div style="color: #2c3e50; font-size: 15px;">${allocatedCost}</div>
            </div>
    `;
    
    // Add project URL if it exists
    if (projectUrl && projectUrl.trim() !== '' && projectUrl !== 'null') {
        popupContent += `
            <div style="margin-bottom: 10px;">
                <div style="font-weight: bold; color: #34495e; margin-bottom: 4px;">Project URL:</div>
                <div>
                    <a href="${projectUrl}" target="_blank" style="color: #3498db; text-decoration: none; word-break: break-all; font-size: 15px;" 
                       onmouseover="this.style.textDecoration='underline'" 
                       onmouseout="this.style.textDecoration='none'">
                        View Project Details ↗
                    </a>
                </div>
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
        maxWidth: '320px'
    })
    .setLngLat(e.lngLat)
    .setHTML(popupContent)
    .addTo(map);
    
    
    
    // Save reference as the current popup
    currentProjectPopup = popup;

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
        if (currentProjectPopup === popup) {
            currentProjectPopup = null;
        }
    });
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
    };
    const handleMouseMove = (e) => {
        updateHoverTooltip(map, e);
    };
    const handleMouseLeave = () => {
        map.getCanvas().style.cursor = '';
        removeHoverTooltip(map);
    };
    const handleClick = (e) => {
        showProjectPopup(map, e);
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
    
    
}
