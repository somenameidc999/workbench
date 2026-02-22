import { randomUUID } from "node:crypto";
import { verifyHMAC, isValidShopDomain } from "./hmac.js";
import { buildOAuthUrl } from "./oauth-url.js";
import { exchangeCodeForToken } from "./token-exchange.js";
import type { ShopifyTokenResponse } from "./types.js";

export interface OAuthServerOptions {
  port?: number;
  apiKey: string;
  apiSecret: string;
  scopes: string;
  shop: string;
  tunnelUrl: string;
  timeoutMs: number;
}

export interface OAuthServerResult {
  server: ReturnType<typeof Bun.serve>;
  port: number;
  nonce: string;
  oauthUrl: string;
  tokenPromise: Promise<ShopifyTokenResponse>;
  shutdown: () => void;
}

export async function startOAuthServer(
  options: OAuthServerOptions
): Promise<OAuthServerResult> {
  const nonce = randomUUID();
  let resolveToken!: (token: ShopifyTokenResponse) => void;
  let rejectToken!: (error: Error) => void;

  const tokenPromise = new Promise<ShopifyTokenResponse>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const timeout = setTimeout(() => {
    rejectToken(
      new Error(
        `OAuth flow timed out after ${options.timeoutMs / 1000}s. User did not complete approval.`
      )
    );
  }, options.timeoutMs);

  const server = Bun.serve({
    port: options.port ?? 0,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/auth/callback") {
        try {
          clearTimeout(timeout);
          const code = url.searchParams.get("code");
          const shop = url.searchParams.get("shop");
          const state = url.searchParams.get("state");

          if (!code || !shop || !url.searchParams.get("hmac")) {
            return new Response("Missing required OAuth parameters", {
              status: 400,
            });
          }
          if (state !== nonce) {
            return new Response("State mismatch — possible CSRF attack", {
              status: 403,
            });
          }
          if (!isValidShopDomain(shop)) {
            return new Response("Invalid shop domain", { status: 400 });
          }
          if (!verifyHMAC(url.searchParams, options.apiSecret)) {
            return new Response("HMAC validation failed", { status: 403 });
          }

          const token = await exchangeCodeForToken({
            shop,
            code,
            apiKey: options.apiKey,
            apiSecret: options.apiSecret,
          });

          resolveToken(token);

          return new Response(
            `<html><body style="font-family:system-ui;max-width:600px;margin:80px auto;text-align:center;">
              <h1>✅ Token Retrieved</h1>
              <p>Access token for <strong>${shop}</strong> has been captured.</p>
              <p>You can close this tab.</p>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        } catch (error) {
          rejectToken(error as Error);
          return new Response(`OAuth error: ${(error as Error).message}`, {
            status: 500,
          });
        }
      }

      const redirectUrl = buildOAuthUrl({
        shop: options.shop,
        apiKey: options.apiKey,
        scopes: options.scopes,
        redirectUri: `${options.tunnelUrl}/auth/callback`,
        nonce,
      });
      return Response.redirect(redirectUrl, 302);
    },
  });

  const port = server.port ?? 0;
  const oauthUrl = buildOAuthUrl({
    shop: options.shop,
    apiKey: options.apiKey,
    scopes: options.scopes,
    redirectUri: `${options.tunnelUrl}/auth/callback`,
    nonce,
  });

  const shutdown = () => {
    clearTimeout(timeout);
    server.stop();
  };

  return { server, port, nonce, oauthUrl, tokenPromise, shutdown };
}
