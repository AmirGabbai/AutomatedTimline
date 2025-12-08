// Data loading: fetch events JSON and bootstrap timeline.

async function loadEvents() {
    try {
        const response = await fetch('static/events-files/racism-events3-backup.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        events = await response.json();

        events.forEach(event => {
            event.categories = deriveCategoriesFromDescriptions(event);
        });

        if (events.length === 0) {
            throw new Error('No events found in JSON file');
        }

        mapCategoriesToColors();
        readURLParams();
        renderCategoryButtons();

        minYear = Math.min(...events.map(event => event.start_year));
        maxYear = Math.max(...events.map(event => event.end_year));

        renderTimeline(true);

        setTimeout(() => {
            isInitialRender = false;
        }, 100);
    } catch (error) {
        console.error('Error loading events:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') ||
            error.name === 'TypeError' || window.location.protocol === 'file:') {
            displayError(
                'Failed to load racism-events.json. This usually happens when opening the file directly.<br><br>' +
                '<strong>Solution:</strong> Run a local server:<br>' +
                '• Python: <code>python -m http.server 8000</code> then visit <code>http://localhost:8000</code><br>' +
                '• Node.js: <code>npx http-server</code> then visit the shown URL<br><br>' +
                'Or check the browser console for more details.'
            );
        } else {
            displayError(`Failed to load events. Error: ${error.message}<br><br>Please check that racism-events.json exists and is valid JSON.`);
        }
    }
}

