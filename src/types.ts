export interface Visit {
	latitude: number;
	longitude: number;
	arrivedAt: string;
	departedAt?: string | null;
	durationMinutes?: number | null;
	locationName?: string | null;
	address?: string | null;
	notes?: string | null;
}

export interface LocationPoint {
	latitude: number;
	longitude: number;
	timestamp: string;
	timestampUnix?: number;
	altitude?: number | null;
	speed?: number | null;
	course?: number | null;
	horizontalAccuracy?: number | null;
	verticalAccuracy?: number | null;
	isOutlier?: boolean;
}

/** The detected format of an export file. */
export type DetectedFormat = "iso-me-json" | "iso-me-csv" | "iso-me-markdown" | "owntracks" | "overland" | "gpx" | "unknown-json";

export interface ExportShape {
	visits: Visit[] | null;
	points: LocationPoint[] | null;
	exportDate?: string;
	/** The detected export format. Used by the UI to show format badges and stats. */
	detectedFormat?: DetectedFormat;
}

export interface BlockConfig {
	source?: string;
	sources?: string[];
	zoom?: number;
	center?: [number, number];
	height?: number;
	show_visits?: boolean;
	show_routes?: boolean;
	show_stats?: boolean;
	interactive?: boolean;
	title?: string;
}
