import { App, PluginSettingTab, Setting } from "obsidian";
import {
	DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
	EXPORT_FOLDER_PATH_TEMPLATE_VARIABLES,
	ExportFolderGranularity,
	isExportFolderGranularity,
	normalizeExportFolderPathTemplate,
	normalizeVaultFolder,
} from "./export-layout";
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
	exportFolderGranularity: ExportFolderGranularity;
	exportFolderCustomPathTemplate: string;
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
	exportFolderGranularity: "flat",
	exportFolderCustomPathTemplate: DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
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

const EXPORT_FOLDER_GRANULARITY_OPTIONS: Record<ExportFolderGranularity, string> = {
	flat: "Flat (exports/file.json)",
	year: "Year folders (exports/YYYY/file.json)",
	month: "Month folders (exports/YYYY/MM/file.json)",
	week: "Week folders (exports/YYYY/W23/file.json)",
	day: "Day folders (exports/YYYY/MM/DD/file.json)",
	custom: "Custom template",
};

type IsoMeSettingKey = Extract<keyof IsoMeSettings, string>;

export function findProviderByUrl(url: string): TileProviderPreset | undefined {
	return TILE_PROVIDERS.find((p) => p.id !== "custom" && p.url === url);
}

export function getProvider(id: TileProviderId): TileProviderPreset {
	return TILE_PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

export function isTileProviderId(value: unknown): value is TileProviderId {
	return typeof value === "string" && TILE_PROVIDERS.some((p) => p.id === value);
}

export interface TileLayerConfig {
	url: string;
	attribution: string;
}

export interface TileLayerOverrides {
	tile_provider?: string;
	tile_url?: string;
	tile_attribution?: string;
}

function nonEmptyTrimmed(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveTileLayer(
	settings: Pick<IsoMeSettings, "tileUrl" | "tileAttribution">,
	overrides: TileLayerOverrides = {},
): TileLayerConfig {
	let url = settings.tileUrl;
	let attribution = settings.tileAttribution;

	const providerId = nonEmptyTrimmed(overrides.tile_provider)?.toLowerCase();
	if (providerId && isTileProviderId(providerId)) {
		const provider = getProvider(providerId);
		if (provider.id !== "custom") {
			url = provider.url;
			attribution = provider.attribution;
		}
	}

	const overrideUrl = nonEmptyTrimmed(overrides.tile_url);
	const hasOverrideAttribution = overrides.tile_attribution !== undefined;
	if (overrideUrl) {
		url = overrideUrl;
		const matchedProvider = findProviderByUrl(overrideUrl);
		attribution = hasOverrideAttribution
			? overrides.tile_attribution ?? ""
			: matchedProvider?.attribution ?? "";
	} else if (hasOverrideAttribution) {
		attribution = overrides.tile_attribution ?? "";
	}

	return { url, attribution };
}

function tileProviderOptions(): Record<string, string> {
	return TILE_PROVIDERS.reduce<Record<string, string>>((options, provider) => {
		options[provider.id] = provider.label;
		return options;
	}, {});
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function finiteNumber(value: unknown, fallback: number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export class IsoMeSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: IsoMeMapsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Tile provider")
			.setDesc(this.tileProviderDescription())
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(tileProviderOptions())
					.setValue(this.plugin.settings.tileProvider)
					.onChange(async (value) => {
						await this.applySettingValue("tileProvider", value);
						this.display();
					});
			});

		if (this.plugin.settings.tileProvider === "custom") {
			this.addTextSetting(
				"tileUrl",
				"Tile layer URL",
				"Leaflet tile URL template (e.g. https://.../{z}/{x}/{y}.png).",
				DEFAULT_SETTINGS.tileUrl,
			);
			this.addTextSetting(
				"tileAttribution",
				"Tile attribution",
				"HTML attribution string shown in the bottom-right of the map.",
			);
		}

		this.addSectionHeading("Exports");
		this.addTextSetting(
			"exportsFolder",
			"Exports folder",
			"Vault-relative root folder holding your iso.me exports (e.g. `exports`). Bare `source:` filenames in code blocks are looked up here, and date keywords like `today` / `yesterday` search this folder plus the nested structure below.",
			"exports",
		);
		this.addDropdownSetting(
			"exportFolderGranularity",
			"Export folder structure",
			"Opt in to nested export folders. Flat keeps existing behavior. Nested choices also keep flat files under the exports folder loadable for gradual migrations.",
			EXPORT_FOLDER_GRANULARITY_OPTIONS,
		);
		this.addTextSetting(
			"exportFolderCustomPathTemplate",
			"Custom folder path template",
			`Used when Export folder structure is Custom. Use / for folders. Variables: ${EXPORT_FOLDER_PATH_TEMPLATE_VARIABLES.map((v) => `{${v}}`).join(", ")}. iso.me's DATED preset uses {year}/{year}-{month}.`,
			DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
		);
		this.addTextSetting(
			"exportFilenamePattern",
			"Export filename/path pattern",
			"Glob template used to find an export by date. Supports iso.me filename tokens like `{date}`, `{year}`, `{month}`, `{day}`, `{type}`, and `{format}`; `{type}`, `{format}`, time, and unknown tokens become wildcards. You can include folders here (e.g. `{year}/{year}-{month}/Daily Track - {date}`) or use the folder structure setting above. Default `*{date}*` matches any export filename containing the date.",
			DEFAULT_SETTINGS.exportFilenamePattern,
		);
		this.addTextSetting(
			"exportDateFormat",
			"Export date format",
			"How dates are spelled in your export filenames. Tokens: `YYYY`, `MM`, `DD`. Default `YYYY-MM-DD` matches iso.me's built-in export naming.",
			DEFAULT_SETTINGS.exportDateFormat,
		);

		this.addSectionHeading("Map defaults");
		this.addNumberSetting(
			"defaultHeight",
			"Default map height",
			"Pixel height for maps that don't specify `height:` in the block.",
			1,
			1,
		);
		this.addNumberSetting("defaultZoom", "Default zoom", undefined, undefined, 1);
		this.addTextSetting("routeColor", "Route color");
		this.addTextSetting("markerColor", "Visit marker color");
		this.addTextSetting(
			"outlierColor",
			"GPS glitch (outlier) color",
			"Color for points iso.me has flagged as outliers when shown.",
		);
		this.addToggleSetting("showVisitsByDefault", "Show visit markers by default");
		this.addToggleSetting("showRoutesByDefault", "Show routes by default");
		this.addToggleSetting(
			"showOutliersByDefault",
			"Show GPS glitches (outliers) by default",
			"Render points iso.me has flagged as outliers as small scatter dots. Outliers are always excluded from route polylines, route distance, and average speed.",
		);
	}

	private addSectionHeading(name: string): void {
		new Setting(this.containerEl)
			.setName(name)
			.setHeading()
			.setClass("iso-me-section-header");
	}

	private addTextSetting(
		key: IsoMeSettingKey,
		name: string,
		desc?: string,
		placeholder?: string,
	): void {
		const setting = new Setting(this.containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addText((text) => {
			if (placeholder) text.setPlaceholder(placeholder);
			text.setValue(stringValue(this.plugin.settings[key]));
			text.onChange(async (value) => {
				await this.applySettingValue(key, value);
			});
		});
	}

	private addNumberSetting(
		key: "defaultHeight" | "defaultZoom",
		name: string,
		desc?: string,
		min?: number,
		step?: number,
	): void {
		const setting = new Setting(this.containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addText((text) => {
			text.inputEl.type = "number";
			if (min !== undefined) text.inputEl.min = String(min);
			if (step !== undefined) text.inputEl.step = String(step);
			text.setValue(String(this.plugin.settings[key]));
			text.onChange(async (value) => {
				await this.applySettingValue(key, Number(value));
			});
		});
	}

	private addDropdownSetting(
		key: "exportFolderGranularity",
		name: string,
		desc: string | undefined,
		options: Record<string, string>,
	): void {
		const setting = new Setting(this.containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addDropdown((dropdown) => {
			dropdown
				.addOptions(options)
				.setValue(stringValue(this.plugin.settings[key]))
				.onChange(async (value) => {
					await this.applySettingValue(key, value);
				});
		});
	}

	private addToggleSetting(key: IsoMeSettingKey, name: string, desc?: string): void {
		const setting = new Setting(this.containerEl).setName(name);
		if (desc) setting.setDesc(desc);
		setting.addToggle((toggle) => {
			toggle.setValue(this.plugin.settings[key] === true).onChange(async (value) => {
				await this.applySettingValue(key, value);
			});
		});
	}

	private async applySettingValue(key: IsoMeSettingKey, value: unknown): Promise<void> {
		const settings = this.plugin.settings;

		switch (key) {
			case "tileProvider": {
				const id = isTileProviderId(value) ? value : DEFAULT_SETTINGS.tileProvider;
				settings.tileProvider = id;
				if (id !== "custom") {
					const preset = getProvider(id);
					settings.tileUrl = preset.url;
					settings.tileAttribution = preset.attribution;
				}
				break;
			}
			case "tileUrl":
				settings.tileUrl = stringValue(value).trim() || DEFAULT_SETTINGS.tileUrl;
				break;
			case "tileAttribution":
				settings.tileAttribution = stringValue(value);
				break;
			case "exportsFolder":
				settings.exportsFolder = normalizeVaultFolder(stringValue(value));
				break;
			case "exportFilenamePattern":
				settings.exportFilenamePattern =
					stringValue(value).trim() || DEFAULT_SETTINGS.exportFilenamePattern;
				break;
			case "exportDateFormat":
				settings.exportDateFormat =
					stringValue(value).trim() || DEFAULT_SETTINGS.exportDateFormat;
				break;
			case "exportFolderGranularity":
				settings.exportFolderGranularity = isExportFolderGranularity(value)
					? value
					: DEFAULT_SETTINGS.exportFolderGranularity;
				break;
			case "exportFolderCustomPathTemplate":
				settings.exportFolderCustomPathTemplate = normalizeExportFolderPathTemplate(
					stringValue(value),
				);
				break;
			case "defaultHeight":
				settings.defaultHeight = Math.max(
					1,
					finiteNumber(value, DEFAULT_SETTINGS.defaultHeight),
				);
				break;
			case "defaultZoom":
				settings.defaultZoom = finiteNumber(value, DEFAULT_SETTINGS.defaultZoom);
				break;
			case "markerColor":
				settings.markerColor = stringValue(value).trim() || DEFAULT_SETTINGS.markerColor;
				break;
			case "routeColor":
				settings.routeColor = stringValue(value).trim() || DEFAULT_SETTINGS.routeColor;
				break;
			case "outlierColor":
				settings.outlierColor = stringValue(value).trim() || DEFAULT_SETTINGS.outlierColor;
				break;
			case "showVisitsByDefault":
				settings.showVisitsByDefault = value === true;
				break;
			case "showRoutesByDefault":
				settings.showRoutesByDefault = value === true;
				break;
			case "showOutliersByDefault":
				settings.showOutliersByDefault = value === true;
				break;
			default:
				return;
		}

		await this.plugin.saveSettings();
	}

	private tileProviderDescription(): string {
		const activeProvider = getProvider(this.plugin.settings.tileProvider);
		const parts = ["Pick a basemap. Choose Custom to use your own tile URL."];
		if (activeProvider.note) parts.push(activeProvider.note);
		parts.push(
			"Already-open notes keep their current basemap until you reload the note (or Obsidian).",
		);
		return parts.join("\n");
	}
}
