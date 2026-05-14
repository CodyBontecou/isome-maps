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
	const month = MONTHS[m[1].toLowerCase()];
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
	return { key: m[1].trim().toLowerCase(), value: m[2].trim() };
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

function parseVisitsBullet(lines: string[]): Visit[] {
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

function parseVisitsTable(lines: string[]): Visit[] {
	const visits: Visit[] = [];
	let currentDate: DateParts | null = null;
	let columns: Map<string, number> | null = null;

	const cleanField = (s: string | undefined): string | null => {
		if (!s) return null;
		const t = s.trim();
		return t === "" || t === "-" ? null : t;
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();

		if (line.startsWith("## ")) {
			currentDate = parseDateHeading(line.slice(3).trim());
			columns = null;
			continue;
		}

		const cells = parseTableRow(line);
		if (!cells) {
			columns = null;
			continue;
		}

		if (!columns) {
			const lowered = cells.map((c) => c.toLowerCase());
			if (
				lowered.includes("arrived") &&
				lowered.includes("lat") &&
				lowered.includes("lon")
			) {
				const headerColumns = new Map<string, number>();
				lowered.forEach((c, idx) => headerColumns.set(c, idx));
				columns = headerColumns;
			}
			continue;
		}

		if (isSeparatorRow(cells)) continue;
		if (!currentDate) continue;

		const activeColumns = columns;
		const get = (key: string) => {
			const index = activeColumns.get(key);
			return index === undefined ? undefined : cells[index];
		};

		const arrived = parseTime(get("arrived") ?? "");
		if (!arrived) continue;

		const lat = stripUnit(get("lat") ?? "");
		const lon = stripUnit(get("lon") ?? "");
		if (lat === null || lon === null) continue;

		const arrivedAt = combineToISO(currentDate, arrived);
		if (!arrivedAt) continue;

		const departedStr = cleanField(get("departed"));
		const departed = departedStr ? parseTime(departedStr) : null;
		const departedAt = departed ? combineToISO(currentDate, departed) : null;

		const durationStr = cleanField(get("duration"));
		const durationMinutes = durationStr ? parseDurationText(durationStr) : null;

		visits.push({
			latitude: lat,
			longitude: lon,
			arrivedAt,
			departedAt,
			durationMinutes,
			locationName: cleanField(get("location")),
			address: cleanField(get("address")),
			notes: cleanField(get("notes")),
		});
	}

	return visits;
}

function parseVisitsMarkdown(lines: string[]): Visit[] {
	const bullet = parseVisitsBullet(lines);
	if (bullet.length > 0) return bullet;
	return parseVisitsTable(lines);
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
				const headerColumns = new Map<string, number>();
				lowered.forEach((c, idx) => headerColumns.set(c, idx));
				columns = headerColumns;
			}
			continue;
		}

		if (isSeparatorRow(cells)) continue;
		if (!currentDate) continue;

		const activeColumns = columns;
		const get = (key: string) => {
			const index = activeColumns.get(key);
			return index === undefined ? undefined : cells[index];
		};
		const timeStr = get("time");
		const latStr = get("lat");
		const lonStr = get("lon");
		if (!timeStr || !latStr || !lonStr) continue;

		const time = parseTime(timeStr);
		if (!time) continue;
		const lat = stripUnit(latStr);
		const lon = stripUnit(lonStr);
		if (lat === null || lon === null) continue;

		const iso = combineToISO(currentDate, time);
		if (!iso) continue;

		const outlier = get("outlier")?.toLowerCase();
		const isOutlier = outlier === "yes" || outlier === "true";

		points.push({
			latitude: lat,
			longitude: lon,
			timestamp: iso,
			altitude: stripUnit(get("altitude") ?? ""),
			speed: stripUnit(get("speed") ?? ""),
			course: null,
			horizontalAccuracy: stripUnit(get("accuracy") ?? ""),
			verticalAccuracy: null,
			isOutlier,
		});
	}

	return points;
}

type SectionKind = "visits" | "points" | "skip";

function classifyH1(heading: string): SectionKind {
	const h = heading.toLowerCase();
	if (h.includes("location points")) return "points";
	if (h.includes("complete export")) return "skip";
	if (h === "visits" || h.includes("iso.me")) return "visits";
	return "skip";
}

export function parseExportMarkdown(text: string): ExportShape {
	const lines = text.split(/\r?\n/);

	interface Section {
		kind: SectionKind;
		start: number;
		end: number;
	}
	const sections: Section[] = [];
	let cur: Section | null = null;

	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim();
		if (t.startsWith("# ") && !t.startsWith("## ")) {
			if (cur) {
				cur.end = i;
				sections.push(cur);
			}
			cur = { kind: classifyH1(t.slice(2).trim()), start: i, end: lines.length };
		}
	}
	if (cur) sections.push(cur);

	let visits: Visit[] | null = null;
	let points: LocationPoint[] | null = null;

	for (const s of sections) {
		const slice = lines.slice(s.start, s.end);
		if (s.kind === "visits") {
			const v = parseVisitsMarkdown(slice);
			visits = visits === null ? v : visits.concat(v);
		} else if (s.kind === "points") {
			const p = parsePointsMarkdown(slice);
			points = points === null ? p : points.concat(p);
		}
	}

	if (visits === null && points === null) {
		throw new MarkdownParseError(
			'Unrecognized markdown. Expected H1 "# iso.me Export", "# iso.me Location Points Export", or "# iso.me Complete Export".',
		);
	}

	return { visits, points };
}
