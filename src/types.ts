/** Espejo de `Runtime` en src-tauri/src/processes.rs. */
export type Runtime = "node" | "python" | "dotnet" | "other";

/** Espejo de `ProcessInfo` en src-tauri/src/processes.rs. */
export type ProcessInfo = {
  pid: number;
  name: string;
  runtime: Runtime;
  cpu: number;
  memoryMb: number;
  runTimeSecs: number;
  /** Puertos TCP en escucha; vacio si el proceso no sirve en ninguno. */
  ports: number[];
  /** Segundos seguidos sin actividad de CPU. 0 con el Zombie Finder apagado. */
  idleSecs: number;
  /** Parado desde hace mas del tiempo configurado y ocupando algun puerto. */
  zombie: boolean;
};

/** Espejo de `KillOutcome` en src-tauri/src/processes.rs. */
export type KillOutcome = {
  pid: number;
  killed: boolean;
  error: string | null;
  freedPorts: number[];
  name: string;
};

/** Espejo de `KillSource` en src-tauri/src/storage.rs. */
export type KillSource = "window" | "tray" | "hotkey" | "auto";

/** Espejo de `HistoryEntry` en src-tauri/src/storage.rs. */
export type HistoryEntry = {
  pid: number;
  name: string;
  freedPorts: number[];
  killedAt: number;
  source: KillSource;
};

/** Espejo de `Theme` en src-tauri/src/storage.rs. */
export type Theme = "system" | "light" | "dark";

/** Espejo de `Settings` en src-tauri/src/storage.rs. */
export type Settings = {
  customNames: string[];
  hotkeyEnabled: boolean;
  refreshMs: number;
  theme: Theme;
  autoKillEnabled: boolean;
  autoKillMb: number;
  zombieEnabled: boolean;
  zombieMinutes: number;
};

/** Espejo de `MIN_AUTO_KILL_MB` en src-tauri/src/storage.rs. Rust lo impone; aqui
 *  solo sirve para que el campo no deje escribir algo que va a corregirse solo. */
export const AUTO_KILL_MIN_MB = 256;

/** Espejo de `MIN_ZOMBIE_MINUTES` en src-tauri/src/storage.rs. */
export const ZOMBIE_MIN_MINUTES = 1;

/** Evento que emite Rust con cada lista nueva de procesos. */
export const PROCESSES_UPDATED = "processes-updated";

/** Evento con el avance de la descarga de una actualizacion: `[bajado, total]`. */
export const UPDATE_PROGRESS = "update-progress";

/** Espejo de `ReleaseInfo` en src-tauri/src/update.rs. */
export type ReleaseInfo = {
  tag: string;
  version: string;
  notes: string;
  htmlUrl: string;
  assetUrl: string;
  assetName: string;
  assetSize: number;
  /** URL del `.sha256`. Vacia si el release no lo publica: entonces no se descarga. */
  checksumUrl: string;
};

export const RUNTIMES: Record<Runtime, { label: string; color: string }> = {
  node: { label: "Node.js", color: "var(--color-node)" },
  python: { label: "Python", color: "var(--color-python)" },
  dotnet: { label: ".NET", color: "var(--color-dotnet)" },
  other: { label: "Otros", color: "var(--color-other)" },
};

export const KILL_SOURCES: Record<KillSource, string> = {
  window: "Ventana",
  tray: "Bandeja",
  hotkey: "Ctrl+Alt+K",
  auto: "Auto-Kill",
};

export const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

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

/** Rust guarda epoch en ms; el formato lo pone aqui la configuracion del equipo. */
export function formatTimestamp(millis: number): string {
  return new Date(millis).toLocaleString();
}
