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

/** Espejo de `KillOutcome` en src-tauri/src/lib.rs. */
export type KillOutcome = {
  pid: number;
  killed: boolean;
  error: string | null;
};

export const RUNTIMES: Record<Runtime, { label: string; color: string }> = {
  node: { label: "Node.js", color: "var(--color-node)" },
  python: { label: "Python", color: "var(--color-python)" },
  dotnet: { label: ".NET", color: "var(--color-dotnet)" },
};

/** Intervalos ofrecidos para el refresco automatico, en milisegundos. */
export const REFRESH_INTERVALS = [
  { label: "Off", ms: 0 },
  { label: "2s", ms: 2000 },
  { label: "5s", ms: 5000 },
] as const;

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatMemory(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}
