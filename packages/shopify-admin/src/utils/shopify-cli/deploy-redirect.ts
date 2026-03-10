import { parse, stringify } from "smol-toml";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

export function slugifyAppName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateAppToml(
  tomlPath: string,
  params: {
    clientId: string;
    appName: string;
    scopes: string;
    redirectUrl: string;
  }
): Promise<void> {
  await mkdir(dirname(tomlPath), { recursive: true });
  const content = stringify({
    client_id: params.clientId,
    name: params.appName,
    application_url: "https://shopify.dev/apps/default-app-home",
    embedded: true,
    build: { automatically_update_urls_on_dev: true },
    webhooks: { api_version: "2026-04" },
    access_scopes: { scopes: params.scopes },
    auth: { redirect_urls: [params.redirectUrl] },
  });
  await writeFile(tomlPath, content, "utf-8");
}

export async function updateTomlRedirectUrl(
  tomlPath: string,
  redirectUrl: string
): Promise<void> {
  const content = await readFile(tomlPath, "utf-8");
  const config = parse(content) as Record<string, unknown>;

  if (!config.auth) {
    config.auth = {};
  }

  (config.auth as Record<string, unknown>).redirect_urls = [redirectUrl];
  await writeFile(tomlPath, stringify(config), "utf-8");
}

export async function ensureTomlWithRedirectUrl(
  tomlPath: string,
  redirectUrl: string,
  appConfig?: { clientId: string; appName: string; scopes: string }
): Promise<void> {
  let fileExists = true;
  try {
    await access(tomlPath);
  } catch {
    fileExists = false;
  }

  if (fileExists) {
    await updateTomlRedirectUrl(tomlPath, redirectUrl);
  } else if (appConfig) {
    await generateAppToml(tomlPath, { ...appConfig, redirectUrl });
  } else {
    throw new Error(
      `TOML file not found at ${tomlPath} and no app config available to generate one.`
    );
  }
}

export function tomlConfigName(tomlPath: string): string {
  const file = basename(tomlPath);
  const match = file.match(/^shopify\.app\.(.+)\.toml$/);
  return match ? match[1] : file;
}

export async function deployAppConfig(tomlPath: string): Promise<string> {
  const proc = Bun.spawn(
    ["shopify", "app", "deploy", "--config", tomlConfigName(tomlPath), "--force"],
    { cwd: dirname(tomlPath), stdout: "pipe", stderr: "pipe" }
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(
      `shopify app deploy failed (exit ${exitCode}):\n${stderr || stdout}`
    );
  }

  return stdout || stderr;
}
