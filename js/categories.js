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
        button.textContent = category;
        button.setAttribute('data-category', category);

        const categoryColor = categoryColors[category] || defaultColor;
        button.style.backgroundColor = categoryColor;

        if (hiddenCategories[category]) {
            button.classList.add('hidden');
        }

        button.addEventListener('click', () => toggleCategoryVisibility(category, button));

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
function toggleCategoryVisibility(category, button) {
    hiddenCategories[category] = !hiddenCategories[category];

    if (hiddenCategories[category]) {
        button.classList.add('hidden');
    } else {
        button.classList.remove('hidden');
    }

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

    return event.categories.every(category => !hiddenCategories[category]);
}

