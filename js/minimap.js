// Minimap rendering and interactions.

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

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    const containerWidth = minimapCanvas.clientWidth || minimapCanvas.parentElement?.clientWidth || 0;
    const containerHeight = minimapCanvas.clientHeight || minimapCanvas.parentElement?.clientHeight || 0;
    if (!containerWidth || !containerHeight) return;

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

function updateMinimapViewport() {
    if (!minimapViewport || !minimapCanvas) return;

    if (minimapResizingSide && minimapResizePreview) {
        minimapViewport.style.width = `${minimapResizePreview.width}px`;
        minimapViewport.style.left = `${minimapResizePreview.left}px`;
        return;
    }

    const scrollable = getTimelineScrollable();
    if (!scrollable) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    const scaleX = minimapCanvas.width / timelineWidth;
    const viewportWidth = Math.max(scrollable.clientWidth * scaleX, 4);
    const viewportLeft = scrollable.scrollLeft * scaleX;

    minimapViewport.style.width = `${viewportWidth}px`;
    minimapViewport.style.left = `${viewportLeft}px`;
}

function getViewportWidthBounds() {
    const scrollable = getTimelineScrollable();
    const timelineWidth = getTimelineWidth();
    if (!scrollable || !timelineWidth || !minimapCanvas) return null;

    const yearRange = maxYear - minYear + 1;
    if (!yearRange) return null;

    const minWidth = (scrollable.clientWidth * minimapCanvas.width) / (yearRange * maxZoomIn);
    const maxWidth = (scrollable.clientWidth * minimapCanvas.width) / (yearRange * maxZoomOut);

    return {
        minWidth: Math.max(12, minWidth),
        maxWidth: Math.max(minWidth, maxWidth)
    };
}

function resizeMinimapViewport(side, clientX) {
    const scrollable = getTimelineScrollable();
    if (!scrollable || !minimapCanvas) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    const rect = minimapCanvas.getBoundingClientRect();
    if (!rect.width) return;

    const scaleX = minimapCanvas.width / timelineWidth;
    const currentLeft = scrollable.scrollLeft * scaleX;
    const currentWidth = scrollable.clientWidth * scaleX;
    const bounds = getViewportWidthBounds();
    if (!bounds) return;

    const pointerX = clientX - rect.left;
    const oppositeSide = side === 'left' ? 'right' : 'left';
    let desiredWidth = currentWidth;

    if (side === 'left') {
        const anchorRight = currentLeft + currentWidth;
        const newLeft = Math.min(Math.max(pointerX, 0), anchorRight - bounds.minWidth);
        desiredWidth = anchorRight - newLeft;
    } else {
        const anchorLeft = currentLeft;
        const newRight = Math.max(Math.min(pointerX, minimapCanvas.width), anchorLeft + bounds.minWidth);
        desiredWidth = newRight - anchorLeft;
    }

    desiredWidth = Math.min(Math.max(desiredWidth, bounds.minWidth), bounds.maxWidth);

    const yearRange = maxYear - minYear + 1;
    const newYearWidthRaw = (scrollable.clientWidth * minimapCanvas.width) / (desiredWidth * yearRange);
    const newYearWidth = Math.min(Math.max(newYearWidthRaw, maxZoomOut), maxZoomIn);

    const scrollWidth = scrollable.scrollWidth;
    const anchorFraction = oppositeSide === 'left'
        ? scrollable.scrollLeft / scrollWidth
        : (scrollable.scrollLeft + scrollable.clientWidth) / scrollWidth;

    const previewLeft = oppositeSide === 'left'
        ? currentLeft
        : (currentLeft + currentWidth - desiredWidth);

    minimapResizePreview = {
        width: desiredWidth,
        left: previewLeft,
        newYearWidth,
        anchor: { type: oppositeSide, fraction: anchorFraction }
    };

    if (minimapViewport) {
        minimapViewport.style.width = `${desiredWidth}px`;
        minimapViewport.style.left = `${previewLeft}px`;
    }
}

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

function extractGradientStops(gradientString) {
    const match = gradientString.match(/linear-gradient\((.*)\)/i);
    if (!match) {
        return [];
    }

    let content = match[1].trim();

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
        minimapResizingSide = null;

        if (minimapViewport) {
            minimapViewport.classList.remove('resizing');
        }

        if (minimapResizePreview) {
            updateZoom(minimapResizePreview.newYearWidth, { anchor: minimapResizePreview.anchor });
            minimapResizePreview = null;
        } else {
            refreshMinimap();
        }
    };

    const startResize = (side) => (event) => {
        minimapResizingSide = side;
        minimapResizePreview = null;
        if (minimapViewport) {
            minimapViewport.classList.add('resizing');
        }
        resizeMinimapViewport(side, event.clientX);
        event.preventDefault();
        event.stopPropagation();
    };

    const moveResize = (event) => {
        if (!minimapResizingSide) return;
        resizeMinimapViewport(minimapResizingSide, event.clientX);
    };

    minimapCanvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    // Keep dragging active while the mouse is down, even if leaving the viewport,
    // so the timeline follows the cursor across the minimap area.
    minimapCanvas.addEventListener('mouseleave', (event) => {
        if (!event.buttons) {
            minimapDragging = false;
        }
    });
    minimapCanvas.addEventListener('click', (event) => handleMinimapNavigation(event.clientX));

    if (minimapViewport) {
        let leftHandle = minimapViewport.querySelector('.minimap-handle.left');
        let rightHandle = minimapViewport.querySelector('.minimap-handle.right');

        if (!leftHandle) {
            leftHandle = document.createElement('div');
            leftHandle.className = 'minimap-handle left';
            minimapViewport.appendChild(leftHandle);
        }

        if (!rightHandle) {
            rightHandle = document.createElement('div');
            rightHandle.className = 'minimap-handle right';
            minimapViewport.appendChild(rightHandle);
        }

        leftHandle.addEventListener('mousedown', startResize('left'));
        rightHandle.addEventListener('mousedown', startResize('right'));
    }

    window.addEventListener('mousemove', moveResize);
    window.addEventListener('mouseup', endDrag);

    refreshMinimap({ redraw: true });
}

function highlightMinimapEvent(eventDiv) {
    if (!minimapHighlight || !minimapCanvas) return;

    const timelineWidth = getTimelineWidth();
    if (!timelineWidth) return;

    // Ensure we have up-to-date canvas dimensions for scaling
    const containerWidth = minimapCanvas.clientWidth || minimapCanvas.parentElement?.clientWidth || 0;
    const containerHeight = minimapCanvas.clientHeight || minimapCanvas.parentElement?.clientHeight || 0;
    if (!containerWidth || !containerHeight) return;

    const scaleX = (minimapCanvas.width || containerWidth) / timelineWidth;
    const laneCount = Math.max(activeLayersCount, 1);
    const laneHeight = containerHeight / laneCount;

    const left = parseFloat(eventDiv.style.left) || 0;
    const width = eventDiv.offsetWidth || eventDiv.getBoundingClientRect().width || 0;
    const laneIndex = parseInt(eventDiv.getAttribute('data-lane-index'), 10) || 0;

    const highlightWidth = Math.max(width * scaleX, 1);
    const barHeight = Math.max(laneHeight - 4, 2);
    const x = left * scaleX;
    const y = containerHeight - (laneIndex + 1) * laneHeight + (laneHeight - barHeight) / 2;

    minimapHighlight.style.display = 'block';
    minimapHighlight.style.left = `${x}px`;
    minimapHighlight.style.width = `${highlightWidth}px`;
    minimapHighlight.style.height = `${barHeight}px`;
    minimapHighlight.style.top = `${y}px`;
}

function clearMinimapHighlight() {
    if (minimapHighlight) {
        minimapHighlight.style.display = 'none';
    }
}

