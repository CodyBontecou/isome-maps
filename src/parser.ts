import { BlockConfig } from "./types";

const BOOL_KEYS = new Set([
	"show_visits",
	"show_routes",
	"show_outliers",
	"show_stats",
	"interactive",
]);
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

function unquote(value: string): string {
	return value.replace(/^["'](.*)["']$/, "$1");
}

function splitListValue(value: string): string[] {
	let inner = value.trim();
	if (inner.startsWith("[") && inner.endsWith("]")) {
		inner = inner.slice(1, -1);
	}
	return inner
		.split(",")
		.map((s) => unquote(s.trim()))
		.filter((s) => s.length > 0);
}

export function parseBlockConfig(source: string): BlockConfig {
	const cfg: BlockConfig = {};
	const lines = source.split(/\r?\n/);
	let i = 0;

	while (i < lines.length) {
		const rawLine = lines[i];
		const line = rawLine.trim();
		i++;

		if (!line || line.startsWith("#")) continue;
		const m = line.match(/^([a-z_-]+)\s*:\s*(.*)$/i);
		if (!m) continue;
		const key = m[1].toLowerCase();
		const rawValue = m[2].trim();
		const value = unquote(rawValue);

		if (key === "sources") {
			const collected: string[] = [];
			if (rawValue.length > 0) {
				collected.push(...splitListValue(rawValue));
			} else {
				while (i < lines.length) {
					const itemMatch = lines[i].match(/^\s*-\s+(.+?)\s*$/);
					if (!itemMatch) break;
					collected.push(unquote(itemMatch[1]));
					i++;
				}
			}
			if (collected.length > 0) cfg.sources = collected;
			continue;
		}

		if (rawValue.length === 0) continue;

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
				else if (key === "show_outliers") cfg.show_outliers = b;
				else if (key === "show_stats") cfg.show_stats = b;
				else if (key === "interactive") cfg.interactive = b;
			}
		}
	}
	return cfg;
}
