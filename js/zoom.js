// Zoom controls for adjusting year width.

const maxZoomIn = 200;
const maxZoomOut = 35;

function updateZoom(newYearWidth) {
    const scrollable = document.querySelector('.timeline-scrollable');

    let centerYear = null;
    if (scrollable.scrollWidth > 0) {
        const currentScrollLeft = scrollable.scrollLeft;
        const viewportCenter = currentScrollLeft + scrollable.clientWidth / 2;
        centerYear = minYear + (viewportCenter / yearWidth);
    }

    isZooming = true;

    yearWidth = newYearWidth;
    renderTimeline(false, centerYear);

    setTimeout(() => {
        isZooming = false;
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

