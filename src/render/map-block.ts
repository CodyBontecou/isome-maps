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
	private resizeObserver: ResizeObserver | null = null;
	private intersectionObserver: IntersectionObserver | null = null;
	private layoutRefreshRaf: number | null = null;
	private layoutRefreshTimers: number[] = [];

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
		this.disconnectLayoutWatchers();
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

		if (this.cfg.show_stats ?? false) {
			// Render stats bar above the map (non-critical — swallow errors gracefully)
			try {
				const stats = computeStats(data);
				renderStatsBar(this.containerEl, stats);
			} catch {
				// Stats bar is best-effort; never block the map.
			}
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

		this.dynamicLayers = L.layerGroup().addTo(map);

		this.applyFilter();

		this.installLayoutWatchers(mapEl);
		this.scheduleInitialLayoutRefresh();
	}

	private installLayoutWatchers(mapEl: HTMLElement): void {
		this.disconnectLayoutWatchers();

		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => {
				this.queueLayoutRefresh();
			});
			this.resizeObserver.observe(mapEl);
			this.resizeObserver.observe(this.containerEl);
		}

		if (typeof IntersectionObserver !== "undefined") {
			this.intersectionObserver = new IntersectionObserver((entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					this.queueLayoutRefresh();
				}
			});
			this.intersectionObserver.observe(mapEl);
		}

		this.registerDomEvent(window, "resize", () => {
			this.queueLayoutRefresh();
		});
	}

	private scheduleInitialLayoutRefresh(): void {
		// Obsidian reading mode can finish code-block post-processing before the
		// preview pane has reached its final width/visibility. Leaflet caches that
		// early size, leaving only the top-left tiles painted until a later edit-mode
		// toggle forces a reflow. Re-check for a short window so maps recover once
		// the note, scroll container, and any surrounding callouts/layout settle.
		this.queueLayoutRefresh();
		for (const delay of [50, 150, 300, 600, 1000]) {
			const timer = window.setTimeout(() => {
				this.queueLayoutRefresh();
			}, delay);
			this.layoutRefreshTimers.push(timer);
		}
	}

	private queueLayoutRefresh(): void {
		if (!this.map || this.layoutRefreshRaf !== null) return;

		this.layoutRefreshRaf = window.requestAnimationFrame(() => {
			this.layoutRefreshRaf = null;
			this.refreshMapLayout();
		});
	}

	private refreshMapLayout(): void {
		const map = this.map;
		if (!map) return;

		if (!this.hasUsableMapSize(map)) return;

		map.invalidateSize({ pan: false, debounceMoveend: true });

		// If the initial bounds fit was attempted while Obsidian had the map in a
		// hidden/zero-sized layout, retry it once the container becomes measurable.
		if (!this.hasFitInitial) {
			this.applyFilter();
		}
	}

	private hasUsableMapSize(map: L.Map): boolean {
		const rect = map.getContainer().getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}

	private disconnectLayoutWatchers(): void {
		if (this.layoutRefreshRaf !== null) {
			window.cancelAnimationFrame(this.layoutRefreshRaf);
			this.layoutRefreshRaf = null;
		}
		for (const timer of this.layoutRefreshTimers) {
			window.clearTimeout(timer);
		}
		this.layoutRefreshTimers = [];

		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.intersectionObserver?.disconnect();
		this.intersectionObserver = null;
	}

	private applyFilter(): void {
		const map = this.map;
		const target = this.dynamicLayers;
		if (!map || !target || !this.fullData) return;

		try {
			target.clearLayers();

			const filtered = filterData(this.fullData, this.filter);

			const showVisits = this.cfg.show_visits ?? this.settings.showVisitsByDefault;
			const showRoutes = this.cfg.show_routes ?? this.settings.showRoutesByDefault;
			const showOutliers = this.settings.showOutliersByDefault;

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

			if (showOutliers && outlierPoints.length > 0) {
				bounds.push(
					...renderOutlierMarkers(target, outlierPoints, this.settings.outlierColor),
				);
			}

			if (bounds.length === 0 || this.cfg.auto_fit === false) {
				if (!this.hasFitInitial) {
					const center = this.cfg.center ?? this.settings.defaultCenter;
					map.setView(center, this.cfg.zoom ?? this.settings.defaultZoom);
					this.hasFitInitial = true;
				}
				return;
			}

			if (!this.hasUsableMapSize(map)) {
				// Leaflet needs a real container size to calculate a bounds-based zoom.
				// Obsidian can render post-processors before the pane is visible, so leave
				// the initial fit pending for the layout watcher instead of falling back to
				// the configured/default home center.
				return;
			}

			if (bounds.length === 1) {
				map.setView(bounds[0], this.cfg.zoom ?? 14);
			} else {
				map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
			}
			this.hasFitInitial = true;
		} catch {
			// Layer rendering is best-effort; show at least the basemap.
			if (!this.hasFitInitial) {
				map.setView(
					this.cfg.center ?? this.settings.defaultCenter,
					this.cfg.zoom ?? this.settings.defaultZoom,
				);
				this.hasFitInitial = true;
			}
		}
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
