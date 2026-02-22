import { createTokenStore } from "../../utils/shopify-oauth/token-store/index.js";

const tokenStore = createTokenStore();

export interface ListTokensArgs {
  app_name?: string;
}

export async function handleListTokens(args: ListTokensArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const tokens = await tokenStore.list(args?.app_name);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "success",
          count: tokens.length,
          tokens: tokens.map((t) => ({
            app_name: t.app_name,
            shop: t.shop,
            scope: t.scope,
            created_at: t.created_at,
            token_prefix: t.access_token.substring(0, 12) + "...",
          })),
        }),
      },
    ],
  };
}
