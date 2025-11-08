// Timeline Configuration
let yearWidth = 100; // Default width per year in pixels
let minYear = null;
let maxYear = null;
let events = [];

// DOM Elements
const eventsLayer = document.getElementById('eventsLayer');
const yearsLayer = document.getElementById('yearsLayer');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

/**
 * Fetches events from events.json file
 * Finds the minimum start_year and maximum end_year
 * Sets the timeline range accordingly
 */
async function loadEvents() {
    try {
        const response = await fetch('events.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        events = await response.json();
        
        if (events.length === 0) {
            throw new Error('No events found in JSON file');
        }
        
        // Find min and max years across all events
        minYear = Math.min(...events.map(event => event.start_year));
        maxYear = Math.max(...events.map(event => event.end_year));
        
        // Initialize the timeline (scroll to end on initial load)
        renderTimeline(true);
    } catch (error) {
        console.error('Error loading events:', error);
        
        // Check if it's a CORS/network error (common when opening file:// directly)
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || 
            error.name === 'TypeError' || window.location.protocol === 'file:') {
            displayError(
                'Failed to load events.json. This usually happens when opening the file directly.<br><br>' +
                '<strong>Solution:</strong> Run a local server:<br>' +
                '• Python: <code>python -m http.server 8000</code> then visit <code>http://localhost:8000</code><br>' +
                '• Node.js: <code>npx http-server</code> then visit the shown URL<br><br>' +
                'Or check the browser console for more details.'
            );
        } else {
            displayError(`Failed to load events. Error: ${error.message}<br><br>Please check that events.json exists and is valid JSON.`);
        }
    }
}

/**
 * Calculates the total width of the timeline based on year range and yearWidth
 */
function getTimelineWidth() {
    if (minYear === null || maxYear === null) return 0;
    const yearRange = maxYear - minYear + 1;
    return yearRange * yearWidth;
}

/**
 * Renders the entire timeline including year labels and events
 * @param {boolean} scrollToEnd - If true, scrolls to the end after rendering (for initial load)
 * @param {number|null} centerYear - The year to keep centered in viewport (for zoom preservation)
 */
function renderTimeline(scrollToEnd = false, centerYear = null) {
    if (minYear === null || maxYear === null) return;
    
    const container = document.querySelector('.timeline-container');
    
    const timelineWidth = getTimelineWidth();
    
    // Keep the visible container constrained to the viewport so the
    // earliest years stay in view, and place the width on the layers
    // inside the scrollable area instead.
    container.style.width = '100%';
    eventsLayer.style.width = `${timelineWidth}px`;
    yearsLayer.style.width = `${timelineWidth}px`;

    const timelineLine = container.querySelector('.timeline-line');
    if (timelineLine) {
        timelineLine.style.width = `${timelineWidth}px`;
    }

    // Render year labels
    renderYearLabels();
    
    // Render events
    renderEvents();
    
    // Set scroll position after rendering
    setTimeout(() => {
        if (scrollToEnd) {
            // Initial load: scroll to the end
            container.scrollLeft = container.scrollWidth - container.clientWidth;
        } else if (centerYear !== null) {
            // Zoom: preserve the center year in view
            const newCenterPosition = (centerYear - minYear) * yearWidth;
            const targetScrollLeft = newCenterPosition - container.clientWidth / 2;
            // Ensure scroll position is within bounds
            const maxScroll = container.scrollWidth - container.clientWidth;
            container.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
        }
    }, 0);
}

/**
 * Generates and displays year labels below the timeline
 * Each year gets equal width based on yearWidth
 */
function renderYearLabels() {
    yearsLayer.innerHTML = '';
    
    if (minYear === null || maxYear === null) return;
    
    for (let year = minYear; year <= maxYear; year++) {
        const yearLabel = document.createElement('div');
        yearLabel.className = 'year-label';
        yearLabel.textContent = year;
        
        // Calculate left position: (year - minYear) * yearWidth
        const leftPosition = (year - minYear) * yearWidth;
        yearLabel.style.left = `${leftPosition}px`;
        
        // Set width to match yearWidth so label stays centered in the year segment
        yearLabel.style.width = `${yearWidth}px`;
        
        yearsLayer.appendChild(yearLabel);
    }
}

/**
 * Creates event rectangles above the timeline
 * Width = (end_year - start_year + 1) * yearWidth
 * Left position = (start_year - min_year) * yearWidth
 */
function renderEvents() {
    eventsLayer.innerHTML = '';
    
    if (minYear === null || maxYear === null || events.length === 0) return;
    
    events.forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.textContent = event.title;
        
        // Calculate width: (end_year - start_year + 1) * yearWidth
        const eventDuration = event.end_year - event.start_year + 1;
        const eventWidth = eventDuration * yearWidth;
        eventDiv.style.width = `${eventWidth}px`;
        
        // Calculate left position: (start_year - min_year) * yearWidth
        const leftPosition = (event.start_year - minYear) * yearWidth;
        eventDiv.style.left = `${leftPosition}px`;
        
        // Stagger events vertically to avoid overlap, starting from the bottom
        const eventsLayerHeight = 280; // Match the height from CSS
        const eventHeight = 40; // Match the event height from CSS
        const verticalOffset = (index % 3) * 70; // Cycle through 3 vertical positions
        // Calculate top position from bottom: layer height - event height - vertical offset
        const topPosition = eventsLayerHeight - eventHeight - verticalOffset;
        eventDiv.style.top = `${topPosition}px`;
        
        eventsLayer.appendChild(eventDiv);
    });
}

/**
 * Updates the yearWidth variable and re-renders the timeline
 * All elements smoothly transition due to CSS transitions
 */
const maxZoomIn = 200;
const maxZoomOut = 35;
function updateZoom(newYearWidth) {
    const container = document.querySelector('.timeline-container');
    
    // Calculate which year is currently in the center of the viewport BEFORE updating yearWidth
    let centerYear = null;
    if (container.scrollWidth > 0) {
        const currentScrollLeft = container.scrollLeft;
        const viewportCenter = currentScrollLeft + container.clientWidth / 2;
        // Calculate which year this corresponds to based on CURRENT (old) yearWidth
        centerYear = minYear + (viewportCenter / yearWidth);
    }
    
    yearWidth = newYearWidth;
    renderTimeline(false, centerYear);
    
    // Update button states (optional: disable at min/max zoom)
    zoomInBtn.disabled = yearWidth >= maxZoomIn; // Max zoom in
    zoomOutBtn.disabled = yearWidth <= maxZoomOut; // Max zoom out
}

/**
 * Zoom In: Increases yearWidth by 20 pixels
 */
function zoomIn() {
    const newWidth = Math.min(yearWidth + 20, maxZoomIn); // Cap at 500px
    updateZoom(newWidth);
}

/**
 * Zoom Out: Decreases yearWidth by 20 pixels
 */
function zoomOut() {
    const newWidth = Math.max(yearWidth - 20, maxZoomOut); // Cap at 20px
    updateZoom(newWidth);
}

/**
 * Displays an error message to the user
 */
function displayError(message) {
    const container = document.querySelector('.timeline-container');
    container.innerHTML = `<div class="error">${message}</div>`;
}

/**
 * Initialize the timeline when the page loads
 */
function init() {
    // Set up zoom button event listeners
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    
    // Initialize button states
    zoomInBtn.disabled = false;
    zoomOutBtn.disabled = false;
    
    // Load events and render timeline
    loadEvents();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

