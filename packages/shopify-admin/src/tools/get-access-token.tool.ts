import { resolveAccessToken } from "../utils/resolve-token.js";
import { listStoreIds } from "@toolbox/core";

export interface GetAccessTokenArgs {
  shop: string;
}

export async function handleGetAccessToken(args: GetAccessTokenArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    const result = await resolveAccessToken(args.shop);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            shop: result.shopDomain,
            access_token: result.accessToken,
            token_type: result.tokenType,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    let availableStores: string[] = [];
    try {
      availableStores = await listStoreIds();
    } catch {
      // ignore
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message,
            ...(availableStores.length > 0 && {
              available_stores: availableStores,
            }),
            hint: "Ensure the store is configured in workbench.config.ts with name, client_id, and client_secret.",
          }),
        },
      ],
      isError: true,
    };
  }
}
