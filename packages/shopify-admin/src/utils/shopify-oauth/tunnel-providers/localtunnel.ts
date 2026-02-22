// Optional: use localtunnel if installed. Fallback for when cloudflared is not available.
export class LocaltunnelTunnel {
  private tunnel: { close: () => void; url: string } | null = null;

  async start(port: number): Promise<string> {
    try {
      const lt = await import("localtunnel");
      this.tunnel = await lt.default({ port });
      return this.tunnel.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `localtunnel failed. Install it with: bun add -d localtunnel. ${message}`
      );
    }
  }

  async stop(): Promise<void> {
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = null;
    }
  }
}
