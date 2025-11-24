# Interactive Timeline

An interactive horizontal timeline visualization tool.

## Quick Start

### Option 1: Using Python (Recommended)

1. Open a terminal in this directory
2. Run: `python server.py`
3. Open your browser and go to: `http://localhost:8000/index.html`

### Option 2: Using Node.js

1. Install http-server (if not already installed): `npm install -g http-server`
2. Open a terminal in this directory
3. Run: `npx http-server`
4. Open the URL shown in the terminal (usually `http://localhost:8080`)

### Option 3: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Why a Server?

Modern browsers block `fetch()` requests when opening HTML files directly (file:// protocol) due to CORS security restrictions. Using a local server solves this issue.

## Files

- `index.html` - Main HTML file
- `style.css` - Styling
- `script.js` - Timeline logic and event handling
- `events.json` - Event data (edit this to customize your timeline)
- `server.py` - Simple Python HTTP server

## Customizing Events

Edit `events.json` to add or modify events. Each event should have:
- `title`: Event name
- `start_year`: Starting year
- `end_year`: Ending year

### events.json structure

Every entry inside the `events.json` array follows the structure below. Only `title`, `start_year`, and `end_year` are required; everything else is optional and can be omitted if not needed.

```
{
  "title": "Age of Discovery",
  "start_year": 1415,
  "end_year": 1600,
  "links": [
    "https://www.youtube.com/watch?v=T8EW0skmZ_o"
  ],
  "descriptions": {
    "technology": "Advances in navigation, shipbuilding, and cartography enabling transoceanic voyages.",
    "culture": "Encounters between civilizations reshaping worldviews, trade networks, and colonial ambitions."
  }
}
```

- `links`: Optional array of URLs. If present, YouTube links will be embedded inside the modal and non-YouTube links will be listed in the resources section.
- `descriptions`: Required when you want per-category blurbs. Each key represents a category (e.g., `war`, `culture`, `technology`, `art`) and the value is the narrative shown in the modal and used to infer category colors.

Add as many objects as needed; the timeline automatically derives categories, colors, lanes, and timeline span from the data you provide.

