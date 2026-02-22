/**
 * Exchange client_id + client_secret for an Admin API access token (client credentials).
 * POST https://{shopDomain}/admin/oauth/access_token
 */
export async function getAccessToken(
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const host = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${host}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Shopify OAuth failed (${res.status}): ${text.slice(0, 500)}`
    );
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    return null;
  }
  return data.access_token;
}
