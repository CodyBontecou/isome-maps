import * as L from "leaflet";
import { Visit } from "../types";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function fmtDateTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}

function fmtDuration(minutes: number | null | undefined): string {
	if (minutes == null || !Number.isFinite(minutes)) return "—";
	if (minutes < 60) return `${Math.round(minutes)} min`;
	const hours = Math.floor(minutes / 60);
	const rem = Math.round(minutes - hours * 60);
	return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

function buildPopup(visit: Visit): string {
	const parts: string[] = [];
	if (visit.locationName) {
		parts.push(`<div class="iso-me-popup-title">${escapeHtml(visit.locationName)}</div>`);
	}
	if (visit.address) {
		parts.push(`<div class="iso-me-popup-address">${escapeHtml(visit.address)}</div>`);
	}
	parts.push(
		`<div class="iso-me-popup-times">${escapeHtml(fmtDateTime(visit.arrivedAt))} → ${escapeHtml(fmtDateTime(visit.departedAt))}</div>`,
	);
	parts.push(
		`<div class="iso-me-popup-duration">Duration: ${escapeHtml(fmtDuration(visit.durationMinutes))}</div>`,
	);
	if (visit.notes) {
		parts.push(`<div class="iso-me-popup-notes">${escapeHtml(visit.notes)}</div>`);
	}
	return parts.join("");
}

export function renderVisitMarkers(
	target: L.LayerGroup,
	visits: Visit[],
	color: string,
): L.LatLngTuple[] {
	const bounds: L.LatLngTuple[] = [];
	for (const v of visits) {
		const latlng: L.LatLngTuple = [v.latitude, v.longitude];
		L.circleMarker(latlng, {
			radius: 8,
			color,
			fillColor: color,
			fillOpacity: 0.85,
			weight: 2,
		})
			.bindPopup(buildPopup(v))
			.addTo(target);
		bounds.push(latlng);
	}
	return bounds;
}
