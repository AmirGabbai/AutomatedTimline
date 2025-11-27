// Navigation helpers: error display and URL sync reactions.

function displayError(message) {
    const container = document.querySelector('.timeline-container');
    container.innerHTML = `<div class="error">${message}</div>`;
}

function handlePopState() {
    if (events.length === 0) return;

    Object.keys(hiddenCategories).forEach(category => {
        hiddenCategories[category] = false;
    });

    readURLParams();

    const buttons = categoriesMenu.querySelectorAll('.category-btn');
    buttons.forEach(button => {
        const category = button.getAttribute('data-category');
        if (hiddenCategories[category]) {
            button.classList.add('hidden');
        } else {
            button.classList.remove('hidden');
        }
    });

    renderEvents();
}

