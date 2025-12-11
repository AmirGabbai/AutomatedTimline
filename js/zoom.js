// Zoom controls for adjusting year width.

const maxZoomIn = 200;
const maxZoomOut = 28;

function updateZoom(newYearWidth, options = {}) {
    const scrollable = getTimelineScrollable();
    const anchor = options.anchor || null;
    let anchorInfo = null;

    if (scrollable && scrollable.scrollWidth > 0) {
        const currentScrollWidth = scrollable.scrollWidth;
        if (anchor?.type === 'left') {
            anchorInfo = {
                type: 'left',
                fraction: anchor.fraction ?? (scrollable.scrollLeft / currentScrollWidth)
            };
        } else if (anchor?.type === 'right') {
            anchorInfo = {
                type: 'right',
                fraction: anchor.fraction ?? ((scrollable.scrollLeft + scrollable.clientWidth) / currentScrollWidth)
            };
        } else {
            const currentScrollLeft = scrollable.scrollLeft;
            const viewportCenter = currentScrollLeft + scrollable.clientWidth / 2;
            const centerYear = minYear + (viewportCenter / yearWidth);
            // Keep center anchoring stable while zooming from wheel/pinch.
            const targetCenterYear = anchor?.centerYear ?? centerYear;
            anchorInfo = { type: 'center', centerYear: targetCenterYear };
        }
    }

    isZooming = true;

    yearWidth = newYearWidth;
    if (anchorInfo?.type === 'center') {
        renderTimeline(false, anchorInfo.centerYear);
    } else {
        renderTimeline();
    }

    setTimeout(() => {
        isZooming = false;
        if (anchorInfo && anchorInfo.type !== 'center' && scrollable) {
            const newScrollWidth = scrollable.scrollWidth;
            const maxScroll = newScrollWidth - scrollable.clientWidth;

            let newScrollLeft = anchorInfo.type === 'left'
                ? anchorInfo.fraction * newScrollWidth
                : anchorInfo.fraction * newScrollWidth - scrollable.clientWidth;

            if (Number.isNaN(newScrollLeft)) {
                newScrollLeft = scrollable.scrollLeft;
            }

            scrollable.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
            refreshMinimap();
        }
    }, 0);

    zoomInBtn.disabled = yearWidth >= maxZoomIn;
    zoomOutBtn.disabled = yearWidth <= maxZoomOut;
}

function zoomIn() {
    const newWidth = Math.min(yearWidth + 20, maxZoomIn);
    updateZoom(newWidth);
}

function zoomOut() {
    const newWidth = Math.max(yearWidth - 20, maxZoomOut);
    updateZoom(newWidth);
}

// Enable pinch/trackpad zooming on the timeline scroll area.
function setupWheelZoom() {
    const scrollable = getTimelineScrollable();
    // Restrict wheel/pinch zoom to the events layer so it only triggers while hovering timeline content.
    const zoomSurface = eventsLayer;
    if (!scrollable || !zoomSurface) return;

    let wheelFramePending = false;
    let pendingZoomWidth = yearWidth;
    let gestureAnchorYear = null;
    let gestureTimeout = null;

    const handleWheel = (event) => {
        // On most browsers a pinch gesture arrives as a wheel event with ctrlKey.
        if (!event.ctrlKey && !event.metaKey) return;

        // Prevent the browser page zoom and keep the gesture within the timeline.
        event.preventDefault();

        // Determine the year under the cursor so we can keep it centered while zooming.
        const rect = scrollable.getBoundingClientRect();
        const offsetX = event.clientX - rect.left + scrollable.scrollLeft;
        const anchorYear = minYear + (offsetX / yearWidth);
        if (gestureAnchorYear === null) {
            gestureAnchorYear = anchorYear;
        }

        // Smooth zoom factor based on gesture intensity; clamp to our limits.
        const zoomFactor = 1 + Math.min(Math.abs(event.deltaY) * 0.0025, 1.5);
        pendingZoomWidth = event.deltaY < 0
            ? Math.min(pendingZoomWidth * zoomFactor, maxZoomIn)
            : Math.max(pendingZoomWidth / zoomFactor, maxZoomOut);

        // Throttle via rAF so we update smoothly without over-rendering.
        if (!wheelFramePending) {
            wheelFramePending = true;
            requestAnimationFrame(() => {
                wheelFramePending = false;
                updateZoom(pendingZoomWidth, { anchor: { type: 'center', centerYear: gestureAnchorYear } });
            });
        }

        // Reset the gesture anchor after a short pause in wheel events.
        if (gestureTimeout) {
            clearTimeout(gestureTimeout);
        }
        gestureTimeout = setTimeout(() => {
            gestureAnchorYear = null;
            pendingZoomWidth = yearWidth;
        }, 180);
    };

    zoomSurface.addEventListener('wheel', handleWheel, { passive: false });
}

