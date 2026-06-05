---
plugin-id: iso-me-maps
version: 0.7.11
last-updated: 2026-06-05
---

# Security

## Network Activity

iso.me Maps does not upload vault content or location exports. The only network activity is browser image loading for the selected map tile provider.

| Host | Purpose | Data Sent | Direction |
| --- | --- | --- | --- |
| `*.basemaps.cartocdn.com` | Default CartoDB Voyager/Positron/Dark Matter map tiles | Tile coordinates in the URL, IP address, user agent/referrer headers set by the runtime; no vault file contents | outbound/inbound |
| `*.tile.opentopomap.org` | Optional OpenTopoMap map tiles | Tile coordinates in the URL, IP address, user agent/referrer headers set by the runtime; no vault file contents | outbound/inbound |
| `server.arcgisonline.com` | Optional Esri World Imagery map tiles | Tile coordinates in the URL, IP address, user agent/referrer headers set by the runtime; no vault file contents | outbound/inbound |
| `*.tile.openstreetmap.org` | Optional OpenStreetMap map tiles | Tile coordinates in the URL, IP address, user agent/referrer headers set by the runtime; no vault file contents | outbound/inbound |
| User-configured custom tile host | Optional custom map tiles if the user chooses the Custom tile provider | Tile coordinates in the URL, IP address, user agent/referrer headers set by the runtime; no vault file contents | outbound/inbound |

## Data Collection

| Data Type | Scope | Purpose |
| --- | --- | --- |
| Location export files (`.json`, `.csv`, `.md`, `.markdown`, `.gpx`) | Files explicitly referenced by an `iso-me` code block through `source` / `sources` | Parse visits, GPS points, routes, and stats for rendering the map in the current note |
| Vault file paths | Only the configured exports folder, explicit source folders, or glob/date-keyword search roots; bounded by the plugin's folder-depth settings | Resolve folders, globs, and date keywords to matching location export files |
| Plugin settings | This plugin's local settings data only | Remember tile provider, display defaults, and export-folder naming preferences |

## Third-Party Services

| Service | Purpose | Data Shared |
| --- | --- | --- |
| CartoDB basemaps | Default map tile rendering | Tile coordinates and standard request metadata only |
| OpenTopoMap | Optional map tile rendering | Tile coordinates and standard request metadata only |
| Esri World Imagery | Optional satellite tile rendering | Tile coordinates and standard request metadata only |
| OpenStreetMap tile servers | Optional map tile rendering | Tile coordinates and standard request metadata only |
| Custom tile provider | Optional user-specified map tile rendering | Determined by the user's configured tile URL; the plugin does not append vault contents |

## Permissions

- Uses standard Obsidian vault adapter APIs to read user-selected export files.
- Uses standard Obsidian vault adapter APIs to list files under configured export/search folders when resolving folders, globs, or date keywords.
- Does not use Node.js filesystem modules, shell commands, Electron bridge messaging, system copy/paste APIs, or dynamic-code execution APIs.

## Data Storage

| What | Where | Encrypted |
| --- | --- | --- |
| Tile provider, tile URL/attribution, export-folder options, display defaults, marker/route colors | Local Obsidian plugin settings (`data.json`) | No |

