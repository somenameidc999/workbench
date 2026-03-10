declare module "bunfig" {
  export function loadConfig<T>(options: {
    name: string;
    cwd: string;
    defaultConfig: T;
    endpoint?: string;
    headers?: Record<string, string>;
  }): Promise<T>;
}
