import { DetectedFormat, ExportShape, LocationPoint } from "../types";

export interface MapStats {
	visitCount: number;
	pointCount: number;
	dateRange: { earliest: Date; latest: Date } | null;
	totalDistanceKm: number;
	averageSpeedKmh: number;
	topPlace: { name: string; count: number } | null;
	detectedFormat: DetectedFormat | undefined;
}

const FORMAT_LABELS: Record<DetectedFormat, string> = {
	"iso-me-json": "JSON",
	"iso-me-csv": "CSV",
	"iso-me-markdown": "MD",
	owntracks: "OwnTracks",
	overland: "Overland",
	gpx: "GPX",
	"unknown-json": "JSON",
};

const FORMAT_CLASSES: Record<DetectedFormat, string> = {
	"iso-me-json": "iso-me-badge-json",
	"iso-me-csv": "iso-me-badge-csv",
	"iso-me-markdown": "iso-me-badge-md",
	owntracks: "iso-me-badge-ot",
	overland: "iso-me-badge-ol",
	gpx: "iso-me-badge-gpx",
	"unknown-json": "iso-me-badge-json",
};

export function formatLabel(f: DetectedFormat | undefined): string {
	if (!f) return "";
	return FORMAT_LABELS[f] ?? f;
}

export function formatClass(f: DetectedFormat | undefined): string {
	if (!f) return "";
	return FORMAT_CLASSES[f] ?? "";
}

function fmtDate(d: Date): string {
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDuration(ms: number): string {
	const hours = Math.floor(ms / 36e5);
	const days = Math.floor(hours / 24);
	if (days >= 1) return `${days}d ${hours % 24}h`;
	return `${hours}h`;
}

function distanceBetween(a: LocationPoint, b: LocationPoint): number {
	const R = 6371e3; // Earth's radius in meters
	const φ1 = (a.latitude * Math.PI) / 180;
	const φ2 = (b.latitude * Math.PI) / 180;
	const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
	const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
	const sinΔφ2 = Math.sin(Δφ / 2);
	const sinΔλ2 = Math.sin(Δλ / 2);
	const aH =
		sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
	return R * 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1 - aH));
}

export function computeStats(data: ExportShape): MapStats {
	const visits = data.visits ?? [];
	const points = data.points ?? [];

	// Date range
	let earliest: Date | null = null;
	let latest: Date | null = null;
	for (const v of visits) {
		const d = new Date(v.arrivedAt);
		if (!isNaN(d.getTime())) {
			if (!earliest || d < earliest) earliest = d;
			if (!latest || d > latest) latest = d;
		}
	}
	for (const p of points) {
		const d = new Date(p.timestamp);
		if (!isNaN(d.getTime())) {
			if (!earliest || d < earliest) earliest = d;
			if (!latest || d > latest) latest = d;
		}
	}

	// Total distance (from clean points only)
	let totalDistanceKm = 0;
	const cleanPoints = points
		.filter((p) => !p.isOutlier)
		.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
	for (let i = 1; i < cleanPoints.length; i++) {
		totalDistanceKm += distanceBetween(cleanPoints[i - 1], cleanPoints[i]) / 1000;
	}

	// Average speed (from clean points with speed data)
	let totalSpeed = 0;
	let speedCount = 0;
	for (const p of cleanPoints) {
		if (p.speed != null && p.speed >= 0) {
			totalSpeed += p.speed;
			speedCount++;
		}
	}
	const averageSpeedKmh = speedCount > 0 ? (totalSpeed / speedCount) * 3.6 : 0;

	// Top visited place
	const nameFreq = new Map<string, number>();
	for (const v of visits) {
		const name = v.locationName?.trim();
		if (name) nameFreq.set(name, (nameFreq.get(name) ?? 0) + 1);
	}
	let topPlace: { name: string; count: number } | null = null;
	for (const [name, count] of nameFreq) {
		if (!topPlace || count > topPlace.count) topPlace = { name, count };
	}

	return {
		visitCount: visits.length,
		pointCount: points.length,
		dateRange: earliest && latest ? { earliest, latest } : null,
		totalDistanceKm,
		averageSpeedKmh,
		topPlace,
		detectedFormat: data.detectedFormat,
	};
}

export function renderStatsBar(parent: HTMLElement, stats: MapStats): HTMLElement {
	const el = parent.createDiv({ cls: "iso-me-stats" });

	// Format badge row
	const badgesRow = el.createDiv({ cls: "iso-me-stats-badges" });
	if (stats.detectedFormat) {
		const badge = badgesRow.createSpan({ cls: `iso-me-format-badge ${formatClass(stats.detectedFormat)}` });
		badge.textContent = formatLabel(stats.detectedFormat);
	}

	// Stat pills
	const pillsRow = el.createDiv({ cls: "iso-me-stats-pills" });

	if (stats.visitCount > 0) {
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: String(stats.visitCount) });
		pill.createSpan({ cls: "iso-me-stat-label", text: stats.visitCount === 1 ? "visit" : "visits" });
	}

	if (stats.pointCount > 0) {
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: stats.pointCount.toLocaleString() });
		pill.createSpan({ cls: "iso-me-stat-label", text: stats.pointCount === 1 ? "point" : "points" });
	}

	if (stats.totalDistanceKm > 0) {
		const displayKm = stats.totalDistanceKm < 1
			? `${Math.round(stats.totalDistanceKm * 1000)} m`
			: stats.totalDistanceKm < 10
				? `${stats.totalDistanceKm.toFixed(1)} km`
				: `${Math.round(stats.totalDistanceKm)} km`;
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: displayKm });
		pill.createSpan({ cls: "iso-me-stat-label", text: "distance" });
	}

	if (stats.averageSpeedKmh > 0) {
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: `${Math.round(stats.averageSpeedKmh)} km/h` });
		pill.createSpan({ cls: "iso-me-stat-label", text: "avg speed" });
	}

	if (stats.dateRange) {
		const durationMs = stats.dateRange.latest.getTime() - stats.dateRange.earliest.getTime();
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: `${fmtDate(stats.dateRange.earliest)} → ${fmtDate(stats.dateRange.latest)}` });
		pill.createSpan({ cls: "iso-me-stat-label", text: durationMs > 0 ? fmtDuration(durationMs) : "range" });
	}

	if (stats.topPlace && stats.topPlace.count >= 2) {
		const pill = pillsRow.createDiv({ cls: "iso-me-stat-pill" });
		pill.createSpan({ cls: "iso-me-stat-value", text: stats.topPlace.name });
		pill.createSpan({ cls: "iso-me-stat-label", text: `${stats.topPlace.count} visits` });
	}

	return el;
}
