# Contributing

## Setup

```bash
bun install          # installs all workspace packages + links internal deps
cp .env.example .env # fill in secrets
```

## Running

```bash
# Individual MCP server (for MCP Inspector testing)
bun --env-file=../../.env run src/mcp-server.ts    # from packages/shopify-admin/
bunx @modelcontextprotocol/inspector -- bun --env-file=../../.env run src/mcp-server.ts

# Orchestrator (all servers)
bun run mcp:start   # from root
bun run mcp:dev     # with --hot
bun run mcp:list    # list discovered servers
```

## Testing

```bash
bun test               # all packages from root
bun test --watch       # watch mode
bun test packages/shopify-admin  # single package
```

## Adding a New MCP Package

1. Create `packages/{name}/` with `package.json` containing `"name": "@toolbox/{name}"`.
2. Add `"mcp"` script in `package.json`: `"mcp": "bun run src/mcp-server.ts"`.
3. Add `"@toolbox/{name}": "workspace:*"` to root `devDependencies`.
4. Run `bun install` to link.
5. The orchestrator auto-discovers packages with an `mcp` script.
6. Tools are namespaced as `{name}__{tool}` in the orchestrator.

## Adding Tools to a Package

Register tools in the package's `mcp-server.ts`:

```typescript
const inputSchema = { param: z.string() } satisfies Record<string, z.ZodType>;
server.registerTool(
  "tool_name",
  { description: "...", inputSchema } as ToolConfig,
  (async (params: { param: string }) => {
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }) as never,
);
```

The `as ToolConfig` + `as never` casts are **required** to avoid deep type instantiation errors.

## Known Footguns

### stdout is sacred
Never `console.log` in MCP tool handlers. It corrupts the stdio JSON-RPC stream. Use `console.error` for debug output.

### .env loading
Bun loads `.env` from `process.cwd()`. When running from `packages/*`, root `.env` is not found. Always pass `--env-file=../../.env` or run from root.

### Token store key
Tokens are keyed by shop domain only. If you have the same store in multiple apps, only one token per type is stored. This is by design — prevents stale token bugs from app_name mismatches.

### Schema files
`admin-*.json` schema files are gitignored (15-25MB). Run `bun run packages/shopify-admin/scripts/fetch-schema.ts` to regenerate.

### Workspace linking
After adding a new `@toolbox/*` package, always run `bun install` from root. The `exports` field with `"./src/index.ts"` is required for cross-package TypeScript resolution without a build step.

## Code Conventions

- **No build step.** All packages run from source via Bun. `main`, `types`, `exports` all point to `./src/index.ts`.
- **Zod for MCP input schemas.** No hand-written JSON Schema.
- **File-based token store.** `~/.shopify-mcp/tokens/`.
- **Tool responses** always return `{ content: [{ type: "text", text: string }] }`.
- **Config over env vars.** Store/account definitions in `workbench.config.ts`, secrets in `.env`.
