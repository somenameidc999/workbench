import { loadConfig } from "bunfig";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

/** One store: store id → env var name for domain, "<storeId>-token" → env var name for token */
export type StoreEntry = Record<string, string>;

const CONFIG_NAMES = [
  "workbench.config.ts",
  "workbench.config.js",
  "workbench.config.mjs",
  "workbench.config.cjs",
  ".workbench.config.ts",
  ".workbench.config.js",
];

/** Walk up from dir until we find workbench.config.*; return that directory or null. */
function findConfigDir(dir: string): string | null {
  let current = resolve(dir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      if (existsSync(resolve(current, name))) return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export type WorkbenchConfig = {
  /** Each entry: { "store-a": "SHOPIFY_STORE_A", "store-a-token": "SHOPIFY_STORE_A_TOKEN" } — values are env var names */
  stores: StoreEntry[];
};

const defaultConfig: WorkbenchConfig = {
  stores: [],
};

let cached: WorkbenchConfig | null = null;

export type LoadConfigOptions = {
  /** Directory to search for workbench.config.* (default: process.cwd()) */
  cwd?: string;
  /** Bypass cache and reload from file/env */
  reload?: boolean;
};

function parseStores(entries: StoreEntry[]): Map<string, { domainEnv: string; tokenEnv: string }> {
  const map = new Map<string, { domainEnv: string; tokenEnv: string }>();
  for (const obj of entries) {
    let storeId: string | null = null;
    let domainEnv: string | null = null;
    let tokenEnv: string | null = null;
    for (const [key, value] of Object.entries(obj)) {
      if (key.endsWith("-token")) {
        tokenEnv = value;
      } else {
        storeId = key;
        domainEnv = value;
      }
    }
    if (storeId && domainEnv != null && tokenEnv != null) {
      map.set(storeId, { domainEnv, tokenEnv });
    }
  }
  return map;
}

/** Store entry with name + client_id + client_secret (OAuth / client credentials). Values could be env var names or resolved strings. */
function parseOAuthStores(
  entries: StoreEntry[]
): Map<string, { name: string; clientId: string; clientSecret: string; domain?: string }> {
  const map = new Map<
    string,
    { name: string; clientId: string; clientSecret: string; domain?: string }
  >();
  for (const obj of entries) {
    const name = obj["name"];
    const clientId = obj["client_id"];
    const clientSecret = obj["client_secret"];
    const domain = obj["domain"];
    if (name && clientId && clientSecret) {
      map.set(name, {
        name,
        clientId,
        clientSecret,
        domain,
      });
    }
  }
  return map;
}

/**
 * Load workbench config via bunfig. Config file defines stores array; each entry maps store id and token keys to env var names.
 */
export async function loadWorkbenchConfig(
  options: LoadConfigOptions = {}
): Promise<WorkbenchConfig> {
  if (cached && !options.reload) return cached;
  const cwd =
    options.cwd ?? findConfigDir(process.cwd()) ?? process.cwd();
  const resolved = await loadConfig({
    name: "workbench",
    cwd,
    defaultConfig,
  } as Parameters<typeof loadConfig>[0]);
  cached = resolved as WorkbenchConfig;
  return cached;
}

export type StoreCredentials = {
  domain: string;
  token: string;
};

/**
 * Resolve credentials for a store. Config entry gives env var names; we read process.env[domainEnv] and process.env[tokenEnv].
 */
export async function getStoreCredentials(
  storeId: string,
  options: LoadConfigOptions = {}
): Promise<StoreCredentials> {
  const config = await loadWorkbenchConfig(options);
  const parsed = parseStores(config.stores);
  const entry = parsed.get(storeId);
  if (!entry) {
    throw new Error(
      `Unknown store "${storeId}". Known stores: ${Array.from(parsed.keys()).join(", ") || "(none)"}`
    );
  }
  const domain = process.env[entry.domainEnv];
  const token = process.env[entry.tokenEnv];
  if (!domain || !token) {
    const missing = [
      !domain && entry.domainEnv,
      !token && entry.tokenEnv,
    ].filter(Boolean);
    throw new Error(
      `Missing env for store "${storeId}": set ${missing.join(" and ")}`
    );
  }
  return { domain, token };
}

/** List store ids defined in config (no secrets). */
export async function listStoreIds(
  options: LoadConfigOptions = {}
): Promise<string[]> {
  const config = await loadWorkbenchConfig(options);
  const tokenKeys = Array.from(parseStores(config.stores).keys());
  const oauthKeys = Array.from(parseOAuthStores(config.stores).keys());
  return Array.from(new Set([...tokenKeys, ...oauthKeys]));
}

export type StoreOAuthCredentials = {
  domain: string;
  clientId: string;
  clientSecret: string;
};

/**
 * Resolve OAuth (client credentials) credentials for a store. Config entry must have name, client_id, client_secret.
 * Domain is entry.domain if set, otherwise {name}.myshopify.com.
 */
export async function getStoreOAuthCredentials(
  storeId: string,
  options: LoadConfigOptions = {}
): Promise<StoreOAuthCredentials> {
  const config = await loadWorkbenchConfig(options);
  const parsed = parseOAuthStores(config.stores);
  const entry = parsed.get(storeId);
  if (!entry) {
    throw new Error(
      `Unknown store "${storeId}". Known stores: ${Array.from(parsed.keys()).join(", ") || "(none)"}`
    );
  }
  const domain = entry.domain ?? `${entry.name}.myshopify.com`;
  if (!entry.clientId || !entry.clientSecret) {
    throw new Error(
      `Missing client_id or client_secret for store "${storeId}". Set env vars or values in config.`
    );
  }
  return {
    domain,
    clientId: entry.clientId,
    clientSecret: entry.clientSecret,
  };
}
