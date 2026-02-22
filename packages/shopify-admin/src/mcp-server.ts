import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleGenerateToken } from "./tools/shopify-oauth/generate-token.tool";
import { handleConfigureApp } from "./tools/shopify-oauth/configure-app.tool";
import { handleGetStoredToken } from "./tools/shopify-oauth/get-token.tool";
import { handleListTokens } from "./tools/shopify-oauth/list-tokens.tool";
import { handleSearch } from "./tools/code-mode/search.tool";
import { handleExecute } from "./tools/code-mode/execute.tool";

const server = new McpServer({
  name: "shopify-admin",
  version: "0.0.1",
});

// Shopify OAuth tools
const shopifyGenerateTokenInputSchema = {
  shop: z.string().describe("Shopify store domain (e.g. my-store.myshopify.com)"),
  app_name: z
    .string()
    .optional()
    .describe(
      "Name of a previously configured app (via shopify_configure_app). Mutually exclusive with inline credentials."
    ),
  api_key: z
    .string()
    .optional()
    .describe(
      "Shopify app Client ID. Use for one-off token generation without saving app config."
    ),
  api_secret: z.string().optional().describe("Shopify app Client Secret."),
  scopes: z
    .string()
    .optional()
    .describe(
      "Comma-separated OAuth scopes (e.g. read_products,write_orders). Defaults to app config scopes."
    ),
  tunnel_provider: z
    .enum(["cloudflared", "localtunnel"])
    .optional()
    .describe(
      "Tunnel provider. Default: cloudflared (requires cloudflared CLI installed)."
    ),
  timeout_seconds: z
    .number()
    .optional()
    .describe("How long to wait for OAuth completion. Default: 120."),
} satisfies Record<string, z.ZodType>;

const shopifyConfigureAppInputSchema = {
  app_name: z
    .string()
    .describe("Unique name for this app config (e.g. italist-admin)"),
  api_key: z.string().describe("Shopify app Client ID from Partners Dashboard"),
  api_secret: z.string().describe("Shopify app Client Secret from Partners Dashboard"),
  scopes: z
    .string()
    .describe(
      "Default OAuth scopes, comma-separated (e.g. read_products,write_products,read_orders,write_orders)"
    ),
} satisfies Record<string, z.ZodType>;

const shopifyGetStoredTokenInputSchema = {
  shop: z.string().describe("Shopify store domain"),
} satisfies Record<string, z.ZodType>;

const shopifyListTokensInputSchema = {
  app_name: z
    .string()
    .optional()
    .describe("Filter by app name. Omit to list all."),
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
  "shopify_generate_access_token",
  {
    description:
      "Generate a Shopify Admin API offline access token via OAuth for a custom distribution app. Starts a temporary tunnel, prints an OAuth URL to stderr for the user to open and approve, then captures and stores the token. If Shopify shows 'Unauthorized Access', add the printed redirect URL to your app's Allowed redirection URL(s) in Partners (App → Configuration → URLs). Requires shopify_configure_app first, OR inline api_key + api_secret.",
    inputSchema: shopifyGenerateTokenInputSchema,
  } as ToolConfig,
  handleGenerateToken as never
);

register(
  "shopify_configure_app",
  {
    description:
      "Store Shopify app credentials for reuse. Credentials are saved locally so you don't need to provide api_key/api_secret on every token generation call.",
    inputSchema: shopifyConfigureAppInputSchema,
  } as ToolConfig,
  handleConfigureApp as never
);

register(
  "shopify_get_stored_token",
  {
    description:
      "Retrieve a stored Shopify access token for a specific app and shop.",
    inputSchema: shopifyGetStoredTokenInputSchema,
  } as ToolConfig,
  handleGetStoredToken as never
);

register(
  "shopify_list_tokens",
  {
    description:
      "List all stored Shopify access tokens, optionally filtered by app name.",
    inputSchema: shopifyListTokensInputSchema,
  } as ToolConfig,
  handleListTokens as never
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
