// Loading overlay management for handling loading states during project data loading
// Shows a semi-transparent overlay with spinner for slow network connections

// Using a singleton pattern to manage loading states
class LoadingManager {
  constructor() {
    this.isLoading = false;
    this.loadingTimer = null;
    this.loadingStartTime = null;
    // Configurable threshold - can be easily adjusted as needed
    this.SHOW_DELAY_MS = 500; // Show spinner after 500ms by default
  }

  /**
   * Set the delay threshold for when to show the loading overlay
   * @param {number} delayMs - Delay in milliseconds before showing overlay
   */
  setThreshold(delayMs) {
    this.SHOW_DELAY_MS = delayMs;
  }

  /**
   * Start tracking a loading operation
   * @param {string} message - Loading message to display (defaults to "Loading projects...")
   */
  startLoading(message = 'Loading projects...') {
    this.isLoading = true;
    this.loadingStartTime = Date.now();
    
    // Only show overlay if loading takes longer than threshold
    this.loadingTimer = setTimeout(() => {
      if (this.isLoading) { // Still loading after delay
        this.showOverlay(message);
      }
    }, this.SHOW_DELAY_MS);
  }

  /**
   * Stop the loading operation and hide overlay if shown
   */
  stopLoading() {
    this.isLoading = false;
    
    // Clear timer if it hasn't fired yet
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    
    this.hideOverlay();
  }

  /**
   * Show the loading overlay with message
   * @param {string} message - Message to display
   */
  showOverlay(message) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      console.warn('Loading overlay element not found in DOM');
      return;
    }

    const messageEl = overlay.querySelector('p');
    if (messageEl) messageEl.textContent = message;
    
    overlay.style.display = 'flex';
    
    // Prevent map interaction during loading
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.pointerEvents = 'none';
    }
  }

  /**
   * Hide the loading overlay and restore map interaction
   */
  hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    // Restore map interaction
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.pointerEvents = 'auto';
    }
  }

  /**
   * Get the current threshold setting
   * @returns {number} Current threshold in milliseconds
   */
  getThreshold() {
    return this.SHOW_DELAY_MS;
  }

  /**
   * Check if currently loading
   * @returns {boolean} True if loading is in progress
   */
  getIsLoading() {
    return this.isLoading;
  }
}

// Export a singleton instance
export const loadingManager = new LoadingManager();
