export type SandboxResult<T> =
  | { readonly ok: true; readonly data: T; readonly logs: readonly string[] }
  | { readonly ok: false; readonly error: string; readonly logs: readonly string[] };

export type SandboxOptions = {
  readonly timeoutMs?: number;
};
