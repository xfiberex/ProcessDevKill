/** Espejo de `Runtime` en src-tauri/src/lib.rs. */
export type Runtime = "node" | "python" | "dotnet";

/** Espejo de `ProcessInfo` en src-tauri/src/lib.rs. */
export type ProcessInfo = {
  pid: number;
  name: string;
  runtime: Runtime;
  cpu: number;
  memoryMb: number;
  runTimeSecs: number;
};

export const RUNTIMES: Record<Runtime, { label: string; color: string }> = {
  node: { label: "Node.js", color: "var(--color-node)" },
  python: { label: "Python", color: "var(--color-python)" },
  dotnet: { label: ".NET", color: "var(--color-dotnet)" },
};
