import { ExportShape, LocationPoint, Visit } from "./types";

export class GPXParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GPXParseError";
	}
}

function toFiniteNumber(value: string | null | undefined): number | null {
	if (!value) return null;
	const n = Number(value.trim());
	return Number.isFinite(n) ? n : null;
}

function textOf(el: Element | null, tag: string): string | null {
	const child = el?.querySelector(tag);
	return child?.textContent?.trim() ?? null;
}

/**
 * Parse iso.me GPX exports (waypoints as visits, track points as location points).
 * Uses DOMParser (available in Electron and mobile WebView).
 */
export function parseGPX(xml: string): ExportShape {
	let doc: Document;
	try {
		const parser = new DOMParser();
		doc = parser.parseFromString(xml, "text/xml");
	} catch {
		throw new GPXParseError("Failed to parse GPX XML");
	}

	const errNode = doc.querySelector("parsererror");
	if (errNode) {
		throw new GPXParseError(`XML parse error: ${errNode.textContent ?? "unknown"}`);
	}

	const root = doc.documentElement;
	if (!root || root.tagName !== "gpx") {
		throw new GPXParseError("Not a GPX document (missing <gpx> root element)");
	}

	// Resolve the iso.me extension namespace
	const isomeNS = resolveIsomeNamespace(root);

	const visits: Visit[] = [];
	const points: LocationPoint[] = [];

	// Parse <wpt> elements → visits
	const wptNodes = Array.from(root.querySelectorAll("wpt"));
	for (const wpt of wptNodes) {
		const lat = toFiniteNumber(wpt.getAttribute("lat"));
		const lon = toFiniteNumber(wpt.getAttribute("lon"));
		if (lat === null || lon === null) continue;

		const timeEl = wpt.querySelector("time");
		const arrivedAt = timeEl?.textContent?.trim();

		let locationName = textOf(wpt, "name");
		let address: string | null = null;
		const desc = textOf(wpt, "desc");
		if (desc) {
			// iso.me encodes address and notes separated by " — " in <desc>
			const parts = desc.split(/ — /);
			address = parts[0] || null;
		}

		// iso.me extensions
		let departedAt: string | null = null;
		let durationMinutes: number | null = null;
		const extensions = wpt.querySelector("extensions");
		if (extensions && isomeNS) {
			departedAt = textOfNS(extensions, isomeNS, "departedAt");
			durationMinutes = toFiniteNumber(textOfNS(extensions, isomeNS, "durationMinutes"));
		}

		if (arrivedAt) {
			visits.push({
				latitude: lat,
				longitude: lon,
				arrivedAt,
				departedAt,
				durationMinutes,
				locationName: locationName === "Visit" ? null : locationName,
				address,
				notes: null,
			});
		}
	}

	// Parse <trk>/<trkseg>/<trkpt> → location points
	const trkNodes = Array.from(root.querySelectorAll("trk > trkseg > trkpt"));
	for (const trkpt of trkNodes) {
		const lat = toFiniteNumber(trkpt.getAttribute("lat"));
		const lon = toFiniteNumber(trkpt.getAttribute("lon"));
		if (lat === null || lon === null) continue;

		const timeEl = trkpt.querySelector("time");
		const timestamp = timeEl?.textContent?.trim();
		if (!timestamp) continue;

		const altitude = toFiniteNumber(textOf(trkpt, "ele"));

		let speed: number | null = null;
		let horizontalAccuracy: number | null = null;
		let isOutlier = false;
		const extensions = trkpt.querySelector("extensions");
		if (extensions && isomeNS) {
			speed = toFiniteNumber(textOfNS(extensions, isomeNS, "speed"));
			horizontalAccuracy = toFiniteNumber(textOfNS(extensions, isomeNS, "horizontalAccuracy"));
			const outlierText = textOfNS(extensions, isomeNS, "isOutlier");
			isOutlier = outlierText?.toLowerCase() === "true";
		}

		points.push({
			latitude: lat,
			longitude: lon,
			timestamp,
			altitude,
			speed,
			course: null,
			horizontalAccuracy,
			verticalAccuracy: null,
			isOutlier,
		});
	}

	if (visits.length === 0 && points.length === 0) {
		throw new GPXParseError("GPX file contains no waypoints or track points");
	}

	const exportDate = textOf(root, "metadata > time");

	return { visits: visits.length > 0 ? visits : null, points: points.length > 0 ? points : null, exportDate: exportDate ?? undefined };
}

/**
 * Find the iso.me extension namespace URI from the root <gpx> element.
 */
function resolveIsomeNamespace(root: Element): string | null {
	for (const attr of Array.from(root.attributes)) {
		if (attr.value === "https://isome.isolated.tech/gpx/1.0") {
			if (attr.name === "xmlns:isome") return "isome";
			const m = attr.name.match(/^xmlns:(.+)$/);
			if (m) return m[1];
		}
	}
	// Fallback: try common prefixes
	return "isome";
}

/**
 * Query an element by tag name within a namespace.
 */
function textOfNS(el: Element, nsPrefix: string, localName: string): string | null {
	// Build the namespace-qualified selector
	const prefix = nsPrefix.includes(":") ? nsPrefix : `${nsPrefix}:`;
	try {
		const child = el.querySelector(`${prefix}${localName}`);
		if (child) return child.textContent?.trim() ?? null;
	} catch {
		// namespace selectors can fail; fall through
	}

	// Fallback: search by localName only (less precise but works)
	for (const child of Array.from(el.children)) {
		if (child.localName === localName || child.tagName.endsWith(`:${localName}`)) {
			return child.textContent?.trim() ?? null;
		}
	}
	return null;
}
