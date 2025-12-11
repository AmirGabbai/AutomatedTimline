// Cache base positions so we don't compound offsets after each render.
let cachedBaseLayoutMetrics = null;

// Timeline rendering: width calculations, labels, and event blocks.

function getTimelineWidth() {
    if (minYear === null || maxYear === null) return 0;
    const yearRange = maxYear - minYear + 1;
    return yearRange * yearWidth;
}

function getBaseLayoutMetrics() {
    if (cachedBaseLayoutMetrics) {
        return cachedBaseLayoutMetrics;
    }

    const scrollable = getTimelineScrollable();
    const timelineLine = scrollable?.querySelector('.timeline-line');
    const timelineBottomBar = document.querySelector('.timeline-bottom-bar');

    cachedBaseLayoutMetrics = {
        lineTop: timelineLine ? parseFloat(getComputedStyle(timelineLine).top) : 0,
        reflectionTop: reflectionLayer ? parseFloat(getComputedStyle(reflectionLayer).top) : 0,
        yearsTop: yearsLayer ? parseFloat(getComputedStyle(yearsLayer).top) : 0,
        bottomBarBottom: timelineBottomBar ? parseFloat(getComputedStyle(timelineBottomBar).bottom) : 0
    };

    return cachedBaseLayoutMetrics;
}

function getTimelineScrollable() {
    return document.querySelector('.timeline-scrollable');
}

function setupTimelineDrag() {
    const scrollable = getTimelineScrollable();
    // Use the events layer as the drag surface so dragging only happens over the timeline content
    const dragSurface = eventsLayer;
    if (!scrollable || !dragSurface) return;

    const startDrag = (event) => {
        if (event.button !== 0) return;
        if (isZooming) return; // Skip drag while zoom gestures are active
        // Prevent dragging when interacting with an event block
        if (event.target.closest('.event')) return;
        timelineDragging = true;
        timelineDragStartX = event.clientX;
        timelineDragStartScrollLeft = scrollable.scrollLeft;
        scrollable.classList.add('dragging');
    };

    const handleDrag = (event) => {
        if (!timelineDragging) return;
        const deltaX = event.clientX - timelineDragStartX;
        scrollable.scrollLeft = timelineDragStartScrollLeft - deltaX;
    };

    const endDrag = () => {
        if (!timelineDragging) return;
        timelineDragging = false;
        scrollable.classList.remove('dragging');
    };

    dragSurface.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', endDrag);
    dragSurface.addEventListener('mouseleave', endDrag);
}

function renderTimeline(scrollToEnd = false, centerYear = null) {
    if (minYear === null || maxYear === null) return;

    const container = document.querySelector('.timeline-container');
    const scrollable = document.querySelector('.timeline-scrollable');

    const timelineWidth = getTimelineWidth();

    container.style.width = '100%';
    eventsLayer.style.width = `${timelineWidth}px`;
    yearsLayer.style.width = `${timelineWidth}px`;
    reflectionLayer.style.width = `${timelineWidth}px`;

    const timelineLine = scrollable.querySelector('.timeline-line');
    if (timelineLine) {
        timelineLine.style.width = `${timelineWidth}px`;
    }

    renderYearLabels();
    renderEvents();

    setTimeout(() => {
        if (scrollToEnd) {
            scrollable.scrollLeft = scrollable.scrollWidth - scrollable.clientWidth;
        } else if (centerYear !== null) {
            const newCenterPosition = (centerYear - minYear) * yearWidth;
            const targetScrollLeft = newCenterPosition - scrollable.clientWidth / 2;
            const maxScroll = scrollable.scrollWidth - scrollable.clientWidth;
            scrollable.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
        }
    }, 0);
}

function renderYearLabels() {
    yearsLayer.innerHTML = '';

    if (minYear === null || maxYear === null) return;

    const yearLabelInterval = getYearLabelInterval();
    const shouldCondenseLabels = yearWidth <= condensedYearWidthThreshold || yearLabelInterval > 1;
    yearsLayer.classList.toggle('condensed-labels', shouldCondenseLabels);

    const useRoundedIntervals = yearLabelInterval >= 5;

    for (let year = minYear; year <= maxYear; year++) {
        const isBoundaryYear = year === minYear || year === maxYear;
        const matchesInterval = useRoundedIntervals
            ? year % yearLabelInterval === 0 // Align to round numbers (e.g., 1910, 1920)
            : (year - minYear) % yearLabelInterval === 0;

        if (!isBoundaryYear && !matchesInterval) {
            continue;
        }

        const yearLabel = document.createElement('div');
        yearLabel.className = 'year-label';
        yearLabel.textContent = year;

        const leftPosition = (year - minYear) * yearWidth;
        yearLabel.style.left = `${leftPosition}px`;

        yearLabel.style.width = `${yearWidth}px`;

        yearsLayer.appendChild(yearLabel);
    }
}

function getYearLabelInterval() {
    const intervalLevel = yearLabelIntervalLevels.find(level => yearWidth <= level.maxWidth);
    return intervalLevel ? intervalLevel.interval : 1;
}

function getEventColor(event) {
    if (!event.categories || event.categories.length === 0) {
        return defaultColor;
    }

    if (event.categories.length === 1) {
        const category = event.categories[0];
        return categoryColors[category] || defaultColor;
    }

    const colors = event.categories
        .map(cat => categoryColors[cat] || defaultColor)
        .filter((color, index, self) => self.indexOf(color) === index);

    if (colors.length === 1) {
        return colors[0];
    }

    const gradientStops = colors.map((color, index) => {
        const percentage = (index / (colors.length - 1)) * 100;
        return `${color} ${percentage}%`;
    }).join(', ');

    return `linear-gradient(135deg, ${gradientStops})`;
}

function renderEvents() {
    if (minYear === null || maxYear === null || events.length === 0) return;

    const existingEventElements = Array.from(eventsLayer.querySelectorAll('.event'));
    const existingEventMap = new Map();
    existingEventElements.forEach(el => {
        const eventIndex = parseInt(el.getAttribute('data-event-index'), 10);
        if (!isNaN(eventIndex)) {
            existingEventMap.set(eventIndex, el);
        }
    });

    const visibleEventMap = new Map();
    events.forEach((event, index) => {
        if (isEventVisible(event)) {
            visibleEventMap.set(index, event);
        }
    });

    existingEventMap.forEach((eventDiv, eventIndex) => {
        if (!visibleEventMap.has(eventIndex)) {
            if (isZooming) {
                eventDiv.remove();
            } else {
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

    const layerCount = 9;
    const layerSpacing = 72;
    const eventsLayerHeight = (eventsLayer?.clientHeight || eventsLayer?.offsetHeight || 800);
    const eventHeight = 30;
    const laneOccupancy = Array.from({ length: layerCount }, () => []);

    visibleEventMap.forEach((event, eventIndex) => {
        let eventDiv = existingEventMap.get(eventIndex);
        const isNewEvent = !eventDiv;
        const eventDurationYears = event.end_year - event.start_year + 1;

        if (isNewEvent) {
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
            eventDiv.setAttribute('data-event-index', eventIndex);

            const eventColor = getEventColor(event);
            const getCurrentEventMetrics = () => {
                const duration = event.end_year - event.start_year + 1;
                const currentWidth = duration * yearWidth;
                const currentLeft = (event.start_year - minYear) * yearWidth;
                return { currentWidth, currentLeft };
            };

            eventDiv.addEventListener('mouseenter', (e) => {
                const { currentWidth, currentLeft } = getCurrentEventMetrics();
                const reflectionWidth = Math.max(currentWidth - 10, 0);
                showReflectionBlock(event.start_year, event.end_year, eventColor, currentLeft, reflectionWidth);
                const followCursor = eventDurationYears >= 15;
                showEventTooltip(event.title, eventDiv, followCursor, e);
                highlightMinimapEvent(eventDiv);
            });

            eventDiv.addEventListener('mousemove', (e) => {
                updateTooltipPosition(eventDiv, e);
            });

            eventDiv.addEventListener('mouseleave', () => {
                hideReflectionBlock();
                hideEventTooltip();
                clearMinimapHighlight();
            });

            eventDiv.addEventListener('click', (e) => {
                if (e.target.closest('.video-icon')) {
                    return;
                }
                showEventModal(event);
            });

            eventsLayer.appendChild(eventDiv);
        } else {
            if (eventDiv.classList.contains('fade-out')) {
                eventDiv.classList.remove('fade-out');
                eventDiv.style.opacity = '1';
            }
        }

        if (isZooming) {
            eventDiv.style.transition = 'none';
        } else {
            eventDiv.style.transition = '';
        }

        const eventColor = getEventColor(event);
        eventDiv.style.background = eventColor;

        const eventWidth = eventDurationYears * yearWidth;
        const adjustedWidth = Math.max(eventWidth - 10, 0);
        eventDiv.style.width = `${adjustedWidth}px`;

        const titleTextEl = eventDiv.querySelector('.event-title-text');
        if (titleTextEl) {
            titleTextEl.style.display = adjustedWidth < minEventLabelWidth ? 'none' : '';
        }
        const videoIconEl = eventDiv.querySelector('.video-icon');
        if (videoIconEl) {
            videoIconEl.style.display = adjustedWidth < minEventLabelWidth ? 'none' : '';
        }

        const leftPosition = (event.start_year - minYear) * yearWidth;
        eventDiv.style.left = `${leftPosition}px`;

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

        eventDiv.setAttribute('data-lane-index', laneIndex);
        eventDiv.setAttribute('data-start-year', event.start_year);
        eventDiv.setAttribute('data-end-year', event.end_year);
        eventDiv.setAttribute('data-background', eventColor);

        if (isNewEvent && !isInitialRender && !isZooming) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    eventDiv.classList.remove('fade-in');
                });
            });
        } else if (isNewEvent && isZooming) {
            eventDiv.classList.remove('fade-in');
            eventDiv.style.opacity = '1';
        }
    });

    activeLayersCount = laneOccupancy.filter(lane => lane.length > 0).length;

    const unusedLayers = layerCount - activeLayersCount;
    const maxPushUpOffset = 100;
    const pushUpScale = 0.3; // keep the timeline lower on smaller screens
    const pushUpOffset = Math.min(unusedLayers * layerSpacing, maxPushUpOffset) * pushUpScale;

    const allEventElements = eventsLayer.querySelectorAll('.event:not(.fade-out)');
    allEventElements.forEach(eventDiv => {
        if (isZooming) {
            eventDiv.style.transition = 'none';
        }

        const laneIndex = parseInt(eventDiv.getAttribute('data-lane-index'), 10);
        if (!isNaN(laneIndex)) {
            const verticalOffset = laneIndex * layerSpacing;
            const topPosition = eventsLayerHeight - eventHeight - verticalOffset - pushUpOffset;
            eventDiv.style.top = `${topPosition}px`;
        }

        if (!isZooming) {
            eventDiv.style.transition = '';
        }
    });

    const scrollable = document.querySelector('.timeline-scrollable');
    const timelineLine = scrollable.querySelector('.timeline-line');
    const timelineBottomBar = document.querySelector('.timeline-bottom-bar');

    const {
        lineTop: baseTimelineLineTop,
        reflectionTop: baseReflectionLayerTop,
        yearsTop: baseYearsLayerTop,
        bottomBarBottom: baseBottomBarBottom
    } = getBaseLayoutMetrics();

    const bottomBarExtraGap = 50;

    if (timelineLine) {
        timelineLine.style.top = `${baseTimelineLineTop - pushUpOffset}px`;
    }

    if (reflectionLayer) {
        reflectionLayer.style.top = `${baseReflectionLayerTop - pushUpOffset}px`;
    }

    if (yearsLayer) {
        yearsLayer.style.top = `${baseYearsLayerTop - pushUpOffset}px`;
    }

    if (timelineBottomBar) {
        const adjustedBottom = Math.max(baseBottomBarBottom, baseBottomBarBottom + pushUpOffset - bottomBarExtraGap);
        timelineBottomBar.style.bottom = `${adjustedBottom}px`;
    }

    refreshMinimap({ redraw: true });
}

