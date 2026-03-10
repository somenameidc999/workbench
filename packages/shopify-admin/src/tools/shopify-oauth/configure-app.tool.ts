import { AppConfigStore } from "../../utils/shopify-oauth/config.js";
import { createTunnelProvider } from "../../utils/shopify-oauth/tunnel.js";
import { startOAuthServer } from "../../utils/shopify-oauth/oauth-server.js";
import { createTokenStore } from "../../utils/shopify-oauth/token-store/index.js";
import type { TunnelProviderName } from "../../utils/shopify-oauth/tunnel.js";

const appConfigStore = new AppConfigStore();
const tokenStore = createTokenStore();

export interface ConfigureAppArgs {
  app_name?: string;
  api_key?: string;
  api_secret?: string;
  scopes?: string;
  shop?: string;
  tunnel_provider?: TunnelProviderName;
  port?: number;
}

export async function handleConfigureApp(args: ConfigureAppArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const appName = args.app_name || process.env.SHOPIFY_APP_NAME;
  const apiKey = args.api_key || process.env.SHOPIFY_API_KEY;
  const apiSecret = args.api_secret || process.env.SHOPIFY_API_SECRET;
  const scopes = args.scopes || process.env.SHOPIFY_SCOPES;
  const shopArg = args.shop || process.env.SHOPIFY_SHOP;

  const missing = [
    !appName && "app_name (or SHOPIFY_APP_NAME)",
    !apiKey && "api_key (or SHOPIFY_API_KEY)",
    !apiSecret && "api_secret (or SHOPIFY_API_SECRET)",
    !scopes && "scopes (or SHOPIFY_SCOPES)",
    !shopArg && "shop (or SHOPIFY_SHOP)",
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "error", message: `Missing required fields: ${missing.join(", ")}. Provide them as arguments or set the corresponding env vars.` }) }],
      isError: true,
    };
  }

  await appConfigStore.set({ app_name: appName!, api_key: apiKey!, api_secret: apiSecret!, scopes: scopes! });

  let shop = shopArg!.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0]!;
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
            message: `Invalid shop domain: "${shopArg}". Use store handle (e.g. my-store) or full domain (e.g. my-store.myshopify.com).`,
          }),
        },
      ],
      isError: true,
    };
  }

  const providerName = args.tunnel_provider ?? "cloudflared";
  const tunnelProvider = createTunnelProvider(providerName);

  try {
    const requestedPort = args.port ?? 0;

    const tempServer = Bun.serve({
      port: requestedPort,
      fetch() {
        return new Response("init");
      },
    });
    const port = tempServer.port;
    tempServer.stop();

    console.error(`\n🔌 Starting ${providerName} tunnel on port ${port}...`);
    const tunnelUrl = await tunnelProvider.start(port);

    const oauthServer = await startOAuthServer({
      port,
      apiKey: apiKey!,
      apiSecret: apiSecret!,
      scopes: scopes!,
      shop,
      tunnelUrl,
      timeoutMs: 300_000,
    });

    oauthServer.tokenPromise
      .then(async (tokenResponse) => {
        const storedToken = {
          access_token: tokenResponse.access_token,
          scope: tokenResponse.scope,
          shop,
          app_name: appName!,
          created_at: new Date().toISOString(),
          source: "oauth-mcp-tool" as const,
          token_type: "offline" as const,
        };
        await tokenStore.set(storedToken);
        console.error(`\n✅ Token for ${shop} stored successfully.`);
      })
      .catch((err) => {
        console.error(`\n❌ OAuth flow failed: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        oauthServer.shutdown();
        tunnelProvider.stop().catch(() => {});
      });

    const redirectUri = `${tunnelUrl}/auth/callback`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            next_steps: [
              `1. Go to your app in the Shopify Partner Portal (or app.shopify.com)`,
              `2. Set the App URL to: ${tunnelUrl}`,
              `3. Add this Allowed redirection URL: ${redirectUri}`,
              `4. Save the app configuration`,
              `5. Open this link in the browser to approve and store the token: ${oauthServer.oauthUrl}`,
            ],
            app_url: tunnelUrl,
            redirect_uri: redirectUri,
            oauth_url: oauthServer.oauthUrl,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let hint: string | undefined;
    if (errorMessage.includes("cloudflared")) {
      hint = "Run: brew install cloudflare/cloudflare/cloudflared";
    }
    await tunnelProvider.stop().catch(() => {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: errorMessage,
            ...(hint && { hint }),
          }),
        },
      ],
      isError: true,
    };
  }
}
