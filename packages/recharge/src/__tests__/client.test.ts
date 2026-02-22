import { test, expect, mock, beforeEach } from "bun:test";

const originalFetch = globalThis.fetch;

function mockFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init: init ?? {} });
    const resp = responses[Math.min(callIndex++, responses.length - 1)];
    return new Response(JSON.stringify(resp.body), {
      status: resp.status,
      headers: { "content-type": "application/json", ...(resp.headers ?? {}) },
    });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

// Mock resolveRechargeCredentials so tests don't need workbench.config.ts
const mockCredentials = { token: "test-token-123" };

// We need to mock the auth module before importing http
const { rechargeRequest } = await (async () => {
  const authModule = await import("../../src/client/auth");
  mock.module("../../src/client/auth", () => ({
    resolveRechargeCredentials: async () => mockCredentials,
  }));

  // Re-import http to pick up mocked auth
  // Since Bun caches modules, we use the direct import
  // and rely on the mock above for auth resolution
  return await import("../../src/client/http");
})();

test("sends correct headers including X-Recharge-Version and access token", async () => {
  const calls = mockFetch([{ status: 200, body: { customer: { id: 1 } } }]);

  const result = await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/customers/1",
  });

  expect(calls.length).toBe(1);
  const headers = calls[0].init.headers as Record<string, string>;
  expect(headers["X-Recharge-Version"]).toBe("2021-11");
  expect(headers["X-Recharge-Access-Token"]).toBe("test-token-123");
  expect(headers["Content-Type"]).toBe("application/json");
  expect(result.status).toBe(200);
  expect(result.data).toEqual({ customer: { id: 1 } });
});

test("appends query parameters to URL", async () => {
  const calls = mockFetch([{ status: 200, body: { customers: [] } }]);

  await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/customers",
    query: { email: "test@example.com", limit: 10, missing: undefined },
  });

  const url = new URL(calls[0].url);
  expect(url.searchParams.get("email")).toBe("test@example.com");
  expect(url.searchParams.get("limit")).toBe("10");
  expect(url.searchParams.has("missing")).toBe(false);
});

test("sends JSON body for POST requests", async () => {
  const calls = mockFetch([{ status: 201, body: { customer: { id: 2 } } }]);

  await rechargeRequest({
    shop: "test-store",
    method: "POST",
    path: "/customers",
    body: { email: "new@example.com", first_name: "Test", last_name: "User" },
  });

  const body = JSON.parse(calls[0].init.body as string);
  expect(body.email).toBe("new@example.com");
  expect(body.first_name).toBe("Test");
});

test("retries on 429 with exponential backoff", async () => {
  const calls = mockFetch([
    { status: 429, body: { error: "rate limited" }, headers: { "retry-after": "1" } },
    { status: 429, body: { error: "rate limited" } },
    { status: 200, body: { ok: true } },
  ]);

  const result = await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/customers",
    _initialBackoffMs: 10,
  });

  expect(calls.length).toBe(3);
  expect(result.status).toBe(200);
  expect(result.data).toEqual({ ok: true });
});

test("retries on 5xx errors", async () => {
  const calls = mockFetch([
    { status: 502, body: { error: "bad gateway" } },
    { status: 200, body: { recovered: true } },
  ]);

  const result = await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/subscriptions",
    _initialBackoffMs: 10,
  });

  expect(calls.length).toBe(2);
  expect(result.status).toBe(200);
});

test("returns error response after max retries exhausted", async () => {
  const calls = mockFetch([
    { status: 429, body: { error: "rate limited" } },
    { status: 429, body: { error: "rate limited" } },
    { status: 429, body: { error: "rate limited" } },
    { status: 429, body: { error: "rate limited" } },
  ]);

  const result = await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/charges",
    _initialBackoffMs: 10,
  });

  // 1 initial + 3 retries = 4 total calls
  expect(calls.length).toBe(4);
  expect(result.status).toBe(429);
});

test("extracts rate limit metadata from response headers", async () => {
  mockFetch([{
    status: 200,
    body: { ok: true },
    headers: {
      "x-recharge-limit": "40",
      "x-recharge-limit-remaining": "38",
      "retry-after": "2",
    },
  }]);

  const result = await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/customers",
  });

  expect(result.rateLimit).toEqual({
    limit: "40",
    remaining: "38",
    reset: "2",
  });
});

test("does not send body for GET requests", async () => {
  const calls = mockFetch([{ status: 200, body: {} }]);

  await rechargeRequest({
    shop: "test-store",
    method: "GET",
    path: "/addresses",
  });

  expect(calls[0].init.body).toBeUndefined();
});
