import { Subprocess } from "bun";
import type { ServerEntry } from "./registry";

export type ChildState = "starting" | "running" | "crashed" | "stopped";

export interface ManagedChild {
  entry: ServerEntry;
  state: ChildState;
  proc: Subprocess | null;
  restarts: number;
  stdinWriter: WritableStreamDefaultWriter<Uint8Array> | null;
}

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2000;
const ENV_FILE = "../../.env";

export class ProcessManager {
  private children = new Map<string, ManagedChild>();
  private shutdownRequested = false;

  constructor(private entries: ServerEntry[]) {}

  async startAll(): Promise<void> {
    for (const entry of this.entries) {
      await this.startChild(entry);
    }
    this.installSignalHandlers();
  }

  private async startChild(entry: ServerEntry): Promise<void> {
    if (this.shutdownRequested) return;

    const existing = this.children.get(entry.name);
    const restarts = existing?.restarts ?? 0;

    if (restarts >= MAX_RESTARTS) {
      console.error(`[orchestrator] ${entry.name}: max restarts (${MAX_RESTARTS}) reached, not restarting`);
      this.children.set(entry.name, {
        entry,
        state: "crashed",
        proc: null,
        restarts,
        stdinWriter: null,
      });
      return;
    }

    console.error(`[orchestrator] starting ${entry.name} (restart #${restarts})`);

    const proc = Bun.spawn(entry.command, {
      cwd: entry.cwd,
      env: { ...process.env },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    const child: ManagedChild = {
      entry,
      state: "running",
      proc,
      restarts,
      stdinWriter: proc.stdin.getWriter(),
    };

    this.children.set(entry.name, child);

    this.pipeStderr(entry.name, proc);

    proc.exited.then((code) => {
      if (this.shutdownRequested) return;
      console.error(`[orchestrator] ${entry.name} exited with code ${code}`);
      child.state = "crashed";
      child.proc = null;
      child.stdinWriter = null;
      child.restarts++;
      setTimeout(() => this.startChild(entry), RESTART_DELAY_MS);
    });
  }

  private async pipeStderr(name: string, proc: Subprocess): Promise<void> {
    if (!proc.stderr) return;
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (line.trim()) console.error(`[${name}] ${line}`);
        }
      }
    } catch {
      // stream closed
    }
  }

  getChild(name: string): ManagedChild | undefined {
    return this.children.get(name);
  }

  getAllChildren(): Map<string, ManagedChild> {
    return this.children;
  }

  status(): Array<{ name: string; state: ChildState; restarts: number; pid: number | null }> {
    return [...this.children.values()].map((c) => ({
      name: c.entry.name,
      state: c.state,
      restarts: c.restarts,
      pid: c.proc?.pid ?? null,
    }));
  }

  async shutdown(): Promise<void> {
    this.shutdownRequested = true;
    console.error("[orchestrator] shutting down all servers...");
    const kills: Promise<void>[] = [];

    for (const child of this.children.values()) {
      if (child.proc) {
        child.proc.kill("SIGTERM");
        kills.push(
          Promise.race([
            child.proc.exited.then(() => {}),
            new Promise<void>((r) => setTimeout(r, 5000)),
          ])
        );
      }
    }

    await Promise.all(kills);

    for (const child of this.children.values()) {
      if (child.proc) {
        try {
          child.proc.kill("SIGKILL");
        } catch {}
      }
      child.state = "stopped";
      child.proc = null;
      child.stdinWriter = null;
    }

    console.error("[orchestrator] all servers stopped");
  }

  private installSignalHandlers(): void {
    const handler = () => {
      this.shutdown().then(() => process.exit(0));
    };
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
  }
}
