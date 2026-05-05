import { DetectedFormat, ExportShape } from "../types";
import { formatClass, formatLabel } from "./stats-bar";

export interface FilterState {
	day: string | null;
	timeStartMin: number;
	timeEndMin: number;
}

export const DEFAULT_FILTER: FilterState = {
	day: null,
	timeStartMin: 0,
	timeEndMin: 1440,
};

function isoToLocalDay(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${dd}`;
}

function fmtDayLabel(day: string): string {
	const [y, m, d] = day.split("-").map(Number) as [number, number, number];
	const dt = new Date(y, m - 1, d);
	if (Number.isNaN(dt.getTime())) return day;
	return dt.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function fmtTime(min: number): string {
	if (min >= 1440) return "End of day";
	if (min <= 0) return "Start of day";
	const h = Math.floor(min / 60);
	const m = min % 60;
	const period = h < 12 ? "AM" : "PM";
	const h12 = ((h + 11) % 12) + 1;
	return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function collectDays(data: ExportShape): string[] {
	const days = new Set<string>();
	for (const v of data.visits ?? []) {
		const d = isoToLocalDay(v.arrivedAt);
		if (d) days.add(d);
	}
	for (const p of data.points ?? []) {
		const d = isoToLocalDay(p.timestamp);
		if (d) days.add(d);
	}
	return [...days].sort();
}

export function filterData(data: ExportShape, filter: FilterState): ExportShape {
	const matches = (iso: string): boolean => {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return false;
		if (filter.day) {
			if (isoToLocalDay(iso) !== filter.day) return false;
		}
		const minOfDay = d.getHours() * 60 + d.getMinutes();
		return minOfDay >= filter.timeStartMin && minOfDay <= filter.timeEndMin;
	};

	const visits = data.visits ? data.visits.filter((v) => matches(v.arrivedAt)) : null;
	const points = data.points ? data.points.filter((p) => matches(p.timestamp)) : null;
	return { visits, points, exportDate: data.exportDate, detectedFormat: data.detectedFormat };
}

export function buildControls(
	parent: HTMLElement,
	days: string[],
	initial: FilterState,
	onChange: (state: FilterState) => void,
	detectedFormat?: DetectedFormat,
): HTMLElement {
	const el = parent.createDiv({ cls: "iso-me-controls" });
	const state: FilterState = { ...initial };

	// Format badge
	if (detectedFormat) {
		const badge = el.createSpan({ cls: `iso-me-format-badge ${formatClass(detectedFormat)}` });
		badge.textContent = formatLabel(detectedFormat);
	}

	const dayWrap = el.createDiv({ cls: "iso-me-control" });
	dayWrap.createEl("label", { text: "Day", cls: "iso-me-control-label" });
	const daySelect = dayWrap.createEl("select", { cls: "iso-me-day-select" });
	const allOpt = daySelect.createEl("option", { text: "All days" });
	allOpt.value = "";
	if (state.day === null) allOpt.selected = true;
	for (const d of days) {
		const opt = daySelect.createEl("option", { text: fmtDayLabel(d) });
		opt.value = d;
		if (state.day === d) opt.selected = true;
	}
	daySelect.addEventListener("change", () => {
		state.day = daySelect.value === "" ? null : daySelect.value;
		onChange({ ...state });
	});

	const timeWrap = el.createDiv({ cls: "iso-me-control iso-me-time-control" });
	timeWrap.createEl("label", { text: "Time of day", cls: "iso-me-control-label" });

	const slidersWrap = timeWrap.createDiv({ cls: "iso-me-time-sliders" });

	const startLabel = slidersWrap.createEl("span", {
		cls: "iso-me-time-label",
		text: fmtTime(state.timeStartMin),
	});
	const startInput = slidersWrap.createEl("input", { cls: "iso-me-time-range" });
	startInput.type = "range";
	startInput.min = "0";
	startInput.max = "1440";
	startInput.step = "15";
	startInput.value = String(state.timeStartMin);

	const endInput = slidersWrap.createEl("input", { cls: "iso-me-time-range" });
	endInput.type = "range";
	endInput.min = "0";
	endInput.max = "1440";
	endInput.step = "15";
	endInput.value = String(state.timeEndMin);

	const endLabel = slidersWrap.createEl("span", {
		cls: "iso-me-time-label",
		text: fmtTime(state.timeEndMin),
	});

	startInput.addEventListener("input", () => {
		let v = Number(startInput.value);
		if (v > state.timeEndMin) v = state.timeEndMin;
		state.timeStartMin = v;
		startInput.value = String(v);
		startLabel.textContent = fmtTime(v);
	});
	startInput.addEventListener("change", () => onChange({ ...state }));

	endInput.addEventListener("input", () => {
		let v = Number(endInput.value);
		if (v < state.timeStartMin) v = state.timeStartMin;
		state.timeEndMin = v;
		endInput.value = String(v);
		endLabel.textContent = fmtTime(v);
	});
	endInput.addEventListener("change", () => onChange({ ...state }));

	const reset = el.createEl("button", { text: "Reset", cls: "iso-me-control-reset" });
	reset.type = "button";
	reset.addEventListener("click", () => {
		state.day = null;
		state.timeStartMin = DEFAULT_FILTER.timeStartMin;
		state.timeEndMin = DEFAULT_FILTER.timeEndMin;
		daySelect.value = "";
		startInput.value = String(state.timeStartMin);
		endInput.value = String(state.timeEndMin);
		startLabel.textContent = fmtTime(state.timeStartMin);
		endLabel.textContent = fmtTime(state.timeEndMin);
		onChange({ ...state });
	});

	return el;
}
