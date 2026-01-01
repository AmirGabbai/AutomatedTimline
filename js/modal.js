// Modal interactions for viewing event details.

let currentEventIndex = -1;

// ==================== INFO MODAL FUNCTIONS ====================

function showInfoModal() {
    const modal = document.getElementById('infoModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    const videoPlaceholder = document.getElementById('infoVideoPlaceholder');
    const videoContainer = document.getElementById('infoModalVideo');
    const videoIframe = document.getElementById('infoVideoIframe');
    
    // Stop video if playing
    if (videoIframe) {
        try {
            videoIframe.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        } catch (e) { /* no-op */ }
        videoIframe.src = '';
    }
    
    // Reset to show placeholder
    if (videoPlaceholder) videoPlaceholder.style.display = 'flex';
    if (videoContainer) videoContainer.style.display = 'none';
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function playInfoVideo() {
    const videoPlaceholder = document.getElementById('infoVideoPlaceholder');
    const videoContainer = document.getElementById('infoModalVideo');
    const videoIframe = document.getElementById('infoVideoIframe');
    
    // Replace with your actual YouTube video ID
    const infoVideoId = 'YOUR_VIDEO_ID_HERE';
    
    if (infoVideoId && infoVideoId !== 'YOUR_VIDEO_ID_HERE') {
        videoIframe.src = `https://www.youtube.com/embed/${infoVideoId}?enablejsapi=1&rel=0&autoplay=1`;
        videoPlaceholder.style.display = 'none';
        videoContainer.style.display = 'block';
    }
}

function initInfoModal() {
    const infoBtn = document.getElementById('infoBtn');
    const infoModalCloseBtn = document.getElementById('infoModalCloseBtn');
    const infoModal = document.getElementById('infoModal');
    const videoPlaceholder = document.getElementById('infoVideoPlaceholder');
    
    if (infoBtn) {
        infoBtn.addEventListener('click', showInfoModal);
    }
    
    if (infoModalCloseBtn) {
        infoModalCloseBtn.addEventListener('click', closeInfoModal);
    }
    
    if (infoModal) {
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                closeInfoModal();
            }
        });
    }
    
    if (videoPlaceholder) {
        videoPlaceholder.addEventListener('click', playInfoVideo);
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && infoModal && infoModal.classList.contains('active')) {
            closeInfoModal();
        }
    });
}

// Initialize info modal when DOM is ready
document.addEventListener('DOMContentLoaded', initInfoModal);

// ==============================================================

function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return null;

    let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

function isYouTubeLink(url) {
    return url && (url.includes('youtube.com') || url.includes('youtu.be'));
}

function showEventModal(event) {
    currentEventIndex = events.findIndex(e => e === event);

    updateNavigationButtons();
    const modal = document.getElementById('eventModal');
    const modalContent = modal.querySelector('.modal-content');
    const modalHero = document.getElementById('modalHero');
    const modalTitle = document.getElementById('modalTitle');
    const modalVideoIcon = document.getElementById('modalVideoIcon-black');
    const modalCategories = document.getElementById('modalCategories');
    const modalYears = document.getElementById('modalYears');
    const modalVideos = document.getElementById('modalVideos');
    const modalDescriptions = document.getElementById('modalDescriptions');
    const modalLinks = document.getElementById('modalLinks');

    // Make sure any previously embedded players are fully stopped before rendering a new event.
    clearModalVideos(modalVideos);

    // Determine if this event has a video_url
    const hasVideos = event.video_url && event.video_url.trim() !== '';
    
    // Apply the appropriate size class
    modalContent.classList.remove('modal-with-video', 'modal-without-video');
    modalContent.classList.add(hasVideos ? 'modal-with-video' : 'modal-without-video');

    // Set hero image if available, otherwise use a gradient based on categories
    if (event.image_url && event.image_url.trim() !== '') {
        modalHero.style.backgroundImage = `url('${event.image_url}')`;
        modalHero.style.backgroundSize = 'cover';
        modalHero.style.backgroundPosition = 'center';
    } else {
        // Create a gradient from category colors
        const categoryList = [];
        if (Array.isArray(event.categories)) {
            categoryList.push(...event.categories);
        }
        if (event.descriptions && typeof event.descriptions === 'object') {
            categoryList.push(...Object.keys(event.descriptions));
        }
        const uniqueCategories = Array.from(new Set(categoryList));
        const gradientColors = uniqueCategories
            .map(cat => categoryColors[cat])
            .filter(Boolean);
        
        if (gradientColors.length >= 2) {
            modalHero.style.backgroundImage = `linear-gradient(135deg, ${gradientColors[0]}40 0%, ${gradientColors[1]}40 100%)`;
        } else if (gradientColors.length === 1) {
            modalHero.style.backgroundImage = `linear-gradient(135deg, ${gradientColors[0]}40 0%, ${gradientColors[0]}20 100%)`;
        } else {
            modalHero.style.backgroundImage = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)';
        }
    }

    modalTitle.textContent = event.title;

    // Show video icon only if video_url is present
    modalVideoIcon.style.display = hasVideos ? 'inline' : 'none';

    if (event.start_year === event.end_year) {
        modalYears.textContent = event.start_year.toString();
    } else {
        modalYears.textContent = `${event.start_year}-${event.end_year}`;
    }

    modalCategories.innerHTML = '';
    // Collect all categories from both categories array and descriptions
    const allCategories = [];
    if (event.categories && event.categories.length > 0) {
        allCategories.push(...event.categories);
    }
    if (event.descriptions && typeof event.descriptions === 'object') {
        allCategories.push(...Object.keys(event.descriptions));
    }
    const uniqueCats = Array.from(new Set(allCategories));
    uniqueCats.forEach(category => {
        const circle = document.createElement('span');
        circle.className = 'modal-category-circle';
        const categoryColor = categoryColors[category] || defaultColor;
        circle.style.backgroundColor = categoryColor;
        modalCategories.appendChild(circle);
    });

    modalVideos.innerHTML = '';
    if (hasVideos) {
        const videoId = extractYouTubeId(event.video_url);
        if (videoId) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'modal-video';
            const iframe = document.createElement('iframe');
            // enablejsapi allows us to send a stop command on close
            iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0`;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            videoContainer.appendChild(iframe);
            modalVideos.appendChild(videoContainer);
        }
        modalVideos.style.display = 'flex';
    } else {
        modalVideos.style.display = 'none';
    }

    modalDescriptions.innerHTML = '';
    if (event.descriptions && typeof event.descriptions === 'object') {
        Object.entries(event.descriptions).forEach(([category, description]) => {
            const descriptionItem = document.createElement('div');
            descriptionItem.className = 'modal-description-item';

            const categoryName = document.createElement('div');
            categoryName.className = 'modal-description-category';
            const categoryColor = categoryColors[category] || defaultColor;
            categoryName.style.backgroundColor = categoryColor;
            // Wrap text in span for unskew effect (parallelogram shape)
            const categorySpan = document.createElement('span');
            categorySpan.textContent = category;
            categoryName.appendChild(categorySpan);

            const descriptionText = document.createElement('div');
            descriptionText.className = 'modal-description-text';
            descriptionText.textContent = description;

            descriptionItem.appendChild(categoryName);
            descriptionItem.appendChild(descriptionText);
            modalDescriptions.appendChild(descriptionItem);
        });
    }

    const modalLinksSection = document.querySelector('.modal-links-section');
    const modalFooter = document.querySelector('.modal-footer');
    modalLinks.innerHTML = '';
    const allLinks = event.links || [];
    if (allLinks.length > 0) {
        allLinks.forEach((link, index) => {
            const linkElement = document.createElement('a');
            linkElement.className = 'modal-link';
            linkElement.href = link;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.textContent = link;
            modalLinks.appendChild(linkElement);
        });
        modalLinksSection.style.display = 'flex';
        modalFooter.classList.remove('no-links');
    } else {
        modalLinksSection.style.display = 'none';
        modalFooter.classList.add('no-links');
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevEventBtn');
    const nextBtn = document.getElementById('nextEventBtn');

    if (prevBtn) {
        prevBtn.disabled = currentEventIndex <= 0;
    }

    if (nextBtn) {
        nextBtn.disabled = currentEventIndex >= events.length - 1;
    }
}

function showPreviousEvent() {
    if (currentEventIndex > 0) {
        const prevEvent = events[currentEventIndex - 1];
        showEventModal(prevEvent);
    }
}

function showNextEvent() {
    if (currentEventIndex < events.length - 1) {
        const nextEvent = events[currentEventIndex + 1];
        showEventModal(nextEvent);
    }
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    const modalVideos = document.getElementById('modalVideos');

    clearModalVideos(modalVideos);

    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Stop and remove any YouTube iframes within the modal.
function clearModalVideos(container) {
    if (!container) return;

    const iframes = container.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
        // Try to pause nicely via the YouTube iframe API.
        try {
            iframe.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
        } catch (e) {
            /* no-op */
        }

        // Brutal fallback: blank the src before removing to force playback teardown.
        iframe.src = '';
        iframe.remove();
    });

    // Replace children to guarantee nothing continues playing in the background.
    container.innerHTML = '';
    container.style.display = 'none';
}

