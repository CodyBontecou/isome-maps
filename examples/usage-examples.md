# iso.me Maps — Usage Examples

Copy these code blocks into any Obsidian note after placing the example export files in your vault (e.g. in an `exports/` folder).

---

## Basic: Combined JSON (visits + points)

Drop the combined export and map everything at once:

````markdown
```iso-me
source: examples/san-francisco-combined.json
title: San Francisco — May 4, 2026
height: 500
zoom: 13
```
````

---

## Separate files: visits + points

When you export visits and points as separate files, merge them with `sources:`:

````markdown
```iso-me
sources:
  - examples/san-francisco-visits.json
  - examples/san-francisco-points.json
title: SF — visits + track
height: 500
show_heatmap: true
```
````

---

## CSV: Visits and points

CSV files from iso.me are auto-detected by their header row:

````markdown
```iso-me
source: examples/commute-visits.csv
title: Commute — Visits (CSV)
height: 450
```
````

````markdown
```iso-me
source: examples/commute-points.csv
title: Commute — GPS Points (CSV)
height: 450
show_heatmap: true
show_outliers: true
```
````

---

## Markdown: Visits and points

Markdown exports work the same way — the plugin detects the H1 heading:

````markdown
```iso-me
source: examples/san-francisco-visits.md
title: SF Visits (Markdown)
height: 450
```
````

````markdown
```iso-me
source: examples/commute-points.md
title: Commute Points (Markdown)
height: 450
show_routes: true
show_outliers: true
```
````

---

## OwnTracks: GPS points

OwnTracks `.json` files are detected by their `_type: "location"` structure. These are points-only — no visits:

````markdown
```iso-me
source: examples/owntracks-commute.json
title: Commute (OwnTracks)
height: 450
show_routes: true
show_heatmap: false
```
````

> **Note:** OwnTracks `vel` is km/h — the plugin converts to m/s internally. No visits are rendered.

---

## Overland: GeoJSON points

Overland `.json` files are detected by their `{ locations: [...] }` GeoJSON structure. Also points-only:

````markdown
```iso-me
source: examples/overland-commute.json
title: Commute (Overland)
height: 450
show_routes: true
show_heatmap: true
```
````

> **Note:** Overland coordinates use `[longitude, latitude]` ordering. The plugin normalizes them.

---

## GPX: Waypoints + tracks

GPX files render visits from `<wpt>` elements and routes from `<trk>/<trkpt>` elements. The combined example includes both:

````markdown
```iso-me
source: examples/san-francisco-day.gpx
title: San Francisco Day (GPX)
height: 500
zoom: 13
show_visits: true
show_routes: true
show_heatmap: true
```
````

---

## Interactive mode

Add `interactive: true` to get a day picker and time-of-day slider:

````markdown
```iso-me
source: examples/san-francisco-combined.json
title: Interactive Map
height: 500
interactive: true
```
````

---

## Full options reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `source` | path | *(required)* | Single export file (vault-relative) |
| `sources` | list | — | Multiple export files, combined into one map |
| `title` | text | — | Heading shown above the map |
| `height` | number | 400 | Map height in pixels |
| `zoom` | number | 11 | Starting zoom level |
| `center` | `[lat, lon]` | `[0, 0]` | Starting center point |
| `show_visits` | boolean | `true` | Show visit markers |
| `show_routes` | boolean | `true` | Show route polylines |
| `show_heatmap` | boolean | `false` | Show heatmap overlay |
| `show_outliers` | boolean | `false` | Show GPS glitch markers |
| `show_stats` | boolean | `true` | Show the summary stats bar |
| `interactive` | boolean | `false` | Show day/time filter controls |

---

## Date keywords (requires Exports Folder setting)

Set an **Exports folder** in plugin settings, then use:

```markdown
```iso-me
source: today
title: Where I went today
```
```

```markdown
```iso-me
source: yesterday
title: Yesterday's data
```
```

```markdown
```iso-me
source: 2026-05-04
title: May 4, 2026
```
```

```markdown
```iso-me
source: last 7 days
title: This week
interactive: true
```
```

---

## Per-day exports (folder + glob)

When iso.me's **One file per day** toggle is on, load all files at once:

```markdown
```iso-me
source: exports/may-2026/
title: May 2026
interactive: true
```
```

Or use a glob to match specific naming patterns:

```markdown
```iso-me
source: exports/iso.me*all*.json
title: All combined day files
```
```
