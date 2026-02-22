import { resolveRechargeCredentials } from "./auth";

const API_VERSION = "2021-11";
const BASE_URL = "https://api.rechargeapps.com";

const MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 1000;

export type RechargeRequestOptions = {
  account: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Override initial backoff for testing (ms). Default 1000. */
  _initialBackoffMs?: number;
};

export type RechargeResponse = {
  status: number;
  data: unknown;
  rateLimit?: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
  };
};

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function extractRateLimit(headers: Headers) {
  return {
    limit: headers.get("x-recharge-limit"),
    remaining: headers.get("x-recharge-limit-remaining") ?? headers.get("x-request-limit"),
    reset: headers.get("retry-after"),
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rechargeRequest(opts: RechargeRequestOptions): Promise<RechargeResponse> {
  const { token } = await resolveRechargeCredentials(opts.account);
  if (!token) throw new Error(`No Recharge API token resolved for account "${opts.account}"`);
  const initialBackoff = opts._initialBackoffMs ?? DEFAULT_BACKOFF_MS;

  const url = buildUrl(opts.path, opts.query);
  const headers: Record<string, string> = {
    "X-Recharge-Access-Token": token,
    "X-Recharge-Version": API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = initialBackoff * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }

    try {
      const response = await fetch(url, {
        method: opts.method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });

      const rateLimit = extractRateLimit(response.headers);

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Recharge API ${response.status}: ${response.statusText}`);
        if (attempt < MAX_RETRIES) continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      return { status: response.status, data, rateLimit };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw lastError ?? new Error("Recharge request failed after retries");
}
