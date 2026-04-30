declare module "leaflet.heat" {
	const _default: unknown;
	export default _default;
}

import "leaflet";

declare module "leaflet" {
	interface HeatLayerOptions {
		minOpacity?: number;
		maxZoom?: number;
		max?: number;
		radius?: number;
		blur?: number;
		gradient?: { [key: number]: string };
	}

	interface HeatLayer extends Layer {
		setLatLngs(latlngs: Array<[number, number, number?]>): this;
		addLatLng(latlng: [number, number, number?]): this;
		setOptions(options: HeatLayerOptions): this;
		redraw(): this;
	}

	function heatLayer(
		latlngs: Array<[number, number, number?]>,
		options?: HeatLayerOptions,
	): HeatLayer;
}
