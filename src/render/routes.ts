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

function totalDistanceMeters(points: LocationPoint[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1]!;
		const b = points[i]!;
		total += L.latLng(a.latitude, a.longitude).distanceTo(
			L.latLng(b.latitude, b.longitude),
		);
	}
	return total;
}

function straightDistanceMeters(points: LocationPoint[]): number {
	const a = points[0]!;
	const b = points[points.length - 1]!;
	return L.latLng(a.latitude, a.longitude).distanceTo(
		L.latLng(b.latitude, b.longitude),
	);
}

function formatDistance(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)} m`;
	const km = meters / 1000;
	return km < 10 ? `${km.toFixed(2)} km` : `${km.toFixed(1)} km`;
}

export function renderRoutePolyline(
	target: L.LayerGroup,
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
		}).addTo(target);
		return [latlng];
	}

	const sampled = downsample(points, MAX_POINTS);
	const coords = sampled.map(
		(p) => [p.latitude, p.longitude] as L.LatLngTuple,
	);

	const pathMeters = totalDistanceMeters(points);
	const straightMeters = straightDistanceMeters(points);

	const polyline = L.polyline(coords, {
		color,
		weight: 4,
		opacity: 0.9,
		lineCap: "round",
		lineJoin: "round",
	}).addTo(target);

	const popupHtml =
		`<div class="iso-me-route-popup">` +
		`<div><strong>Path:</strong> ${formatDistance(pathMeters)}</div>` +
		`<div><strong>Straight:</strong> ${formatDistance(straightMeters)}</div>` +
		`</div>`;
	polyline.bindPopup(popupHtml);

	const start = coords[0]!;
	const end = coords[coords.length - 1]!;
	L.circleMarker(start, {
		radius: 6,
		color: "#22c55e",
		fillColor: "#22c55e",
		fillOpacity: 1,
		weight: 2,
	}).addTo(target);
	L.circleMarker(end, {
		radius: 6,
		color: "#ef4444",
		fillColor: "#ef4444",
		fillOpacity: 1,
		weight: 2,
	}).addTo(target);

	return coords;
}
