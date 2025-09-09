// Loading overlay management for handling loading states during project data loading
// Shows a semi-transparent overlay with spinner for slow network connections

// Using a singleton pattern to manage loading states
class LoadingManager {
  constructor() {
    this.isLoading = false;
    this.loadingTimer = null;
    this.fadeTimer = null;
    this.loadingStartTime = null;
    // Configurable threshold - can be easily adjusted as needed
    this.SHOW_DELAY_MS = 500; // Show spinner after 500ms by default
    this.FADE_DURATION_MS = 500; // Fade out duration to prevent flickering
  }

  /**
   * Set the delay threshold for when to show the loading overlay
   * @param {number} delayMs - Delay in milliseconds before showing overlay
   */
  setThreshold(delayMs) {
    this.SHOW_DELAY_MS = delayMs;
  }

  /**
   * Set the fade duration for smooth overlay hiding
   * @param {number} fadeMs - Fade duration in milliseconds
   */
  setFadeDuration(fadeMs) {
    this.FADE_DURATION_MS = fadeMs;
  }

  /**
   * Start tracking a loading operation
   * @param {string} message - Loading message to display (defaults to "Loading projects...")
   */
  startLoading(message = 'Loading projects...') {
    this.isLoading = true;
    this.loadingStartTime = Date.now();
    
    // Clear any existing timers
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    
    // If overlay is currently fading out, immediately show it again
    const overlay = document.getElementById('loadingOverlay');
    if (overlay && overlay.classList.contains('fade-out')) {
      overlay.classList.remove('fade-out');
      overlay.style.display = 'flex';
      // Update message if overlay is already visible
      const messageEl = overlay.querySelector('p');
      if (messageEl) messageEl.textContent = message;
    }
    
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
    
    this.hideOverlayWithFade();
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
   * Hide the loading overlay with smooth fade-out to prevent flickering
   */
  hideOverlayWithFade() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay || overlay.style.display === 'none') {
      return; // Already hidden or doesn't exist
    }

    // Start the fade-out animation
    overlay.classList.add('fade-out');
    
    // Restore map interaction immediately (fade is just visual)
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.pointerEvents = 'auto';
    }

    // Actually hide the element after fade completes
    this.fadeTimer = setTimeout(() => {
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('fade-out');
      }
      this.fadeTimer = null;
    }, this.FADE_DURATION_MS);
  }

  /**
   * Hide the loading overlay immediately (without fade)
   */
  hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('fade-out');
    }
    
    // Clear fade timer if running
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
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
   * Get the current fade duration setting
   * @returns {number} Current fade duration in milliseconds
   */
  getFadeDuration() {
    return this.FADE_DURATION_MS;
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
