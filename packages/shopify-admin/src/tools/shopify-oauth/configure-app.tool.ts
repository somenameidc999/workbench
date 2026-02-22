import { AppConfigStore } from "../../utils/shopify-oauth/config.js";

const appConfigStore = new AppConfigStore();

export interface ConfigureAppArgs {
  app_name: string;
  api_key: string;
  api_secret: string;
  scopes: string;
}

export async function handleConfigureApp(args: ConfigureAppArgs): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  await appConfigStore.set({
    app_name: args.app_name,
    api_key: args.api_key,
    api_secret: args.api_secret,
    scopes: args.scopes,
  });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "success",
          message: `App "${args.app_name}" configured successfully.`,
          app_name: args.app_name,
          scopes: args.scopes,
        }),
      },
    ],
  };
}
