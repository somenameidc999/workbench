# workbench

Unified Bun-based MCP workspace with an orchestrator that auto-discovers package MCP servers and exposes them as one MCP endpoint.

## What has been done so far

- Set up a monorepo workspace (`packages/*`) with Bun scripts for starting, listing, and inspecting MCP servers.
- Built `@toolbox/orchestrator` MCP server that:
  - discovers MCP-capable packages by checking for a `mcp` script,
  - connects to each child server over stdio,
  - namespaces tools as `serverName__toolName`,
  - exposes a meta tool: `orchestrator__status`.
- Added a working `@toolbox/shopify-admin` MCP server with tools for:
  - `shopify_configure_app`
  - `shopify_generate_access_token`
  - `shopify_get_stored_token`
  - `shopify_list_tokens`
  - `search` (schema introspection in sandboxed JS)
  - `execute` (sandboxed Shopify GraphQL execution with token resolution)
- Added Shopify code-mode tests:
  - `packages/shopify-admin/src/tools/code-mode/search.test.ts`
  - `packages/shopify-admin/src/tools/code-mode/execute.test.ts`
- Implemented Shopify order-query helpers (`orders.ts`, `getOrder.ts`) for API usage inside the package.

## Setup

```bash
bun install
```

## Useful commands

From repo root:

```bash
# Start orchestrator MCP server
bun run mcp:start

# Start with hot reload
bun run mcp:dev

# Show discoverable MCP servers
bun run mcp:list

# Open MCP Inspector against orchestrator
bun run mcp:inspect
```

## Testing MCP inspection

### Option A (recommended): use workspace script

```bash
bun run mcp:inspect
```

### Option B: direct inspector command

```bash
bunx @modelcontextprotocol/inspector -- bun run packages/orchestrator/src/index.ts
```

After Inspector opens:

1. Connect to the server.
2. Run `orchestrator__status` to verify child servers and tool registration.
3. Run one namespaced tool, for example:
   - `shopify-admin__search` with:
     ```json
     {
       "code": "const q = schema.__schema.queryType.name; const t = schema.__schema.types.find(x => x.name === q); return t.fields.slice(0, 10).map(f => f.name);"
     }
     ```
   - `shopify-admin__execute` with:
     ```json
     {
       "shop": "your-shop.myshopify.com",
       "code": "return await shopify.query(`{ shop { name myshopifyDomain } }`);"
     }
     ```

## Add MCP to Claude Code

Add the following to your Claude Code MCP config (merge with existing `mcpServers` entries):

```json
{
  "mcpServers": {
    "workbench-orchestrator": {
      "command": "bun",
      "args": [
        "--env-file=/ABSOLUTE/PATH/TO/workbench/.env",
        "run",
        "/ABSOLUTE/PATH/TO/workbench/packages/orchestrator/src/index.ts"
      ]
    }
  }
}
```

Then restart Claude Code (or reload MCP servers) and confirm the server appears as `workbench-orchestrator`.

## Helpful notes

- Use absolute paths in MCP config for reliability.
- Child tool names are always namespaced by server in orchestrator (for example `shopify-admin__execute`).
- If no tools appear, run `bun run mcp:list` to confirm discovery and ensure each package has a `mcp` script.
- `shopify_generate_access_token` may require adding the shown callback URL to Shopify app Allowed redirection URL(s).
- Keep secrets in `.env` only; do not commit real app credentials.