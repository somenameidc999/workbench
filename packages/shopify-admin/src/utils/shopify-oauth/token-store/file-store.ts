import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { TokenStore } from "./interface.js";
import type { StoredToken } from "../types.js";

function getDataDir(): string {
  const base =
    process.env.SHOPIFY_MCP_DATA_DIR ?? join(process.env.HOME ?? "~", ".shopify-mcp");
  return join(base, "tokens");
}

export class FileTokenStore implements TokenStore {
  private dir: string;

  constructor(baseDir?: string) {
    this.dir = baseDir ?? getDataDir();
  }

  private shopToFilename(shop: string, tokenType: StoredToken["token_type"]): string {
    return `${shop.replace(/\./g, "_")}__${tokenType}.json`;
  }

  async get(shop: string, tokenType: StoredToken["token_type"] = "offline"): Promise<StoredToken | null> {
    try {
      const filepath = join(this.dir, this.shopToFilename(shop, tokenType));
      const data = await readFile(filepath, "utf-8");
      return JSON.parse(data) as StoredToken;
    } catch {
      if (tokenType === "offline") {
        try {
          // Backward compatibility for older offline-token filename format.
          const legacyPath = join(this.dir, `${shop.replace(/\./g, "_")}.json`);
          const data = await readFile(legacyPath, "utf-8");
          return JSON.parse(data) as StoredToken;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  async set(token: StoredToken): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const filepath = join(this.dir, this.shopToFilename(token.shop, token.token_type));
    await writeFile(filepath, JSON.stringify(token, null, 2), "utf-8");
  }

  async delete(shop: string, tokenType: StoredToken["token_type"] = "offline"): Promise<boolean> {
    try {
      await unlink(join(this.dir, this.shopToFilename(shop, tokenType)));
      return true;
    } catch {
      if (tokenType === "offline") {
        try {
          await unlink(join(this.dir, `${shop.replace(/\./g, "_")}.json`));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async list(appName?: string): Promise<StoredToken[]> {
    try {
      await mkdir(this.dir, { recursive: true });
      const files = await readdir(this.dir);
      const tokens: StoredToken[] = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        try {
          const data = await readFile(join(this.dir, file), "utf-8");
          const token = JSON.parse(data) as StoredToken;
          if (appName && token.app_name !== appName) continue;
          tokens.push(token);
        } catch {
          // Skip corrupt files
        }
      }

      return tokens;
    } catch {
      return [];
    }
  }
}
