import { ExportShape, LocationPoint } from "./types";

/**
 * Detect if a parsed JSON payload is an OwnTracks export.
 * OwnTracks exports are an array of objects with `_type: "location"`.
 */
export function isOwnTracksJSON(data: unknown): boolean {
	if (!Array.isArray(data)) return false;
	if (data.length === 0) return false;
	const first = data[0] as Record<string, unknown> | null;
	return !!first && first._type === "location" && typeof first.lat === "number" && typeof first.lon === "number";
}

/**
 * Parse an OwnTracks JSON export into iso.me LocationPoints.
 * OwnTracks fields:
 *   lat, lon: coordinates
 *   tst: Unix timestamp (seconds)
 *   acc: horizontal accuracy (m)
 *   alt: altitude (m)
 *   vel: speed (km/h) → converted to m/s
 *   cog: course over ground (degrees)
 *   vac: vertical accuracy (m)
 *   tid: tracker ID
 */
export function parseOwnTracks(data: unknown[]): ExportShape {
	const points: LocationPoint[] = [];

	for (const raw of data) {
		if (!raw || typeof raw !== "object") continue;
		const r = raw as Record<string, unknown>;

		if (r._type !== "location") continue;
		if (typeof r.lat !== "number" || typeof r.lon !== "number") continue;

		const tst = typeof r.tst === "number" ? r.tst : undefined;
		let timestamp: string;
		if (tst !== undefined) {
			timestamp = new Date(tst * 1000).toISOString();
		} else {
			continue;
		}

		const speedKph = typeof r.vel === "number" ? r.vel : null;
		const speedMs = speedKph !== null ? speedKph / 3.6 : null;

		points.push({
			latitude: r.lat,
			longitude: r.lon,
			timestamp,
			timestampUnix: tst,
			altitude: typeof r.alt === "number" ? r.alt : null,
			speed: speedMs,
			course: typeof r.cog === "number" ? r.cog : null,
			horizontalAccuracy: typeof r.acc === "number" ? r.acc : null,
			verticalAccuracy: typeof r.vac === "number" ? r.vac : null,
			isOutlier: false,
		});
	}

	return { visits: null, points: points.length > 0 ? points : null };
}
