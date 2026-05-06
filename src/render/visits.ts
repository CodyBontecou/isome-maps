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

/** Map visit duration to circle radius: min 6px, max 22px. */
function durationRadius(minutes: number | null | undefined): number {
	if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 8;
	// Log scale so short stops are distinguishable but long stays don't dominate
	const r = 5 + Math.log2(minutes + 1) * 3;
	return Math.min(Math.max(r, 6), 22);
}

/** Assign a fill opacity based on duration — longer stays = more opaque. */
function durationOpacity(minutes: number | null | undefined): number {
	if (minutes == null || !Number.isFinite(minutes)) return 0.6;
	if (minutes <= 5) return 0.5;
	if (minutes <= 30) return 0.65;
	if (minutes <= 120) return 0.75;
	return 0.9;
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
	const dur = fmtDuration(visit.durationMinutes);
	if (dur !== "—") {
		parts.push(
			`<div class="iso-me-popup-duration">Duration: ${escapeHtml(dur)}</div>`,
		);
	}
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

	// Compute duration range for dynamic sizing
	const durations = visits
		.map((v) => v.durationMinutes)
		.filter((d): d is number => d != null && Number.isFinite(d) && d > 0);
	const minDur = durations.length > 0 ? Math.min(...durations) : 0;
	const maxDur = durations.length > 0 ? Math.max(...durations) : 0;
	const durRange = maxDur - minDur;

	for (const v of visits) {
		const latlng: L.LatLngTuple = [v.latitude, v.longitude];
		const radius = durationRadius(v.durationMinutes);
		const opacity = durationOpacity(v.durationMinutes);

		// Thicker border for long stays when there's meaningful range
		const weight = durRange > 30 && v.durationMinutes != null && v.durationMinutes > 60 ? 3 : 2;

		L.circleMarker(latlng, {
			radius,
			color,
			fillColor: color,
			fillOpacity: opacity,
			weight,
		})
			.bindPopup(buildPopup(v))
			.addTo(target);
		bounds.push(latlng);
	}

	return bounds;
}
