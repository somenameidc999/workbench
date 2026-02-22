import { join } from "path";

/** Order shape returned by GetOrder GraphQL query. */
type GetOrderResponse = {
  order: {
    id: string;
    legacyResourceId: string;
    name: string;
    email: string | null;
    createdAt: string;
    displayFinancialStatus: string | null;
    displayFulfillmentStatus: string;
    currentTotalPriceSet: {
      shopMoney: { amount: string; currencyCode: string };
    };
  } | null;
};

/**
 * Normalize order id to GraphQL GID. Accepts GID (gid://shopify/Order/123) or legacy numeric id.
 */
function toOrderGid(orderId: string): string {
  const trimmed = orderId.trim();
  const gidMatch = trimmed.match(/gid:\/\/shopify\/Order\/(\d+)/i);
  if (gidMatch) return `gid://shopify/Order/${gidMatch[1]}`;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Order/${trimmed}`;
  throw new Error(
    `Invalid order id: expected numeric id or GID (gid://shopify/Order/123), got "${orderId}"`
  );
}

export type ShopifyOrder = {
  id: number;
  name?: string;
  email?: string | null;
  total_price?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

const getOrderQuery = await Bun.file(
  join(import.meta.dir, "queries", "getOrder.graphql")
).text();

/**
 * Fetch a single order by id via Admin GraphQL API. shopDomain e.g. "seed-staging.myshopify.com", accessToken from getAccessToken.
 */
export async function getOrder(
  shopDomain: string,
  accessToken: string,
  orderId: string
): Promise<ShopifyOrder> {
  const host = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2024-01";
  const url = `https://${host}/admin/api/${apiVersion}/graphql.json`;
  const id = toOrderGid(orderId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: getOrderQuery, variables: { id } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Shopify Admin GraphQL get order failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    data?: GetOrderResponse;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(
      `Shopify Admin GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }

  const order = json.data?.order;
  if (!order) {
    throw new Error("Shopify Admin GraphQL response missing order");
  }

  return {
    id: Number(order.legacyResourceId),
    name: order.name,
    email: order.email,
    total_price: order.currentTotalPriceSet.shopMoney.amount,
    financial_status: order.displayFinancialStatus ?? undefined,
    fulfillment_status: order.displayFulfillmentStatus,
    created_at: order.createdAt,
  };
}
