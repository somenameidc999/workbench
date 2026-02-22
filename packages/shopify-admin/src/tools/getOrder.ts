import { getStoreOAuthCredentials } from "@toolbox/core";
import { getOrder as fetchOrder } from "../orders";
import { resolveAccessToken } from "../utils/resolve-token.js";

export type GetOrderParams = {
  storeName: string;
  orderId: string;
  domain?: string;
};

/**
 * Get a Shopify order by store name (from config) and order id (GID or legacy numeric).
 * Resolves store credentials from config, gets an access token (client credentials first,
 * then OAuth token store / Redis fallback), then fetches the order.
 */
export async function getOrder(params: GetOrderParams): Promise<unknown> {
  const { storeName, orderId, domain: shopDomain } = params;
  const { domain } = await getStoreOAuthCredentials(storeName);

  const resolved = await resolveAccessToken(shopDomain ?? domain);
  const accessToken = resolved.accessToken;

  const order = await fetchOrder(domain, accessToken, orderId);
  return order;
}
