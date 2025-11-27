// Entry point: wire up UI handlers and kick off data loading.

function init() {
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);

    zoomInBtn.disabled = false;
    zoomOutBtn.disabled = false;

    window.addEventListener('popstate', handlePopState);

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

    const scrollable = document.querySelector('.timeline-scrollable');
    const instructionsContainer = document.querySelector('.instructions-container');

    if (scrollable && instructionsContainer) {
        scrollable.addEventListener('wheel', (e) => {
            if (e.shiftKey && !instructionsHidden) {
                instructionsHidden = true;
                instructionsContainer.style.opacity = '0';
                setTimeout(() => {
                    instructionsContainer.style.display = 'none';
                }, 500);
            }
        });
    }

    setupMinimapInteractions();
    loadEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

