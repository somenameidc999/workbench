export interface ExecuteResult {
  result: unknown;
  error?: string;
  logs?: string[];
}

export interface Executor {
  execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult>;
}

/**
 * Runs LLM-generated code in-process using AsyncFunction.
 * No sandboxing — code has full access to the Bun runtime.
 * Suitable for local dev workbenches only.
 */
export class BunLocalExecutor implements Executor {
  async execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult> {
    const logs: string[] = [];
    const mockConsole = {
      log: (...a: unknown[]) => logs.push(a.map(String).join(" ")),
      warn: (...a: unknown[]) => logs.push(`[warn] ${a.map(String).join(" ")}`),
      error: (...a: unknown[]) => logs.push(`[error] ${a.map(String).join(" ")}`),
    };

    try {
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      const fn = new AsyncFunction("codemode", "console", `return await (${code})()`);
      const result = await fn(fns, mockConsole);
      return { result, logs };
    } catch (err) {
      return {
        result: undefined,
        error: err instanceof Error ? err.message : String(err),
        logs,
      };
    }
  }
}
