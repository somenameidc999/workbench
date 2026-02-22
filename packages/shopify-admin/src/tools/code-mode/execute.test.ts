import { test, expect, describe, mock, beforeEach } from "bun:test";
import { handleExecute } from "./execute.tool";

const mockResolveAccessToken = mock(async (_shop: string) => ({
  accessToken: "shpat_test_token",
  shopDomain: "test-store.myshopify.com",
}));

mock.module("../../utils/resolve-token.js", () => ({
  resolveAccessToken: mockResolveAccessToken,
  domainToShop: (d: string) => d.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0] ?? d,
}));

// Mock global fetch for the shopify client
const originalFetch = globalThis.fetch;

describe("execute tool", () => {
  beforeEach(() => {
    mockResolveAccessToken.mockClear();
  });

  test("executes code with shopify.query()", async () => {
    const mockData = { product: { id: "gid://shopify/Product/1", title: "Widget" } };
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ data: mockData }), {
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await handleExecute({
      shop: "test-store.myshopify.com",
      code: `
        const data = await shopify.query('{ product(id: "gid://shopify/Product/1") { id title } }');
        return data;
      `,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toEqual(mockData);
    expect(mockResolveAccessToken).toHaveBeenCalledWith("test-store.myshopify.com");

    globalThis.fetch = originalFetch;
  });

  test("returns error when token resolution fails", async () => {
    mockResolveAccessToken.mockImplementationOnce(async () => {
      throw new Error('No access token found for shop "bad-store.myshopify.com". Run shopify_generate_access_token first.');
    });

    const result = await handleExecute({
      shop: "bad-store.myshopify.com",
      code: "return await shopify.query('{ shop { name } }');",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("error");
    expect(parsed.error).toContain("No access token found");
    expect(result.isError).toBe(true);
  });

  test("returns error for code that throws", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ data: {} }), {
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await handleExecute({
      shop: "test-store.myshopify.com",
      code: 'throw new Error("user code error");',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("error");
    expect(parsed.error).toBe("user code error");

    globalThis.fetch = originalFetch;
  });

  test("handles GraphQL errors from Shopify", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ errors: [{ message: "Access denied" }] }), {
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await handleExecute({
      shop: "test-store.myshopify.com",
      code: `
        try {
          return await shopify.query('{ shop { name } }');
        } catch(e) {
          return { caught: e.message };
        }
      `,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result.caught).toContain("Access denied");

    globalThis.fetch = originalFetch;
  });

  test("captures logs from execute code", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ data: { shop: { name: "Test" } } }), {
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await handleExecute({
      shop: "test-store.myshopify.com",
      code: `console.log("fetching shop"); const d = await shopify.query("{ shop { name } }"); return d;`,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.logs).toEqual(["fetching shop"]);

    globalThis.fetch = originalFetch;
  });
});
