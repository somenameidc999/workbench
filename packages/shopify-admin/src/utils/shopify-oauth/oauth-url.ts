export function buildOAuthUrl(params: {
  shop: string;
  apiKey: string;
  scopes: string;
  redirectUri: string;
  nonce: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.apiKey,
    scope: params.scopes,
    redirect_uri: params.redirectUri,
    state: params.nonce,
  });
  return `https://${params.shop}/admin/oauth/authorize?${query.toString()}`;
}
