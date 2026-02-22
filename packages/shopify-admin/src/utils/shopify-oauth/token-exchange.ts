import type { ShopifyTokenResponse } from "./types.js";

export interface TokenExchangeParams {
  shop: string;
  code: string;
  apiKey: string;
  apiSecret: string;
}

export async function exchangeCodeForToken(
  params: TokenExchangeParams
): Promise<ShopifyTokenResponse> {
  const url = `https://${params.shop}/admin/oauth/access_token`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: params.apiKey,
      client_secret: params.apiSecret,
      code: params.code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (!data.access_token || typeof data.access_token !== "string") {
    throw new Error(
      `Token exchange response missing access_token: ${JSON.stringify(data)}`
    );
  }

  return {
    access_token: data.access_token,
    scope: typeof data.scope === "string" ? data.scope : "",
  };
}
