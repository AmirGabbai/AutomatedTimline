// Tooltip positioning and reflection helpers.

let tooltipPlacement = 'above';

function updateTooltipPosition(targetElement, cursorEvent = null) {
    const element = targetElement || tooltipTargetElement;
    if (!element || !eventTooltip) return;

    if (tooltipFollowCursor && cursorEvent) {
        eventTooltip.style.left = `${cursorEvent.pageX}px`;
        eventTooltip.style.top = `${cursorEvent.pageY}px`;
        return;
    }

    const rect = element.getBoundingClientRect();
    const tooltipLeft = window.scrollX + rect.left + rect.width / 2;
    const tooltipTop = tooltipPlacement === 'below'
        ? window.scrollY + rect.bottom
        : window.scrollY + rect.top;

    eventTooltip.style.left = `${tooltipLeft}px`;
    eventTooltip.style.top = `${tooltipTop}px`;
}

function buildTooltipDescription(event, maxLength = 110) {
    if (!event) return '';

    let firstDescription = '';
    if (event.descriptions && typeof event.descriptions === 'object') {
        const values = Object.values(event.descriptions).filter(Boolean);
        firstDescription = typeof values[0] === 'string' ? values[0] : '';
    } else if (typeof event.description === 'string') {
        firstDescription = event.description;
    }

    if (!firstDescription) return '';

    const cleanText = firstDescription.trim();
    if (cleanText.length > maxLength) {
        return `${cleanText.slice(0, maxLength).trim()}...`;
    }
    return `${cleanText}...`;
}

function buildTooltipHTML(event) {
    const yearsText = event.start_year === event.end_year
        ? `${event.start_year}`
        : `${event.start_year}-${event.end_year}`;

    const categoryCircles = (event.categories || []).map(category => {
        const color = categoryColors[category] || defaultColor;
        return `<span class="tooltip-category-circle" style="background-color: ${color};"></span>`;
    }).join('');

    const descriptionPreview = buildTooltipDescription(event);

    const hasVideo = event.video_url && event.video_url.trim() !== '';
    const videoIconHTML = hasVideo
        ? `<img class="tooltip-video-icon" src="static/icons/video-icon-black.svg" alt="Video">`
        : '';

    return `
        <div class="tooltip-hero"></div>
        <div class="tooltip-body">
            <div class="tooltip-meta">
                <div class="tooltip-categories">${categoryCircles}</div>
                <div class="tooltip-years">${yearsText}</div>
            </div>
            <div class="tooltip-title-wrapper">
                <span class="tooltip-title">${event.title || ''}</span>
                ${videoIconHTML}
            </div>
            <div class="tooltip-description">${descriptionPreview}</div>
        </div>
    `;
}

function showEventTooltip(eventData, targetElement, followCursor = false, cursorEvent = null, placement = 'above') {
    if (!eventData || !targetElement) return;

    tooltipTargetElement = targetElement;
    tooltipFollowCursor = followCursor;
    tooltipPlacement = placement === 'below' ? 'below' : 'above';
    eventTooltip.classList.toggle('below', tooltipPlacement === 'below');

    eventTooltip.innerHTML = buildTooltipHTML(eventData);
    
    // Set image on tooltip hero if available
    const tooltipHero = eventTooltip.querySelector('.tooltip-hero');
    if (tooltipHero && eventData.image_url && eventData.image_url.trim() !== '') {
        tooltipHero.style.backgroundImage = `url('${eventData.image_url}')`;
        tooltipHero.style.backgroundSize = 'cover';
        tooltipHero.style.backgroundPosition = 'center';
    }
    
    updateTooltipPosition(targetElement, cursorEvent);
    eventTooltip.classList.add('visible');
}

function hideEventTooltip() {
    tooltipFollowCursor = false;
    tooltipTargetElement = null;
    eventTooltip.classList.remove('visible');
}

function applyOpacityToBackground(background) {
    if (!background) return '';

    if (background.includes('linear-gradient')) {
        const gradientMatch = background.match(/linear-gradient\(([^)]+)\)/);
        if (!gradientMatch) return background;

        const gradientContent = gradientMatch[1];
        const parts = gradientContent.split(',').map(p => p.trim());

        let direction = '';
        let colorStops = [];

        if (parts[0].match(/^\d+deg$/)) {
            direction = parts[0];
            colorStops = parts.slice(1);
        } else {
            colorStops = parts;
        }

        const newStops = colorStops.map(stop => {
            const stopParts = stop.split(/\s+/);
            const color = stopParts[0];
            const percentage = stopParts.slice(1).join(' ');

            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return percentage ? `rgba(${r}, ${g}, ${b}, 0.4) ${percentage}` : `rgba(${r}, ${g}, ${b}, 0.4)`;
            }
            return stop;
        });

        const gradientParts = direction ? [direction, ...newStops] : newStops;
        return `linear-gradient(${gradientParts.join(', ')})`;
    }

    if (background.startsWith('#')) {
        const r = parseInt(background.slice(1, 3), 16);
        const g = parseInt(background.slice(3, 5), 16);
        const b = parseInt(background.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, 0.4)`;
    }

    if (background.includes('rgba')) {
        return background.replace(/rgba\(([^)]+)\)/, (match, content) => {
            const parts = content.split(',').map(p => p.trim());
            if (parts.length === 4) {
                parts[3] = '0.4';
                return `rgba(${parts.join(', ')})`;
            }
            return match;
        });
    }

    return background;
}

function showReflectionBlock(startYear, endYear, eventBackground, leftPosition, eventWidth) {
    reflectionLayer.innerHTML = '';

    const reflectionBlock = document.createElement('div');
    reflectionBlock.className = 'reflection-block';

    const backgroundWithOpacity = applyOpacityToBackground(eventBackground);
    reflectionBlock.style.background = backgroundWithOpacity;

    reflectionBlock.style.left = `${leftPosition}px`;
    reflectionBlock.style.width = `${eventWidth}px`;

    reflectionLayer.appendChild(reflectionBlock);
}

function hideReflectionBlock() {
    reflectionLayer.innerHTML = '';
}

function extractColorsFromBackground(colorString) {
    if (!colorString) return [];

    if (colorString.includes('linear-gradient')) {
        const colorMatches = colorString.match(/#[0-9a-fA-F]{6}/g);
        return colorMatches || [];
    }

    if (colorString.startsWith('#')) {
        return [colorString];
    }

    return [];
}

function hexToRgba(hex, opacity = 0.5) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function createGlowColor(colors) {
    if (colors.length === 0) {
        return 'rgba(74, 144, 226, 0.5)';
    }

    if (colors.length === 1) {
        return hexToRgba(colors[0], 0.5);
    }

    return colors.map(color => hexToRgba(color, 0.5));
}

