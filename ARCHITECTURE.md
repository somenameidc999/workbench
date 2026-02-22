# Architecture

## What This Is

Bun monorepo (`packages/*`) exposing e-commerce platform APIs as MCP tools.
Primary consumer: Claude Code / Cursor via MCP protocol.
Each package = one MCP server. Orchestrator discovers + proxies them through a single MCP endpoint.

## Packages

| Package | Purpose | MCP? |
|---------|---------|------|
| `@toolbox/core` | Config loading (`bunfig`), store credential resolution | No |
| `@toolbox/shopify-admin` | Shopify Admin GraphQL API tools + OAuth token lifecycle | Yes |
| `@toolbox/recharge` | Recharge subscription API tools (REST, code-mode) | Yes |
| `@toolbox/orchestrator` | Discovers MCP packages, proxies all tools through one endpoint | Yes (parent) |
| `@toolbox/database` | Local DB access (scaffold only) | No |

## Data Flow

### MCP Tool Call (client → orchestrator → child)

```
Client (Claude Code)
  ↓ tools/call: "shopify-admin__execute"
Orchestrator (packages/orchestrator/src/index.ts)
  ↓ strips prefix, forwards via StdioClientTransport
shopify-admin MCP server (packages/shopify-admin/src/mcp-server.ts)
  ↓ resolveAccessToken() → sandbox → shopify.query()
Shopify Admin GraphQL API
  ↓ response
Back up the chain → client
```

### Token Resolution (resolveAccessToken)

```
1. Find client_id/client_secret from workbench.config.ts (match by store name or domain)
2. Check cached client_credentials token (file store, 1hr TTL)
3. If cached + fresh → return
4. If not → POST client_credentials grant → cache → return
5. If client_credentials fails → check offline token in file store
6. If nothing → throw with "Run shopify_generate_access_token" hint
```

### OAuth Token Generation (shopify_generate_access_token)

```
1. Start ephemeral Bun.serve() on random port
2. Start cloudflared tunnel → get https://*.trycloudflare.com URL
3. Build OAuth authorize URL with tunnel as redirect_uri
4. Return URL to user → user clicks → Shopify consent screen
5. Callback hits tunnel → server validates HMAC + nonce
6. Exchange code for offline access_token
7. Store token as JSON file (keyed by shop domain + token_type)
8. Tear down server + tunnel
```

## Code Mode Pattern

Inspired by [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode-mcp/).
Instead of 1 tool per API endpoint, 2 generic tools cover the entire API:

- **`search`**: Agent writes JS to filter bundled GraphQL introspection schema. Frozen `schema` global. No network.
- **`execute`**: Agent writes JS with `shopify.query(graphql, variables?)`. Pre-authenticated client injected. 30s timeout.

Both run in a `new Function()` sandbox with blocked globals (`process`, `Bun`, `fetch`, `require`, `globalThis`).
Console output captured into `logs` array — never touches stdout (stdio MCP constraint).

Recharge uses the same pattern via `@cloudflare/codemode` SDK with a REST client instead of GraphQL.

## Orchestrator Architecture

```
discoverServers()  →  scan packages/*/package.json for "mcp" script
     ↓
StdioClientTransport  →  spawn each child MCP server
     ↓
client.listTools()  →  discover all child tools
     ↓
Register as serverName__toolName on parent McpServer
     ↓
StdioServerTransport  →  expose unified endpoint to client
```

Tool routing is **deterministic prefix-based** (not LLM-selected).
`pi-agent-core` is installed but not yet wired for smart routing (Phase B/C).

## Config System

- `workbench.config.ts`: Store definitions with env var references for secrets. Loaded by `bunfig`.
- `.env`: Actual secrets (client IDs, secrets, API tokens). Auto-loaded by Bun from cwd.
- Store credentials resolved by `getStoreOAuthCredentials(storeName)` in `@toolbox/core`.
- Recharge accounts resolved by `resolveRechargeCredentials(accountName)` in `@toolbox/recharge`.

## Token Storage

File-based. Default dir: `~/.shopify-mcp/tokens/`.

Filename format: `{shop.replace(/\./g, "_")}__${token_type}.json` (dots → underscores).
Two token types: `offline` (permanent) and `client_credentials` (1hr TTL, auto-refreshed).

Legacy filename compat: `{shop.replace(/\./g, "_")}.json` (no type suffix) still read for offline tokens.

## Infrastructure

- **Runtime**: Bun (not Node). All scripts, servers, tests use Bun.
- **Transport**: stdio (MCP protocol over stdin/stdout of child processes).
- **Tunneling**: cloudflared Quick Tunnels (free, no account). Localtunnel as fallback.
- **Schema storage**: GraphQL introspection JSON downloaded per API version. Gitignored (15-25MB).
- **No external infra**: No databases, queues, or cloud services. Everything runs locally.

## Key Architectural Decisions

| Decision | Why |
|----------|-----|
| `new Function()` sandbox over QuickJS WASM | Local MCP = trusted code from LLM on dev machine. WASM adds 2MB + cold-start + serialization overhead. Sandbox interface stable for future swap. |
| File-based token store over Redis | Simplicity. `TokenStore` interface abstracted so Redis can be swapped in without changing callers. |
| Code Mode over per-endpoint tools | Fixed ~1000 token footprint regardless of API surface. Shopify Admin has 200+ endpoints. |
| Orchestrator as MCP proxy, not LLM router | MCP clients (Claude Code) already have an LLM. Adding another LLM in the router = cost + latency for no benefit in v1. |
| `workbench.config.ts` over env-only config | Structured store definitions > scattered env vars. bunfig resolves env vars at runtime. Config file is committable. |
| REST → GraphQL for Shopify | GraphQL is Shopify's primary API direction. REST deprecated for new features. |
| cloudflared over ngrok | Free, no account, no rate limits. Tunnel URL changes each run (requires updating Partner Dashboard redirect URLs). |
| Token store keyed by shop domain only (not app_name+shop) | Eliminates app_name mismatch bugs. One token per shop per type. |
| `--env-file=../../.env` in package scripts | Bun loads .env from cwd. Child processes run from packages/*, not root. Explicit path avoids "Known stores: (none)" failures. |
