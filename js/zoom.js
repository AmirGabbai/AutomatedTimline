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
            anchorInfo = { type: 'center', centerYear };
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

