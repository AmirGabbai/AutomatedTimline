// Timeline Configuration
let yearWidth = 100; // Default width per year in pixels
let minYear = null;
let maxYear = null;
let events = [];

// Color Palette - 10 colors for automatic category assignment
const colorPalette = [
    '#5e72c7',  // Blue
    '#764ba2',  // Purple
    '#993b6f',  // Pink
    '#e74c3c',  // Red
    '#f39c12',  // Orange
    '#2ecc71',  // Green
    '#1abc9c',  // Teal
    '#3498db',  // Light Blue
    '#9b59b6',  // Violet
    '#e67e22'   // Dark Orange
];

// Dynamic category to color mapping (will be populated after loading events)
let categoryColors = {};
const defaultColor = '#6c757d'; // Gray (fallback for events without categories)

// Track which categories are hidden (true = hidden, false = visible)
let hiddenCategories = {};

// DOM Elements
const eventsLayer = document.getElementById('eventsLayer');
const yearsLayer = document.getElementById('yearsLayer');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const categoriesMenu = document.querySelector('.categories-menu');

/**
 * Extracts all unique categories from the events array
 * @returns {Array<string>} Array of unique category names
 */
function extractCategories() {
    const categoriesSet = new Set();
    events.forEach(event => {
        if (event.categories && Array.isArray(event.categories)) {
            event.categories.forEach(category => {
                if (category && typeof category === 'string') {
                    categoriesSet.add(category);
                }
            });
        }
    });
    return Array.from(categoriesSet).sort(); // Sort for consistent ordering
}

/**
 * Maps categories to colors from the color palette
 * Each category gets assigned a color from the palette in order
 */
function mapCategoriesToColors() {
    const uniqueCategories = extractCategories();
    categoryColors = {};
    
    uniqueCategories.forEach((category, index) => {
        // Use modulo to cycle through colors if there are more categories than colors
        const colorIndex = index % colorPalette.length;
        categoryColors[category] = colorPalette[colorIndex];
        // Initialize all categories as visible
        hiddenCategories[category] = false;
    });
    
    console.log('Category to color mapping:', categoryColors);
}

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
        
        // Extract categories and map them to colors
        mapCategoriesToColors();
        
        // Read URL parameters to set initial category visibility
        readURLParams();
        
        // Render category buttons
        renderCategoryButtons();
        
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
 * Gets the color for an event based on its categories
 * Creates a gradient if multiple categories exist
 * @param {Object} event - The event object
 * @returns {string} - The color hex code or gradient CSS string
 */
function getEventColor(event) {
    if (!event.categories || event.categories.length === 0) {
        return defaultColor;
    }
    
    // If single category, return solid color
    if (event.categories.length === 1) {
        const category = event.categories[0];
        return categoryColors[category] || defaultColor;
    }
    
    // If multiple categories, create a gradient
    const colors = event.categories
        .map(cat => categoryColors[cat] || defaultColor)
        .filter((color, index, self) => self.indexOf(color) === index); // Remove duplicates
    
    if (colors.length === 1) {
        return colors[0]; // All categories map to same color
    }
    
    // Create gradient stops evenly distributed
    const gradientStops = colors.map((color, index) => {
        const percentage = (index / (colors.length - 1)) * 100;
        return `${color} ${percentage}%`;
    }).join(', ');
    
    return `linear-gradient(135deg, ${gradientStops})`;
}

/**
 * Renders category buttons in the categories menu
 * Each button shows the category name and uses the category color as background
 */
function renderCategoryButtons() {
    categoriesMenu.innerHTML = '';
    
    const uniqueCategories = extractCategories();
    
    uniqueCategories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = category;
        button.setAttribute('data-category', category);
        
        // Set background color from categoryColors
        const categoryColor = categoryColors[category] || defaultColor;
        button.style.backgroundColor = categoryColor;
        
        // Set initial button state based on hiddenCategories
        if (hiddenCategories[category]) {
            button.classList.add('hidden');
        }
        
        // Add click handler to toggle visibility
        button.addEventListener('click', () => toggleCategoryVisibility(category, button));
        
        categoriesMenu.appendChild(button);
    });
}

/**
 * Updates the URL with the current hidden categories
 * Uses URLSearchParams to manage query parameters
 */
function updateURL() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get all hidden categories
    const hiddenCats = Object.keys(hiddenCategories).filter(cat => hiddenCategories[cat]);
    
    if (hiddenCats.length > 0) {
        // Set the 'hide' parameter with comma-separated category names
        urlParams.set('hide', hiddenCats.join(','));
    } else {
        // Remove the parameter if no categories are hidden
        urlParams.delete('hide');
    }
    
    // Update URL without reloading the page
    const newURL = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.pushState({}, '', newURL);
}

/**
 * Reads URL parameters and sets initial category visibility
 * Supports 'hide' parameter with comma-separated category names
 */
function readURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const hideParam = urlParams.get('hide');
    
    if (hideParam) {
        // Split comma-separated categories and mark them as hidden
        const categoriesToHide = hideParam.split(',').map(cat => cat.trim());
        
        categoriesToHide.forEach(category => {
            if (category && category in categoryColors) {
                hiddenCategories[category] = true;
            }
        });
    }
}

/**
 * Toggles the visibility of events with a specific category
 * @param {string} category - The category to toggle
 * @param {HTMLElement} button - The button element that was clicked
 */
function toggleCategoryVisibility(category, button) {
    // Toggle the hidden state
    hiddenCategories[category] = !hiddenCategories[category];
    
    // Update button appearance
    if (hiddenCategories[category]) {
        button.classList.add('hidden');
    } else {
        button.classList.remove('hidden');
    }
    
    // Update URL to reflect the change
    updateURL();
    
    // Re-render events to reflect visibility changes
    renderEvents();
}

/**
 * Checks if an event should be visible based on category visibility settings
 * @param {Object} event - The event object
 * @returns {boolean} - True if event should be visible, false otherwise
 */
function isEventVisible(event) {
    // If event has no categories, always show it
    if (!event.categories || event.categories.length === 0) {
        return true;
    }
    
    // Event is visible only if ALL of its categories are visible (none are hidden)
    return event.categories.every(category => !hiddenCategories[category]);
}

/**
 * Creates event rectangles above the timeline
 * Width = (end_year - start_year + 1) * yearWidth
 * Left position = (start_year - min_year) * yearWidth
 */
function renderEvents() {
    eventsLayer.innerHTML = '';
    
    if (minYear === null || maxYear === null || events.length === 0) return;
    
    // Filter events based on visibility
    const visibleEvents = events.filter(event => isEventVisible(event));
    
    visibleEvents.forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.textContent = event.title;
        
        // Set color based on event categories
        const eventColor = getEventColor(event);
        eventDiv.style.background = eventColor;
        
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
 * Handles browser back/forward navigation
 * Updates category visibility when URL changes
 */
function handlePopState() {
    // Only handle if events are loaded
    if (events.length === 0) return;
    
    // Reset all categories to visible first
    Object.keys(hiddenCategories).forEach(category => {
        hiddenCategories[category] = false;
    });
    
    // Read URL parameters again
    readURLParams();
    
    // Update button states
    const buttons = categoriesMenu.querySelectorAll('.category-btn');
    buttons.forEach(button => {
        const category = button.getAttribute('data-category');
        if (hiddenCategories[category]) {
            button.classList.add('hidden');
        } else {
            button.classList.remove('hidden');
        }
    });
    
    // Re-render events
    renderEvents();
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
    
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
    
    // Load events and render timeline
    loadEvents();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

