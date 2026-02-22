/** Response from Shopify POST /admin/oauth/access_token (authorization code exchange). */
export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

/** Stored token record (file or Redis). */
export interface StoredToken {
  access_token: string;
  scope: string;
  shop: string;
  app_name: string;
  created_at: string;
  source: string;
  token_type: "offline" | "client_credentials";
  expires_at?: string;
}
