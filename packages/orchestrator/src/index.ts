import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { discoverServers } from "./registry";
import { Router } from "./router";

async function main() {
  console.error("[orchestrator] discovering servers...");
  const entries = await discoverServers();

  if (entries.length === 0) {
    console.error("[orchestrator] no MCP-capable servers found in packages/");
    process.exit(1);
  }

  console.error(`[orchestrator] found ${entries.length} server(s): ${entries.map((e) => e.name).join(", ")}`);

  const router = new Router();
  await router.connectAll(entries);

  const server = new McpServer({
    name: "workbench-orchestrator",
    version: "0.0.1",
  });

  const allTools = router.allTools();
  console.error(`[orchestrator] registering ${allTools.length} proxied tool(s)`);

  for (const tool of allTools) {
    const inputSchema = buildZodSchema(tool.inputSchema);

    server.registerTool(
      tool.qualifiedName,
      { description: tool.description ?? tool.qualifiedName, inputSchema },
      async (args: Record<string, unknown>) => {
        const result = await router.callTool(tool.qualifiedName, args);
        return {
          content: result.content.map((c) => ({
            type: "text" as const,
            text: typeof c.text === "string" ? c.text : JSON.stringify(c),
          })),
          isError: result.isError,
        };
      },
    );
  }

  server.registerTool(
    "orchestrator__status",
    {
      description: "List all connected servers and their available tools",
      inputSchema: {},
    },
    async () => {
      const servers = router.getConnectedServers();
      const status = [...servers.entries()].map(([name, s]) => ({
        name,
        packageName: s.entry.packageName,
        tags: s.entry.tags,
        tools: s.tools.map((t) => t.name),
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  const shutdown = async () => {
    console.error("[orchestrator] shutting down...");
    await router.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[orchestrator] unified MCP server running");
}

/**
 * Build a Zod schema record from a JSON Schema inputSchema object.
 * Handles the common case of { type: "object", properties: { ... }, required: [...] }.
 * Falls back to z.any() for complex/unknown shapes.
 */
function buildZodSchema(
  jsonSchema: Record<string, unknown>,
): Record<string, z.ZodType> {
  const result: Record<string, z.ZodType> = {};
  const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (jsonSchema.required as string[]) ?? [];

  if (!properties) return result;

  for (const [key, propSchema] of Object.entries(properties)) {
    const isRequired = required.includes(key);
    const description = (propSchema.description as string) ?? undefined;
    let schema: z.ZodType;

    switch (propSchema.type) {
      case "string": {
        const enumVals = propSchema.enum as string[] | undefined;
        if (enumVals && enumVals.length >= 2) {
          schema = z.enum(enumVals as [string, ...string[]]);
        } else {
          schema = z.string();
        }
        break;
      }
      case "number":
      case "integer":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      default:
        schema = z.any();
    }

    if (description) schema = schema.describe(description);
    if (!isRequired) schema = schema.optional();

    result[key] = schema;
  }

  return result;
}

main().catch((err) => {
  console.error("[orchestrator] fatal:", err);
  process.exit(1);
});
