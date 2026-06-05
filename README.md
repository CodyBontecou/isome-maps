# iso.me Maps for Obsidian

<img width="500" alt="CleanShot 2026-05-06 at 16 40 20@2x" src="https://github.com/user-attachments/assets/afb51f1f-29c4-4c5a-b717-073010c55c8e" />

Render interactive Leaflet maps inline in Obsidian notes from [iso.me](https://apps.apple.com/us/app/iso-me/id6761960794) exports and compatible location-tracking formats.

Privacy note: the plugin reads only the export files/folders you reference in `iso-me` code blocks. It does not upload vault content; network activity is limited to loading map tiles from the selected tile provider. See [SECURITY.md](SECURITY.md) for the full disclosure.

Requires Obsidian 1.13.0 or newer.

The plugin registers an Obsidian Markdown code block named `iso-me`. Add a fenced block to any note, point it at one or more export files in your vault, and the plugin renders visits, routes, outliers, stats, and optional interactive filters.

---

## Quick start

1. Install and enable **iso.me Maps** in Obsidian.
2. Export data from the iso.me iOS app. JSON combined exports are the easiest starting point.
3. Put the export in your vault, for example `exports/iso.me-2026-05-04.json`.
4. Add this to any note:

````markdown
```iso-me
source: exports/iso.me-2026-05-04.json
title: Where I went
height: 500
show_visits: true
show_routes: true
```
````

`source` or `sources` is required. Every other block parameter is optional.

---

## What it renders

- **Visit markers** — duration-encoded circle markers. Longer stays are larger and more opaque. Popups show place name, address, arrival/departure time, duration, and notes when available.
- **Route polylines** — connected GPS tracks with green start marker, red end marker, and route popup showing path distance and straight-line distance.
- **GPS glitch / outlier markers** — optional scatter markers for points flagged as outliers by iso.me. Outliers are hidden by default and are always excluded from routes, route distance, and average speed.
- **Stats bar** — export format badge, visit count, point count, distance, average speed, date range, and top repeated place.
- **Interactive filters** — optional day selector and time-of-day range slider.

Supported formats:

- iso.me JSON
- iso.me CSV
- iso.me Markdown
- OwnTracks JSON
- Overland JSON / GeoJSON
- GPX

---

## Setup guide

### 1. Install the plugin

#### From Obsidian Community Plugins

If the plugin is available in Community Plugins:

1. Open **Settings → Community plugins**.
2. Disable **Restricted mode** if needed.
3. Click **Browse**.
4. Search for **iso.me Maps**.
5. Click **Install**, then **Enable**.

#### Manual install from a release

1. Download these files from the latest release:
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. In your vault, create this folder:

   ```text
   .obsidian/plugins/iso-me-maps/
   ```

3. Copy the three files into that folder.
4. Restart Obsidian or run **Reload app without saving** from the command palette.
5. Open **Settings → Community plugins** and enable **iso.me Maps**.

#### Development install from this repository

```bash
npm install
npm run build
ln -s "$PWD" "<your-vault>/.obsidian/plugins/iso-me-maps"
```

Then reload Obsidian and enable the plugin.

### 2. Export data from iso.me

In the iso.me iOS app, export the data you want to map. Recommended options:

- Use **JSON** for the simplest one-file workflow.
- Use a combined export containing both **visits** and **points** when possible.
- If exporting CSV or Markdown visits, enable **Coordinates** in iso.me export options. Visits without latitude/longitude cannot be plotted.
- If using **One file per day**, place files in a flat folder or use iso.me v1.5's filename templates with `/` folder separators. The plugin can search nested year/month/week/day/custom folder layouts.

### 3. Put exports in your vault

A common flat layout is:

```text
Your vault/
  Daily Notes/
  exports/
    iso.me - Monday 2026-05-04 - all.json
    iso.me - Tuesday 2026-05-05 - all.json
```

A nested iso.me v1.5 layout can also work:

```text
Your vault/
  exports/
    2026/
      2026-05/
        Daily Track - 2026-05-04.json
        Daily Track - 2026-05-05.json
```

### 4. Configure plugin settings

Open **Settings → iso.me Maps**.

Recommended first-time settings:

| Setting | Suggested value | Why |
|---|---:|---|
| **Exports folder** | `exports` | Lets you write `source: yesterday` or `source: filename.json` instead of full paths. |
| **Export folder structure** | `Flat` | Keeps backwards-compatible flat folder lookup. Switch to `Custom template` for iso.me v1.5 dated folders. |
| **Custom folder path template** | `{year}/{year}-{month}` | Matches iso.me's DATED preset folder layout when folder structure is `Custom template`. |
| **Export filename/path pattern** | `*{date}*` | Matches any file containing the resolved date. |
| **Export date format** | `YYYY-MM-DD` | Matches iso.me's default date format in filenames. |
| **Tile provider** | CartoDB Voyager | Works in desktop and mobile Obsidian. |

### 5. Add a map block

````markdown
```iso-me
source: yesterday
title: Yesterday
height: 500
interactive: true
```
````

With `exportsFolder = exports`, `source: yesterday` searches the `exports/` folder for a file matching yesterday's date.

By default, maps automatically center and zoom to the visible visits/routes/outliers in the loaded export. If you prefer a fixed initial viewport, add `auto_fit: false` plus your desired `center` and `zoom`.

---

## Complete code block parameter reference

Use parameters inside a fenced `iso-me` code block:

````markdown
```iso-me
source: exports/day.json
height: 500
zoom: 12
center: [37.7749, -122.4194]
show_visits: true
show_routes: true
show_stats: false
interactive: false
auto_fit: true
title: April trip
```
````

| Parameter | Type | Required | Default | Description |
|---|---|---:|---|---|
| `source` | path, folder, glob, or date keyword | Yes, unless `sources` is set | — | Loads one source. Can point to a supported file, a folder, a filename glob, or a date keyword such as `today`. |
| `sources` | list of paths/folders/globs/date keywords | Yes, unless `source` is set | — | Loads multiple sources and merges them into one map. Useful for separate visits + points exports or one-file-per-day batches. |
| `title` | string | No | none | Heading displayed above the map. Quotes are optional. |
| `height` | number | No | plugin **Default map height** (`400`) | Map height in pixels. |
| `zoom` | number | No | plugin **Default zoom** (`11`) | Initial/fallback zoom. If `auto_fit` is enabled and the export has one mappable coordinate, this zoom is used; multiple coordinates auto-fit the visible bounds. |
| `center` | `[latitude, longitude]` | No | plugin default center (`[0, 0]`) | Initial/fallback center when no visible layer provides bounds, or when `auto_fit: false`. |
| `auto_fit` | boolean | No | `true` | Automatically centers and zooms to the visible visits/routes/outliers. Set to `false` to use `center` and `zoom` instead. |
| `show_visits` | boolean | No | plugin **Show visit markers by default** (`true`) | Shows visit/stay markers when the export contains visits. |
| `show_routes` | boolean | No | plugin **Show routes by default** (`true`) | Shows GPS route polylines when the export contains points. Outliers are excluded. |
| `show_stats` | boolean | No | `false` | Shows the stats bar above the map. This is per-block only; there is no settings-tab default for stats. |
| `interactive` | boolean | No | `false` | Shows day and time-of-day filters above the map. Filters re-render visits, routes, and outliers. |

### Parameter syntax rules

- The code fence language must be exactly `iso-me`:

  ````markdown
  ```iso-me
  source: exports/day.json
  ```
  ````

- Keys are case-insensitive, but the documented lowercase names are recommended.
- Blank lines are ignored.
- Lines beginning with `#` are comments.
- Unknown keys are ignored.
- Malformed values are ignored and the plugin falls back to defaults.
- Strings may be unquoted, single-quoted, or double-quoted:

  ```yaml
  title: My trip
  title: "My trip"
  title: 'My trip'
  ```

- Boolean values accept all of these forms:

  | True | False |
  |---|---|
  | `true` | `false` |
  | `yes` | `no` |
  | `on` | `off` |
  | `1` | `0` |

- `center` must be bracketed latitude/longitude:

  ```yaml
  center: [37.7749, -122.4194]
  ```

### `sources` syntax

Multi-line YAML-style list:

````markdown
```iso-me
sources:
  - exports/visits.md
  - exports/points.md
```
````

Inline bracket list:

````markdown
```iso-me
sources: [exports/visits.md, exports/points.md]
```
````

Inline comma list:

````markdown
```iso-me
sources: exports/visits.md, exports/points.md
```
````

If both `source` and `sources` are present, all listed sources are loaded and merged.

---

## Source resolution, date keywords, folders, and globs

A source can be any of the following:

| Source form | Example | What happens |
|---|---|---|
| File path | `source: exports/day.json` | Loads that vault-relative file. |
| Bare filename | `source: day.json` | If **Exports folder** is set, loads `exports/day.json`; otherwise loads from the vault root. |
| Folder | `source: exports/may/` | Loads every supported export file inside that folder. In nested folder modes, scans the configured subfolder depth too. |
| Glob | `source: exports/iso.me*.json` | Loads every supported file whose filename or nested relative path matches the glob. Use `**` for explicit recursive globs. |
| Date keyword | `source: yesterday` | Resolves to one or more date-based glob searches using the settings below. |

Supported file extensions are:

```text
.json, .csv, .md, .markdown, .gpx
```

### Date keywords

Date keywords are available in `source` and in each item under `sources`.

| Keyword | Meaning |
|---|---|
| `today` | Today's date. |
| `yesterday` | Yesterday's date. |
| `YYYY-MM-DD` | A specific date, for example `2026-05-04`. |
| `last N days` | Today plus the previous `N - 1` days. `N` is clamped to `1...366`. Examples: `last 7 days`, `last 30 days`, `last 365 days`. |
| `last week` | Alias for `last 7 days`. |

Examples:

````markdown
```iso-me
source: today
title: Today
```
````

````markdown
```iso-me
source: yesterday
title: Yesterday
```
````

````markdown
```iso-me
source: 2026-05-04
title: May 4, 2026
```
````

````markdown
```iso-me
source: last 7 days
title: Last week
interactive: true
```
````

### Date keyword settings

Date keywords use these settings:

| Setting | Default | Description |
|---|---|---|
| **Exports folder** | empty | Vault-relative root folder to search, for example `exports`. |
| **Export folder structure** | `Flat` | Optional nested layout for date lookups and folder sources. Choices: Flat, Year, Month, Week, Day, Custom template. |
| **Custom folder path template** | `{year}/{year}-{month}` | Used when folder structure is Custom. Supports `/` separators and date variables such as `{year}`, `{month}`, `{week}`, `{dayNumber}`, `{date}`, `{weekday}`, `{monthName}`, `{quarter}`, and iso.me's `{day}` weekday token. |
| **Export filename/path pattern** | `*{date}*` | Glob template used to find files for a resolved date. May be a filename only or include folders. Date tokens are replaced before matching. |
| **Export date format** | `YYYY-MM-DD` | Format used when inserting `{date}` into the pattern/template. Supported tokens: `YYYY`, `MM`, `DD`. |

With these flat-folder settings:

```text
Exports folder: exports
Export folder structure: Flat
Export filename/path pattern: *{date}*
Export date format: YYYY-MM-DD
```

This block:

````markdown
```iso-me
source: yesterday
```
````

resolves to a glob like:

```text
exports/*2026-05-08*
```

That matches filenames such as:

```text
exports/iso.me - Friday 2026-05-08 - all.json
exports/isome_complete_export_2026-05-08_121042.json
```

For iso.me v1.5's **DATED** filename preset, use either the nested folder setting:

```text
Exports folder: exports
Export folder structure: Custom template
Custom folder path template: {year}/{year}-{month}
Export filename/path pattern: *{date}*
```

`source: yesterday` then searches both of these, so older flat exports still work while you migrate:

```text
exports/2026/2026-05/*2026-05-08*
exports/*2026-05-08*
```

You can also paste a full iso.me filename template into the filename/path pattern and leave folder structure as Flat:

```text
Export filename/path pattern: {year}/{year}-{month}/Daily Track - {date}
```

When a date pattern has no wildcard and no supported extension, the plugin treats it as a prefix so app templates without `.json` / `.csv` / `.md` / `.gpx` still match exported files.

### Filename pattern examples

| Pattern | Matches |
|---|---|
| `*{date}*` | Any filename containing the date. |
| `iso.me*{date}*all*` | iso.me per-day combined files containing `all`. |
| `*{date}*visits*` | Visit-only per-day files. |
| `*{date}*points*` | Point-only per-day files. |
| `daily-{date}.json` | Exact-style filenames like `daily-2026-05-04.json`. |
| `iso.me - {day} {date} - {type}` | iso.me's readable template; `{day}` becomes the weekday and `{type}` matches visits / points / all. |
| `isome_{type}_{datetime}` | iso.me's compact template; `{datetime}` matches the export date plus any export time. |
| `{year}/{year}-{month}/Daily Track - {date}` | iso.me's dated nested-folder template. |

If the pattern does not contain a date-aware token, the plugin appends `*<date>*` internally.

### Glob rules

- `*` matches any characters within a single path component.
- `?` matches one character within a single path component.
- `**` matches across nested folders for explicit recursive globs such as `exports/**/*.json`.
- Folder sources obey **Export folder structure**: `Flat` scans direct files only; nested modes scan to the configured depth and still include direct files.
- Date keyword lookups in nested modes also try the flat path as a backwards-compatible fallback.
- Matched files are sorted alphabetically before loading.
- Duplicate source paths are loaded only once.
- If any matched file fails to parse, the map block shows an error for that block.

---

## Plugin settings reference

Open **Settings → iso.me Maps** to configure defaults.

### Tile settings

| Setting | Stored key | Default | Description |
|---|---|---|---|
| Tile provider | `tileProvider` | `carto-voyager` | Basemap preset. |
| Tile layer URL | `tileUrl` | CartoDB Voyager URL | Leaflet tile URL template. Visible when provider is **Custom**. |
| Tile attribution | `tileAttribution` | Carto/OpenStreetMap attribution | HTML attribution shown in the map corner. Visible when provider is **Custom**. |

Available tile provider IDs:

| ID | Label | Notes |
|---|---|---|
| `carto-voyager` | CartoDB Voyager | Default. Good general-purpose map. |
| `carto-positron` | CartoDB Positron | Light basemap. |
| `carto-dark-matter` | CartoDB Dark Matter | Dark basemap. |
| `opentopomap` | OpenTopoMap | Topographic map. |
| `esri-world-imagery` | Esri World Imagery | Satellite imagery. |
| `osm` | OpenStreetMap | Mobile only; desktop Obsidian/Electron is blocked by OSM tile server referer policy. |
| `custom` | Custom | Use your own Leaflet tile URL and attribution. |

Tile setting changes apply to newly rendered maps. Already-open notes may need to be reloaded.

### Export lookup settings

| Setting | Stored key | Default | Description |
|---|---|---|---|
| Exports folder | `exportsFolder` | empty | Vault-relative root folder used for bare filenames and date keywords. Leading/trailing slashes are removed. |
| Export folder structure | `exportFolderGranularity` | `flat` | Nested folder mode for date keywords and folder sources: `flat`, `year`, `month`, `week`, `day`, or `custom`. Defaults to flat for backwards compatibility. |
| Custom folder path template | `exportFolderCustomPathTemplate` | `{year}/{year}-{month}` | Used when structure is `custom`. Supports slash-separated date folders. |
| Export filename/path pattern | `exportFilenamePattern` | `*{date}*` | Glob/template for date keyword lookup. Supports iso.me tokens (`{date}`, `{year}`, `{month}`, `{day}`, `{type}`, `{format}`, etc.), `*`, `?`, and folder paths. |
| Export date format | `exportDateFormat` | `YYYY-MM-DD` | Date formatting tokens used for `{date}` in date keywords. Supports `YYYY`, `MM`, `DD`. |

### Map defaults and layer styling

| Setting | Stored key | Default | Description |
|---|---|---|---|
| Default map height | `defaultHeight` | `400` | Used when a block omits `height`. |
| Default zoom | `defaultZoom` | `11` | Used as fallback zoom and when a block omits `zoom`. |
| Default center | `defaultCenter` | `[0, 0]` | Used when no visible layer provides bounds. This setting exists in saved plugin data; it is not currently exposed in the settings UI. |
| Route color | `routeColor` | `#2563eb` | Polyline color for routes. |
| Visit marker color | `markerColor` | `#2dd4bf` | Circle marker color for visits. |
| GPS glitch color | `outlierColor` | `#f59e0b` | Marker color for outliers when shown. |
| Show visit markers by default | `showVisitsByDefault` | `true` | Default for `show_visits`. |
| Show routes by default | `showRoutesByDefault` | `true` | Default for `show_routes`. |
| Show GPS glitches by default | `showOutliersByDefault` | `false` | Controls whether points flagged as outliers / GPS glitches are shown. |

---

## Supported export formats and fields

The parser is intentionally permissive: rows or objects missing required plotting fields are skipped instead of breaking the whole export. A file-level parse error is shown only when the overall file shape is unrecognized or invalid.

### iso.me JSON

File extension: `.json`

Supported root shapes:

```json
{ "exportDate": "2026-05-04T12:00:00Z", "visits": [] }
```

```json
{ "exportDate": "2026-05-04T12:00:00Z", "points": [] }
```

```json
{ "exportDate": "2026-05-04T12:00:00Z", "visits": [], "points": [] }
```

Visit objects:

| Field | Required | Type | Description |
|---|---:|---|---|
| `latitude` | Yes | number | Visit latitude. |
| `longitude` | Yes | number | Visit longitude. |
| `arrivedAt` | Yes | string | Arrival timestamp. ISO 8601 is recommended. |
| `departedAt` | No | string or null | Departure timestamp. |
| `durationMinutes` | No | number or null | Duration used for marker sizing and popup text. |
| `locationName` | No | string or null | Place name shown in popup and top-place stats. |
| `address` | No | string or null | Address shown in popup. |
| `notes` | No | string or null | Notes shown in popup. |

Point objects:

| Field | Required | Type | Description |
|---|---:|---|---|
| `latitude` | Yes | number | Point latitude. |
| `longitude` | Yes | number | Point longitude. |
| `timestamp` | Yes | string | Point timestamp. ISO 8601 is recommended. |
| `timestampUnix` | No | number | Unix timestamp in seconds. |
| `altitude` | No | number or null | Altitude in meters. |
| `speed` | No | number or null | Speed in meters/second. Stats display average speed in km/h. |
| `course` | No | number or null | Course/bearing in degrees. Stored but not currently visualized. |
| `horizontalAccuracy` | No | number or null | Horizontal accuracy in meters. |
| `verticalAccuracy` | No | number or null | Vertical accuracy in meters. |
| `isOutlier` | No | boolean | Marks a GPS glitch/outlier. Defaults to `false`. |

### iso.me CSV

File extension: `.csv`

CSV type is detected by the header row.

#### Visits CSV

A visits CSV is detected when the header includes:

```text
arrived_at
```

Required columns for plotted rows:

| Column | Required | Description |
|---|---:|---|
| `arrived_at` | Yes | Arrival timestamp. |
| `latitude` | Yes | Visit latitude. Enable coordinates in iso.me export options. |
| `longitude` | Yes | Visit longitude. Enable coordinates in iso.me export options. |

Optional columns:

| Column | Description |
|---|---|
| `departed_at` | Departure timestamp. |
| `duration_minutes` | Visit duration. |
| `location_name` | Place name. |
| `address` | Address. |
| `notes` | Notes. |

Rows without `arrived_at`, `latitude`, or `longitude` are skipped.

#### Points CSV

A points CSV is detected when the header includes all of:

```text
timestamp, latitude, longitude
```

Required columns for plotted rows:

| Column | Required | Description |
|---|---:|---|
| `timestamp` | Yes | Point timestamp. |
| `latitude` | Yes | Point latitude. |
| `longitude` | Yes | Point longitude. |

Optional columns:

| Column | Description |
|---|---|
| `timestamp_unix` | Unix timestamp in seconds. |
| `altitude` | Altitude in meters. |
| `speed` | Speed in meters/second. |
| `horizontal_accuracy` | Horizontal accuracy in meters. |
| `is_outlier` | Outlier flag. Accepted true values: `true`, `yes`, `1`. |

### iso.me Markdown

File extensions: `.md`, `.markdown`

Markdown parsing assumes iso.me's default English date/time export format, for example:

```text
Friday, March 14, 2025
3:24 PM
3:24:05 PM
15:24
15:24:05
```

Supported H1 sections:

| H1 | Parsed as |
|---|---|
| `# iso.me Export` | Visits. |
| `# Visits` | Visits. |
| Any H1 containing `iso.me` | Visits, unless it is a location-points or complete-export heading. |
| `# iso.me Location Points Export` | Location points. |

#### Visits Markdown — bullet format

Expected structure:

```markdown
# iso.me Export

## Friday, March 14, 2025

### Coffee Shop
- **Arrived:** 8:12 AM
- **Departed:** 8:45 AM
- **Duration:** 33m
- **Address:** 123 Market St
- **Coordinates:** 37.7749, -122.4194
> Optional notes
```

Supported bullet fields:

| Field | Required | Description |
|---|---:|---|
| `Arrived` | Yes | Arrival time. |
| `Coordinates` | Yes | `latitude, longitude`. |
| `Departed` | No | Departure time. |
| `Duration` | No | Text containing hours/minutes, for example `1h 20m` or `33m`. |
| `Address` | No | Address. |
| blockquote notes | No | Lines beginning with `> `. |

The `###` heading is used as `locationName` unless the heading itself is just a time.

#### Visits Markdown — table format

The parser also accepts visit tables with at least these columns:

```text
Arrived, Lat, Lon
```

Optional columns:

```text
Departed, Duration, Location, Address, Notes
```

#### Points Markdown — table format

Expected H1:

```markdown
# iso.me Location Points Export
```

The point table must include:

```text
Time, Lat, Lon
```

Optional columns:

```text
Altitude, Speed, Accuracy, Outlier
```

`Outlier` is true when the cell is `yes` or `true`.

### OwnTracks JSON

File extension: `.json`

Detected when the JSON root is an array whose first object looks like an OwnTracks location:

```json
[
  {
    "_type": "location",
    "lat": 37.7749,
    "lon": -122.4194,
    "tst": 1777891200,
    "acc": 10,
    "alt": 12,
    "vel": 18,
    "cog": 270,
    "vac": 5
  }
]
```

Supported fields:

| Field | Required | Description |
|---|---:|---|
| `_type` | Yes | Must be `location`. |
| `lat` | Yes | Latitude. |
| `lon` | Yes | Longitude. |
| `tst` | Yes | Unix timestamp in seconds. |
| `acc` | No | Horizontal accuracy in meters. |
| `alt` | No | Altitude in meters. |
| `vel` | No | Speed in km/h; converted internally to meters/second. |
| `cog` | No | Course over ground in degrees. |
| `vac` | No | Vertical accuracy in meters. |
| `tid` | No | Tracker ID. Accepted but not displayed. |

OwnTracks files contain points only, so visit markers are not rendered.

### Overland JSON / GeoJSON

File extension: `.json`

Detected when the JSON root has a `locations` array of GeoJSON point features:

```json
{
  "locations": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "timestamp": "2026-05-04T12:00:00Z",
        "altitude": 12,
        "speed": 4.2,
        "horizontalAccuracy": 10,
        "deviceId": "iphone"
      }
    }
  ]
}
```

Supported fields:

| Field | Required | Description |
|---|---:|---|
| `locations[]` | Yes | Array of GeoJSON features. |
| `type` | Yes | Feature type must be `Feature`. |
| `geometry.type` | Yes | Geometry type must be `Point`. |
| `geometry.coordinates` | Yes | `[longitude, latitude]` order. |
| `properties.timestamp` | Yes | Timestamp string. |
| `properties.altitude` | No | Altitude in meters. |
| `properties.speed` | No | Speed in meters/second. |
| `properties.horizontalAccuracy` | No | Horizontal accuracy in meters. |
| `properties.deviceId` | No | Accepted but not displayed. |

Overland files contain points only, so visit markers are not rendered.

### GPX

File extension: `.gpx`

The parser uses the browser's built-in `DOMParser`, available in desktop and mobile Obsidian.

Supported GPX content:

| Element | Parsed as | Required data |
|---|---|---|
| `<wpt lat="..." lon="...">` | Visit | `lat`, `lon`, and child `<time>`. |
| `<trk><trkseg><trkpt lat="..." lon="...">` | Location point | `lat`, `lon`, and child `<time>`. |
| `<metadata><time>` | Export date | Optional. |

Waypoint visit fields:

| GPX field | Maps to |
|---|---|
| `wpt@lat`, `wpt@lon` | `latitude`, `longitude` |
| `<time>` | `arrivedAt` |
| `<name>` | `locationName`; `Visit` is treated as empty |
| `<desc>` | Address before ` — ` |
| `<extensions><isome:departedAt>` | `departedAt` |
| `<extensions><isome:durationMinutes>` | `durationMinutes` |

Track point fields:

| GPX field | Maps to |
|---|---|
| `trkpt@lat`, `trkpt@lon` | `latitude`, `longitude` |
| `<time>` | `timestamp` |
| `<ele>` | `altitude` |
| `<extensions><isome:speed>` | `speed` |
| `<extensions><isome:horizontalAccuracy>` | `horizontalAccuracy` |
| `<extensions><isome:isOutlier>` | `isOutlier`; true only when text is `true` |

iso.me extension namespace:

```xml
xmlns:isome="https://isome.isolated.tech/gpx/1.0"
```

---

## Layer behavior details

### Visits

- Visits require latitude, longitude, and arrival time.
- Marker radius is based on `durationMinutes` using a logarithmic scale.
- Marker opacity increases for longer stays.
- Popup fields are escaped before rendering.

### Routes

- Routes require location points.
- Outlier points are always removed before route rendering.
- Routes with more than 1,500 points are visually downsampled for rendering performance, but popup path distance is computed from the full clean point set.
- Single-point routes render as one point marker.

### Outliers

- Outliers are points where `isOutlier` is true.
- They are hidden by default.
- When shown, they render as small markers with a timestamp popup.
- They never contribute to routes, route distance, or average speed.

### Stats bar

The stats bar is hidden by default. Add `show_stats: true` to a map block to display it. It is best-effort and never blocks map rendering. It summarizes the loaded export data:

- Detected format
- Visit count
- Point count
- Total clean-point route distance
- Average speed from clean points with speed data
- Date range
- Top repeated place when a place appears at least twice

When `interactive: true`, filters update map layers but the stats bar remains a summary of the loaded export.

### Interactive filters

`interactive: true` adds:

- Format badge
- Day selector with **All days** plus every local day present in visits or points
- Time-of-day range sliders from **Start of day** to **End of day**
- 15-minute slider steps
- Reset button

Filtering uses each timestamp's local day and local time in Obsidian.

---

## Common recipes

### Daily note template: yesterday's map

Set **Exports folder** to `exports`, then put this in a daily note template:

````markdown
```iso-me
source: yesterday
title: Yesterday's movement
height: 450
interactive: true
```
````

### Fixed center and zoom

Auto-fit is enabled by default. To always open the map at a specific place and zoom level, opt out with `auto_fit: false`:

````markdown
```iso-me
source: yesterday
title: Yesterday near home
height: 450
auto_fit: false
center: [37.7749, -122.4194]
zoom: 12
```
````

### Last 30 days from one-file-per-day exports

````markdown
```iso-me
source: last 30 days
title: Last 30 days
height: 600
interactive: true
```
````

### Separate visit and point files

````markdown
```iso-me
sources:
  - exports/2026-05-04-visits.md
  - exports/2026-05-04-points.md
title: May 4, 2026
show_visits: true
show_routes: true
```
````

### All files in a folder

````markdown
```iso-me
source: exports/may-2026/
title: May 2026
interactive: true
```
````

### Glob a subset of daily files

````markdown
```iso-me
source: exports/iso.me*all*.json
title: Combined daily exports
```
````

### Satellite map default

Set **Tile provider** to `esri-world-imagery` in settings, then use normal blocks:

````markdown
```iso-me
source: exports/hike.gpx
title: Hike
show_routes: true
```
````

---

## Examples included in this repository

The [`examples/`](examples/) directory contains sample export files for all supported formats, plus [`examples/usage-examples.md`](examples/usage-examples.md) with ready-to-paste Obsidian code blocks.

| File | Format | Contains |
|---|---|---|
| `san-francisco-combined.json` | iso.me JSON | Visits + points |
| `san-francisco-visits.json` | iso.me JSON | Visits only |
| `san-francisco-points.json` | iso.me JSON | Points only |
| `commute-visits.csv` | CSV | Visits |
| `commute-points.csv` | CSV | Points |
| `san-francisco-visits.md` | Markdown | Visits |
| `commute-points.md` | Markdown | Points |
| `owntracks-commute.json` | OwnTracks | GPS points |
| `overland-commute.json` | Overland | GPS points |
| `san-francisco-day.gpx` | GPX | Waypoints + tracks |

---

## Troubleshooting

### `iso.me: Missing required source`

Add either `source:` or `sources:` to the block.

### `File not found`

Check:

- The path is relative to the vault root.
- The file is inside the vault.
- **Exports folder** is set correctly if you are using bare filenames or date keywords.
- Date keyword pattern and nested folder structure match the actual export path.

### Date keyword does not find my file

Use a more specific or more permissive **Export filename/path pattern**, and confirm **Export folder structure** if the file lives in nested folders.

For example, if files are named:

```text
iso.me - Friday 2026-05-08 - all.json
```

use:

```text
*{date}*all*
```

### Visits do not appear from CSV or Markdown

Make sure the export includes coordinates. Visit rows without latitude and longitude are skipped.

### Routes do not appear

Make sure the export includes location points. Visit-only exports can show visit markers but cannot render routes.

### Outliers do not affect routes

This is intentional. Outliers are always excluded from routes, distance, and average speed.

### OpenStreetMap tiles are blank on desktop

Use CartoDB Voyager, CartoDB Positron, CartoDB Dark Matter, OpenTopoMap, Esri World Imagery, or a custom provider. OSM's standard tile servers reject desktop Obsidian/Electron requests due to referer policy.

### The map has the wrong timezone/day

Interactive day and time filters use the local timezone of Obsidian when parsing timestamps.

---

## Privacy notes

- Export files stay in your Obsidian vault.
- The plugin reads local vault files and renders the map in Obsidian.
- Basemap tiles are requested from the selected tile provider, so map tile requests may reveal viewed map areas to that provider.
- Use a custom/self-hosted tile provider if you need stricter privacy.

---

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

Reload Obsidian, disable Restricted mode if needed, and enable **iso.me Maps**.

---

## License

MIT
