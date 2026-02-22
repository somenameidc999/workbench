import { loadSchema } from "../../schema/load-schema.js";
import { runInSandbox } from "../../sandbox/executor.js";

export interface SearchArgs {
  code: string;
}

export async function handleSearch(args: SearchArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const schema = await loadSchema();
    const result = await runInSandbox(args.code, { schema: Object.freeze(schema) });

    if (result.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "success", result: result.data, logs: result.logs }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ status: "error", error: result.error, logs: result.logs }),
        },
      ],
      isError: true,
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
}
