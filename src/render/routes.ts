import * as L from "leaflet";
import { LocationPoint } from "../types";

const MAX_POINTS = 1500;

function downsample<T>(arr: T[], max: number): T[] {
	if (arr.length <= max) return arr;
	const stride = arr.length / max;
	const out: T[] = [];
	for (let i = 0; i < max - 1; i++) {
		out.push(arr[Math.floor(i * stride)]!);
	}
	out.push(arr[arr.length - 1]!);
	return out;
}

export function renderRoutePolyline(
	map: L.Map,
	points: LocationPoint[],
	color: string,
): L.LatLngTuple[] {
	if (points.length === 0) return [];

	if (points.length === 1) {
		const p = points[0]!;
		const latlng: L.LatLngTuple = [p.latitude, p.longitude];
		L.circleMarker(latlng, {
			radius: 6,
			color,
			fillColor: color,
			fillOpacity: 1,
			weight: 2,
		}).addTo(map);
		return [latlng];
	}

	const sampled = downsample(points, MAX_POINTS);
	const coords = sampled.map(
		(p) => [p.latitude, p.longitude] as L.LatLngTuple,
	);

	L.polyline(coords, {
		color,
		weight: 4,
		opacity: 0.9,
		lineCap: "round",
		lineJoin: "round",
	}).addTo(map);

	const start = coords[0]!;
	const end = coords[coords.length - 1]!;
	L.circleMarker(start, {
		radius: 6,
		color: "#22c55e",
		fillColor: "#22c55e",
		fillOpacity: 1,
		weight: 2,
	}).addTo(map);
	L.circleMarker(end, {
		radius: 6,
		color: "#ef4444",
		fillColor: "#ef4444",
		fillOpacity: 1,
		weight: 2,
	}).addTo(map);

	return coords;
}
