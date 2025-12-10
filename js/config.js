// Shared timeline configuration, state, and DOM references.

// Timeline Configuration
let yearWidth = 50; // Default width per year in pixels
const minEventLabelWidth = 100; // Hide inline content on narrower blocks
const condensedYearWidthThreshold = 45; // Below this we condense year labels
let minYear = null;
let maxYear = null;
let events = [];

// Color Palette - 10 colors for automatic category assignment
const colorPalette = [
    '#AE563C',
    '#305C7A',
    '#E7B75C',
    '#C6CB74',
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

// Tooltip setup
const eventTooltip = document.createElement('div');
eventTooltip.className = 'event-tooltip';
eventTooltip.setAttribute('role', 'tooltip');
document.body.appendChild(eventTooltip);
let tooltipFollowCursor = false;
let tooltipTargetElement = null;

