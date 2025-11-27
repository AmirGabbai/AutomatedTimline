// Tooltip positioning and reflection helpers.

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
    const tooltipTop = window.scrollY + rect.top;

    eventTooltip.style.left = `${tooltipLeft}px`;
    eventTooltip.style.top = `${tooltipTop}px`;
}

function showEventTooltip(text, targetElement, followCursor = false, cursorEvent = null) {
    if (!text || !targetElement) return;

    tooltipTargetElement = targetElement;
    tooltipFollowCursor = followCursor;

    eventTooltip.textContent = text;
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

