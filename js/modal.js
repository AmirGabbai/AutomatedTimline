// Modal interactions for viewing event details.

let currentEventIndex = -1;

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
    const modalTitle = document.getElementById('modalTitle');
    const modalVideoIcon = document.getElementById('modalVideoIcon-black');
    const modalCategories = document.getElementById('modalCategories');
    const modalYears = document.getElementById('modalYears');
    const modalVideos = document.getElementById('modalVideos');
    const modalDescriptions = document.getElementById('modalDescriptions');
    const modalLinks = document.getElementById('modalLinks');

    modalTitle.textContent = event.title;

    const youtubeLinks = event.links ? event.links.filter(link => isYouTubeLink(link)) : [];
    modalVideoIcon.style.display = youtubeLinks.length > 0 ? 'inline' : 'none';

    if (event.start_year === event.end_year) {
        modalYears.textContent = event.start_year.toString();
    } else {
        modalYears.textContent = `${event.start_year}-${event.end_year}`;
    }

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
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

