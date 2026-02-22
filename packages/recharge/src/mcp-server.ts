import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { rechargeCodemode } from "./codemode";

const server = new McpServer({
  name: "recharge",
  version: "0.1.0",
});

server.registerTool("recharge_codemode", {
  description: rechargeCodemode.description!,
  inputSchema: {
    code: z.string().describe(
      "An async arrow function using the `codemode` object to call Recharge API tools. " +
      "Example: async () => { const customers = await codemode.recharge_2021_11_customers_list({ account: 'my-account' }); return customers; }"
    ),
  },
}, async ({ code }) => {
  const result = await rechargeCodemode.execute!({ code: code as string }, {});
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(result, null, 2),
    }],
    isError: !!result.error,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
