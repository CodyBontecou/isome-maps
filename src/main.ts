import { Plugin } from "obsidian";
import { parseBlockConfig } from "./parser";
import { MapRenderChild } from "./render/map-block";
import { DEFAULT_SETTINGS, IsoMeSettings, IsoMeSettingTab } from "./settings";

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
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
