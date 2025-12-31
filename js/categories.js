// Category utilities: derive categories, manage colors, and toggle visibility.

/**
 * Derives the list of categories for an event based on its description keys.
 * @param {Object} event - The event object from the JSON file.
 * @returns {Array<string>} - Array of category names.
 */
function deriveCategoriesFromDescriptions(event) {
    if (!event || typeof event !== 'object') {
        return [];
    }

    const descriptions = event.descriptions;
    if (!descriptions || typeof descriptions !== 'object') {
        return [];
    }

    return Object.keys(descriptions)
        .filter(key => typeof key === 'string' && key.trim().length > 0);
}

/**
 * Extracts all unique categories from the events array.
 * @returns {Array<string>} Array of unique category names.
 */
function extractCategories() {
    const categoriesSet = new Set();
    events.forEach(event => {
        if (event.categories && Array.isArray(event.categories)) {
            event.categories.forEach(category => {
                if (category && typeof category === 'string') {
                    categoriesSet.add(category);
                }
            });
        }
    });
    return Array.from(categoriesSet).sort(); // Sort for consistent ordering
}

/**
 * Maps categories to colors from the color palette.
 * Each category gets assigned a color from the palette in order.
 */
function mapCategoriesToColors() {
    const uniqueCategories = extractCategories();
    categoryColors = {};
    hiddenCategories = {};

    uniqueCategories.forEach((category, index) => {
        const colorIndex = index % colorPalette.length;
        categoryColors[category] = colorPalette[colorIndex];
        hiddenCategories[category] = false;
    });

    console.log('Category to color mapping:', categoryColors);
}

/**
 * Renders category buttons in the categories menu.
 * Each button shows the category name and uses the category color as background.
 */
function renderCategoryButtons() {
    categoriesMenu.innerHTML = '';

    const uniqueCategories = extractCategories();

    uniqueCategories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.setAttribute('data-category', category);
        
        // Wrap text in span to unskew it
        const textSpan = document.createElement('span');
        textSpan.textContent = category;
        button.appendChild(textSpan);

        const categoryColor = categoryColors[category] || defaultColor;
        button.style.backgroundColor = categoryColor;

        if (hiddenCategories[category]) {
            button.classList.add('hidden');
        }

        button.addEventListener('click', () => toggleCategoryVisibility(category));

        categoriesMenu.appendChild(button);
    });
}

/**
 * Updates the URL with the current hidden categories.
 */
function updateURL() {
    const urlParams = new URLSearchParams(window.location.search);

    const hiddenCats = Object.keys(hiddenCategories).filter(cat => hiddenCategories[cat]);

    if (hiddenCats.length > 0) {
        urlParams.set('hide', hiddenCats.join(','));
    } else {
        urlParams.delete('hide');
    }

    const newURL = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.pushState({}, '', newURL);
}

/**
 * Reads URL parameters and sets initial category visibility.
 */
function readURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const hideParam = urlParams.get('hide');

    if (hideParam) {
        const categoriesToHide = hideParam.split(',').map(cat => cat.trim());

        categoriesToHide.forEach(category => {
            if (category && category in categoryColors) {
                hiddenCategories[category] = true;
            }
        });
    }
}

/**
 * Toggles the visibility of events with a specific category.
 * @param {string} category - The category to toggle.
 * @param {HTMLElement} button - The button element that was clicked.
 */
function toggleCategoryVisibility(category) {
    const allVisible = Object.values(hiddenCategories).every(isHidden => !isHidden);
    const visibleCount = Object.values(hiddenCategories).filter(isHidden => !isHidden).length;

    if (allVisible) {
        // If everything is visible, hide all other categories and keep only the clicked one visible.
        Object.keys(hiddenCategories).forEach(cat => {
            hiddenCategories[cat] = cat !== category;
        });
    } else if (visibleCount === 1 && !hiddenCategories[category]) {
        // If only this category is visible and it's clicked, show everything.
        Object.keys(hiddenCategories).forEach(cat => {
            hiddenCategories[cat] = false;
        });
    } else {
        hiddenCategories[category] = !hiddenCategories[category];
    }

    // Re-render buttons to reflect the new hidden state for all categories.
    renderCategoryButtons();

    updateURL();
    renderEvents();
}

/**
 * Checks if an event should be visible based on category visibility settings.
 * @param {Object} event - The event object.
 * @returns {boolean} True if event should be visible, false otherwise.
 */
function isEventVisible(event) {
    if (!event.categories || event.categories.length === 0) {
        return true;
    }

    // Show the event if it has at least one visible category, even if others are hidden.
    return event.categories.some(category => !hiddenCategories[category]);
}

