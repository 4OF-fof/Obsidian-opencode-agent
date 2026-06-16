import { lstatSync, readlinkSync } from "node:fs";
import { lstat, mkdir, readlink, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { Menu, Notice, Plugin, TAbstractFile, TFolder } from "obsidian";
import { VaultBasePathProvider } from "./types";

export class SkillInstaller {
  constructor(
    private readonly plugin: Plugin,
    private readonly vaultBasePath: VaultBasePathProvider,
    private readonly onInstall?: () => void,
  ) {}

  onload(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("file-menu", (menu, file) => {
        this.addInstallMenuItem(menu, file);
      }),
    );
  }

  private addInstallMenuItem(menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFolder) || !this.folderHasDirectSkillFile(file)) {
      return;
    }

    if (this.isSkillInstalled(file)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle("SKILLをインストール")
        .setIcon("download")
        .onClick(() => {
          void this.installSkill(file);
        });
    });
  }

  private folderHasDirectSkillFile(folder: TFolder): boolean {
    return folder.children.some((child) => child.name === "SKILL.md");
  }

  private isSkillInstalled(folder: TFolder): boolean {
    const vaultBasePath = this.vaultBasePath();
    if (!vaultBasePath) {
      return false;
    }

    const sourcePath = resolve(vaultBasePath, folder.path);
    const linkPath = join(vaultBasePath, ".agents", "skills", folder.name);
    return this.readExistingSkillLinkSync(linkPath) === sourcePath;
  }

  private async installSkill(folder: TFolder): Promise<void> {
    const vaultBasePath = this.vaultBasePath();
    if (!vaultBasePath) {
      new Notice("Skillのインストールにはローカル保管庫が必要です。");
      return;
    }

    const sourcePath = resolve(vaultBasePath, folder.path);
    const skillsDir = join(vaultBasePath, ".agents", "skills");
    const linkPath = join(skillsDir, folder.name);

    try {
      await mkdir(skillsDir, { recursive: true });

      const existingLink = await this.readExistingSkillLink(linkPath);
      if (existingLink) {
        if (existingLink === sourcePath) {
          new Notice(`Skill「${folder.name}」はすでにインストール済みです。`);
        } else {
          new Notice(
            `「${folder.name}」という名前のSkillは .agents/skills にすでに存在します。`,
          );
        }
        return;
      }

      const relativeTarget = relative(dirname(linkPath), sourcePath);
      await symlink(relativeTarget, linkPath, "dir");
      new Notice(`Skill「${folder.name}」をインストールしました。`);
      this.onInstall?.();
    } catch (error) {
      console.error("Failed to install skill", error);
      new Notice(`Skill「${folder.name}」をインストールできませんでした。`);
    }
  }

  private async readExistingSkillLink(
    linkPath: string,
  ): Promise<string | null> {
    try {
      const stat = await lstat(linkPath);
      if (!stat.isSymbolicLink()) {
        return linkPath;
      }

      const target = await readlink(linkPath);
      return resolve(dirname(linkPath), target);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }

  private readExistingSkillLinkSync(linkPath: string): string | null {
    try {
      const stat = lstatSync(linkPath);
      if (!stat.isSymbolicLink()) {
        return linkPath;
      }

      const target = readlinkSync(linkPath);
      return resolve(dirname(linkPath), target);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }

      throw error;
    }
  }
}
