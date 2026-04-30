import * as L from "leaflet";
import "leaflet.heat";
import { LocationPoint } from "../types";

export function renderHeatLayer(
	map: L.Map,
	points: LocationPoint[],
	radius: number,
	blur: number,
): void {
	if (points.length === 0) return;
	const data: Array<[number, number, number]> = points.map((p) => [
		p.latitude,
		p.longitude,
		1,
	]);
	L.heatLayer(data, { radius, blur }).addTo(map);
}
