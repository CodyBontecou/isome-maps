import { ExportShape, LocationPoint, Visit } from "./types";

export class CSVParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CSVParseError";
	}
}

function parseCSV(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let i = 0;
	let inQuotes = false;
	const len = text.length;

	while (i < len) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (i + 1 < len && text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ",") {
			row.push(field);
			field = "";
			i++;
			continue;
		}
		if (c === "\r") {
			i++;
			continue;
		}
		if (c === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			i++;
			continue;
		}
		field += c;
		i++;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function toFiniteNumber(value: string | undefined): number | null {
	if (value === undefined) return null;
	const trimmed = value.trim();
	if (trimmed === "") return null;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : null;
}

function toBool(value: string | undefined): boolean {
	if (!value) return false;
	const v = value.trim().toLowerCase();
	return v === "true" || v === "yes" || v === "1";
}

function toString(value: string | undefined): string | null {
	if (value === undefined) return null;
	const trimmed = value;
	return trimmed === "" ? null : trimmed;
}

function buildHeaderMap(headers: string[]): Map<string, number> {
	const map = new Map<string, number>();
	headers.forEach((h, idx) => {
		map.set(h.trim().toLowerCase(), idx);
	});
	return map;
}

function isVisitsCSV(headers: Map<string, number>): boolean {
	return headers.has("arrived_at");
}

function isPointsCSV(headers: Map<string, number>): boolean {
	return headers.has("timestamp") && headers.has("latitude") && headers.has("longitude");
}

type CSVSectionKind = "visits" | "points";

interface CSVSection {
	kind: CSVSectionKind;
	rows: string[][];
	headers: Map<string, number>;
}

function csvSectionKind(headers: Map<string, number>): CSVSectionKind | null {
	if (isVisitsCSV(headers)) return "visits";
	if (isPointsCSV(headers)) return "points";
	return null;
}

function isCommentRow(row: string[]): boolean {
	return row.length > 0 && row[0].trim().startsWith("#");
}

function collectSections(rows: string[][]): CSVSection[] {
	const sections: CSVSection[] = [];
	let i = 0;

	while (i < rows.length) {
		const headers = buildHeaderMap(rows[i]);
		const kind = csvSectionKind(headers);
		if (!kind) {
			i++;
			continue;
		}

		const sectionRows = [rows[i]];
		i++;

		while (i < rows.length) {
			const row = rows[i];
			if (isCommentRow(row)) break;
			if (csvSectionKind(buildHeaderMap(row))) break;
			sectionRows.push(row);
			i++;
		}

		sections.push({ kind, rows: sectionRows, headers });
	}

	return sections;
}

function cell(row: string[], headers: Map<string, number>, key: string): string | undefined {
	const index = headers.get(key);
	return index === undefined ? undefined : row[index];
}

function parseVisits(rows: string[][], headers: Map<string, number>): Visit[] {
	const visits: Visit[] = [];

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const arrivedAt = cell(row, headers, "arrived_at");
		const lat = toFiniteNumber(cell(row, headers, "latitude"));
		const lon = toFiniteNumber(cell(row, headers, "longitude"));
		if (!arrivedAt || lat === null || lon === null) continue;

		visits.push({
			latitude: lat,
			longitude: lon,
			arrivedAt,
			departedAt: toString(cell(row, headers, "departed_at")),
			durationMinutes: toFiniteNumber(cell(row, headers, "duration_minutes")),
			locationName: toString(cell(row, headers, "location_name")),
			address: toString(cell(row, headers, "address")),
			notes: toString(cell(row, headers, "notes")),
		});
	}
	return visits;
}

function parsePoints(rows: string[][], headers: Map<string, number>): LocationPoint[] {
	const points: LocationPoint[] = [];

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const timestamp = cell(row, headers, "timestamp");
		const lat = toFiniteNumber(cell(row, headers, "latitude"));
		const lon = toFiniteNumber(cell(row, headers, "longitude"));
		if (!timestamp || lat === null || lon === null) continue;

		const tsUnix = toFiniteNumber(cell(row, headers, "timestamp_unix"));
		const isOutlier = toBool(cell(row, headers, "is_outlier"));

		points.push({
			latitude: lat,
			longitude: lon,
			timestamp,
			timestampUnix: tsUnix ?? undefined,
			altitude: toFiniteNumber(cell(row, headers, "altitude")),
			speed: toFiniteNumber(cell(row, headers, "speed")),
			course: null,
			horizontalAccuracy: toFiniteNumber(cell(row, headers, "horizontal_accuracy")),
			verticalAccuracy: null,
			isOutlier,
		});
	}
	return points;
}

export function parseExportCSV(text: string): ExportShape {
	const rows = parseCSV(text);
	if (rows.length === 0) {
		throw new CSVParseError("CSV is empty");
	}

	const sections = collectSections(rows);

	if (sections.length > 0) {
		let visits: Visit[] | null = null;
		let points: LocationPoint[] | null = null;

		for (const section of sections) {
			if (section.kind === "visits") {
				const parsed = parseVisits(section.rows, section.headers);
				visits = visits === null ? parsed : visits.concat(parsed);
			} else {
				const parsed = parsePoints(section.rows, section.headers);
				points = points === null ? parsed : points.concat(parsed);
			}
		}

		return { visits, points };
	}

	const headerRow = rows.find((row) => !isCommentRow(row)) ?? rows[0];
	throw new CSVParseError(
		`Unrecognized CSV header. Expected iso.me visits (arrived_at,...), points (timestamp,latitude,longitude,...), or combined CSV sections. Got: ${headerRow.join(",")}`,
	);
}
