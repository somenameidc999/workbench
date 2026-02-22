import { test, expect, describe } from "bun:test";
import { runInSandbox } from "./executor";

describe("runInSandbox", () => {
  test("returns primitive value", async () => {
    const result = await runInSandbox("return 42;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(42);
  });

  test("returns object value", async () => {
    const result = await runInSandbox('return { name: "test", count: 3 };', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: "test", count: 3 });
  });

  test("accesses injected globals", async () => {
    const data = { items: [1, 2, 3] };
    const result = await runInSandbox("return data.items.length;", { data });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(3);
  });

  test("captures console.log output", async () => {
    const result = await runInSandbox('console.log("hello"); console.warn("warn"); return "done";', {});
    expect(result.ok).toBe(true);
    expect(result.logs).toEqual(["hello", "warn"]);
  });

  test("captures console.log with multiple args", async () => {
    const result = await runInSandbox('console.log("a", 1, true); return null;', {});
    expect(result.logs).toEqual(["a 1 true"]);
  });

  test("reports syntax errors", async () => {
    const result = await runInSandbox("return {{{;", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Syntax error");
  });

  test("reports runtime errors", async () => {
    const result = await runInSandbox('throw new Error("boom");', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("boom");
  });

  test("process is inaccessible", async () => {
    const result = await runInSandbox("return typeof process;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("undefined");
  });

  test("Bun is inaccessible", async () => {
    const result = await runInSandbox("return typeof Bun;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("undefined");
  });

  test("require is inaccessible", async () => {
    const result = await runInSandbox("return typeof require;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("undefined");
  });

  test("fetch is inaccessible", async () => {
    const result = await runInSandbox("return typeof fetch;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("undefined");
  });

  test("globalThis is inaccessible", async () => {
    const result = await runInSandbox("return typeof globalThis;", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("undefined");
  });

  test("timeout triggers for long-running code", async () => {
    const result = await runInSandbox(
      "await new Promise(r => {}); return 1;",
      {},
      { timeoutMs: 100 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("timed out");
  });

  test("frozen globals cannot be mutated", async () => {
    const obj = Object.freeze({ x: 1 });
    const result = await runInSandbox(
      'try { obj.x = 2; return "mutated"; } catch(e) { return "frozen"; }',
      { obj },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("frozen");
  });

  test("async code works", async () => {
    const result = await runInSandbox(
      "const a = await Promise.resolve(10); const b = await Promise.resolve(20); return a + b;",
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(30);
  });

  test("safe builtins are available", async () => {
    const result = await runInSandbox(
      "return [typeof JSON, typeof Array, typeof Map, typeof Math, typeof Date].join(',');",
      {},
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("object,function,function,object,function");
  });
});
