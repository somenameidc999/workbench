import type { SandboxResult, SandboxOptions } from "./types.js";

const SAFE_BUILTINS: Record<string, unknown> = {
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Map,
  Set,
  Date,
  RegExp,
  Promise,
  Error,
  TypeError,
  RangeError,
  Math,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  undefined,
  NaN,
  Infinity,
};

// Only identifiers that are valid JS parameter names — reserved keywords
// (import, eval, etc.) are already blocked by the language parser.
const BLOCKED_GLOBALS = [
  "process",
  "Bun",
  "require",
  "globalThis",
  "global",
  "self",
  "window",
  "fetch",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "clearTimeout",
  "clearInterval",
  "clearImmediate",
  "queueMicrotask",
  "__dirname",
  "__filename",
];

function buildConsoleProxy(): { proxy: Record<string, (...args: unknown[]) => void>; logs: string[] } {
  const logs: string[] = [];
  const capture = (...args: unknown[]) => {
    logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  return {
    logs,
    proxy: { log: capture, info: capture, warn: capture, error: capture, debug: capture },
  };
}

export async function runInSandbox<T>(
  code: string,
  globals: Record<string, unknown>,
  options?: SandboxOptions,
): Promise<SandboxResult<T>> {
  const { proxy: console, logs } = buildConsoleProxy();

  const injected: Record<string, unknown> = { ...SAFE_BUILTINS, console, ...globals };

  // Shadow blocked globals with undefined so code can't escape
  for (const name of BLOCKED_GLOBALS) {
    if (!(name in injected)) {
      injected[name] = undefined;
    }
  }

  const paramNames = Object.keys(injected);
  const paramValues = Object.values(injected);

  const wrapped = `"use strict"; return (async () => { ${code} })();`;

  let fn: (...args: unknown[]) => Promise<unknown>;
  try {
    fn = new Function(...paramNames, wrapped) as typeof fn;
  } catch (err) {
    return { ok: false, error: `Syntax error: ${err instanceof Error ? err.message : String(err)}`, logs };
  }

  const execute = async (): Promise<SandboxResult<T>> => {
    try {
      const result = await fn(...paramValues);
      return { ok: true, data: result as T, logs };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), logs };
    }
  };

  if (options?.timeoutMs != null && options.timeoutMs > 0) {
    const timeout = new Promise<SandboxResult<T>>((_, reject) => {
      setTimeout(() => reject(new Error(`Sandbox execution timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
    });
    try {
      return await Promise.race([execute(), timeout]);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), logs };
    }
  }

  return execute();
}
