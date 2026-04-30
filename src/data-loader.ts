import { App, normalizePath } from "obsidian";
import { ExportShape, LocationPoint, Visit } from "./types";

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
	};
}

export async function loadExport(app: App, source: string): Promise<ExportShape> {
	const path = normalizePath(source);
	let raw: string;
	try {
		raw = await app.vault.adapter.read(path);
	} catch (e) {
		throw new DataLoadError(`File not found: ${path}`, path);
	}

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

	const root = parsed as Record<string, unknown>;
	const visitsRaw = Array.isArray(root.visits) ? root.visits : null;
	const pointsRaw = Array.isArray(root.points) ? root.points : null;

	if (!visitsRaw && !pointsRaw) {
		throw new DataLoadError(
			"Export contains neither `visits` nor `points` arrays",
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
	};
}
