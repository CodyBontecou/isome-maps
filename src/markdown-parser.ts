import { ExportShape, LocationPoint, Visit } from "./types";

export class MarkdownParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarkdownParseError";
	}
}

const MONTHS: Record<string, number> = {
	january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
	july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

interface DateParts {
	year: number;
	month: number; // 0-indexed
	day: number;
}

// Parse "Friday, March 14, 2025" or "March 14, 2025" — en_US `.full` / `.long` styles.
function parseDateHeading(text: string): DateParts | null {
	const m = text.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
	if (!m) return null;
	const month = MONTHS[m[1]!.toLowerCase()];
	if (month === undefined) return null;
	const day = Number(m[2]);
	const year = Number(m[3]);
	if (!Number.isFinite(day) || !Number.isFinite(year)) return null;
	return { year, month, day };
}

interface TimeParts {
	hour: number;
	minute: number;
	second: number;
}

// Parse "3:24 PM", "3:24:05 PM", "15:24", "15:24:05".
function parseTime(text: string): TimeParts | null {
	const m = text.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
	if (!m) return null;
	let hour = Number(m[1]);
	const minute = Number(m[2]);
	const second = m[3] ? Number(m[3]) : 0;
	const ampm = m[4]?.toUpperCase();
	if (ampm === "PM" && hour < 12) hour += 12;
	else if (ampm === "AM" && hour === 12) hour = 0;
	if (hour > 23 || minute > 59 || second > 59) return null;
	return { hour, minute, second };
}

function combineToISO(date: DateParts, time: TimeParts): string | null {
	const d = new Date(date.year, date.month, date.day, time.hour, time.minute, time.second);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString();
}

function parseDurationText(text: string): number | null {
	const hMatch = text.match(/(\d+)\s*h/i);
	const mMatch = text.match(/(\d+)\s*m(?!\w)/i);
	const hours = hMatch ? Number(hMatch[1]) : 0;
	const minutes = mMatch ? Number(mMatch[1]) : 0;
	if (!hMatch && !mMatch) return null;
	return hours * 60 + minutes;
}

function parseCoords(text: string): [number, number] | null {
	const m = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
	if (!m) return null;
	const lat = Number(m[1]);
	const lon = Number(m[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	return [lat, lon];
}

function parseBulletField(line: string): { key: string; value: string } | null {
	const m = line.match(/^\s*-\s*\*\*([^*]+):\*\*\s*(.+?)\s*$/);
	if (!m) return null;
	return { key: m[1]!.trim().toLowerCase(), value: m[2]!.trim() };
}

interface VisitDraft {
	heading: string;
	date: DateParts;
	arrived?: TimeParts;
	departed?: TimeParts;
	durationMinutes?: number;
	address?: string;
	coords?: [number, number];
	locationName?: string;
	notes?: string;
}

function flushVisit(draft: VisitDraft, visits: Visit[]): void {
	if (!draft.arrived || !draft.coords) return;
	const arrivedAt = combineToISO(draft.date, draft.arrived);
	if (!arrivedAt) return;
	const departedAt = draft.departed ? combineToISO(draft.date, draft.departed) : null;

	visits.push({
		latitude: draft.coords[0],
		longitude: draft.coords[1],
		arrivedAt,
		departedAt,
		durationMinutes: draft.durationMinutes ?? null,
		locationName: draft.locationName ?? null,
		address: draft.address ?? null,
		notes: draft.notes ?? null,
	});
}

function parseVisitsMarkdown(lines: string[]): Visit[] {
	const visits: Visit[] = [];
	let currentDate: DateParts | null = null;
	let draft: VisitDraft | null = null;

	const finishDraft = () => {
		if (draft) {
			flushVisit(draft, visits);
			draft = null;
		}
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();

		if (line.startsWith("## ")) {
			finishDraft();
			currentDate = parseDateHeading(line.slice(3).trim());
			continue;
		}

		if (line.startsWith("### ")) {
			finishDraft();
			if (!currentDate) continue;
			const heading = line.slice(4).trim();
			draft = { heading, date: currentDate };
			// If the heading is itself a time, leave locationName unset; otherwise use as locationName.
			if (!parseTime(heading)) {
				draft.locationName = heading;
			}
			continue;
		}

		if (!draft) continue;

		const bullet = parseBulletField(line);
		if (bullet) {
			switch (bullet.key) {
				case "arrived": {
					const t = parseTime(bullet.value);
					if (t) draft.arrived = t;
					break;
				}
				case "departed": {
					const t = parseTime(bullet.value);
					if (t) draft.departed = t;
					break;
				}
				case "duration": {
					const d = parseDurationText(bullet.value);
					if (d !== null) draft.durationMinutes = d;
					break;
				}
				case "address":
					draft.address = bullet.value;
					break;
				case "coordinates": {
					const c = parseCoords(bullet.value);
					if (c) draft.coords = c;
					break;
				}
			}
			continue;
		}

		if (line.startsWith("> ")) {
			const text = line.slice(2).trim();
			draft.notes = draft.notes ? `${draft.notes}\n${text}` : text;
		}
	}

	finishDraft();
	return visits;
}

interface PointTableContext {
	date: DateParts;
	columns: Map<string, number>; // header lowercased -> index
}

function parseTableRow(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
	const inner = trimmed.slice(1, -1);
	return inner.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
	return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function stripUnit(value: string): number | null {
	if (!value || value === "-") return null;
	const m = value.match(/(-?\d+(?:\.\d+)?)/);
	if (!m) return null;
	const n = Number(m[1]);
	return Number.isFinite(n) ? n : null;
}

function parsePointsMarkdown(lines: string[]): LocationPoint[] {
	const points: LocationPoint[] = [];
	let currentDate: DateParts | null = null;
	let columns: Map<string, number> | null = null;

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();

		if (line.startsWith("## ")) {
			currentDate = parseDateHeading(line.slice(3).trim());
			columns = null;
			continue;
		}

		const cells = parseTableRow(line);
		if (!cells) continue;

		if (!columns) {
			// Expect header row containing "Time" and "Lat" and "Lon".
			const lowered = cells.map((c) => c.toLowerCase());
			if (lowered.includes("time") && lowered.includes("lat") && lowered.includes("lon")) {
				columns = new Map();
				lowered.forEach((c, idx) => columns!.set(c, idx));
			}
			continue;
		}

		if (isSeparatorRow(cells)) continue;
		if (!currentDate) continue;

		const idx = (key: string) => columns!.get(key);
		const timeStr = idx("time") !== undefined ? cells[idx("time")!] : undefined;
		const latStr = idx("lat") !== undefined ? cells[idx("lat")!] : undefined;
		const lonStr = idx("lon") !== undefined ? cells[idx("lon")!] : undefined;
		if (!timeStr || !latStr || !lonStr) continue;

		const time = parseTime(timeStr);
		if (!time) continue;
		const lat = stripUnit(latStr);
		const lon = stripUnit(lonStr);
		if (lat === null || lon === null) continue;

		const iso = combineToISO(currentDate, time);
		if (!iso) continue;

		const outlierIdx = idx("outlier");
		let isOutlier = false;
		if (outlierIdx !== undefined) {
			const v = cells[outlierIdx]?.toLowerCase();
			isOutlier = v === "yes" || v === "true";
		}

		const speedIdx = idx("speed");
		const altIdx = idx("altitude");
		const accIdx = idx("accuracy");

		points.push({
			latitude: lat,
			longitude: lon,
			timestamp: iso,
			altitude: altIdx !== undefined ? stripUnit(cells[altIdx]!) : null,
			speed: speedIdx !== undefined ? stripUnit(cells[speedIdx]!) : null,
			course: null,
			horizontalAccuracy: accIdx !== undefined ? stripUnit(cells[accIdx]!) : null,
			verticalAccuracy: null,
			isOutlier,
		});
	}

	return points;
}

export function parseExportMarkdown(text: string): ExportShape {
	const lines = text.split(/\r?\n/);

	let kind: "visits" | "points" | null = null;
	for (const line of lines) {
		const t = line.trim();
		if (t.startsWith("# ")) {
			const h = t.slice(2).trim().toLowerCase();
			if (h.includes("location points")) kind = "points";
			else if (h.includes("iso.me")) kind = "visits";
			break;
		}
	}

	if (kind === "visits") {
		return { visits: parseVisitsMarkdown(lines), points: null };
	}
	if (kind === "points") {
		return { visits: null, points: parsePointsMarkdown(lines) };
	}

	throw new MarkdownParseError(
		'Unrecognized markdown. Expected H1 "# iso.me Export" or "# iso.me Location Points Export".',
	);
}
