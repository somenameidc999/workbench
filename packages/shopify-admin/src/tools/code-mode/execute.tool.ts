import { resolveAccessToken, domainToShop } from "../../utils/resolve-token.js";
import { runInSandbox } from "../../sandbox/executor.js";

const EXECUTE_TIMEOUT_MS = 30_000;

export interface ExecuteArgs {
  shop: string;
  code: string;
}

type ShopifyClient = {
  query: (graphql: string, variables?: Record<string, unknown>) => Promise<unknown>;
};

function createShopifyClient(shopDomain: string, accessToken: string): ShopifyClient {
  const host = domainToShop(shopDomain);
  const apiVersion = process.env.SHOPIFY_API_VERSION ?? "2024-01";
  const url = `https://${host}/admin/api/${apiVersion}/graphql.json`;

  return {
    async query(graphql: string, variables?: Record<string, unknown>): Promise<unknown> {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: graphql, variables }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify GraphQL request failed (${res.status}): ${text.slice(0, 500)}`);
      }

      const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
      if (json.errors?.length) {
        throw new Error(`GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
      }
      return json.data;
    },
  };
}

export async function handleExecute(args: ExecuteArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const { accessToken, shopDomain } = await resolveAccessToken(args.shop);
    const client = createShopifyClient(shopDomain, accessToken);

    const result = await runInSandbox(
      args.code,
      { shopify: Object.freeze(client) },
      { timeoutMs: EXECUTE_TIMEOUT_MS },
    );

    if (result.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "success", result: result.data, logs: result.logs }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "error", error: result.error, logs: result.logs }),
        },
      ],
      isError: true,
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
}
