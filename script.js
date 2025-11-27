// Timeline Configuration
let yearWidth = 100; // Default width per year in pixels
const minEventLabelWidth = 100; // Hide inline content on narrower blocks
let minYear = null;
let maxYear = null;
let events = [];

/*
    original colors:

*/
// Color Palette - 10 colors for automatic category assignment
const colorPalette = [
    '#AE563C',
    '#305C7A',  
    '#C6CB74',
    '#E7B75C',
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

// Track if this is the initial render (to avoid fade-in on first load)
let isInitialRender = true;

// Track if we're currently zooming (to disable animations during zoom)
let isZooming = false;

// Track the number of layers that contain events
let activeLayersCount = 0;

// Track if instructions have been hidden (to only hide once)
let instructionsHidden = false;

/**
 * Derives the list of categories for an event based on its description keys.
 * @param {Object} event - The event object from the JSON file.
 * @returns {Array<string>} - Array of category names.
 */
function deriveCategoriesFromDescriptions(event) {
    if (!event || typeof event !== 'object') {
        return [];
    }

    const descriptions = event.descriptions;
    if (!descriptions || typeof descriptions !== 'object') {
        return [];
    }

    return Object.keys(descriptions)
        .filter(key => typeof key === 'string' && key.trim().length > 0);
}

// DOM Elements
const eventsLayer = document.getElementById('eventsLayer');
const yearsLayer = document.getElementById('yearsLayer');
const reflectionLayer = document.getElementById('reflectionLayer');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const categoriesMenu = document.querySelector('.categories-menu');
const minimapCanvas = document.getElementById('timelineMinimapCanvas');
const minimapViewport = document.getElementById('minimapViewport');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
let minimapNeedsRedraw = true;
let minimapFrameRequested = false;
let minimapDragging = false;
const eventTooltip = document.createElement('div');
eventTooltip.className = 'event-tooltip';
eventTooltip.setAttribute('role', 'tooltip');
document.body.appendChild(eventTooltip);
let tooltipFollowCursor = false;
let tooltipTargetElement = null;

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
    hiddenCategories = {};
    
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
 * Fetches events from racism-events.json file
 * Finds the minimum start_year and maximum end_year
 * Sets the timeline range accordingly
 */
async function loadEvents() {
    try {
        const response = await fetch('static/events-files/racism-events3.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        events = await response.json();

        // Derive categories from description keys
        events.forEach(event => {
            event.categories = deriveCategoriesFromDescriptions(event);
        });
        
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
        
        // Mark initial render as complete after a short delay
        setTimeout(() => {
            isInitialRender = false;
        }, 100);
    } catch (error) {
        console.error('Error loading events:', error);
        
        // Check if it's a CORS/network error (common when opening file:// directly)
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || 
            error.name === 'TypeError' || window.location.protocol === 'file:') {
            displayError(
                'Failed to load racism-events.json. This usually happens when opening the file directly.<br><br>' +
                '<strong>Solution:</strong> Run a local server:<br>' +
                '• Python: <code>python -m http.server 8000</code> then visit <code>http://localhost:8000</code><br>' +
                '• Node.js: <code>npx http-server</code> then visit the shown URL<br><br>' +
                'Or check the browser console for more details.'
            );
        } else {
            displayError(`Failed to load events. Error: ${error.message}<br><br>Please check that racism-events.json exists and is valid JSON.`);
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

function getTimelineScrollable() {
    return document.querySelector('.timeline-scrollable');
}

/**
 * Renders the entire timeline including year labels and events
 * @param {boolean} scrollToEnd - If true, scrolls to the end after rendering (for initial load)
 * @param {number|null} centerYear - The year to keep centered in viewport (for zoom preservation)
 */
function renderTimeline(scrollToEnd = false, centerYear = null) {
    if (minYear === null || maxYear === null) return;
    
    const container = document.querySelector('.timeline-container');
    const scrollable = document.querySelector('.timeline-scrollable');
    
    const timelineWidth = getTimelineWidth();
    
    // Keep the visible container constrained to the viewport so the
    // earliest years stay in view, and place the width on the layers
    // inside the scrollable area instead.
    container.style.width = '100%';
    eventsLayer.style.width = `${timelineWidth}px`;
    yearsLayer.style.width = `${timelineWidth}px`;
    reflectionLayer.style.width = `${timelineWidth}px`;

    const timelineLine = scrollable.querySelector('.timeline-line');
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
            scrollable.scrollLeft = scrollable.scrollWidth - scrollable.clientWidth;
        } else if (centerYear !== null) {
            // Zoom: preserve the center year in view
            const newCenterPosition = (centerYear - minYear) * yearWidth;
            const targetScrollLeft = newCenterPosition - scrollable.clientWidth / 2;
            // Ensure scroll position is within bounds
            const maxScroll = scrollable.scrollWidth - scrollable.clientWidth;
            scrollable.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
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
    if (minYear === null || maxYear === null || events.length === 0) return;
    
    // Get existing event elements and create a map by event index
    const existingEventElements = Array.from(eventsLayer.querySelectorAll('.event'));
    const existingEventMap = new Map();
    existingEventElements.forEach(el => {
        const eventIndex = parseInt(el.getAttribute('data-event-index'), 10);
        if (!isNaN(eventIndex)) {
            existingEventMap.set(eventIndex, el);
        }
    });
    
    // Create a map of visible events by their index in the original events array
    const visibleEventMap = new Map();
    events.forEach((event, index) => {
        if (isEventVisible(event)) {
            visibleEventMap.set(index, event);
        }
    });
    
    // Fade out and remove events that should be hidden (only if not zooming)
    existingEventMap.forEach((eventDiv, eventIndex) => {
        if (!visibleEventMap.has(eventIndex)) {
            if (isZooming) {
                // During zoom, remove immediately without animation
                eventDiv.remove();
            } else {
                // During category toggle, fade out smoothly
                eventDiv.classList.add('fade-out');
                eventDiv.addEventListener('transitionend', function handler(e) {
                    if (e.propertyName === 'opacity' && eventDiv.classList.contains('fade-out')) {
                        eventDiv.removeEventListener('transitionend', handler);
                        eventDiv.remove();
                    }
                }, { once: true });
            }
        }
    });
    
    // Calculate lane occupancy for visible events
    const layerCount = 9;
    const layerSpacing = 80;
    const eventsLayerHeight = (eventsLayer?.clientHeight || eventsLayer?.offsetHeight || 760); // Keep in sync with CSS
    const eventHeight = 40; // Match the event height from CSS
    const laneOccupancy = Array.from({ length: layerCount }, () => []);

    visibleEventMap.forEach((event, eventIndex) => {
        // Check if event element already exists
        let eventDiv = existingEventMap.get(eventIndex);
        const isNewEvent = !eventDiv;
        const eventDurationYears = event.end_year - event.start_year + 1;
        
        if (isNewEvent) {
            // Create new event element
            // Only add fade-in class if not initial render and not zooming
            const shouldFadeIn = !isInitialRender && !isZooming;
            eventDiv = document.createElement('div');
            eventDiv.className = 'event' + (shouldFadeIn ? ' fade-in' : '');
            const eventTitle = document.createElement('span');
            eventTitle.className = 'event-title';

        if (event.links && event.links.some(link => isYouTubeLink(link))) {
            const firstYoutubeLink = event.links.find(link => isYouTubeLink(link));
            const videoLink = document.createElement('a');
            videoLink.className = 'video-icon';
            videoLink.href = firstYoutubeLink;
            videoLink.target = '_blank';
            videoLink.rel = 'noopener noreferrer';
            videoLink.setAttribute('aria-label', `Watch video about ${event.title}`);
            const videoIcon = document.createElement('img');
            videoIcon.src = 'static/icons/video-icon-white.svg';
            videoIcon.alt = 'Video';
            videoLink.appendChild(videoIcon);
            eventTitle.appendChild(videoLink);
        }

            const titleText = document.createElement('span');
            titleText.className = 'event-title-text';
            titleText.textContent = event.title;
            eventTitle.appendChild(titleText);

            eventDiv.appendChild(eventTitle);
            
            // Store event index for tracking
            eventDiv.setAttribute('data-event-index', eventIndex);
            
            // Add hover handlers for reflection effect
            const eventColor = getEventColor(event);
            const getCurrentEventMetrics = () => {
                const duration = event.end_year - event.start_year + 1;
                const currentWidth = duration * yearWidth;
                const currentLeft = (event.start_year - minYear) * yearWidth;
                return { currentWidth, currentLeft };
            };
            
            eventDiv.addEventListener('mouseenter', (e) => {
                const { currentWidth, currentLeft } = getCurrentEventMetrics();
                // Use the same width as the event (with -10px adjustment) and keep it non-negative
                const reflectionWidth = Math.max(currentWidth - 10, 0);
                showReflectionBlock(event.start_year, event.end_year, eventColor, currentLeft, reflectionWidth);
                const followCursor = eventDurationYears >= 15;
                showEventTooltip(event.title, eventDiv, followCursor, e);
            });
            
            eventDiv.addEventListener('mousemove', (e) => {
                updateTooltipPosition(eventDiv, e);
            });
            
            eventDiv.addEventListener('mouseleave', () => {
                hideReflectionBlock();
                hideEventTooltip();
            });
            
            // Add click handler to show modal
            eventDiv.addEventListener('click', (e) => {
                // Prevent event from bubbling if clicking on video icon
                if (e.target.closest('.video-icon')) {
                    return;
                }
                showEventModal(event);
            });
            
            eventsLayer.appendChild(eventDiv);
        } else {
            // Remove fade-out class if it exists (in case event was being hidden but is now visible again)
            if (eventDiv.classList.contains('fade-out')) {
                eventDiv.classList.remove('fade-out');
                // Ensure it's fully visible
                eventDiv.style.opacity = '1';
            }
        }
        
        // Disable transitions during zoom for better performance
        if (isZooming) {
            eventDiv.style.transition = 'none';
        } else {
            eventDiv.style.transition = ''; // Reset to CSS default
        }
        
        // Set color based on event categories
        const eventColor = getEventColor(event);
        eventDiv.style.background = eventColor;
        
        // Calculate width: (end_year - start_year + 1) * yearWidth
        const eventWidth = eventDurationYears * yearWidth;
        const adjustedWidth = Math.max(eventWidth - 10, 0);
        eventDiv.style.width = `${adjustedWidth}px`;

        // Hide the inline title when the visual block is too narrow to keep it readable
        const titleTextEl = eventDiv.querySelector('.event-title-text');
        if (titleTextEl) {
            titleTextEl.style.display = adjustedWidth < minEventLabelWidth ? 'none' : '';
        }
        const videoIconEl = eventDiv.querySelector('.video-icon');
        if (videoIconEl) {
            videoIconEl.style.display = adjustedWidth < minEventLabelWidth ? 'none' : '';
        }
        
        // Calculate left position: (start_year - min_year) * yearWidth
        const leftPosition = (event.start_year - minYear) * yearWidth;
        eventDiv.style.left = `${leftPosition}px`;
        
        // Determine vertical lane, defaulting to the bottom lane and moving up only if needed
        let laneIndex = 0;
        for (; laneIndex < layerCount; laneIndex++) {
            const laneEvents = laneOccupancy[laneIndex];
            const hasOverlap = laneEvents.some(range => (
                event.start_year <= range.end && event.end_year >= range.start
            ));
            if (!hasOverlap) {
                break;
            }
        }

        if (laneIndex === layerCount) {
            laneIndex = layerCount - 1;
        }

        laneOccupancy[laneIndex].push({
            start: event.start_year,
            end: event.end_year
        });

        // Store lane index on the element for later position adjustment
        eventDiv.setAttribute('data-lane-index', laneIndex);
        
        // Store event data on the div for hover effects
        eventDiv.setAttribute('data-start-year', event.start_year);
        eventDiv.setAttribute('data-end-year', event.end_year);
        eventDiv.setAttribute('data-background', eventColor);
        
        // Trigger fade-in animation for new events (but not on initial render or during zoom)
        if (isNewEvent && !isInitialRender && !isZooming) {
            // Use requestAnimationFrame to ensure the element is in the DOM before animating
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    eventDiv.classList.remove('fade-in');
                });
            });
        } else if (isNewEvent && isZooming) {
            // During zoom, ensure the event is immediately visible (no fade-in)
            eventDiv.classList.remove('fade-in');
            eventDiv.style.opacity = '1';
        }
    });
    
    // Calculate the number of layers that contain events
    activeLayersCount = laneOccupancy.filter(lane => lane.length > 0).length;
    
    // Calculate the offset to push timeline up by unused layers
    const unusedLayers = layerCount - activeLayersCount;
    const maxPushUpOffset = 160; // Maximum push up in pixels
    const pushUpOffset = Math.min(unusedLayers * layerSpacing, maxPushUpOffset);
    
    
    // Adjust all event positions to push timeline up by unused layers
    const allEventElements = eventsLayer.querySelectorAll('.event:not(.fade-out)');
    allEventElements.forEach(eventDiv => {
        // Disable transitions during zoom for position updates
        if (isZooming) {
            eventDiv.style.transition = 'none';
        }
        
        const laneIndex = parseInt(eventDiv.getAttribute('data-lane-index'), 10);
        if (!isNaN(laneIndex)) {
            const verticalOffset = laneIndex * layerSpacing;
            // Calculate top position from bottom: layer height - event height - vertical offset - push up offset
            const topPosition = eventsLayerHeight - eventHeight - verticalOffset - pushUpOffset;
            eventDiv.style.top = `${topPosition}px`;
        }
        
        // Re-enable transitions after position update (if not zooming)
        if (!isZooming) {
            eventDiv.style.transition = ''; // Reset to CSS default
        }
    });
    
    // Adjust timeline line, reflection layer, and years layer positions
    const scrollable = document.querySelector('.timeline-scrollable');
    const timelineLine = scrollable.querySelector('.timeline-line');
    
    // Base positions from CSS (timeline-line: 780px, reflection-layer: 786px, years-layer: 790px)
    const baseTimelineLineTop = 780;
    const baseReflectionLayerTop = 786;
    const baseYearsLayerTop = 790;
    
    if (timelineLine) {
        timelineLine.style.top = `${baseTimelineLineTop - pushUpOffset}px`;
    }
    
    if (reflectionLayer) {
        reflectionLayer.style.top = `${baseReflectionLayerTop - pushUpOffset}px`;
    }
    
    if (yearsLayer) {
        yearsLayer.style.top = `${baseYearsLayerTop - pushUpOffset}px`;
    }

    refreshMinimap({ redraw: true });
}

/**
 * Redraws or updates the minimap canvas and viewport overlay.
 * Uses requestAnimationFrame to avoid redundant work during rapid updates.
 */
function refreshMinimap({ redraw = false } = {}) {
    if (!minimapCanvas || !minimapViewport) return;
    if (redraw) {
        minimapNeedsRedraw = true;
    }

    if (minimapFrameRequested) return;
    minimapFrameRequested = true;

    requestAnimationFrame(() => {
        minimapFrameRequested = false;

        if (minimapNeedsRedraw) {
            drawMinimap();
            minimapNeedsRedraw = false;
        }

        updateMinimapViewport();
    });
}

/**
 * Draws a simplified representation of the current timeline in the minimap canvas.
 * Uses the already-positioned event elements to avoid duplicating placement logic.
 */
function drawMinimap() {
    if (!minimapCtx || !minimapCanvas) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    const containerWidth = minimapCanvas.clientWidth || minimapCanvas.parentElement?.clientWidth || 0;
    const containerHeight = minimapCanvas.clientHeight || minimapCanvas.parentElement?.clientHeight || 0;
    if (!containerWidth || !containerHeight) return;

    // Resize canvas to match the on-screen size for crisp rendering.
    minimapCanvas.width = containerWidth;
    minimapCanvas.height = containerHeight;

    minimapCtx.clearRect(0, 0, containerWidth, containerHeight);

    const scaleX = containerWidth / timelineWidth;
    const laneCount = Math.max(activeLayersCount, 1);
    const laneHeight = containerHeight / laneCount;
    const visibleEvents = eventsLayer?.querySelectorAll('.event:not(.fade-out)') || [];

    visibleEvents.forEach(eventDiv => {
        const eventIndex = parseInt(eventDiv.getAttribute('data-event-index'), 10);
        if (Number.isNaN(eventIndex) || !events[eventIndex]) return;

        const eventData = events[eventIndex];
        if (!isEventVisible(eventData)) return;

        const left = parseFloat(eventDiv.style.left) || 0;
        const width = eventDiv.offsetWidth || eventDiv.getBoundingClientRect().width || 0;
        if (!width) return;

        const laneIndex = parseInt(eventDiv.getAttribute('data-lane-index'), 10) || 0;
        const x = left * scaleX;
        const mapWidth = Math.max(width * scaleX, 1);
        const barHeight = Math.max(laneHeight - 4, 2);
        const y = containerHeight - (laneIndex + 1) * laneHeight + (laneHeight - barHeight) / 2;
        const background = eventDiv.getAttribute('data-background') || window.getComputedStyle(eventDiv).backgroundImage || defaultColor;

        minimapCtx.fillStyle = getMinimapFillStyle(background, x, mapWidth);
        minimapCtx.fillRect(x, y, mapWidth, barHeight);
    });
}

/**
 * Updates the viewport overlay to match the currently visible portion of the main timeline.
 */
function updateMinimapViewport() {
    if (!minimapViewport || !minimapCanvas) return;

    const scrollable = getTimelineScrollable();
    if (!scrollable) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    const scaleX = minimapCanvas.width / timelineWidth;
    const viewportWidth = Math.max(scrollable.clientWidth * scaleX, 4); // Prevent disappearing overlay
    const viewportLeft = scrollable.scrollLeft * scaleX;

    minimapViewport.style.width = `${viewportWidth}px`;
    minimapViewport.style.left = `${viewportLeft}px`;
}

/**
 * Converts the event background (solid or gradient) into a canvas fill style.
 */
function getMinimapFillStyle(background, x, width) {
    if (!background || background === 'none') {
        return defaultColor;
    }

    if (background.startsWith('linear-gradient')) {
        const stops = extractGradientStops(background);
        if (stops.length > 0) {
            const gradient = minimapCtx.createLinearGradient(x, 0, x + width, 0);
            const lastIndex = stops.length - 1;
            stops.forEach((stop, index) => {
                const position = typeof stop.position === 'number'
                    ? stop.position
                    : (lastIndex === 0 ? 0 : index / lastIndex);
                gradient.addColorStop(Math.min(Math.max(position, 0), 1), stop.color);
            });
            return gradient;
        }
    }

    return background;
}

/**
 * Extracts color stops from a CSS linear-gradient string.
 * Returns an array of { color, position } where position is 0-1.
 */
function extractGradientStops(gradientString) {
    const match = gradientString.match(/linear-gradient\((.*)\)/i);
    if (!match) {
        return [];
    }

    let content = match[1].trim();

    // Remove direction segment (e.g., "135deg," or "to right,")
    if (content.startsWith('to ') || /^\d/.test(content)) {
        const commaIndex = content.indexOf(',');
        if (commaIndex !== -1) {
            content = content.slice(commaIndex + 1).trim();
        }
    }

    const stopsRaw = splitGradientStops(content);
    const stops = [];

    stopsRaw.forEach(stop => {
        const colorMatch = stop.match(/(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/i);
        if (!colorMatch) {
            return;
        }

        const color = colorMatch[1];
        const remainder = stop.slice(colorMatch.index + color.length).trim();
        let position = null;

        if (remainder) {
            const percentMatch = remainder.match(/(\d+(?:\.\d+)?)%/);
            if (percentMatch) {
                position = parseFloat(percentMatch[1]) / 100;
            }
        }

        stops.push({ color, position });
    });

    return stops;
}

/**
 * Splits gradient stop definitions into an array,
 * keeping rgba() contents intact.
 */
function splitGradientStops(content) {
    const stops = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
            stops.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }

    if (current.trim()) {
        stops.push(current.trim());
    }

    return stops;
}

/**
 * Handles navigation when the user clicks or drags inside the minimap.
 */
function handleMinimapNavigation(clientX) {
    const scrollable = getTimelineScrollable();
    if (!scrollable || !minimapCanvas) return;

    const rect = minimapCanvas.getBoundingClientRect();
    if (!rect.width) return;

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const timelineWidth = getTimelineWidth();
    const targetCenter = ratio * timelineWidth;
    const targetScrollLeft = targetCenter - scrollable.clientWidth / 2;
    const maxScroll = scrollable.scrollWidth - scrollable.clientWidth;

    scrollable.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
    refreshMinimap();
}

/**
 * Wires up scroll, resize, and pointer events needed to keep the minimap in sync.
 */
function setupMinimapInteractions() {
    const scrollable = getTimelineScrollable();
    if (!scrollable || !minimapCanvas) return;

    scrollable.addEventListener('scroll', () => refreshMinimap());
    window.addEventListener('resize', () => refreshMinimap({ redraw: true }));

    const startDrag = (event) => {
        minimapDragging = true;
        handleMinimapNavigation(event.clientX);
        event.preventDefault();
    };

    const moveDrag = (event) => {
        if (!minimapDragging) return;
        handleMinimapNavigation(event.clientX);
    };

    const endDrag = () => {
        minimapDragging = false;
    };

    minimapCanvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    minimapCanvas.addEventListener('mouseleave', () => {
        minimapDragging = false;
    });
    minimapCanvas.addEventListener('click', (event) => handleMinimapNavigation(event.clientX));

    // Ensure the initial render draws a baseline viewport once events load.
    refreshMinimap({ redraw: true });
}

/**
 * Updates the yearWidth variable and re-renders the timeline
 * Animations are disabled during zoom for better performance
 */
const maxZoomIn = 200;
const maxZoomOut = 35;
function updateZoom(newYearWidth) {
    const scrollable = document.querySelector('.timeline-scrollable');
    
    // Calculate which year is currently in the center of the viewport BEFORE updating yearWidth
    let centerYear = null;
    if (scrollable.scrollWidth > 0) {
        const currentScrollLeft = scrollable.scrollLeft;
        const viewportCenter = currentScrollLeft + scrollable.clientWidth / 2;
        // Calculate which year this corresponds to based on CURRENT (old) yearWidth
        centerYear = minYear + (viewportCenter / yearWidth);
    }
    
    // Set zooming flag to disable animations
    isZooming = true;
    
    yearWidth = newYearWidth;
    renderTimeline(false, centerYear);
    
    // Re-enable animations after a short delay to allow rendering to complete
    setTimeout(() => {
        isZooming = false;
    }, 0);
    
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
 * Extracts YouTube video ID from a YouTube URL
 * Supports various YouTube URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - YouTube video ID or null if not a valid YouTube URL
 */
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    
    // Check if it's a YouTube URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return null;
    
    // Pattern for youtube.com/watch?v=VIDEO_ID
    let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Checks if a URL is a YouTube link
 * @param {string} url - URL to check
 * @returns {boolean} - True if it's a YouTube URL
 */
function isYouTubeLink(url) {
    return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

// Track current event index for navigation
let currentEventIndex = -1;

/**
 * Shows the event modal and populates it with event data
 * @param {Object} event - The event object to display
 */
function showEventModal(event) {
    // Find the current event index in the events array
    currentEventIndex = events.findIndex(e => e === event);
    
    // Update navigation buttons
    updateNavigationButtons();
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalVideoIcon = document.getElementById('modalVideoIcon-black');
    const modalCategories = document.getElementById('modalCategories');
    const modalYears = document.getElementById('modalYears');
    const modalVideos = document.getElementById('modalVideos');
    const modalDescriptions = document.getElementById('modalDescriptions');
    const modalLinks = document.getElementById('modalLinks');
    
    // Set title
    modalTitle.textContent = event.title;
    
    // Show video icon if there are YouTube links
    const youtubeLinks = event.links ? event.links.filter(link => isYouTubeLink(link)) : [];
    if (youtubeLinks.length > 0) {
        modalVideoIcon.style.display = 'inline';
    } else {
        modalVideoIcon.style.display = 'none';
    }
    
    // Set years
    if (event.start_year === event.end_year) {
        modalYears.textContent = event.start_year.toString();
    } else {
        modalYears.textContent = `${event.start_year}-${event.end_year}`;
    }
    
    // Set category circles
    modalCategories.innerHTML = '';
    if (event.categories && event.categories.length > 0) {
        event.categories.forEach(category => {
            const circle = document.createElement('span');
            circle.className = 'modal-category-circle';
            const categoryColor = categoryColors[category] || defaultColor;
            circle.style.backgroundColor = categoryColor;
            modalCategories.appendChild(circle);
        });
    }
    
    // Set videos (YouTube embeds)
    modalVideos.innerHTML = '';
    if (youtubeLinks.length > 0) {
        youtubeLinks.forEach(link => {
            const videoId = extractYouTubeId(link);
            if (videoId) {
                const videoContainer = document.createElement('div');
                videoContainer.className = 'modal-video';
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${videoId}`;
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                iframe.allowFullscreen = true;
                videoContainer.appendChild(iframe);
                modalVideos.appendChild(videoContainer);
            }
        });
        modalVideos.style.display = 'flex';
    } else {
        modalVideos.style.display = 'none';
    }
    
    // Set descriptions
    modalDescriptions.innerHTML = '';
    if (event.descriptions && typeof event.descriptions === 'object') {
        Object.entries(event.descriptions).forEach(([category, description]) => {
            const descriptionItem = document.createElement('div');
            descriptionItem.className = 'modal-description-item';
            
            const categoryName = document.createElement('div');
            categoryName.className = 'modal-description-category';
            const categoryColor = categoryColors[category] || defaultColor;
            categoryName.style.color = categoryColor;
            categoryName.textContent = category;
            
            const descriptionText = document.createElement('div');
            descriptionText.className = 'modal-description-text';
            descriptionText.textContent = description;
            
            descriptionItem.appendChild(categoryName);
            descriptionItem.appendChild(descriptionText);
            modalDescriptions.appendChild(descriptionItem);
        });
    }
    
    // Set links (excluding YouTube links as they're shown as videos)
    const modalLinksSection = document.querySelector('.modal-links-section');
    const modalFooter = document.querySelector('.modal-footer');
    modalLinks.innerHTML = '';
    const nonYouTubeLinks = event.links ? event.links.filter(link => !isYouTubeLink(link)) : [];
    if (nonYouTubeLinks.length > 0) {
        nonYouTubeLinks.forEach((link, index) => {
            const linkElement = document.createElement('a');
            linkElement.className = 'modal-link';
            linkElement.href = link;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.textContent = `${index + 1}. ${link}`;
            modalLinks.appendChild(linkElement);
        });
        modalLinksSection.style.display = 'block';
        modalFooter.classList.remove('no-links');
    } else {
        modalLinksSection.style.display = 'none';
        modalFooter.classList.add('no-links');
    }
    
    // Show modal
    modal.classList.add('active');
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

/**
 * Updates the state of next/previous navigation buttons
 */
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevEventBtn');
    const nextBtn = document.getElementById('nextEventBtn');
    
    // Disable previous button if at first event
    if (prevBtn) {
        prevBtn.disabled = currentEventIndex <= 0;
    }
    
    // Disable next button if at last event
    if (nextBtn) {
        nextBtn.disabled = currentEventIndex >= events.length - 1;
    }
}

/**
 * Navigates to the previous event in the modal
 */
function showPreviousEvent() {
    if (currentEventIndex > 0) {
        const prevEvent = events[currentEventIndex - 1];
        showEventModal(prevEvent);
    }
}

/**
 * Navigates to the next event in the modal
 */
function showNextEvent() {
    if (currentEventIndex < events.length - 1) {
        const nextEvent = events[currentEventIndex + 1];
        showEventModal(nextEvent);
    }
}

/**
 * Closes the event modal
 */
function closeEventModal() {
    const modal = document.getElementById('eventModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * Extracts colors from a gradient or solid color string
 * @param {string} colorString - CSS color string (gradient or solid color)
 * @returns {Array<string>} - Array of color hex codes
 */
function extractColorsFromBackground(colorString) {
    if (!colorString) return [];
    
    // If it's a gradient
    if (colorString.includes('linear-gradient')) {
        // Extract colors from gradient stops
        const colorMatches = colorString.match(/#[0-9a-fA-F]{6}/g);
        return colorMatches || [];
    }
    
    // If it's a solid color (hex)
    if (colorString.startsWith('#')) {
        return [colorString];
    }
    
    // If it's an rgb/rgba color, try to convert (simplified)
    // For now, return empty array for non-hex colors
    return [];
}

/**
 * Converts a hex color to rgba format
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} - rgba color string
 */
function hexToRgba(hex, opacity = 0.5) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Creates a glow effect color from an array of colors
 * Uses the first color for single colors, or creates a gradient-like glow for multiple colors
 * @param {Array<string>} colors - Array of color hex codes
 * @returns {string|Array<string>} - Glow color(s) in rgba format
 */
function createGlowColor(colors) {
    if (colors.length === 0) {
        return 'rgba(74, 144, 226, 0.5)'; // Default blue glow
    }
    
    if (colors.length === 1) {
        return hexToRgba(colors[0], 0.5);
    }
    
    // For multiple colors, return an array to create a multi-color glow
    return colors.map(color => hexToRgba(color, 0.5));
}

/**
 * Converts a gradient or solid color to a version with reduced opacity
 * @param {string} background - Background color/gradient string
 * @returns {string} - Background with reduced opacity
 */
function applyOpacityToBackground(background) {
    if (!background) return '';
    
    // If it's a gradient, we need to add opacity to each color
    if (background.includes('linear-gradient')) {
        // Extract the gradient definition
        const gradientMatch = background.match(/linear-gradient\(([^)]+)\)/);
        if (!gradientMatch) return background;
        
        const gradientContent = gradientMatch[1];
        // Split by comma, but be careful with the direction parameter
        // The format is: "135deg, #color1 0%, #color2 100%"
        const parts = gradientContent.split(',').map(p => p.trim());
        
        // First part might be the direction (e.g., "135deg")
        let direction = '';
        let colorStops = [];
        
        if (parts[0].match(/^\d+deg$/)) {
            direction = parts[0];
            colorStops = parts.slice(1);
        } else {
            colorStops = parts;
        }
        
        // Convert each color stop to include opacity
        const newStops = colorStops.map(stop => {
            // Check if it's a color with percentage (e.g., "#5e72c7 0%")
            const stopParts = stop.split(/\s+/);
            const color = stopParts[0];
            const percentage = stopParts.slice(1).join(' '); // Handle multiple parts (e.g., "0%" or "50% 100%")
            
            if (color.startsWith('#')) {
                // Convert hex to rgba with opacity
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return percentage ? `rgba(${r}, ${g}, ${b}, 0.4) ${percentage}` : `rgba(${r}, ${g}, ${b}, 0.4)`;
            }
            return stop;
        });
        
        // Reconstruct the gradient
        const gradientParts = direction ? [direction, ...newStops] : newStops;
        return `linear-gradient(${gradientParts.join(', ')})`;
    }
    
    // If it's a solid hex color, convert to rgba with opacity
    if (background.startsWith('#')) {
        const r = parseInt(background.slice(1, 3), 16);
        const g = parseInt(background.slice(3, 5), 16);
        const b = parseInt(background.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }
    
    // If it's already rgba, adjust opacity
    if (background.includes('rgba')) {
        return background.replace(/rgba\(([^)]+)\)/, (match, content) => {
            const parts = content.split(',').map(p => p.trim());
            if (parts.length === 4) {
                parts[3] = '0.4';
                return `rgba(${parts.join(', ')})`;
            }
            return match;
        });
    }
    
    return background;
}

/**
 * Shows a reflection block under the timeline line matching the hovered event
 * @param {number} startYear - Start year of the event
 * @param {number} endYear - End year of the event
 * @param {string} eventBackground - Background color/gradient of the event
 * @param {number} leftPosition - Left position of the event in pixels
 * @param {number} eventWidth - Width of the event in pixels
 */
function updateTooltipPosition(targetElement, cursorEvent = null) {
    const element = targetElement || tooltipTargetElement;
    if (!element || !eventTooltip) return;
    
    if (tooltipFollowCursor && cursorEvent) {
        eventTooltip.style.left = `${cursorEvent.pageX}px`;
        eventTooltip.style.top = `${cursorEvent.pageY}px`;
        return;
    }
    
    const rect = element.getBoundingClientRect();
    const tooltipLeft = window.scrollX + rect.left + rect.width / 2;
    const tooltipTop = window.scrollY + rect.top;
    
    eventTooltip.style.left = `${tooltipLeft}px`;
    eventTooltip.style.top = `${tooltipTop}px`;
}

function showEventTooltip(text, targetElement, followCursor = false, cursorEvent = null) {
    if (!text || !targetElement) return;
    
    tooltipTargetElement = targetElement;
    tooltipFollowCursor = followCursor;
    
    eventTooltip.textContent = text;
    updateTooltipPosition(targetElement, cursorEvent);
    eventTooltip.classList.add('visible');
}

function hideEventTooltip() {
    tooltipFollowCursor = false;
    tooltipTargetElement = null;
    eventTooltip.classList.remove('visible');
}

function showReflectionBlock(startYear, endYear, eventBackground, leftPosition, eventWidth) {
    // Clear any existing reflection block
    reflectionLayer.innerHTML = '';
    
    // Create the reflection block
    const reflectionBlock = document.createElement('div');
    reflectionBlock.className = 'reflection-block';
    
    // Apply the same background with reduced opacity
    const backgroundWithOpacity = applyOpacityToBackground(eventBackground);
    reflectionBlock.style.background = backgroundWithOpacity;
    
    // Match the event's position and width
    reflectionBlock.style.left = `${leftPosition}px`;
    reflectionBlock.style.width = `${eventWidth}px`;
    
    reflectionLayer.appendChild(reflectionBlock);
}

/**
 * Hides the reflection block
 */
function hideReflectionBlock() {
    reflectionLayer.innerHTML = '';
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
    
    // Set up modal close handlers
    const modal = document.getElementById('eventModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    
    // Close modal when clicking the close button
    modalCloseBtn.addEventListener('click', closeEventModal);
    
    // Set up navigation button handlers
    const prevEventBtn = document.getElementById('prevEventBtn');
    const nextEventBtn = document.getElementById('nextEventBtn');
    
    if (prevEventBtn) {
        prevEventBtn.addEventListener('click', showPreviousEvent);
    }
    
    if (nextEventBtn) {
        nextEventBtn.addEventListener('click', showNextEvent);
    }
    
    // Close modal when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEventModal();
        }
    });
    
    // Close modal when pressing ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeEventModal();
        }
    });
    
    // Hide instructions on first Shift+scroll
    const scrollable = document.querySelector('.timeline-scrollable');
    const instructionsContainer = document.querySelector('.instructions-container');
    
    if (scrollable && instructionsContainer) {
        scrollable.addEventListener('wheel', (e) => {
            // Check if Shift key is pressed
            if (e.shiftKey && !instructionsHidden) {
                instructionsHidden = true;
                instructionsContainer.style.opacity = '0';
                // Remove from DOM after fade out
                setTimeout(() => {
                    instructionsContainer.style.display = 'none';
                }, 500);
            }
        });
    }

    setupMinimapInteractions();
    
    // Load events and render timeline
    loadEvents();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

