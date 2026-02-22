import type { TokenStore } from "./interface.js";
import { FileTokenStore } from "./file-store.js";

export type { TokenStore } from "./interface.js";

export function createTokenStore(): TokenStore {
  return new FileTokenStore();
}
