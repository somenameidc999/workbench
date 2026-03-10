import { createTunnelProvider } from "../../utils/shopify-oauth/tunnel.js";
import { startOAuthServer } from "../../utils/shopify-oauth/oauth-server.js";
import { createTokenStore } from "../../utils/shopify-oauth/token-store/index.js";
import { AppConfigStore, getAppsDir } from "../../utils/shopify-oauth/config.js";
import type { AppConfig } from "../../utils/shopify-oauth/config.js";
import type { TunnelProviderName } from "../../utils/shopify-oauth/tunnel.js";
import { join } from "node:path";
import {
  ensureTomlWithRedirectUrl,
  deployAppConfig,
  slugifyAppName,
} from "../../utils/shopify-cli/deploy-redirect.js";

const tokenStore = createTokenStore();
const appConfigStore = new AppConfigStore();

export interface GenerateTokenArgs {
  shop: string;
  app_name?: string;
  api_key?: string;
  api_secret?: string;
  scopes?: string;
  tunnel_provider?: TunnelProviderName;
  port?: number;
  timeout_seconds?: number;
  toml_config_path?: string;
  auto_deploy?: boolean;
}

export async function handleGenerateToken(args: GenerateTokenArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  let apiKey: string;
  let apiSecret: string;
  let scopes: string;
  let appName: string;
  let appConfig: AppConfig | null = null;

  if (args.app_name) {
    appConfig = await appConfigStore.get(args.app_name);
    if (!appConfig) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: `App "${args.app_name}" not found. Configure it first with shopify_configure_app.`,
            }),
          },
        ],
        isError: true,
      };
    }
    apiKey = appConfig.api_key;
    apiSecret = appConfig.api_secret;
    scopes = args.scopes ?? appConfig.scopes;
    appName = args.app_name;
  } else if (args.api_key && args.api_secret) {
    apiKey = args.api_key;
    apiSecret = args.api_secret;
    scopes = args.scopes ?? "read_products";
    appName = "inline";
  } else {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message:
              "Provide either app_name (for stored config) or api_key + api_secret.",
          }),
        },
      ],
      isError: true,
    };
  }

  let shop = args.shop.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
  if (!shop.includes(".")) {
    shop = `${shop}.myshopify.com`;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: `Invalid shop domain: "${args.shop}". Use store handle (e.g. r114wg-zn) or full domain (e.g. r114wg-zn.myshopify.com).`,
          }),
        },
      ],
      isError: true,
    };
  }

  const providerName = args.tunnel_provider ?? "cloudflared";
  const tunnelProvider = createTunnelProvider(providerName);
  let oauthServer: Awaited<ReturnType<typeof startOAuthServer>> | null = null;

  try {
    const timeoutMs = (args.timeout_seconds ?? 120) * 1000;

    const port = args.port ?? 0;

    const tempServer = Bun.serve({
      port,
      fetch() {
        return new Response("init");
      },
    });
    const resolvedPort = tempServer.port;
    tempServer.stop();

    const tunnelUrl = await tunnelProvider.start(resolvedPort);

    oauthServer = await startOAuthServer({
      port,
      apiKey,
      apiSecret,
      scopes,
      shop,
      tunnelUrl,
      timeoutMs,
    });

    const redirectUri = `${tunnelUrl}/auth/callback`;

    const tomlPath = args.toml_config_path
      ?? appConfig?.toml_config_path
      ?? join(getAppsDir(), `shopify.app.${slugifyAppName(appName)}.toml`);
    const shouldDeploy = args.auto_deploy !== false;

    if (shouldDeploy) {
      console.error(`\n📝 Updating TOML redirect_urls: ${redirectUri}`);
      await ensureTomlWithRedirectUrl(tomlPath, redirectUri, {
        clientId: apiKey,
        appName: appName,
        scopes: scopes,
      });
      console.error("🚀 Deploying app config to register redirect URL...");
      const deployOutput = await deployAppConfig(tomlPath);
      console.error(`✅ Redirect URL registered with Shopify`);
      if (deployOutput) {
        console.error(`   ${deployOutput.split("\n")[0]}`);
      }
    }

    console.error("\n🔗 OAuth URL (open in browser):");
    console.error(`   ${oauthServer.oauthUrl}`);
    if (!shouldDeploy) {
      console.error("\n⚠️  If you see 'Unauthorized Access' from Shopify:");
      console.error("   Add this EXACT URL to your app's Allowed redirection URL(s) in Partners:");
      console.error("   App → Configuration → URLs → Allowed redirection URL(s)");
      console.error(`   ${redirectUri}`);
    }
    console.error(`\n⏳ Waiting for OAuth callback (${args.timeout_seconds ?? 120}s timeout)...\n`);

    const tokenResponse = await oauthServer.tokenPromise;

    const storedToken = {
      access_token: tokenResponse.access_token,
      scope: tokenResponse.scope,
      shop,
      app_name: appName,
      created_at: new Date().toISOString(),
      source: "oauth-mcp-tool",
      token_type: "offline" as const,
    };
    await tokenStore.set(storedToken);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            shop,
            access_token: tokenResponse.access_token,
            scope: tokenResponse.scope,
            token_type: "offline",
            stored: true,
            storage_key: `shopify:token:${appName}:${shop}`,
            message: "Access token generated and stored successfully.",
            redirect_uri_used: `${tunnelUrl}/auth/callback`,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let hint: string | undefined;
    if (errorMessage.includes("timed out")) {
      hint = "The user did not complete the OAuth approval in time. Try again.";
    } else if (errorMessage.includes("cloudflared")) {
      hint = "Run: brew install cloudflare/cloudflare/cloudflared";
    } else if (errorMessage.includes("redirect_uri")) {
      hint =
        "Add the tunnel callback URL to your app's allowed redirect URLs in the Shopify Partners Dashboard.";
    } else {
      hint =
        "If Shopify showed 'Unauthorized Access': add the redirect URL (Partners → App → Configuration → URLs → Allowed redirection URL(s)) and retry.";
    }
    const payload: Record<string, unknown> = {
      status: "error",
      message: errorMessage,
      ...(hint && { hint }),
    };
    if (oauthServer) {
      const match = oauthServer.oauthUrl.match(/redirect_uri=([^&]+)/);
      if (match) {
        try {
          payload.redirect_uri_to_allow = decodeURIComponent(match[1]);
        } catch {
          // ignore
        }
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload),
        },
      ],
      isError: true,
    };
  } finally {
    oauthServer?.shutdown();
    await tunnelProvider.stop();
  }
}
