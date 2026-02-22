import { spawn, type ChildProcess } from "node:child_process";

export class CloudflaredTunnel {
  private process: ChildProcess | null = null;

  async start(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "cloudflared tunnel failed to start within 15s. Is cloudflared installed? Run: brew install cloudflare/cloudflare/cloudflared"
          )
        );
      }, 15000);

      this.process = spawn(
        "cloudflared",
        ["tunnel", "--url", `http://localhost:${port}`],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      let stderrBuffer = "";
      this.process.stderr?.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
        const match = stderrBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });

      this.process.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        if (err.code === "ENOENT") {
          reject(
            new Error(
              "cloudflared not found. Install it: brew install cloudflare/cloudflare/cloudflared"
            )
          );
        } else {
          reject(err);
        }
      });

      this.process.on("exit", (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(
            new Error(`cloudflared exited with code ${code}. stderr: ${stderrBuffer}`)
          );
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}
