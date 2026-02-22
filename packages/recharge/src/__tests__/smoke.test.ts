import { test, expect, mock, beforeEach } from "bun:test";
import { allRechargeTools } from "../tools/all";
import { addressTools } from "../tools/addresses";
import { customerTools } from "../tools/customers";
import { subscriptionTools } from "../tools/subscriptions";
import { chargeTools } from "../tools/charges";
import { discountTools } from "../tools/discounts";
import { productTools } from "../tools/products";
import { collectionTools } from "../tools/collections";

const originalFetch = globalThis.fetch;

function mockFetchWithCapture() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

mock.module("../client/auth", () => ({
  resolveRechargeCredentials: async () => ({
    token: "smoke-test-token",
  }),
}));

test("all 53 tools are registered in allRechargeTools", () => {
  const names = Object.keys(allRechargeTools);
  expect(names.length).toBe(53);
  expect(names.every(n => n.startsWith("recharge_2021_11_"))).toBe(true);

  const byResource = (prefix: string) => names.filter(n => n.startsWith(`recharge_2021_11_${prefix}`));
  expect(byResource("addresses_").length).toBe(7);
  expect(byResource("customers_").length).toBe(7);
  expect(byResource("subscriptions_").length).toBe(10);
  expect(byResource("charges_").length).toBe(11);
  expect(byResource("discounts_").length).toBe(5);
  expect(byResource("products_").length).toBe(5);
  expect(byResource("collections_").length).toBe(8);
});

test("smoke: customers_list sends GET to /customers", async () => {
  const calls = mockFetchWithCapture();
  const tool = customerTools.recharge_2021_11_customers_list;

  await tool.execute!({ account: "test-store", limit: 10 } as any, {} as any);

  expect(calls.length).toBe(1);
  expect(calls[0].method).toBe("GET");
  expect(calls[0].url).toContain("/customers");
  expect(calls[0].url).toContain("limit=10");
});

test("smoke: subscriptions_create sends POST with body", async () => {
  const calls = mockFetchWithCapture();
  const tool = subscriptionTools.recharge_2021_11_subscriptions_create;

  await tool.execute!({
    account: "test-store",
    address_id: 123,
    charge_interval_frequency: 30,
    next_charge_scheduled_at: "2025-01-01",
    order_interval_frequency: 30,
    order_interval_unit: "day",
    quantity: 1,
    external_variant_id: { ecommerce: "456" },
  } as any, {} as any);

  expect(calls.length).toBe(1);
  expect(calls[0].method).toBe("POST");
  expect(calls[0].url).toContain("/subscriptions");
  expect(calls[0].body).toEqual({
    address_id: 123,
    charge_interval_frequency: 30,
    next_charge_scheduled_at: "2025-01-01",
    order_interval_frequency: 30,
    order_interval_unit: "day",
    quantity: 1,
    external_variant_id: { ecommerce: "456" },
  });
});

test("smoke: charges_refund sends POST with charge_id in path", async () => {
  const calls = mockFetchWithCapture();
  const tool = chargeTools.recharge_2021_11_charges_refund;

  await tool.execute!({ account: "test-store", charge_id: 999, amount: "25.00" } as any, {} as any);

  expect(calls.length).toBe(1);
  expect(calls[0].method).toBe("POST");
  expect(calls[0].url).toContain("/charges/999/refund");
  expect(calls[0].body).toEqual({ amount: "25.00" });
});

test("smoke: addresses_delete sends DELETE with address_id in path", async () => {
  const calls = mockFetchWithCapture();
  const tool = addressTools.recharge_2021_11_addresses_delete;

  await tool.execute!({ account: "test-store", address_id: 42 } as any, {} as any);

  expect(calls.length).toBe(1);
  expect(calls[0].method).toBe("DELETE");
  expect(calls[0].url).toContain("/addresses/42");
});

test("smoke: discounts_create sends POST with body fields", async () => {
  const calls = mockFetchWithCapture();
  const tool = discountTools.recharge_2021_11_discounts_create;

  await tool.execute!({ account: "test-store", code: "SAVE10", value: 10, value_type: "percentage" } as any, {} as any);

  expect(calls.length).toBe(1);
  expect(calls[0].method).toBe("POST");
  expect(calls[0].url).toContain("/discounts");
  expect(calls[0].body).toEqual({ code: "SAVE10", value: 10, value_type: "percentage" });
});
