import { createCodeTool } from "@cloudflare/codemode/ai";
import { BunLocalExecutor } from "./executor";
import { allRechargeTools } from "../tools/all";

const executor = new BunLocalExecutor();

export const rechargeCodemode = createCodeTool({
  tools: allRechargeTools,
  executor,
});
