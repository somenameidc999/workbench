import { loadWorkbenchConfig, type LoadConfigOptions } from "@toolbox/core";

export type RechargeCredentials = {
  token: string;
};

/**
 * Resolve Recharge API token for a store.
 * Expects a workbench.config.ts entry like:
 *   { name: "recharge-seed-staging", access_token: process.env.RECHARGE_API_TOKEN }
 */
export async function resolveRechargeCredentials(
  account: string,
  options?: LoadConfigOptions
): Promise<RechargeCredentials> {
  const config = await loadWorkbenchConfig(options);

  for (const entry of config.stores) {
    if (entry.name === account && entry.access_token) {
      if (!entry.access_token) {
        throw new Error(
          `Recharge account "${account}" found in config but access_token is empty. Check your env vars.`
        );
      }
      return { token: entry.access_token };
    }
  }

  const known = config.stores
    .filter((e) => e.access_token)
    .map((e) => e.name)
    .filter(Boolean);

  throw new Error(
    `Unknown Recharge account "${account}". Known Recharge accounts: ${known.join(", ") || "(none)"}. Add { name: "${account}", access_token: process.env.YOUR_TOKEN } to workbench.config.ts stores.`
  );
}
