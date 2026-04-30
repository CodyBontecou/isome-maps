import * as L from "leaflet";
import { LocationPoint } from "../types";

export function renderOutlierMarkers(
	map: L.Map,
	points: LocationPoint[],
	color: string,
): L.LatLngTuple[] {
	const bounds: L.LatLngTuple[] = [];
	for (const p of points) {
		const latlng: L.LatLngTuple = [p.latitude, p.longitude];
		L.circleMarker(latlng, {
			radius: 4,
			color,
			fillColor: color,
			fillOpacity: 0.85,
			weight: 1,
		})
			.bindPopup(`<div class="iso-me-popup-outlier">GPS glitch · ${p.timestamp}</div>`)
			.addTo(map);
		bounds.push(latlng);
	}
	return bounds;
}
