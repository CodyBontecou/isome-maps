const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LAST_N_DAYS_RE = /^last\s+(\d+)\s+days?$/;

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function isDateKeyword(value: string): boolean {
	const v = value.trim().toLowerCase();
	if (v === "today" || v === "yesterday" || v === "last week") return true;
	if (ISO_DATE_RE.test(v)) return true;
	if (LAST_N_DAYS_RE.test(v)) return true;
	return false;
}

export function resolveDateKeyword(value: string, now: Date = new Date()): Date[] {
	const v = value.trim().toLowerCase();
	const today = startOfDay(now);
	if (v === "today") return [today];
	if (v === "yesterday") return [shiftDays(today, -1)];
	if (v === "last week") return rangeOfDays(today, 7);
	const m = v.match(LAST_N_DAYS_RE);
	if (m) {
		const n = Math.max(1, Math.min(366, Number(m[1])));
		return rangeOfDays(today, n);
	}
	if (ISO_DATE_RE.test(v)) {
		const [y, mo, d] = v.split("-").map(Number) as [number, number, number];
		return [new Date(y, mo - 1, d)];
	}
	return [];
}

export function formatDate(d: Date, format: string): string {
	const yyyy = String(d.getFullYear()).padStart(4, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return format.replace(/YYYY/g, yyyy).replace(/MM/g, mm).replace(/DD/g, dd);
}

export function dateTemplateTokens(
	d: Date,
	dateFormat = "YYYY-MM-DD",
): Record<string, string> {
	const yyyy = String(d.getFullYear()).padStart(4, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const formattedDate = formatDate(d, dateFormat);
	const weekday = WEEKDAYS[d.getDay()];
	const monthName = MONTH_NAMES[d.getMonth()];
	const quarter = `Q${Math.floor(d.getMonth() / 3) + 1}`;

	return {
		date: formattedDate,
		year: yyyy,
		month: mm,
		dayNumber: dd,
		weekday,
		monthName,
		quarter,
		week: `W${String(isoWeekNumber(d)).padStart(2, "0")}`,
		// iso.me's filename template uses {day} for the weekday label.
		day: weekday,
		// Time-based tokens cannot be known from a date keyword. Treat them as
		// wildcards so templates like isome_{type}_{datetime} still resolve.
		datetime: `${formattedDate}*`,
		time: "*",
		// Date-keyword lookups intentionally match every export type/format.
		type: "*",
		format: "*",
	};
}

export function renderDateTemplate(
	template: string,
	d: Date,
	dateFormat = "YYYY-MM-DD",
	unknownTokenReplacement?: string,
): string {
	const tokens = dateTemplateTokens(d, dateFormat);
	return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => {
		const value = tokens[name];
		if (value !== undefined) return value;
		return unknownTokenReplacement ?? match;
	});
}

export function applyDateToPattern(
	pattern: string,
	formattedDateOrDate: string | Date,
	dateFormat = "YYYY-MM-DD",
): string {
	if (formattedDateOrDate instanceof Date) {
		const tokens = dateTemplateTokens(formattedDateOrDate, dateFormat);
		let sawDateToken = false;
		const resolved = pattern.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => {
			const value = tokens[name];
			if (value === undefined) return match;
			if (name !== "type" && name !== "format" && name !== "time") {
				sawDateToken = true;
			}
			return value;
		});
		if (!sawDateToken) return `${resolved}*${tokens.date}*`;
		return resolved;
	}

	const formattedDate = formattedDateOrDate;
	if (!pattern.includes("{date}")) return `${pattern}*${formattedDate}*`;
	return pattern.replace(/\{date\}/g, formattedDate);
}

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function shiftDays(d: Date, by: number): Date {
	const out = new Date(d);
	out.setDate(out.getDate() + by);
	return out;
}

function rangeOfDays(today: Date, n: number): Date[] {
	const out: Date[] = [];
	for (let i = 0; i < n; i++) out.push(shiftDays(today, -i));
	return out;
}

function isoWeekNumber(date: Date): number {
	const weekDate = new Date(Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	));
	const day = weekDate.getUTCDay() || 7;
	weekDate.setUTCDate(weekDate.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
	return Math.ceil(((weekDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
