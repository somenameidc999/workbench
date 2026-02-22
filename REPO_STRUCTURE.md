# workbench – repo structure

*(excluding `node_modules`)*

```
.
├── .claude/
│   ├── agents/
│   │   └── workbench-agent.md          # Claude Code subagent for this repo
│   └── CLAUDE.md                       # Claude Code agent instructions
├── .env                                # Secrets (gitignored)
├── .env.example                        # Template for .env
├── .gitignore
├── ARCHITECTURE.md                     # System topology, data flows, decisions
├── CONTRIBUTING.md                     # Setup, running, testing, conventions
├── DOMAIN.md                           # Business logic, API quirks, edge cases
├── README.md                           # Quick-start and usage
├── REPO_STRUCTURE.md                   # This file
├── index.ts                            # Root entry (unused)
├── package.json                        # Workspace root, mcp:* scripts
├── tsconfig.base.json                  # Shared TS config
├── tsconfig.json                       # Root TS config
├── workbench.config.ts                 # Store/account definitions
│
└── packages/
    ├── core/                           # @toolbox/core
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── config.ts               # bunfig config loading, credential resolution
    │       └── index.ts                # Re-exports
    │
    ├── database/                       # @toolbox/database (scaffold)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts                # Empty export
    │
    ├── orchestrator/                   # @toolbox/orchestrator
    │   ├── package.json
    │   └── src/
    │       ├── index.ts                # Main MCP server, discovers + proxies
    │       ├── list-servers.ts         # CLI: list discovered MCP servers
    │       ├── process-manager.ts      # Child process lifecycle management
    │       ├── registry.ts             # ServerEntry, discoverServers()
    │       └── router.ts              # ConnectedServer, tool routing
    │
    ├── recharge/                       # @toolbox/recharge
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                # Package exports
    │       ├── mcp-server.ts           # Single recharge_codemode tool
    │       ├── __tests__/
    │       │   ├── client.test.ts
    │       │   ├── codemode.test.ts
    │       │   └── smoke.test.ts
    │       ├── client/
    │       │   ├── auth.ts             # resolveRechargeCredentials()
    │       │   └── http.ts             # rechargeRequest() HTTP client
    │       ├── codemode/
    │       │   ├── executor.ts         # BunLocalExecutor (AsyncFunction)
    │       │   └── index.ts            # createCodeTool wiring
    │       └── tools/
    │           ├── all.ts              # Aggregates all AI SDK tool() defs
    │           ├── addresses/index.ts
    │           ├── charges/index.ts
    │           ├── collections/index.ts
    │           ├── customers/index.ts
    │           ├── discounts/index.ts
    │           ├── products/index.ts
    │           └── subscriptions/index.ts
    │
    └── shopify-admin/                  # @toolbox/shopify-admin
        ├── package.json
        ├── tsconfig.json
        ├── scripts/
        │   └── fetch-schema.ts         # Download introspection JSON
        └── src/
            ├── auth.ts                 # getAccessToken()
            ├── index.ts                # Package exports
            ├── mcp-server.ts           # 6 MCP tools registered
            ├── orders.ts               # toOrderGid(), getOrder(), ShopifyOrder
            ├── queries/
            │   └── getOrder.graphql
            ├── sandbox/
            │   ├── executor.ts         # new Function() sandbox
            │   ├── executor.test.ts    # 14 sandbox tests
            │   └── types.ts            # SandboxResult, SandboxOptions
            ├── schema/
            │   └── load-schema.ts      # Introspection JSON loader + cache
            ├── tools/
            │   ├── getOrder.ts
            │   ├── code-mode/
            │   │   ├── execute.tool.ts # Sandboxed GraphQL execution
            │   │   ├── execute.test.ts
            │   │   ├── search.tool.ts  # Schema introspection search
            │   │   └── search.test.ts
            │   └── shopify-oauth/
            │       ├── configure-app.tool.ts
            │       ├── generate-token.tool.ts
            │       ├── get-token.tool.ts
            │       └── list-tokens.tool.ts
            └── utils/
                ├── resolve-token.ts    # CC → offline fallback cascade
                └── shopify-oauth/
                    ├── config.ts       # AppConfigStore
                    ├── hmac.ts         # HMAC-SHA256 validation
                    ├── oauth-server.ts # Ephemeral Bun.serve()
                    ├── oauth-url.ts    # OAuth URL builder
                    ├── token-exchange.ts
                    ├── tunnel.ts       # Tunnel provider factory
                    ├── types.ts
                    ├── token-store/
                    │   ├── file-store.ts
                    │   ├── index.ts
                    │   └── interface.ts
                    └── tunnel-providers/
                        ├── cloudflared.ts
                        └── localtunnel.ts
```

## Workspaces

| Package | Path | MCP Server? |
|---------|------|-------------|
| `@toolbox/core` | `packages/core` | No |
| `@toolbox/database` | `packages/database` | No |
| `@toolbox/orchestrator` | `packages/orchestrator` | Yes (parent) |
| `@toolbox/recharge` | `packages/recharge` | Yes |
| `@toolbox/shopify-admin` | `packages/shopify-admin` | Yes |
