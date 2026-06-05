import { applyDateToPattern, renderDateTemplate } from "./date-resolver";

export type ExportFolderGranularity =
	| "flat"
	| "year"
	| "month"
	| "week"
	| "day"
	| "custom";

export const EXPORT_FOLDER_GRANULARITIES: ExportFolderGranularity[] = [
	"flat",
	"year",
	"month",
	"week",
	"day",
	"custom",
];

export const DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE = "{year}/{year}-{month}";
export const EXPORT_FOLDER_PATH_TEMPLATE_VARIABLES = [
	"year",
	"month",
	"week",
	"dayNumber",
	"date",
	"weekday",
	"monthName",
	"quarter",
	"day",
] as const;

const MAX_CUSTOM_EXPORT_FOLDER_DEPTH = 8;

const PREDEFINED_EXPORT_FOLDER_TEMPLATES: Record<
	Exclude<ExportFolderGranularity, "custom">,
	string
> = {
	flat: "",
	year: "{year}",
	month: "{year}/{month}",
	week: "{year}/{week}",
	day: "{year}/{month}/{dayNumber}",
};

const PREDEFINED_EXPORT_FOLDER_MAX_DEPTH: Record<
	Exclude<ExportFolderGranularity, "custom">,
	number
> = {
	flat: 0,
	year: 1,
	month: 2,
	week: 3,
	day: 4,
};

export function isExportFolderGranularity(
	value: unknown,
): value is ExportFolderGranularity {
	return (
		typeof value === "string" &&
		EXPORT_FOLDER_GRANULARITIES.includes(value as ExportFolderGranularity)
	);
}

export function exportFolderMaxDepth(
	granularity: ExportFolderGranularity = "flat",
	customTemplate = DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
): number {
	if (granularity === "custom") {
		return customExportFolderPathTemplateDepth(customTemplate);
	}
	return PREDEFINED_EXPORT_FOLDER_MAX_DEPTH[granularity] ?? 0;
}

export function customExportFolderPathTemplateDepth(template: string): number {
	const normalized = normalizeExportFolderPathTemplate(template);
	if (!normalized) return 0;
	return Math.min(normalized.split("/").length, MAX_CUSTOM_EXPORT_FOLDER_DEPTH);
}

function stripControlCharacters(value: string): string {
	let out = "";
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 32 && code !== 127) out += value[i];
	}
	return out;
}

export function normalizeExportFolderPathTemplate(template: string): string {
	const normalized = stripControlCharacters(template)
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");

	const safeSegments = normalized
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
		.slice(0, MAX_CUSTOM_EXPORT_FOLDER_DEPTH);

	return safeSegments.join("/") || DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE;
}

export function exportFolderPathTemplate(
	granularity: ExportFolderGranularity = "flat",
	customTemplate = DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
): string {
	if (granularity === "custom") {
		return normalizeExportFolderPathTemplate(customTemplate);
	}
	return PREDEFINED_EXPORT_FOLDER_TEMPLATES[granularity] ?? "";
}

export function renderExportFolderPath(
	granularity: ExportFolderGranularity = "flat",
	customTemplate = DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
	date: Date,
	dateFormat = "YYYY-MM-DD",
): string {
	const template = exportFolderPathTemplate(granularity, customTemplate);
	if (!template) return "";
	return renderDateTemplate(template, date, dateFormat, "*")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");
}

export function dateLookupPaths(
	date: Date,
	settings: {
		exportsFolder?: string;
		exportFilenamePattern?: string;
		exportDateFormat?: string;
		exportFolderGranularity?: ExportFolderGranularity;
		exportFolderCustomPathTemplate?: string;
	} = {},
): string[] {
	const baseFolder = normalizeVaultFolder(settings.exportsFolder ?? "");
	const dateFormat = settings.exportDateFormat ?? "YYYY-MM-DD";
	const pattern = normalizeExportFilenamePattern(
		settings.exportFilenamePattern ?? "*{date}*",
	);
	const renderedPattern = ensureLookupGlobCanMatchExtension(
		renderDateTemplateForLookup(pattern, date, dateFormat),
	);

	const paths: string[] = [];
	const push = (path: string): void => {
		const normalized = normalizeVaultPath(path);
		if (!paths.includes(normalized)) paths.push(normalized);
	};

	// If the filename pattern itself contains folders, treat it as the complete
	// relative export path under the base folder. This lets users paste iso.me
	// v1.5 filename templates such as `{year}/{year}-{month}/Daily Track - {date}`.
	if (splitDirAndName(renderedPattern).dir) {
		push(joinVaultPath(baseFolder, renderedPattern));
		return paths;
	}

	const granularity = settings.exportFolderGranularity ?? "flat";
	const nestedFolder = renderExportFolderPath(
		granularity,
		settings.exportFolderCustomPathTemplate ??
			DEFAULT_CUSTOM_EXPORT_FOLDER_PATH_TEMPLATE,
		date,
		dateFormat,
	);
	if (nestedFolder) {
		push(joinVaultPath(baseFolder, nestedFolder, renderedPattern));
	}

	// Keep flat exports loadable even after opting into nested folders. The loader
	// treats these as alternatives and ignores whichever candidate has no matches.
	push(joinVaultPath(baseFolder, renderedPattern));
	return paths;
}

function renderDateTemplateForLookup(
	pattern: string,
	date: Date,
	dateFormat: string,
): string {
	return applyDateToPattern(pattern, date, dateFormat).replace(
		/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
		"*",
	);
}

function ensureLookupGlobCanMatchExtension(path: string): string {
	const { name } = splitDirAndName(path);
	if (name.includes("*") || name.includes("?")) return path;
	const lower = name.toLowerCase();
	const hasKnownExtension = [".json", ".csv", ".md", ".markdown", ".gpx"].some(
		(ext) => lower.endsWith(ext),
	);
	return hasKnownExtension ? path : `${path}*`;
}

function normalizeExportFilenamePattern(pattern: string): string {
	const normalized = pattern
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");
	return normalized || "*{date}*";
}

export function normalizeVaultFolder(folder: string): string {
	return normalizeVaultPath(folder).replace(/\/+$/g, "");
}

export function normalizeVaultPath(path: string): string {
	return path
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/+/g, "/");
}

export function joinVaultPath(...parts: string[]): string {
	return normalizeVaultPath(parts.filter((part) => part.length > 0).join("/"));
}

function splitDirAndName(path: string): { dir: string; name: string } {
	const idx = path.lastIndexOf("/");
	if (idx < 0) return { dir: "", name: path };
	return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
}
