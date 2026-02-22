import { createTokenStore } from "./shopify-oauth/token-store/index.js";
import { getStoreOAuthCredentials, listStoreIds } from "@toolbox/core";
import { getAccessToken } from "../auth.js";
import type { StoredToken } from "./shopify-oauth/types.js";

const tokenStore = createTokenStore();
const CLIENT_CREDENTIALS_TTL_MS = 60 * 60 * 1000;
const CLIENT_CREDENTIALS_REFRESH_SKEW_MS = 60 * 1000;

/** Normalize domain to shop key format (hostname only, no protocol/path). */
export function domainToShop(domain: string): string {
  const host = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .split("/")[0];
  return host ?? domain;
}

function isClientCredentialsTokenFresh(token: StoredToken): boolean {
  if (token.token_type !== "client_credentials") return false;

  const now = Date.now();
  const refreshBefore = now + CLIENT_CREDENTIALS_REFRESH_SKEW_MS;

  if (token.expires_at) {
    const expiry = Date.parse(token.expires_at);
    if (!Number.isNaN(expiry)) {
      return expiry > refreshBefore;
    }
  }

  const created = Date.parse(token.created_at);
  if (Number.isNaN(created)) return false;
  return created + CLIENT_CREDENTIALS_TTL_MS > refreshBefore;
}

async function findOAuthCredentials(
  requestedShop: string,
  normalizedShopDomain: string,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const storeIds = await listStoreIds();

  for (const storeId of storeIds) {
    try {
      const creds = await getStoreOAuthCredentials(storeId);
      const credsShopDomain = domainToShop(creds.domain);
      const storeIdAsDomain = domainToShop(storeId);

      const matchesByDomain = credsShopDomain === normalizedShopDomain;
      const matchesByName =
        storeId === requestedShop || storeIdAsDomain === normalizedShopDomain;

      if (matchesByDomain || matchesByName) {
        return { clientId: creds.clientId, clientSecret: creds.clientSecret };
      }
    } catch {
      // Skip misconfigured entries and keep searching other stores.
    }
  }

  return null;
}

/**
 * Resolve an access token for a Shopify store by looking up the file/Redis token store.
 * Throws with an actionable hint if no token is found.
 */
export async function resolveAccessToken(
  shop: string,
): Promise<{
  accessToken: string;
  shopDomain: string;
  tokenType: "client_credentials" | "offline";
}> {
  const shopDomain = domainToShop(shop);
  const failureReasons: string[] = [];

  const creds = await findOAuthCredentials(shop, shopDomain);
  if (creds) {
    const cachedClientToken = await tokenStore.get(shopDomain, "client_credentials");
    if (cachedClientToken?.access_token && isClientCredentialsTokenFresh(cachedClientToken)) {
      return {
        accessToken: cachedClientToken.access_token,
        shopDomain,
        tokenType: "client_credentials",
      };
    }

    try {
      const accessToken = await getAccessToken(shopDomain, creds.clientId, creds.clientSecret);
      if (accessToken) {
        const now = Date.now();
        const createdAt = new Date(now).toISOString();
        const expiresAt = new Date(now + CLIENT_CREDENTIALS_TTL_MS).toISOString();

        await tokenStore.set({
          access_token: accessToken,
          scope: "",
          shop: shopDomain,
          app_name: "client_credentials",
          created_at: createdAt,
          source: "oauth-client-credentials",
          token_type: "client_credentials",
          expires_at: expiresAt,
        });

        return {
          accessToken,
          shopDomain,
          tokenType: "client_credentials",
        };
      }
      failureReasons.push("Client credentials returned no access token.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failureReasons.push(`Client credentials failed: ${message}`);
    }
  } else {
    failureReasons.push("No matching client_id/client_secret found for store.");
  }

  const offline = await tokenStore.get(shopDomain, "offline");
  if (offline?.access_token) {
    return { accessToken: offline.access_token, shopDomain, tokenType: "offline" };
  }

  throw new Error(
    `Unable to resolve access token for "${shopDomain}". ${failureReasons.join(" ")} ` +
      `Offline token not found. Run shopify_generate_access_token first.`,
  );
}
