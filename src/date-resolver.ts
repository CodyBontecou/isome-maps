const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LAST_N_DAYS_RE = /^last\s+(\d+)\s+days?$/;

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

export function applyDateToPattern(pattern: string, formattedDate: string): string {
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
