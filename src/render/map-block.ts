import * as L from "leaflet";
import { App, MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { DataLoadError, loadExports } from "../data-loader";
import { IsoMeSettings } from "../settings";
import { BlockConfig, ExportShape } from "../types";
import {
	buildControls,
	collectDays,
	DEFAULT_FILTER,
	filterData,
	FilterState,
} from "./controls";
import { renderHeatLayer } from "./heatmap";
import { renderOutlierMarkers } from "./outliers";
import { renderRoutePolyline } from "./routes";
import { computeStats, renderStatsBar } from "./stats-bar";
import { renderVisitMarkers } from "./visits";

export class MapRenderChild extends MarkdownRenderChild {
	private map: L.Map | null = null;
	private dynamicLayers: L.LayerGroup | null = null;
	private fullData: ExportShape | null = null;
	private filter: FilterState = { ...DEFAULT_FILTER };
	private hasFitInitial = false;

	constructor(
		containerEl: HTMLElement,
		private app: App,
		private settings: IsoMeSettings,
		private cfg: BlockConfig,
		_ctx: MarkdownPostProcessorContext,
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass("iso-me-block");
		void this.render();
	}

	onunload(): void {
		if (this.map) {
			this.map.remove();
			this.map = null;
		}
		this.dynamicLayers = null;
		this.containerEl.empty();
	}

	private async render(): Promise<void> {
		this.containerEl.empty();

		if (this.cfg.title) {
			this.containerEl.createEl("h4", {
				text: this.cfg.title,
				cls: "iso-me-title",
			});
		}

		const sources: string[] = [];
		if (this.cfg.source) sources.push(this.cfg.source);
		if (this.cfg.sources) sources.push(...this.cfg.sources);

		if (sources.length === 0) {
			this.renderError(
				"Missing required `source:` (or `sources:`) key. Point it at an iso.me export file (.json, .csv, or .md).",
			);
			return;
		}

		let data: ExportShape;
		try {
			data = await loadExports(this.app, sources, this.settings);
		} catch (e) {
			const msg =
				e instanceof DataLoadError
					? e.message
					: e instanceof Error
						? e.message
						: String(e);
			this.renderError(msg);
			return;
		}

		if ((data.visits?.length ?? 0) === 0 && (data.points?.length ?? 0) === 0) {
			this.renderEmpty("Export contains no visits or location points.");
			return;
		}

		this.fullData = data;
		this.filter = { ...DEFAULT_FILTER };

		if (this.cfg.interactive) {
			const days = collectDays(data);
			buildControls(this.containerEl, days, this.filter, (state) => {
				this.filter = state;
				this.applyFilter();
			}, data.detectedFormat);
		}

		// Render stats bar above the map
		const stats = computeStats(data);
		renderStatsBar(this.containerEl, stats);

		const mapEl = this.containerEl.createDiv({ cls: "iso-me-map" });
		mapEl.style.height = `${this.cfg.height ?? this.settings.defaultHeight}px`;

		const map = L.map(mapEl, {
			zoomControl: true,
			attributionControl: true,
			scrollWheelZoom: false,
		});
		this.map = map;

		L.tileLayer(this.settings.tileUrl, {
			attribution: this.settings.tileAttribution,
			maxZoom: 19,
		}).addTo(map);

		this.dynamicLayers = L.layerGroup().addTo(map);

		this.applyFilter();

		// Reading-view 0-height race fix: re-measure after layout settles.
		requestAnimationFrame(() => {
			this.map?.invalidateSize();
		});
	}

	private applyFilter(): void {
		const map = this.map;
		const target = this.dynamicLayers;
		if (!map || !target || !this.fullData) return;

		target.clearLayers();

		const filtered = filterData(this.fullData, this.filter);

		const showVisits = this.cfg.show_visits ?? this.settings.showVisitsByDefault;
		const showRoutes = this.cfg.show_routes ?? this.settings.showRoutesByDefault;
		const showHeatmap = this.cfg.show_heatmap ?? this.settings.showHeatmapByDefault;
		const showOutliers =
			this.cfg.show_outliers ?? this.settings.showOutliersByDefault;

		const visits = showVisits && filtered.visits ? filtered.visits : [];
		const allPoints = filtered.points ?? [];
		const cleanPoints = allPoints.filter((p) => !p.isOutlier);
		const outlierPoints = allPoints.filter((p) => p.isOutlier);

		const bounds: L.LatLngTuple[] = [];

		if (visits.length > 0) {
			bounds.push(...renderVisitMarkers(target, visits, this.settings.markerColor));
		}

		if (showRoutes && cleanPoints.length > 0) {
			bounds.push(
				...renderRoutePolyline(target, cleanPoints, this.settings.routeColor),
			);
		}

		if (showHeatmap && cleanPoints.length > 0) {
			renderHeatLayer(
				target,
				cleanPoints,
				this.settings.heatRadius,
				this.settings.heatBlur,
			);
			if (!showRoutes) {
				for (const p of cleanPoints) bounds.push([p.latitude, p.longitude]);
			}
		}

		if (showOutliers && outlierPoints.length > 0) {
			bounds.push(
				...renderOutlierMarkers(target, outlierPoints, this.settings.outlierColor),
			);
		}

		if (bounds.length === 0) {
			if (!this.hasFitInitial) {
				const center = this.cfg.center ?? this.settings.defaultCenter;
				map.setView(center, this.cfg.zoom ?? this.settings.defaultZoom);
				this.hasFitInitial = true;
			}
			return;
		}

		if (bounds.length === 1) {
			map.setView(bounds[0]!, this.cfg.zoom ?? 14);
		} else {
			map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
			if (!this.hasFitInitial && this.cfg.zoom != null) {
				map.setZoom(this.cfg.zoom);
			}
		}
		this.hasFitInitial = true;
	}

	private renderError(message: string): void {
		this.containerEl.createDiv({
			cls: "iso-me-error",
			text: `iso.me: ${message}`,
		});
	}

	private renderEmpty(message: string): void {
		this.containerEl.createDiv({
			cls: "iso-me-empty",
			text: message,
		});
	}
}
