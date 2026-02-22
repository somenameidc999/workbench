import { createTokenStore } from "../../utils/shopify-oauth/token-store/index.js";

const tokenStore = createTokenStore();

export interface GetTokenArgs {
  shop: string;
}

export async function handleGetStoredToken(args: GetTokenArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const token = await tokenStore.get(args.shop);
  if (!token) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "not_found",
            message: `No token found for shop "${args.shop}".`,
          }),
        },
      ],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ status: "success", ...token }),
      },
    ],
  };
}
