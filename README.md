# iso.me Maps for Obsidian

Render Leaflet maps inline in your Obsidian notes from JSON exports produced by the [iso.me](https://iso.me) iOS app.

## What it does

Drop a JSON export from iso.me into your vault, then reference it from any note with a fenced ` ```iso-me ` code block. The plugin reads the file and renders an interactive map with:

- **Visit markers** — pins for each visit with a popup showing the location name, address, arrival/departure times, and duration.
- **Route polylines** — connected GPS tracks with start (green) and end (red) markers.
- **Heatmap** — optional density overlay over the GPS points.

## Usage

````markdown
```iso-me
source: exports/iso-export-2026-04.json
height: 500
zoom: 12
center: [37.7749, -122.4194]
show_visits: true
show_routes: true
show_heatmap: false
title: April 2026 trip
```
````

`source` is required and resolved relative to vault root. All other keys are optional and override plugin settings. The plugin auto-detects whether the file contains visits, location points, or both.

## Supported iso.me export shapes

- Visits-only: `{ exportDate, visits: [...] }`
- Points-only: `{ exportDate, points: [...] }`
- Combined: `{ visits: [...], points: [...] }`

Generate any of these via the iso.me Settings → Export flow.

## Development

```bash
npm install
npm run dev          # esbuild watch mode
npm run build        # type-check and bundle for production
```

To test locally, symlink the plugin folder into a test vault:

```bash
ln -s "$PWD" "<test-vault>/.obsidian/plugins/iso-me-maps"
```

Reload Obsidian, disable Safe Mode, and enable "iso.me Maps".

## License

MIT
