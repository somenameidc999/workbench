import { createTunnelProvider } from "../../utils/shopify-oauth/tunnel.js";
import { startOAuthServer } from "../../utils/shopify-oauth/oauth-server.js";
import { createTokenStore } from "../../utils/shopify-oauth/token-store/index.js";
import { AppConfigStore } from "../../utils/shopify-oauth/config.js";
import type { TunnelProviderName } from "../../utils/shopify-oauth/tunnel.js";

const tokenStore = createTokenStore();
const appConfigStore = new AppConfigStore();

export interface GenerateTokenArgs {
  shop: string;
  app_name?: string;
  api_key?: string;
  api_secret?: string;
  scopes?: string;
  tunnel_provider?: TunnelProviderName;
  timeout_seconds?: number;
}

export async function handleGenerateToken(args: GenerateTokenArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  let apiKey: string;
  let apiSecret: string;
  let scopes: string;
  let appName: string;

  if (args.app_name) {
    const config = await appConfigStore.get(args.app_name);
    if (!config) {
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
    apiKey = config.api_key;
    apiSecret = config.api_secret;
    scopes = args.scopes ?? config.scopes;
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

  const tunnelProvider = createTunnelProvider(
    args.tunnel_provider ?? "cloudflared"
  );
  let oauthServer: Awaited<ReturnType<typeof startOAuthServer>> | null = null;

  try {
    const timeoutMs = (args.timeout_seconds ?? 120) * 1000;

    const tempServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response("init");
      },
    });
    const port = tempServer.port;
    tempServer.stop();

    const tunnelUrl = await tunnelProvider.start(port);

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
    console.error("\n🔗 OAuth URL (open in browser):");
    console.error(`   ${oauthServer.oauthUrl}`);
    console.error("\n⚠️  If you see 'Unauthorized Access' from Shopify:");
    console.error("   Add this EXACT URL to your app's Allowed redirection URL(s) in Partners:");
    console.error("   App → Configuration → URLs → Allowed redirection URL(s)");
    console.error(`   ${redirectUri}`);
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
