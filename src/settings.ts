import { App, PluginSettingTab, Setting } from "obsidian";
import type IsoMeMapsPlugin from "./main";

export interface IsoMeSettings {
	tileUrl: string;
	tileAttribution: string;
	defaultHeight: number;
	defaultCenter: [number, number];
	defaultZoom: number;
	markerColor: string;
	routeColor: string;
	outlierColor: string;
	heatRadius: number;
	heatBlur: number;
	showVisitsByDefault: boolean;
	showRoutesByDefault: boolean;
	showHeatmapByDefault: boolean;
	showOutliersByDefault: boolean;
}

// OSM's volunteer tile servers reject requests from Electron because the
// Obsidian desktop client's referer header doesn't match their policy. Default
// to CartoDB Voyager (OSM-styled, no referer requirement, free attribution use).
export const LEGACY_OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const DEFAULT_SETTINGS: IsoMeSettings = {
	tileUrl: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
	tileAttribution:
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	defaultHeight: 400,
	defaultCenter: [0, 0],
	defaultZoom: 11,
	markerColor: "#2dd4bf",
	routeColor: "#2563eb",
	outlierColor: "#f59e0b",
	heatRadius: 25,
	heatBlur: 15,
	showVisitsByDefault: true,
	showRoutesByDefault: true,
	showHeatmapByDefault: false,
	showOutliersByDefault: false,
};

export class IsoMeSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: IsoMeMapsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Tile layer URL")
			.setDesc("Leaflet tile URL template. Default is OpenStreetMap.")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.tileUrl)
					.onChange(async (v) => {
						this.plugin.settings.tileUrl = v.trim() || DEFAULT_SETTINGS.tileUrl;
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
			.setName("Heatmap radius")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.heatRadius))
					.onChange(async (v) => {
						const n = Number(v);
						if (Number.isFinite(n) && n > 0) {
							this.plugin.settings.heatRadius = n;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Heatmap blur")
			.addText((t) =>
				t
					.setValue(String(this.plugin.settings.heatBlur))
					.onChange(async (v) => {
						const n = Number(v);
						if (Number.isFinite(n) && n >= 0) {
							this.plugin.settings.heatBlur = n;
							await this.plugin.saveSettings();
						}
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
			.setName("Show heatmap by default")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showHeatmapByDefault).onChange(async (v) => {
					this.plugin.settings.showHeatmapByDefault = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Show GPS glitches (outliers) by default")
			.setDesc(
				"Render points iso.me has flagged as outliers as small scatter dots. Outliers are always excluded from the route polyline and heatmap.",
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showOutliersByDefault).onChange(async (v) => {
					this.plugin.settings.showOutliersByDefault = v;
					await this.plugin.saveSettings();
				}),
			);
	}
}
