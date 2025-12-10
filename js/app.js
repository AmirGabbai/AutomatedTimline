// Entry point: wire up UI handlers and kick off data loading.

function init() {
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);

    zoomInBtn.disabled = false;
    zoomOutBtn.disabled = false;

    window.addEventListener('popstate', handlePopState);

    setupWheelZoom();
    const modal = document.getElementById('eventModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    modalCloseBtn.addEventListener('click', closeEventModal);

    const prevEventBtn = document.getElementById('prevEventBtn');
    const nextEventBtn = document.getElementById('nextEventBtn');

    if (prevEventBtn) {
        prevEventBtn.addEventListener('click', showPreviousEvent);
    }

    if (nextEventBtn) {
        nextEventBtn.addEventListener('click', showNextEvent);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEventModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeEventModal();
        }
    });

    setupTimelineDrag();
    setupMinimapInteractions();
    loadEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

