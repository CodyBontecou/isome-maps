import { App, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
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

function isTileProviderId(value: unknown): value is TileProviderId {
	return typeof value === "string" && TILE_PROVIDERS.some((p) => p.id === value);
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

	getSettingDefinitions(): SettingDefinitionItem<IsoMeSettingKey>[] {
		const folderTemplateVariables = EXPORT_FOLDER_PATH_TEMPLATE_VARIABLES
			.map((v) => `{${v}}`)
			.join(", ");

		return [
			{
				name: "Tile provider",
				desc: this.tileProviderDescription(),
				control: {
					type: "dropdown",
					key: "tileProvider",
					defaultValue: DEFAULT_SETTINGS.tileProvider,
					options: tileProviderOptions(),
				},
			},
			{
				name: "Tile layer URL",
				desc: "Leaflet tile URL template (e.g. https://.../{z}/{x}/{y}.png).",
				visible: () => this.plugin.settings.tileProvider === "custom",
				control: {
					type: "text",
					key: "tileUrl",
					placeholder: DEFAULT_SETTINGS.tileUrl,
					defaultValue: DEFAULT_SETTINGS.tileUrl,
				},
			},
			{
				name: "Tile attribution",
				desc: "HTML attribution string shown in the bottom-right of the map.",
				visible: () => this.plugin.settings.tileProvider === "custom",
				control: {
					type: "text",
					key: "tileAttribution",
				},
			},
			{
				type: "group",
				heading: "Exports",
				cls: "iso-me-section-header",
				items: [
					{
						name: "Exports folder",
						desc: "Vault-relative root folder holding your iso.me exports (e.g. `exports`). Bare `source:` filenames in code blocks are looked up here, and date keywords like `today` / `yesterday` search this folder plus the nested structure below.",
						control: {
							type: "text",
							key: "exportsFolder",
							placeholder: "exports",
						},
					},
					{
						name: "Export folder structure",
						desc: "Opt in to nested export folders. Flat keeps existing behavior. Nested choices also keep flat files under the exports folder loadable for gradual migrations.",
						control: {
							type: "dropdown",
							key: "exportFolderGranularity",
							defaultValue: DEFAULT_SETTINGS.exportFolderGranularity,
							options: EXPORT_FOLDER_GRANULARITY_OPTIONS,
						},
					},
					{
						name: "Custom folder path template",
						desc: `Used when Export folder structure is Custom. Use / for folders. Variables: ${folderTemplateVariables}. iso.me's DATED preset uses {year}/{year}-{month}.`,
						control: {
							type: "text",
							key: "exportFolderCustomPathTemplate",
							placeholder: DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
							defaultValue: DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
						},
					},
					{
						name: "Export filename/path pattern",
						desc: "Glob template used to find an export by date. Supports iso.me filename tokens like `{date}`, `{year}`, `{month}`, `{day}`, `{type}`, and `{format}`; `{type}`, `{format}`, time, and unknown tokens become wildcards. You can include folders here (e.g. `{year}/{year}-{month}/Daily Track - {date}`) or use the folder structure setting above. Default `*{date}*` matches any export filename containing the date.",
						control: {
							type: "text",
							key: "exportFilenamePattern",
							placeholder: DEFAULT_SETTINGS.exportFilenamePattern,
							defaultValue: DEFAULT_SETTINGS.exportFilenamePattern,
						},
					},
					{
						name: "Export date format",
						desc: "How dates are spelled in your export filenames. Tokens: `YYYY`, `MM`, `DD`. Default `YYYY-MM-DD` matches iso.me's built-in export naming.",
						control: {
							type: "text",
							key: "exportDateFormat",
							placeholder: DEFAULT_SETTINGS.exportDateFormat,
							defaultValue: DEFAULT_SETTINGS.exportDateFormat,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Map defaults",
				cls: "iso-me-section-header",
				items: [
					{
						name: "Default map height",
						desc: "Pixel height for maps that don't specify `height:` in the block.",
						control: {
							type: "number",
							key: "defaultHeight",
							min: 1,
							step: 1,
							defaultValue: DEFAULT_SETTINGS.defaultHeight,
							validate: (value: number): string | void =>
								Number.isFinite(value) && value > 0
									? undefined
									: "Enter a positive pixel height.",
						},
					},
					{
						name: "Default zoom",
						control: {
							type: "number",
							key: "defaultZoom",
							step: 1,
							defaultValue: DEFAULT_SETTINGS.defaultZoom,
						},
					},
					{
						name: "Route color",
						control: {
							type: "text",
							key: "routeColor",
							defaultValue: DEFAULT_SETTINGS.routeColor,
						},
					},
					{
						name: "Visit marker color",
						control: {
							type: "text",
							key: "markerColor",
							defaultValue: DEFAULT_SETTINGS.markerColor,
						},
					},
					{
						name: "GPS glitch (outlier) color",
						desc: "Color for points iso.me has flagged as outliers when shown.",
						control: {
							type: "text",
							key: "outlierColor",
							defaultValue: DEFAULT_SETTINGS.outlierColor,
						},
					},
					{
						name: "Show visit markers by default",
						control: {
							type: "toggle",
							key: "showVisitsByDefault",
							defaultValue: DEFAULT_SETTINGS.showVisitsByDefault,
						},
					},
					{
						name: "Show routes by default",
						control: {
							type: "toggle",
							key: "showRoutesByDefault",
							defaultValue: DEFAULT_SETTINGS.showRoutesByDefault,
						},
					},
					{
						name: "Show GPS glitches (outliers) by default",
						desc: "Render points iso.me has flagged as outliers as small scatter dots. Outliers are always excluded from route polylines, route distance, and average speed.",
						control: {
							type: "toggle",
							key: "showOutliersByDefault",
							defaultValue: DEFAULT_SETTINGS.showOutliersByDefault,
						},
					},
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings;

		switch (key as IsoMeSettingKey) {
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
		if (key === "tileProvider") this.update();
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
