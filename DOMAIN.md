# Domain Knowledge

## Shopify OAuth

### Token Types

**Client Credentials** (`token_type: "client_credentials"`):
- For stores where the merchant added us to their Shopify Organization.
- Retrieved via `POST /admin/oauth/access_token` with `grant_type=client_credentials`.
- Expires in **1 hour**. Cached in file store with `expires_at`.
- Refresh skew: 1 minute before expiry, a new token is fetched.
- No user interaction needed — fully automated.

**Offline Access Token** (`token_type: "offline"`):
- For custom distribution apps installed via OAuth Authorization Code Grant.
- Permanent (no expiry) unless revoked.
- Requires one-time browser interaction: user clicks "Install" on Shopify consent screen.
- Generated via `shopify_generate_access_token` tool.

### OAuth Callback Requirements

- The `redirect_uri` in the authorize URL **must exactly match** an "Allowed redirection URL" in the Shopify Partner Dashboard.
- cloudflared generates a new random URL each run (`https://{random}.trycloudflare.com`).
- This means you must update Partner Dashboard redirect URLs each time you regenerate a token with a new tunnel URL.
- If the callback has `hmac`, `host`, `shop`, `timestamp` but **no `code`** parameter: the redirect_uri doesn't match, or the user hasn't clicked "Install" yet.

### HMAC Validation

Shopify signs callbacks with HMAC-SHA256. The `hmac` query param is removed from the query string before computing the signature against the app's `api_secret`. Validation happens in `utils/shopify-oauth/hmac.ts`.

### Nonce / State

A `randomUUID()` nonce is generated per OAuth flow and passed as `state` param. The callback must return the same value. Prevents CSRF.

## Shopify Admin API

### Order ID Formats

- **Legacy numeric**: `6278028009786`
- **GraphQL GID**: `gid://shopify/Order/6278028009786`
- `toOrderGid()` in `orders.ts` normalizes both to GID for GraphQL queries.
- The GraphQL response returns `legacyResourceId` which maps back to the numeric ID.

### API Versioning

- Set via `SHOPIFY_API_VERSION` env var (default: `2024-01`).
<!-- VERIFY: Is the default still 2024-01 or has it been updated? The .env.example may show 2025-01 -->
- GraphQL endpoint: `https://{shop}/admin/api/{version}/graphql.json`.
- Schema introspection JSON is version-specific: `admin-{version}.json`.

### GraphQL Response Shape

All Shopify GraphQL responses: `{ data?: T, errors?: Array<{ message: string }> }`.
Both must be checked — HTTP 200 can still contain `errors`.

### ShopifyOrder Type Mapping (GraphQL → legacy shape)

| GraphQL field | Mapped to |
|---------------|-----------|
| `legacyResourceId` | `id` (as number) |
| `name` | `name` |
| `email` | `email` |
| `currentTotalPriceSet.shopMoney.amount` | `total_price` |
| `displayFinancialStatus` | `financial_status` |
| `displayFulfillmentStatus` | `fulfillment_status` |
| `createdAt` | `created_at` |

## Recharge API

### Account Identification

- Recharge tools use the field name `account` (not `shop`).
- The `account` param maps to a key in `workbench.config.ts` which resolves to an API token.
- Bug history: discounts tool originally used `shopField` (undefined variable) instead of `accountField`. Fixed to use `account` consistently.

### Tool Parameter Convention

All Recharge tools destructure `{ account, ...body }` or `{ account, ...query }`.
The `account` field is stripped before sending the request body/query to the API.
If `account` is accidentally named `shop` in the schema, it leaks into the API request body.

### Code Mode for REST APIs

Recharge uses the `@cloudflare/codemode` SDK (unlike Shopify which has a custom sandbox).
The `execute` tool injects a `recharge.request(method, path, body?)` client.
The `search` tool provides the OpenAPI spec as a global.

## Token Store

### File Naming

Current: `{shop.replace(/\./g, "_")}__${token_type}.json`
Example: `italist-shop_myshopify_com__offline.json`

Legacy (backward compat for reads): `{shop.replace(/\./g, "_")}.json`
Example: `italist-shop_myshopify_com.json`

### StoredToken Fields

```typescript
{
  access_token: string;
  scope: string;
  shop: string;              // normalized domain: "store.myshopify.com"
  app_name: string;           // from config or "client_credentials"
  created_at: string;         // ISO 8601
  source: string;             // "oauth-callback" | "oauth-client-credentials"
  token_type: "offline" | "client_credentials";
  expires_at?: string;        // ISO 8601, only for client_credentials
}
```

### Token Lookup Order

1. `tokenStore.get(shop, "client_credentials")` — check for cached CC token, verify freshness
2. If stale/missing → fetch new CC token, cache it
3. `tokenStore.get(shop, "offline")` — fallback to permanent token
4. Throw with actionable error message

## Store Configuration

### workbench.config.ts Shape

```typescript
export default {
  stores: [
    {
      name: "store-name",
      client_id: process.env.SOME_CLIENT_ID,
      client_secret: process.env.SOME_CLIENT_SECRET,
    },
    {
      name: "recharge-account-name",
      access_token: process.env.SOME_RECHARGE_TOKEN,
    },
  ],
};
```

### Store Resolution

`getStoreOAuthCredentials(storeName)` returns `{ domain, clientId, clientSecret }`.
If `clientId` or `clientSecret` resolves to empty string (env var not set), the store is **silently skipped** from the known stores list → "Known stores: (none)" error.

`listStoreIds()` returns all configured store names.
`resolveAccessToken(shop)` tries to match by domain or store name across all configured stores.

`resolveRechargeCredentials(accountName)` in `@toolbox/recharge` iterates config stores looking for entries with `access_token`.

## Sandbox Security Model

### Threat Model

The sandbox runs code written by an LLM on the developer's local machine. Not internet-exposed.
`new Function()` is acceptable for this threat model. If ever exposed over HTTP, swap to QuickJS.

### Blocked Globals

`process`, `Bun`, `require`, `globalThis`, `global`, `self`, `window`, `fetch`,
`setTimeout`, `setInterval`, `setImmediate`, `clearTimeout`, `clearInterval`,
`clearImmediate`, `queueMicrotask`, `__dirname`, `__filename`

Note: `import`, `eval`, `Function` are JS reserved keywords — cannot be used as `new Function` parameter names. They're blocked by the language parser itself.

### Allowed Builtins

`JSON`, `Array`, `Object`, `String`, `Number`, `Boolean`, `Map`, `Set`, `Date`,
`RegExp`, `Promise`, `Error`, `TypeError`, `RangeError`, `Math`, `parseInt`,
`parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `decodeURIComponent`,
`encodeURI`, `decodeURI`, `undefined`, `NaN`, `Infinity`

### Injected Globals

- **search tool**: `schema` (frozen introspection JSON)
- **execute tool**: `shopify` (frozen object with `.query(graphql, variables?)`)
- Both: `console` proxy (captures to `logs` array, never touches real stdout)

## MCP Protocol Constraints

### stdio Transport

- stdout = JSON-RPC messages only.
- **Any `console.log` in tool handlers corrupts the protocol.** Use `console.error` for debug output.
- Each MCP server = one process = one stdio stream. Cannot merge multiple servers without a proxy.

### Tool Registration

MCP SDK's `registerTool` + Zod causes "Type instantiation is excessively deep and possibly infinite."
**Required workaround**: extract input schema with `satisfies Record<string, z.ZodType>`, cast handler `as never`, cast config `as ToolConfig`.

### Orchestrator Tool Namespacing

Tools proxied through orchestrator are namespaced: `{serverName}__{toolName}`.
Example: `shopify-admin__execute`, `recharge__recharge_codemode`.
The orchestrator strips the prefix before forwarding to the child.
