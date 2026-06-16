import { App, PluginSettingTab, setIcon, Setting } from "obsidian";
import OpenCodeChatPlugin from "../plugin";
import { ReasoningEffort } from "../shared/types";
import { effortLabel, formatError, selectedModelValue, updateEffortFavorite, updateStringFavorite } from "./helpers";

export class OpenCodeChatSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: OpenCodeChatPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "OpenCode Chat" });

    const selectedModel = `${this.plugin.settings.providerID}/${this.plugin.settings.modelID}`;

    this.renderServerStatusSetting(containerEl);

    new Setting(containerEl)
      .setName("デフォルトモデル")
      .setDesc("接続済みの opencode プロバイダーのモデルだけを表示します。")
      .addDropdown(async (dropdown) => {
        dropdown.addOption("", "opencode のデフォルトモデルを使用");
        dropdown.setValue(selectedModel === "/" ? "" : selectedModel);

        try {
          const models = await this.plugin.listModels();
          for (const model of models) {
            dropdown.addOption(`${model.providerID}/${model.modelID}`, model.label);
          }
          dropdown.setValue(selectedModel === "/" ? "" : selectedModel);
        } catch {
          if (selectedModel !== "/") {
            dropdown.addOption(selectedModel, selectedModel);
            dropdown.setValue(selectedModel);
          }
        }

        dropdown.onChange(async (value) => {
          const separator = value.indexOf("/");
          this.plugin.settings.providerID = separator >= 0 ? value.slice(0, separator) : "";
          this.plugin.settings.modelID = separator >= 0 ? value.slice(separator + 1) : "";
          await this.plugin.saveSettings();
        });
      });

    this.renderFavoriteModelSettings(containerEl);
    this.renderFavoriteEffortSettings(containerEl);
  }

  private renderServerStatusSetting(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName("サーバーステータス")
      .setDesc("opencode サーバーを確認中...")
      .addButton((button) =>
        button.setButtonText("再読み込み").onClick(async () => {
          this.plugin.resetServer();
          await this.plugin.refreshModels();
          this.display();
        }),
      );

    void this.populateServerStatus(setting);
  }

  private async populateServerStatus(setting: Setting): Promise<void> {
    try {
      setting.setDesc(await this.plugin.serverStatusText());
    } catch (error) {
      setting.setDesc(`接続できません: ${formatError(error)}`);
    }
  }

  private renderFavoriteModelSettings(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName("お気に入りチャットモデル")
      .setDesc("お気に入りはチャットのモデルセレクタ上部に表示されます。");
    setting.settingEl.addClass("opencode-chat-settings-section");

    const listEl = setting.settingEl.createDiv({ cls: "opencode-chat-settings-list" });
    listEl.createDiv({ cls: "opencode-chat-settings-loading", text: "モデルを読み込み中..." });
    void this.populateFavoriteModelSettings(listEl);
  }

  private async populateFavoriteModelSettings(listEl: HTMLElement): Promise<void> {
    listEl.empty();

    try {
      const models = await this.plugin.listModels();
      if (models.length === 0) {
        listEl.createDiv({ cls: "opencode-chat-settings-empty", text: "接続済みモデルが見つかりません。" });
        return;
      }

      this.renderFavoritePicker(listEl, models.map((model) => ({
        label: model.label,
        value: selectedModelValue(model.providerID, model.modelID),
      })), this.plugin.settings.visibleModelIDs, async (value, enabled) => {
        this.plugin.settings.visibleModelIDs = updateStringFavorite(this.plugin.settings.visibleModelIDs, value, enabled);
        await this.plugin.saveSettings();
      });
    } catch (error) {
      listEl.createDiv({
        cls: "opencode-chat-settings-empty",
        text: `モデルを読み込めません: ${formatError(error)}`,
      });
    }
  }

  private renderFavoriteEffortSettings(containerEl: HTMLElement): void {
    const setting = new Setting(containerEl)
      .setName("お気に入りチャットエフォート")
      .setDesc("お気に入りはモデルごとに保存され、チャットのエフォートセレクタ上部に表示されます。");
    setting.settingEl.addClass("opencode-chat-settings-section");

    const listEl = setting.settingEl.createDiv({ cls: "opencode-chat-settings-list" });
    listEl.createDiv({ cls: "opencode-chat-settings-loading", text: "モデルエフォートを読み込み中..." });
    void this.populateFavoriteEffortSettings(listEl);
  }

  private async populateFavoriteEffortSettings(listEl: HTMLElement): Promise<void> {
    listEl.empty();

    try {
      const models = (await this.plugin.listModels()).filter((model) => model.effortOptions.length > 0);
      if (models.length === 0) {
        listEl.createDiv({ cls: "opencode-chat-settings-empty", text: "モデル固有のエフォート設定が見つかりません。" });
        return;
      }

      for (const model of models) {
        const modelValue = selectedModelValue(model.providerID, model.modelID);
        listEl.createDiv({ cls: "opencode-chat-settings-subheading", text: model.label });
        this.renderFavoritePicker(
          listEl,
          model.effortOptions.map((effort) => ({ label: effortLabel(effort), value: effort })),
          this.favoriteEffortsForModel(modelValue),
          async (value, enabled) => {
            this.setFavoriteEffortsForModel(
              modelValue,
              updateEffortFavorite(this.favoriteEffortsForModel(modelValue), value, enabled),
            );
            await this.plugin.saveSettings();
          },
        );
      }
    } catch (error) {
      listEl.createDiv({
        cls: "opencode-chat-settings-empty",
        text: `モデルエフォートを読み込めません: ${formatError(error)}`,
      });
    }
  }

  private favoriteEffortsForModel(modelValue: string): ReasoningEffort[] {
    return this.plugin.settings.favoriteReasoningEffortsByModel[modelValue] ?? [];
  }

  private setFavoriteEffortsForModel(modelValue: string, values: ReasoningEffort[]): void {
    if (values.length === 0) {
      delete this.plugin.settings.favoriteReasoningEffortsByModel[modelValue];
      return;
    }

    this.plugin.settings.favoriteReasoningEffortsByModel[modelValue] = values;
  }

  private renderFavoritePicker(
    containerEl: HTMLElement,
    options: Array<{ label: string; value: string }>,
    favoriteValues: string[],
    onToggleFavorite: (value: string, enabled: boolean) => Promise<void>,
  ): void {
    const menuEl = containerEl.createDiv({ cls: "opencode-chat-picker-menu opencode-chat-settings-picker" });
    const favoriteSet = new Set(favoriteValues);
    const favoriteOptions = options.filter((option) => favoriteSet.has(option.value));
    const allOptions = options.filter((option) => !favoriteSet.has(option.value));

    if (favoriteOptions.length > 0) {
      this.renderFavoritePickerSection(menuEl, "お気に入り", favoriteOptions, favoriteValues, onToggleFavorite);
    }
    if (allOptions.length > 0) {
      this.renderFavoritePickerSection(menuEl, "すべてのオプション", allOptions, favoriteValues, onToggleFavorite);
    }
  }

  private renderFavoritePickerSection(
    menuEl: HTMLElement,
    title: string,
    options: Array<{ label: string; value: string }>,
    favoriteValues: string[],
    onToggleFavorite: (value: string, enabled: boolean) => Promise<void>,
  ): void {
    menuEl.createDiv({ cls: "opencode-chat-picker-section", text: title });

    for (const option of options) {
      const itemEl = menuEl.createDiv({ cls: "opencode-chat-picker-item" });
      itemEl.createSpan({ cls: "opencode-chat-picker-item-label", text: option.label });
      itemEl.createSpan({ cls: "opencode-chat-picker-item-icon is-empty" });

      const favoriteButtonEl = itemEl.createEl("button", {
        cls: "opencode-chat-picker-favorite",
        attr: { type: "button", "aria-label": "お気に入りを切り替え" },
      });
      const isFavorite = favoriteValues.includes(option.value);
      setIcon(favoriteButtonEl, "star");
      favoriteButtonEl.toggleClass("is-favorite", isFavorite);
      favoriteButtonEl.addEventListener("click", async () => {
        await onToggleFavorite(option.value, !isFavorite);
        this.display();
      });
    }
  }
}
