import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface ServerEntry {
  name: string;
  packageName: string;
  cwd: string;
  command: string[];
  tags: string[];
}

const PACKAGES_DIR = resolve(import.meta.dir, "../../");

/**
 * Scan workspace packages for MCP-capable servers.
 * A package qualifies if its package.json has a "mcp" script.
 */
export async function discoverServers(): Promise<ServerEntry[]> {
  const entries: ServerEntry[] = [];
  const dirs = await readdir(PACKAGES_DIR, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory() || dir.name === "orchestrator" || dir.name === "core") continue;

    const pkgPath = join(PACKAGES_DIR, dir.name, "package.json");
    const pkgFile = Bun.file(pkgPath);

    if (!(await pkgFile.exists())) continue;

    const pkg = (await pkgFile.json()) as {
      name?: string;
      scripts?: Record<string, string>;
    };

    if (!pkg.scripts?.mcp) continue;

    const shortName = dir.name;
    const cwd = join(PACKAGES_DIR, dir.name);

    entries.push({
      name: shortName,
      packageName: pkg.name ?? shortName,
      cwd,
      command: ["bun", "run", "src/mcp-server.ts"],
      tags: inferTags(shortName),
    });
  }

  return entries;
}

function inferTags(name: string): string[] {
  const tags: string[] = [];
  if (name.includes("shopify")) tags.push("shopify", "ecommerce");
  if (name.includes("recharge")) tags.push("recharge", "subscriptions", "ecommerce");
  if (name.includes("database") || name.includes("db")) tags.push("database", "sql");
  if (tags.length === 0) tags.push(name);
  return tags;
}
