import { ExportShape, LocationPoint } from "./types";

/**
 * Detect if a parsed JSON payload is an Overland export.
 * Overland exports have a `locations` array of GeoJSON Feature objects
 * with `geometry.type === "Point"`.
 */
export function isOverlandJSON(data: unknown): boolean {
	if (!data || typeof data !== "object") return false;
	const r = data as Record<string, unknown>;
	if (!Array.isArray(r.locations)) return false;
	if (r.locations.length === 0) return false;
	const first = r.locations[0] as Record<string, unknown> | null;
	if (!first) return false;
	if (first.type !== "Feature") return false;
	const geom = first.geometry as Record<string, unknown> | null;
	return !!geom && geom.type === "Point";
}

/**
 * Parse an Overland JSON export into iso.me LocationPoints.
 * Overland fields per feature:
 *   geometry.coordinates: [longitude, latitude]
 *   properties.timestamp: ISO 8601 string
 *   properties.altitude: meters
 *   properties.speed: m/s
 *   properties.horizontalAccuracy: meters
 *   properties.deviceId: string
 */
export function parseOverland(data: Record<string, unknown>): ExportShape {
	const locations = data.locations as unknown[];
	const points: LocationPoint[] = [];

	for (const raw of locations) {
		if (!raw || typeof raw !== "object") continue;
		const feat = raw as Record<string, unknown>;

		if (feat.type !== "Feature") continue;

		const geom = feat.geometry as Record<string, unknown> | null;
		if (!geom || geom.type !== "Point") continue;

		const coords = geom.coordinates as number[] | null;
		if (!coords || coords.length < 2) continue;
		const lon = coords[0];
		const lat = coords[1];
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		const props = feat.properties as Record<string, unknown> | null;
		const timestamp = typeof props?.timestamp === "string" ? props.timestamp : null;
		if (!timestamp) continue;

		points.push({
			latitude: lat,
			longitude: lon,
			timestamp,
			timestampUnix: undefined,
			altitude: typeof props?.altitude === "number" ? props.altitude : null,
			speed: typeof props?.speed === "number" ? props.speed : null,
			course: null,
			horizontalAccuracy: typeof props?.horizontalAccuracy === "number" ? props.horizontalAccuracy : null,
			verticalAccuracy: null,
			isOutlier: false,
		});
	}

	return { visits: null, points: points.length > 0 ? points : null };
}
