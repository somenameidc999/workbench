import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleGetAccessToken } from "./tools/get-access-token.tool";
import { handleSearch } from "./tools/code-mode/search.tool";
import { handleExecute } from "./tools/code-mode/execute.tool";

const server = new McpServer({
  name: "shopify-admin",
  version: "0.0.1",
});

// Shopify access token tool (client_credentials grant via workbench.config.ts)
const shopifyGetAccessTokenInputSchema = {
  shop: z.string().describe(
    "Store name from workbench.config.ts (e.g. 'seed-dev-store') or full domain (e.g. 'seed-dev-store.myshopify.com'). The store must have client_id and client_secret configured."
  ),
} satisfies Record<string, z.ZodType>;

// Type assertions avoid "excessively deep" inference from SDK's Zod generics (config + callback).
type ToolConfig = {
  description: string;
  inputSchema: Record<string, z.ZodType>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const register = (name: string, config: ToolConfig, handler: (args: any) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>) =>
  server.registerTool(name, config as ToolConfig, handler as never);

register(
  "shopify_get_access_token",
  {
    description:
      "Get a Shopify Admin API access token for a store using client_credentials grant. Reads client_id and client_secret from workbench.config.ts. Tokens are cached for ~1 hour. Pass the store name from config (e.g. 'seed-dev-store') or full domain.",
    inputSchema: shopifyGetAccessTokenInputSchema,
  } as ToolConfig,
  handleGetAccessToken as never
);

// Code Mode tools — search + execute

const searchInputSchema = {
  code: z.string().describe(
    `JavaScript code to search the Shopify Admin GraphQL introspection schema. The code runs in a sandbox with a \`schema\` global containing the full introspection result (__schema with types, queryType, mutationType). Return a value from the code to get results.

Examples:
  // Find types related to "Product"
  return schema.__schema.types
    .filter(t => t.name.includes("Product"))
    .map(t => ({ name: t.name, kind: t.kind }));

  // List all mutations
  const m = schema.__schema.types.find(t => t.name === schema.__schema.mutationType.name);
  return m.fields.map(f => ({ name: f.name, description: f.description }));

  // Get fields of a specific type
  const t = schema.__schema.types.find(t => t.name === "Order");
  return t.fields.map(f => ({ name: f.name, type: f.type }));`,
  ),
} satisfies Record<string, z.ZodType>;

const executeInputSchema = {
  shop: z.string().describe("Shopify store domain (e.g. my-store.myshopify.com)"),
  code: z.string().describe(
    `JavaScript code to execute against the Shopify Admin GraphQL API. The code runs in a sandbox with a \`shopify\` global providing \`shopify.query(graphql, variables?)\`. Return a value from the code to get results.

Examples:
  // Fetch a product by ID
  const data = await shopify.query(\`{
    product(id: "gid://shopify/Product/123") {
      title
      status
      variants(first: 5) { edges { node { title price } } }
    }
  }\`);
  return data;

  // List first 10 orders
  return await shopify.query(\`{
    orders(first: 10) {
      edges { node { id name createdAt totalPriceSet { shopMoney { amount currencyCode } } } }
    }
  }\`);`,
  ),
} satisfies Record<string, z.ZodType>;

register(
  "search",
  {
    description:
      "Search the Shopify Admin GraphQL schema by writing JavaScript that filters/maps the introspection data. A frozen `schema` global is available with the full __schema (types, queryType, mutationType). No network access. Return a value to get results.",
    inputSchema: searchInputSchema,
  } as ToolConfig,
  handleSearch as never,
);

register(
  "execute",
  {
    description:
      "Execute JavaScript against the Shopify Admin GraphQL API. A `shopify` global provides `shopify.query(graphql, variables?)` for authenticated requests. No raw fetch — only shopify.query() is available. 30s timeout. Return a value to get results.",
    inputSchema: executeInputSchema,
  } as ToolConfig,
  handleExecute as never,
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
