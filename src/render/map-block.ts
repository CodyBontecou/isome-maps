import * as L from "leaflet";
import { App, MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { DataLoadError, loadExports } from "../data-loader";
import { IsoMeSettings } from "../settings";
import { BlockConfig, ExportShape } from "../types";
import { renderHeatLayer } from "./heatmap";
import { renderOutlierMarkers } from "./outliers";
import { renderRoutePolyline } from "./routes";
import { renderVisitMarkers } from "./visits";

export class MapRenderChild extends MarkdownRenderChild {
	private map: L.Map | null = null;

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
			data = await loadExports(this.app, sources);
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

		const showVisits = this.cfg.show_visits ?? this.settings.showVisitsByDefault;
		const showRoutes = this.cfg.show_routes ?? this.settings.showRoutesByDefault;
		const showHeatmap = this.cfg.show_heatmap ?? this.settings.showHeatmapByDefault;
		const showOutliers = this.cfg.show_outliers ?? this.settings.showOutliersByDefault;

		const visits = showVisits && data.visits ? data.visits : [];
		const allPoints = data.points ?? [];
		const cleanPoints = allPoints.filter((p) => !p.isOutlier);
		const outlierPoints = allPoints.filter((p) => p.isOutlier);

		if (visits.length === 0 && allPoints.length === 0) {
			this.renderEmpty("Export contains no visits or location points.");
			return;
		}

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

		const bounds: L.LatLngTuple[] = [];

		if (visits.length > 0) {
			bounds.push(...renderVisitMarkers(map, visits, this.settings.markerColor));
		}

		if (showRoutes && cleanPoints.length > 0) {
			bounds.push(...renderRoutePolyline(map, cleanPoints, this.settings.routeColor));
		}

		if (showHeatmap && cleanPoints.length > 0) {
			renderHeatLayer(
				map,
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
				...renderOutlierMarkers(map, outlierPoints, this.settings.outlierColor),
			);
		}

		if (bounds.length === 0) {
			const center = this.cfg.center ?? this.settings.defaultCenter;
			map.setView(center, this.cfg.zoom ?? this.settings.defaultZoom);
		} else if (bounds.length === 1) {
			map.setView(bounds[0]!, this.cfg.zoom ?? 14);
		} else {
			map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
			if (this.cfg.zoom != null) map.setZoom(this.cfg.zoom);
		}

		// Reading-view 0-height race fix: re-measure after layout settles.
		requestAnimationFrame(() => {
			this.map?.invalidateSize();
		});
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
