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
}

export interface ExportShape {
	visits: Visit[] | null;
	points: LocationPoint[] | null;
	exportDate?: string;
}

export interface BlockConfig {
	source?: string;
	zoom?: number;
	center?: [number, number];
	height?: number;
	show_visits?: boolean;
	show_routes?: boolean;
	show_heatmap?: boolean;
	title?: string;
}
