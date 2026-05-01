import { Plugin } from "obsidian";
import { parseBlockConfig } from "./parser";
import { MapRenderChild } from "./render/map-block";
import {
	DEFAULT_SETTINGS,
	findProviderByUrl,
	IsoMeSettings,
	IsoMeSettingTab,
	LEGACY_OSM_TILE_URL,
} from "./settings";

export default class IsoMeMapsPlugin extends Plugin {
	settings: IsoMeSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor("iso-me", (source, el, ctx) => {
			const cfg = parseBlockConfig(source);
			const child = new MapRenderChild(el, this.app, this.settings, cfg, ctx);
			ctx.addChild(child);
		});

		this.addSettingTab(new IsoMeSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<IsoMeSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
		let dirty = false;
		// Migrate installs that saved the legacy OSM tile URL — desktop Obsidian
		// gets 403'd by OSM's referer policy, so swap to the new default.
		if (this.settings.tileUrl === LEGACY_OSM_TILE_URL) {
			this.settings.tileUrl = DEFAULT_SETTINGS.tileUrl;
			this.settings.tileAttribution = DEFAULT_SETTINGS.tileAttribution;
			this.settings.tileProvider = DEFAULT_SETTINGS.tileProvider;
			dirty = true;
		}
		// Pre-dropdown installs have no tileProvider; infer it from the saved URL.
		if (!data || data.tileProvider === undefined) {
			const match = findProviderByUrl(this.settings.tileUrl);
			this.settings.tileProvider = match ? match.id : "custom";
			dirty = true;
		}
		if (dirty) await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
