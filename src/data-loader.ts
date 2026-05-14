import { App, normalizePath } from "obsidian";
import { CSVParseError, parseExportCSV } from "./csv-parser";
import {
	applyDateToPattern,
	formatDate,
	isDateKeyword,
	resolveDateKeyword,
} from "./date-resolver";
import { GPXParseError, parseGPX } from "./gpx-parser";
import { MarkdownParseError, parseExportMarkdown } from "./markdown-parser";
import { isOverlandJSON, parseOverland } from "./overland-parser";
import { isOwnTracksJSON, parseOwnTracks } from "./owntracks-parser";
import { DetectedFormat, ExportShape, LocationPoint, Visit } from "./types";

export interface SourceResolutionSettings {
	exportsFolder?: string;
	exportFilenamePattern?: string;
	exportDateFormat?: string;
}

export class DataLoadError extends Error {
	constructor(message: string, readonly source: string) {
		super(message);
		this.name = "DataLoadError";
	}
}

function isFiniteNumber(v: unknown): v is number {
	return typeof v === "number" && Number.isFinite(v);
}

function coerceVisit(raw: unknown): Visit | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isFiniteNumber(r.latitude) || !isFiniteNumber(r.longitude)) return null;
	if (typeof r.arrivedAt !== "string") return null;
	return {
		latitude: r.latitude,
		longitude: r.longitude,
		arrivedAt: r.arrivedAt,
		departedAt: typeof r.departedAt === "string" ? r.departedAt : null,
		durationMinutes: isFiniteNumber(r.durationMinutes) ? r.durationMinutes : null,
		locationName: typeof r.locationName === "string" ? r.locationName : null,
		address: typeof r.address === "string" ? r.address : null,
		notes: typeof r.notes === "string" ? r.notes : null,
	};
}

function coercePoint(raw: unknown): LocationPoint | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isFiniteNumber(r.latitude) || !isFiniteNumber(r.longitude)) return null;
	if (typeof r.timestamp !== "string") return null;
	return {
		latitude: r.latitude,
		longitude: r.longitude,
		timestamp: r.timestamp,
		timestampUnix: isFiniteNumber(r.timestampUnix) ? r.timestampUnix : undefined,
		altitude: isFiniteNumber(r.altitude) ? r.altitude : null,
		speed: isFiniteNumber(r.speed) ? r.speed : null,
		course: isFiniteNumber(r.course) ? r.course : null,
		horizontalAccuracy: isFiniteNumber(r.horizontalAccuracy) ? r.horizontalAccuracy : null,
		verticalAccuracy: isFiniteNumber(r.verticalAccuracy) ? r.verticalAccuracy : null,
		isOutlier: typeof r.isOutlier === "boolean" ? r.isOutlier : false,
	};
}

function parseJSONExport(raw: string, path: string): ExportShape {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new DataLoadError(`Invalid JSON: ${msg}`, path);
	}

	if (!parsed || typeof parsed !== "object") {
		throw new DataLoadError("Export must be a JSON object", path);
	}

	// Format sniffing: OwnTracks, Overland, or standard iso.me JSON
	if (isOwnTracksJSON(parsed)) {
		return { ...parseOwnTracks(parsed as unknown[]), detectedFormat: "owntracks" };
	}

	if (isOverlandJSON(parsed)) {
		return { ...parseOverland(parsed as Record<string, unknown>), detectedFormat: "overland" };
	}

	const root = parsed as Record<string, unknown>;
	const visitsRaw = Array.isArray(root.visits) ? root.visits : null;
	const pointsRaw = Array.isArray(root.points) ? root.points : null;

	if (!visitsRaw && !pointsRaw) {
		throw new DataLoadError(
			"Export contains neither `visits` nor `points` arrays, and does not match OwnTracks or Overland format.",
			path,
		);
	}

	const visits = visitsRaw
		? visitsRaw.map(coerceVisit).filter((v): v is Visit => v !== null)
		: null;
	const points = pointsRaw
		? pointsRaw.map(coercePoint).filter((p): p is LocationPoint => p !== null)
		: null;

	return {
		visits,
		points,
		exportDate: typeof root.exportDate === "string" ? root.exportDate : undefined,
		detectedFormat: "iso-me-json",
	};
}

function detectFormat(path: string): "gpx" | "json" | "csv" | "markdown" {
	const lower = path.toLowerCase();
	if (lower.endsWith(".gpx")) return "gpx";
	if (lower.endsWith(".csv")) return "csv";
	if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
	return "json";
}

const SUPPORTED_EXTENSIONS = [".json", ".csv", ".md", ".markdown", ".gpx"];

function hasSupportedExtension(path: string): boolean {
	const lower = path.toLowerCase();
	return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function splitDirAndName(path: string): { dir: string; name: string } {
	const idx = path.lastIndexOf("/");
	if (idx < 0) return { dir: "", name: path };
	return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
}

function globToRegExp(pattern: string): RegExp {
	let out = "^";
	for (let i = 0; i < pattern.length; i++) {
		const ch = pattern[i];
		if (ch === "*") out += "[^/]*";
		else if (ch === "?") out += "[^/]";
		else if (/[.+^${}()|[\]\\]/.test(ch)) out += `\\${ch}`;
		else out += ch;
	}
	out += "$";
	return new RegExp(out);
}

async function expandSource(app: App, source: string): Promise<string[]> {
	const path = normalizePath(source);

	// Filename glob (e.g. "exports/iso.me*.json"). We only support wildcards in
	// the final path component — that's the per-day-export use case.
	if (path.includes("*") || path.includes("?")) {
		const { dir, name } = splitDirAndName(path);
		if (name.includes("*") || name.includes("?")) {
			let listing: { files: string[]; folders: string[] };
			try {
				listing = await app.vault.adapter.list(dir || "/");
			} catch {
				return [path];
			}
			const re = globToRegExp(name);
			const matches = listing.files
				.filter((p) => {
					const tail = splitDirAndName(p).name;
					return re.test(tail) && hasSupportedExtension(tail);
				})
				.sort();
			return matches.length > 0 ? matches : [path];
		}
		return [path];
	}

	// Folder source: include every supported export inside.
	let stat: { type: string } | null = null;
	try {
		stat = (await app.vault.adapter.stat(path)) as { type: string } | null;
	} catch {
		stat = null;
	}
	if (stat && stat.type === "folder") {
		try {
			const listing = await app.vault.adapter.list(path);
			const matches = listing.files.filter(hasSupportedExtension).sort();
			return matches.length > 0 ? matches : [path];
		} catch {
			return [path];
		}
	}

	return [path];
}

async function expandSources(app: App, sources: string[]): Promise<string[]> {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of sources) {
		const expanded = await expandSource(app, s);
		for (const p of expanded) {
			if (!seen.has(p)) {
				seen.add(p);
				out.push(p);
			}
		}
	}
	return out;
}

export async function loadExport(app: App, source: string): Promise<ExportShape> {
	const path = normalizePath(source);
	let raw: string;
	try {
		raw = await app.vault.adapter.read(path);
	} catch {
		throw new DataLoadError(`File not found: ${path}`, path);
	}

	const format = detectFormat(path);

	if (format === "gpx") {
		try {
			const shape = parseGPX(raw);
			return { ...shape, detectedFormat: "gpx" };
		} catch (e) {
			const msg = e instanceof GPXParseError || e instanceof Error ? e.message : String(e);
			throw new DataLoadError(`Invalid GPX: ${msg}`, path);
		}
	}

	if (format === "csv") {
		try {
			const shape = parseExportCSV(raw);
			return { ...shape, detectedFormat: "iso-me-csv" };
		} catch (e) {
			const msg = e instanceof CSVParseError || e instanceof Error ? e.message : String(e);
			throw new DataLoadError(`Invalid CSV: ${msg}`, path);
		}
	}

	if (format === "markdown") {
		try {
			const shape = parseExportMarkdown(raw);
			return { ...shape, detectedFormat: "iso-me-markdown" };
		} catch (e) {
			const msg = e instanceof MarkdownParseError || e instanceof Error ? e.message : String(e);
			throw new DataLoadError(`Invalid Markdown: ${msg}`, path);
		}
	}

	return parseJSONExport(raw, path);
}

export function preprocessSources(
	sources: string[],
	settings: SourceResolutionSettings = {},
	now: Date = new Date(),
): string[] {
	const folder = (settings.exportsFolder ?? "").replace(/\/+$/, "");
	const pattern = settings.exportFilenamePattern ?? "*{date}*";
	const dateFormat = settings.exportDateFormat ?? "YYYY-MM-DD";
	const out: string[] = [];
	const join = (name: string) => (folder ? `${folder}/${name}` : name);
	for (const raw of sources) {
		const trimmed = raw.trim();
		if (!trimmed) continue;
		if (isDateKeyword(trimmed)) {
			for (const date of resolveDateKeyword(trimmed, now)) {
				out.push(join(applyDateToPattern(pattern, formatDate(date, dateFormat))));
			}
			continue;
		}
		if (folder && !trimmed.includes("/")) {
			out.push(join(trimmed));
			continue;
		}
		out.push(trimmed);
	}
	return out;
}

export async function loadExports(
	app: App,
	sources: string[],
	settings: SourceResolutionSettings = {},
): Promise<ExportShape> {
	const resolved = preprocessSources(sources, settings);
	const expanded = await expandSources(app, resolved);
	const all = await Promise.all(expanded.map((s) => loadExport(app, s)));
	const visits: Visit[] = [];
	const points: LocationPoint[] = [];
	let exportDate: string | undefined;
	const detectedFormats: DetectedFormat[] = [];
	for (const e of all) {
		if (e.visits) visits.push(...e.visits);
		if (e.points) points.push(...e.points);
		if (!exportDate && e.exportDate) exportDate = e.exportDate;
		if (e.detectedFormat && !detectedFormats.includes(e.detectedFormat)) {
			detectedFormats.push(e.detectedFormat);
		}
	}
	// Determine the canonical detected format for the combined shape.
	// Priority: if there's just one, use it; otherwise pick the richest.
	const resolvedFormat: DetectedFormat | undefined =
		detectedFormats.length === 1
			? detectedFormats[0]
			: detectedFormats.length > 0
				? (detectedFormats.includes("iso-me-json") ? "iso-me-json" :
					 detectedFormats.includes("iso-me-csv") ? "iso-me-csv" :
					 detectedFormats.includes("iso-me-markdown") ? "iso-me-markdown" :
					 detectedFormats[0])
				: undefined;
	return {
		visits: visits.length > 0 ? visits : null,
		points: points.length > 0 ? points : null,
		exportDate,
		detectedFormat: resolvedFormat,
	};
}
