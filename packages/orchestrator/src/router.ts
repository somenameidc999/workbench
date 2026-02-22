import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ServerEntry } from "./registry";

export interface ConnectedServer {
  entry: ServerEntry;
  client: Client;
  transport: StdioClientTransport;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>;
}

/**
 * Connect to a child MCP server via stdio transport and discover its tools.
 */
async function connectServer(entry: ServerEntry): Promise<ConnectedServer> {
  const [command, ...args] = entry.command;
  const transport = new StdioClientTransport({
    command,
    args,
    cwd: entry.cwd,
    env: { ...process.env } as Record<string, string>,
    stderr: "pipe",
  });

  const stderrStream = transport.stderr;
  if (stderrStream && "on" in stderrStream) {
    (stderrStream as NodeJS.ReadableStream).on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) console.error(`[${entry.name}] ${line}`);
      }
    });
  }

  const client = new Client(
    { name: `orchestrator->${entry.name}`, version: "0.0.1" },
    { capabilities: {} },
  );

  await client.connect(transport);

  const { tools: rawTools } = await client.listTools();
  const tools = rawTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));

  console.error(`[orchestrator] connected to ${entry.name}: ${tools.length} tools discovered`);

  return { entry, client, transport, tools };
}

export class Router {
  private servers = new Map<string, ConnectedServer>();
  /** tool name -> server name */
  private toolIndex = new Map<string, string>();

  async connectAll(entries: ServerEntry[]): Promise<void> {
    for (const entry of entries) {
      try {
        const server = await connectServer(entry);
        this.servers.set(entry.name, server);
        for (const tool of server.tools) {
          const qualifiedName = `${entry.name}__${tool.name}`;
          this.toolIndex.set(qualifiedName, entry.name);
        }
      } catch (err) {
        console.error(
          `[orchestrator] failed to connect to ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * List all tools across all connected servers, namespaced as `serverName__toolName`.
   */
  allTools(): Array<{
    qualifiedName: string;
    serverName: string;
    originalName: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }> {
    const result: Array<{
      qualifiedName: string;
      serverName: string;
      originalName: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }> = [];

    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        result.push({
          qualifiedName: `${serverName}__${tool.name}`,
          serverName,
          originalName: tool.name,
          description: tool.description
            ? `[${serverName}] ${tool.description}`
            : `[${serverName}] ${tool.name}`,
          inputSchema: tool.inputSchema,
        });
      }
    }
    return result;
  }

  /**
   * Call a tool by its qualified name (serverName__toolName).
   */
  async callTool(
    qualifiedName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const serverName = this.toolIndex.get(qualifiedName);
    if (!serverName) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${qualifiedName}` }],
        isError: true,
      };
    }

    const server = this.servers.get(serverName);
    if (!server) {
      return {
        content: [{ type: "text", text: `Server ${serverName} not connected` }],
        isError: true,
      };
    }

    const originalName = qualifiedName.replace(`${serverName}__`, "");

    try {
      const result = await server.client.callTool({ name: originalName, arguments: args });
      return result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error calling ${qualifiedName}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Resolve which server owns a tool (by qualified name).
   */
  resolveServer(qualifiedName: string): ConnectedServer | undefined {
    const serverName = this.toolIndex.get(qualifiedName);
    return serverName ? this.servers.get(serverName) : undefined;
  }

  getConnectedServers(): Map<string, ConnectedServer> {
    return this.servers;
  }

  async shutdown(): Promise<void> {
    console.error("[orchestrator] shutting down router connections...");
    for (const [name, server] of this.servers) {
      try {
        await server.transport.close();
        console.error(`[orchestrator] disconnected from ${name}`);
      } catch {}
    }
    this.servers.clear();
    this.toolIndex.clear();
  }
}
