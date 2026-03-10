import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

export interface AppConfig {
  app_name: string;
  api_key: string;
  api_secret: string;
  scopes: string;
}

export function getAppsDir(): string {
  const base =
    process.env.SHOPIFY_MCP_DATA_DIR ?? join(process.env.HOME ?? "~", ".shopify-mcp");
  return join(base, "apps");
}

export class AppConfigStore {
  private dir: string;

  constructor(baseDir?: string) {
    this.dir = baseDir ?? getAppsDir();
  }

  async get(appName: string): Promise<AppConfig | null> {
    try {
      const data = await readFile(join(this.dir, `${appName}.json`), "utf-8");
      return JSON.parse(data) as AppConfig;
    } catch {
      return null;
    }
  }

  async set(config: AppConfig): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(
      join(this.dir, `${config.app_name}.json`),
      JSON.stringify(config, null, 2),
      "utf-8"
    );
  }

  async list(): Promise<AppConfig[]> {
    try {
      await mkdir(this.dir, { recursive: true });
      const files = await readdir(this.dir);
      const configs: AppConfig[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const data = await readFile(join(this.dir, file), "utf-8");
          configs.push(JSON.parse(data) as AppConfig);
        } catch {
          // skip corrupt
        }
      }
      return configs;
    } catch {
      return [];
    }
  }

  async delete(appName: string): Promise<boolean> {
    try {
      await unlink(join(this.dir, `${appName}.json`));
      return true;
    } catch {
      return false;
    }
  }
}
