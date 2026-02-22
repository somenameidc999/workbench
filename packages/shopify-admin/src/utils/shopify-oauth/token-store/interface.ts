import type { StoredToken } from "../types.js";

export interface TokenStore {
  get(shop: string, tokenType?: StoredToken["token_type"]): Promise<StoredToken | null>;
  set(token: StoredToken): Promise<void>;
  delete(shop: string, tokenType?: StoredToken["token_type"]): Promise<boolean>;
  list(appName?: string): Promise<StoredToken[]>;
}
