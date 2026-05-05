# iso.me Maps for Obsidian

Render Leaflet maps inline in your Obsidian notes from exports produced by the [iso.me](https://iso.me) iOS app.

## What it does

Drop an export from iso.me into your vault, then reference it from any note with a fenced ` ```iso-me ` code block. The plugin reads the file and renders an interactive map with:

- **Visit markers** — duration-encoded circle markers (larger = longer stay) with a popup showing the location name, address, arrival/departure times, and duration.
- **Route polylines** — connected GPS tracks with start (green) and end (red) markers, plus path/straight-line distance info.
- **Heatmap** — optional density overlay over the GPS points.
- **GPS glitches** — points iso.me has flagged as outliers, optionally rendered as small scatter dots. Hidden by default; the route polyline and heatmap always exclude them.
- **Stats bar** — summary statistics above the map: visit/point counts, total distance, average speed, date range, and top visited place.
- **Format badge** — each map shows the detected export format (JSON, CSV, MD, OwnTracks, Overland, GPX).

Pick a basemap (CartoDB Voyager/Positron/Dark Matter, OpenTopoMap, Esri satellite, or a custom URL) from the plugin's settings tab.

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
show_outliers: false
title: April 2026 trip
```
````

`source` is required and resolved relative to vault root. The file extension determines the parser (`.json`, `.csv`, `.md`/`.markdown`). All other keys are optional and override plugin settings. The plugin auto-detects whether the file contains visits, location points, or both.

### Exports folder + date keywords

Set an **Exports folder** in the plugin's settings tab (e.g. `exports`) and `source:` values without a slash are looked up inside it. You can also use date keywords that resolve to the matching export file in that folder:

````markdown
```iso-me
source: yesterday
title: Where I went yesterday
```
````

Supported keywords:

- `today`
- `yesterday`
- `YYYY-MM-DD` — a specific date (e.g. `2026-05-01`)
- `last 7 days`, `last 30 days`, etc.
- `last week` (alias for `last 7 days`)

Each keyword is converted into a glob using the **Export filename pattern** setting (default `*{date}*`, where `{date}` is replaced with the resolved date) and the **Export date format** setting (default `YYYY-MM-DD`, with `YYYY` / `MM` / `DD` tokens). With the defaults, `source: yesterday` matches any file in the exports folder containing yesterday's `YYYY-MM-DD` — which works for both iso.me's per-day filenames (`iso.me - Friday 2026-05-01 - all.json`) and the timestamped full export (`isome_complete_export_2026-05-01_121042.json`). If iso.me's filename format changes, tune the pattern (e.g. `iso.me*{date}*all*` to match only the combined per-day file).

This combines naturally with [daily notes](https://help.obsidian.md/plugins/daily-notes): drop a `source: yesterday` block in your daily-note template and the map renders the previous day's data automatically.

### Interactive filters

Set `interactive: true` to render a control bar above the map with a day picker (each day in the export plus "All days") and a time-of-day range slider. Changing either re-renders the visit, route, heatmap, and outlier layers in place and auto-fits the map to the new selection.

````markdown
```iso-me
source: exports/iso-export-2026-04.json
interactive: true
height: 500
```
````

### Combining multiple files in one map

iso.me's CSV and Markdown exports split visits and location points into separate files. To render both layers on a single map, use `sources:` with a list:

````markdown
```iso-me
sources:
  - exports/visits-2026-04.md
  - exports/points-2026-04.md
show_visits: true
show_routes: true
show_heatmap: false
title: April 2026 trip
```
````

Inline forms (`sources: [a.md, b.md]` or `sources: a.md, b.md`) work too. Visits and points from each file are merged; the map fits its bounds across everything. JSON exports already support a combined `{ visits, points }` shape, so a single `source:` is enough there.

### One-file-per-day exports (folders + globs)

iso.me's export screen has a **One file per day** toggle that produces a separate file for each calendar day in the range. To render a whole batch on one map, point `source:` (or any item under `sources:`) at:

- A folder — every supported export inside is loaded:

  ````markdown
  ```iso-me
  source: exports/april/
  title: April 2026
  ```
  ````

- A filename glob with `*` / `?` — matched files are loaded in alphabetical order (chronological if filenames start with the date):

  ````markdown
  ```iso-me
  source: exports/iso.me*.json
  title: All days
  ```
  ````

  ````markdown
  ```iso-me
  sources:
    - exports/iso.me*visits.md
    - exports/iso.me*points.md
  ```
  ````

Wildcards apply to the filename component only (the directory part must be literal). Files with non-export extensions are skipped automatically.

## Supported iso.me export formats

All six export formats from iso.me are accepted:

### iso.me native formats

**JSON** — visits, points, or combined:
- `{ exportDate, visits: [...] }`
- `{ exportDate, points: [...] }`
- `{ visits: [...], points: [...] }`

**CSV** — auto-detected by header row:
- Visits: `arrived_at,departed_at[,duration_minutes][,latitude,longitude][,location_name][,address][,notes]`
- Points: `timestamp,timestamp_unix,latitude,longitude[,altitude][,speed][,horizontal_accuracy][,is_outlier]`

For visits CSV the `latitude` / `longitude` columns must be present (enable "Coordinates" in the iso.me export options) — without coordinates, visits cannot be plotted.

**Markdown** — auto-detected by H1:
- Visits: `# iso.me Export` with `## <date>` day groups and `### <visit>` blocks containing `- **Arrived/Departed/Duration/Address/Coordinates:** ...` bullets and an optional `> notes` blockquote.
- Points: `# iso.me Location Points Export` with `## <date>` day groups and `| Time | Lat | Lon | ... |` tables.

Markdown parsing assumes the exported dates/times are in en-US format (e.g. `Friday, March 14, 2025` and `3:24 PM`), which matches the iso.me default. JSON and CSV are locale-independent.

### Tracking protocol formats (v1.2+)

These formats carry only GPS location points — no visit/stay data. The format is auto-detected by the structure of the JSON.

**OwnTracks** (`.json`) — [OwnTracks protocol](https://owntracks.org/booklet/tech/json/):
- Array of `{ _type: "location", lat, lon, tst, acc?, alt?, vel? }` objects
- `vel` is km/h (converted to m/s internally)
- `tst` is Unix seconds

**Overland** (`.json`) — [Overland iOS](https://github.com/aaronpk/Overland-iOS) GeoJSON format:
- `{ locations: [{ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { timestamp, altitude?, speed?, horizontal_accuracy? } }] }`
- Coordinates use `[longitude, latitude]` ordering

**GPX** (`.gpx`) — [GPS Exchange Format](https://www.topografix.com/GPX/1/1/) with iso.me extensions:
- Visits rendered from `<wpt>` elements with custom `<isome:departedAt>` and `<isome:durationMinutes>` extensions
- Location points rendered from `<trk>/<trkseg>/<trkpt>` elements with `<isome:speed>`, `<isome:horizontalAccuracy>`, and `<isome:isOutlier>` extensions
- Combined GPX files with both waypoints and tracks are fully supported

GPX parsing uses the browser's native `DOMParser` (available in both desktop and mobile Obsidian).

## Examples

The [`examples/`](examples/) directory contains sample export files for all six supported formats, plus a [`usage-examples.md`](examples/usage-examples.md) with ready-to-paste Obsidian code blocks:

| File | Format | Contains |
|------|--------|----------|
| `san-francisco-combined.json` | iso.me JSON | Visits + points (combined) |
| `san-francisco-visits.json` | iso.me JSON | Visits only |
| `san-francisco-points.json` | iso.me JSON | Points only |
| `commute-visits.csv` | CSV | Visits |
| `commute-points.csv` | CSV | Points |
| `san-francisco-visits.md` | Markdown | Visits |
| `commute-points.md` | Markdown | Points |
| `owntracks-commute.json` | OwnTracks | GPS points |
| `overland-commute.json` | Overland | GPS points |
| `san-francisco-day.gpx` | GPX | Waypoints + tracks |

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
