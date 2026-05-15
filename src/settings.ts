import { App, PluginSettingTab, Setting } from "obsidian";
import type IsoMeMapsPlugin from "./main";

export type TileProviderId =
	| "carto-voyager"
	| "carto-positron"
	| "carto-dark-matter"
	| "opentopomap"
	| "esri-world-imagery"
	| "osm"
	| "custom";

export interface TileProviderPreset {
	id: TileProviderId;
	label: string;
	url: string;
	attribution: string;
	note?: string;
}

const OSM_ATTR =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

export const TILE_PROVIDERS: TileProviderPreset[] = [
	{
		id: "carto-voyager",
		label: "CartoDB Voyager (default)",
		url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
		attribution: CARTO_ATTR,
	},
	{
		id: "carto-positron",
		label: "CartoDB Positron (light)",
		url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
		attribution: CARTO_ATTR,
	},
	{
		id: "carto-dark-matter",
		label: "CartoDB Dark Matter (dark)",
		url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
		attribution: CARTO_ATTR,
	},
	{
		id: "opentopomap",
		label: "OpenTopoMap (topographic)",
		url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
		attribution: `${OSM_ATTR}, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
	},
	{
		id: "esri-world-imagery",
		label: "Esri World Imagery (satellite)",
		url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
		attribution:
			"Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
	},
	{
		id: "osm",
		label: "OpenStreetMap (mobile only — desktop is blocked)",
		url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		attribution: OSM_ATTR,
		note: "OSM's tile servers reject requests from desktop Obsidian (Electron referer policy). Works on the mobile app.",
	},
	{
		id: "custom",
		label: "Custom (enter URL and attribution below)",
		url: "",
		attribution: "",
	},
];

export interface IsoMeSettings {
	tileProvider: TileProviderId;
	tileUrl: string;
	tileAttribution: string;
	exportsFolder: string;
	exportFilenamePattern: string;
	exportDateFormat: string;
	defaultHeight: number;
	defaultCenter: [number, number];
	defaultZoom: number;
	markerColor: string;
	routeColor: string;
	outlierColor: string;
	showVisitsByDefault: boolean;
	showRoutesByDefault: boolean;
	showOutliersByDefault: boolean;
}

// OSM's volunteer tile servers reject requests from Electron because the
// Obsidian desktop client's referer header doesn't match their policy. Default
// to CartoDB Voyager (OSM-styled, no referer requirement, free attribution use).
export const LEGACY_OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_PROVIDER = TILE_PROVIDERS[0];

export const DEFAULT_SETTINGS: IsoMeSettings = {
	tileProvider: DEFAULT_PROVIDER.id,
	tileUrl: DEFAULT_PROVIDER.url,
	tileAttribution: DEFAULT_PROVIDER.attribution,
	exportsFolder: "",
	exportFilenamePattern: "*{date}*",
	exportDateFormat: "YYYY-MM-DD",
	defaultHeight: 400,
	defaultCenter: [0, 0],
	defaultZoom: 11,
	markerColor: "#2dd4bf",
	routeColor: "#2563eb",
	outlierColor: "#f59e0b",
	showVisitsByDefault: true,
	showRoutesByDefault: true,
	showOutliersByDefault: false,
};

export function findProviderByUrl(url: string): TileProviderPreset | undefined {
	return TILE_PROVIDERS.find((p) => p.id !== "custom" && p.url === url);
}

export function getProvider(id: TileProviderId): TileProviderPreset {
	return TILE_PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

export class IsoMeSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: IsoMeMapsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const providerSetting = new Setting(containerEl)
			.setName("Tile provider")
			.setDesc("Pick a basemap. Choose Custom to use your own tile URL.")
			.addDropdown((dd) => {
				for (const p of TILE_PROVIDERS) dd.addOption(p.id, p.label);
				dd.setValue(this.plugin.settings.tileProvider).onChange(async (v) => {
					const id = v as TileProviderId;
					this.plugin.settings.tileProvider = id;
					if (id !== "custom") {
						const preset = getProvider(id);
						this.plugin.settings.tileUrl = preset.url;
						this.plugin.settings.tileAttribution = preset.attribution;
					}
					await this.plugin.saveSettings();
					this.display();
				});
			});

		const activeProvider = getProvider(this.plugin.settings.tileProvider);
		if (activeProvider.note) {
			providerSetting.descEl.createEl("div", {
				text: activeProvider.note,
				cls: "mod-warning",
			});
		}
		providerSetting.descEl.createEl("div", {
			text: "Already-open notes keep their current basemap until you reload the note (or Obsidian).",
		});

		if (this.plugin.settings.tileProvider === "custom") {
			new Setting(containerEl)
				.setName("Tile layer URL")
				.setDesc("Leaflet tile URL template (e.g. https://.../{z}/{x}/{y}.png).")
				.addText((t) =>
					t
						.setValue(this.plugin.settings.tileUrl)
						.onChange(async (v) => {
							this.plugin.settings.tileUrl =
								v.trim() || DEFAULT_SETTINGS.tileUrl;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Tile attribution")
				.setDesc("HTML attribution string shown in the bottom-right of the map.")
				.addText((t) =>
					t
						.setValue(this.plugin.settings.tileAttribution)
						.onChange(async (v) => {
							this.plugin.settings.tileAttribution = v;
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl)
			.setName("Exports")
			.setHeading()
			.settingEl.addClass("iso-me-section-header");

		new Setting(containerEl)
			.setName("Exports folder")
			.setDesc(
				"Vault-relative folder holding your iso.me exports (e.g. `exports`). Bare `source:` filenames in code blocks are looked up here, and date keywords like `today` / `yesterday` search this folder.",
			)
			.addText((t) =>
				t
					.setPlaceholder("exports")
					.setValue(this.plugin.settings.exportsFolder)
					.onChange(async (v) => {
						this.plugin.settings.exportsFolder = v.trim().replace(/\/+$/, "");
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Export filename pattern")
			.setDesc(
				"Glob template used to find an export by date. `{date}` is replaced with the resolved date (formatted using the date format below). `*` and `?` work as wildcards. Default `*{date}*` matches any iso.me export filename containing the date.",
			)
			.addText((t) =>
				t
					.setPlaceholder("*{date}*")
					.setValue(this.plugin.settings.exportFilenamePattern)
					.onChange(async (v) => {
						this.plugin.settings.exportFilenamePattern =
							v.trim() || DEFAULT_SETTINGS.exportFilenamePattern;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Export date format")
			.setDesc(
				"How dates are spelled in your export filenames. Tokens: `YYYY`, `MM`, `DD`. Default `YYYY-MM-DD` matches iso.me's built-in export naming.",
			)
			.addText((t) =>
				t
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.plugin.settings.exportDateFormat)
					.onChange(async (v) => {
						this.plugin.settings.exportDateFormat =
							v.trim() || DEFAULT_SETTINGS.exportDateFormat;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Map defaults")
			.setHeading()
			.settingEl.addClass("iso-me-section-header");

		new Setting(containerEl)
			.setName("Default map height")
			.setDesc("Pixel height for maps that don't specify `height:` in the block.")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.defaultHeight))
					.onChange(async (v) => {
						const n = Number(v);
						if (Number.isFinite(n) && n > 0) {
							this.plugin.settings.defaultHeight = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Default zoom")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.defaultZoom))
					.onChange(async (v) => {
						const n = Number(v);
						if (Number.isFinite(n)) {
							this.plugin.settings.defaultZoom = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Route color")
			.addText((t) =>
				t.setValue(this.plugin.settings.routeColor).onChange(async (v) => {
					this.plugin.settings.routeColor = v.trim() || DEFAULT_SETTINGS.routeColor;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Visit marker color")
			.addText((t) =>
				t.setValue(this.plugin.settings.markerColor).onChange(async (v) => {
					this.plugin.settings.markerColor = v.trim() || DEFAULT_SETTINGS.markerColor;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("GPS glitch (outlier) color")
			.setDesc("Color for points iso.me has flagged as outliers when shown.")
			.addText((t) =>
				t.setValue(this.plugin.settings.outlierColor).onChange(async (v) => {
					this.plugin.settings.outlierColor =
						v.trim() || DEFAULT_SETTINGS.outlierColor;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show visit markers by default")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showVisitsByDefault).onChange(async (v) => {
					this.plugin.settings.showVisitsByDefault = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show routes by default")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showRoutesByDefault).onChange(async (v) => {
					this.plugin.settings.showRoutesByDefault = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show GPS glitches (outliers) by default")
			.setDesc(
				"Render points iso.me has flagged as outliers as small scatter dots. Outliers are always excluded from route polylines, route distance, and average speed.",
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showOutliersByDefault).onChange(async (v) => {
					this.plugin.settings.showOutliersByDefault = v;
					await this.plugin.saveSettings();
				}),
			);
	}
}
