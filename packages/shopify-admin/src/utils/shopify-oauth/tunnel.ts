import { CloudflaredTunnel } from "./tunnel-providers/cloudflared.js";
import { LocaltunnelTunnel } from "./tunnel-providers/localtunnel.js";

export interface TunnelProvider {
  start(port: number): Promise<string>;
  stop(): Promise<void>;
}

export type TunnelProviderName = "cloudflared" | "localtunnel";

export function createTunnelProvider(name: TunnelProviderName): TunnelProvider {
  switch (name) {
    case "cloudflared":
      return new CloudflaredTunnel();
    case "localtunnel":
      return new LocaltunnelTunnel();
    default:
      throw new Error(`Unknown tunnel provider: ${name}`);
  }
}
