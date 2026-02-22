import { test, expect, describe } from "bun:test";
import { rechargeCodemode, allRechargeTools, BunLocalExecutor } from "../index";

describe("codemode integration", () => {
  test("all tools loaded", () => {
    const count = Object.keys(allRechargeTools).length;
    expect(count).toBeGreaterThanOrEqual(40);
    console.log(`${count} tools loaded`);
  });

  test("codemode description generated with type definitions", () => {
    expect(rechargeCodemode.description).toBeDefined();
    expect(rechargeCodemode.description!.length).toBeGreaterThan(1000);
    expect(rechargeCodemode.description).toContain("codemode");
    expect(rechargeCodemode.description).toContain("Recharge_2021_11");
  });

  test("simple code execution", async () => {
    const result = await rechargeCodemode.execute!({ code: "async () => { return 1 + 1; }" }, {});
    expect(result.result).toBe(2);
    expect(result.error).toBeUndefined();
  });

  test("error handling in executed code", async () => {
    await expect(
      rechargeCodemode.execute!({ code: 'async () => { throw new Error("test error"); }' }, {})
    ).rejects.toThrow("test error");
  });

  test("console.log captured in logs", async () => {
    const result = await rechargeCodemode.execute!(
      { code: 'async () => { console.log("hello from sandbox"); return "done"; }' },
      {}
    );
    expect(result.result).toBe("done");
    expect(result.logs).toContain("hello from sandbox");
  });

  test("BunLocalExecutor independently", async () => {
    const executor = new BunLocalExecutor();
    const fns = {
      add: async (a: number, b: number) => a + b,
    };
    const result = await executor.execute(
      "async () => { const sum = await codemode.add(3, 4); return sum; }",
      fns as any
    );
    expect(result.result).toBe(7);
  });
});
