import { BlockConfig } from "./types";

const BOOL_KEYS = new Set(["show_visits", "show_routes", "show_heatmap", "show_outliers"]);
const NUMBER_KEYS = new Set(["zoom", "height"]);

function parseCenter(value: string): [number, number] | undefined {
	const m = value.match(/^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/);
	if (!m) return undefined;
	const lat = Number(m[1]);
	const lon = Number(m[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
	return [lat, lon];
}

function parseBool(value: string): boolean | undefined {
	const v = value.toLowerCase();
	if (v === "true" || v === "yes" || v === "on" || v === "1") return true;
	if (v === "false" || v === "no" || v === "off" || v === "0") return false;
	return undefined;
}

export function parseBlockConfig(source: string): BlockConfig {
	const cfg: BlockConfig = {};
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const m = line.match(/^([a-z_-]+)\s*:\s*(.+)$/i);
		if (!m) continue;
		const key = m[1]!.toLowerCase();
		const value = m[2]!.trim().replace(/^["'](.*)["']$/, "$1");

		if (key === "source") {
			cfg.source = value;
		} else if (key === "title") {
			cfg.title = value;
		} else if (key === "center") {
			const c = parseCenter(value);
			if (c) cfg.center = c;
		} else if (NUMBER_KEYS.has(key)) {
			const n = Number(value);
			if (Number.isFinite(n)) {
				if (key === "zoom") cfg.zoom = n;
				else if (key === "height") cfg.height = n;
			}
		} else if (BOOL_KEYS.has(key)) {
			const b = parseBool(value);
			if (b !== undefined) {
				if (key === "show_visits") cfg.show_visits = b;
				else if (key === "show_routes") cfg.show_routes = b;
				else if (key === "show_heatmap") cfg.show_heatmap = b;
				else if (key === "show_outliers") cfg.show_outliers = b;
			}
		}
	}
	return cfg;
}
