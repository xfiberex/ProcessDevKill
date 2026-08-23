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

/** Espejo de `SystemUsage` en src-tauri/src/processes.rs. */
export type SystemUsage = {
  /** CPU del equipo entero, 0-100. */
  cpu: number;
  /** La parte de ese 0-100 que se llevan los procesos vigilados. */
  devCpu: number;
  usedMemoryMb: number;
  /** RAM instalada: el 100 % contra el que se pintan las dos barras. */
  totalMemoryMb: number;
  devMemoryMb: number;
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

/** Espejo de `ServiceFamily` en src-tauri/src/services.rs. */
export type ServiceFamily =
  | "sqlServer"
  | "postgres"
  | "mySql"
  | "mongoDb"
  | "redis"
  | "docker"
  | "iis"
  | "other";

/** Espejo de `ServiceState` en src-tauri/src/services.rs. */
export type ServiceState = "running" | "stopped" | "pending";

/** Espejo de `StartType` en src-tauri/src/services.rs. */
export type StartType =
  | "boot"
  | "system"
  | "automatic"
  | "automaticDelayed"
  | "manual"
  | "disabled"
  | "unknown";

/** Espejo de `ServiceDependent` en src-tauri/src/services.rs. */
export type ServiceDependent = {
  name: string;
  displayName: string;
};

/**
 * Espejo de `SettableStartType` en src-tauri/src/service_control.rs.
 *
 * **No son todos los de `StartType`.** Faltan `boot` y `system` a proposito: son de controladores
 * que carga el nucleo antes de que exista el escritorio, y ofrecerlos seria regalar una forma de
 * dejar un equipo sin arrancar. Falta `unknown`, que no es un valor sino la ausencia de uno.
 */
export type SettableStartType =
  | "automatic"
  | "automaticDelayed"
  | "manual"
  | "disabled";

/**
 * Los cuatro que la app pone, de mas automatico a menos.
 *
 * Es el orden de `services.msc`, y el que hace que la lista se lea como una escala. Vive aqui
 * porque la usan la vista —para pintar el desplegable— y App —para saber si un valor guardado en
 * el registro se puede volver a poner—.
 */
export const SETTABLE_START_TYPES: SettableStartType[] = [
  "automatic",
  "automaticDelayed",
  "manual",
  "disabled",
];

/** Espejo de `ServiceChange` en src-tauri/src/storage.rs. */
export type ServiceChange = {
  name: string;
  displayName: string;
  /** A lo que estaba **antes de que la app lo tocara la primera vez**: el valor al que se deshace. */
  from: StartType;
  to: StartType;
  /** Epoch en milisegundos. Lo formatea el frontend, que sabe la zona y el idioma. */
  changedAt: number;
};

/** Espejo de `ServiceStartupResult` en src-tauri/src/service_control.rs. */
export type ServiceStartupResult = {
  outcome: ServiceOutcome;
  /** El tipo de arranque **releido del SCM**, no el que se pidio. */
  startType: StartType;
};

/** Espejo de `ServiceAction` en src-tauri/src/service_control.rs. */
export type ServiceAction = "start" | "stop";

/** Espejo de `ServiceOutcome` en src-tauri/src/service_control.rs. */
export type ServiceOutcome =
  | "done"
  | "pending"
  | "cancelled"
  | "blocked"
  | "refused";

/** Espejo de `ServiceActionResult` en src-tauri/src/service_control.rs. */
export type ServiceActionResult = {
  outcome: ServiceOutcome;
  /**
   * El estado **releido del SCM** al terminar, no el que se supone. `null` si no se pudo
   * consultar. Ver `esperar_estado` en service_control.rs.
   */
  state: ServiceState | null;
  /** Quien impedia detenerlo. Solo viene con `outcome: "blocked"`. */
  blockers: ServiceDependent[];
};

/** Espejo de `ServiceInfo` en src-tauri/src/services.rs. */
export type ServiceInfo = {
  /** El nombre del SCM (`MSSQL$SQLEXPRESS`). Es la clave, y lo que se compara. */
  name: string;
  /** El nombre que enseña Windows, ya localizado por el sistema. Solo para leerlo. */
  displayName: string;
  family: ServiceFamily;
  state: ServiceState;
  startType: StartType;
  /** 0 si el servicio esta parado. */
  pid: number;
  /**
   * `null` cuando no se puede leer, que es **lo normal**: casi todos los servicios corren con otra
   * cuenta y un proceso sin elevar no puede abrirlos para preguntarles la memoria. Se pinta «—»,
   * nunca un 0 que el usuario se creeria.
   */
  memoryMb: number | null;
  /** Vacio es normal: SQL Express viene con TCP/IP desactivado y no escucha en ninguno. */
  ports: number[];
};

/** Espejo de `Theme` en src-tauri/src/storage.rs. */
export type Theme = "system" | "light" | "dark";

/** Espejo de `Language` en src-tauri/src/storage.rs. */
export type Language = "es" | "en";

/** Espejo de `Settings` en src-tauri/src/storage.rs. */
export type Settings = {
  customNames: string[];
  hotkeyEnabled: boolean;
  /** Si cerrar la ventana la esconde en la bandeja en vez de terminar la app. */
  closeToTray: boolean;
  refreshMs: number;
  theme: Theme;
  autoKillEnabled: boolean;
  autoKillMb: number;
  zombieEnabled: boolean;
  zombieMinutes: number;
  /** Lo usan los dos lados: la ventana para pintarse y Rust para la bandeja y las notificaciones. */
  language: Language;
  /** Servicios extra a vigilar. Lista aparte de `customNames`, que son ejecutables. */
  customServices: string[];
};

/** Espejo de `MIN_AUTO_KILL_MB` en src-tauri/src/storage.rs. Rust lo impone; aqui
 *  solo sirve para que el campo no deje escribir algo que va a corregirse solo. */
export const AUTO_KILL_MIN_MB = 256;

/** Espejo de `MIN_ZOMBIE_MINUTES` en src-tauri/src/storage.rs. */
export const ZOMBIE_MIN_MINUTES = 1;

/** Evento que emite Rust con cada lista nueva de procesos. */
export const PROCESSES_UPDATED = "processes-updated";

/** Evento con el consumo del equipo. Solo lo emite el hilo del poller, y por eso
 *  deja de llegar con el auto-refresco en "Off": ver `medir` en poller.rs. */
export const SYSTEM_USAGE = "system-usage";

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

// El color de cada runtime **no** es espejo de Rust y se queda aqui a proposito: es un `Record`
// indexado por un tipo espejo, asi que TypeScript obliga a completarlo cuando Rust gana una
// variante. Separarlo de su tipo perderia esa comprobacion a cambio de un archivo mas.
//
// Las **etiquetas** que lo acompañaban se fueron a `i18n.tsx` al traducir la app (T4-01), donde
// conservan la misma comprobacion: alli van con `satisfies Record<Runtime, string>`. Los
// formateadores, que no tenian esa atadura, ya se habian ido a `lib/format.ts`.

export const RUNTIME_COLORS: Record<Runtime, string> = {
  node: "var(--color-node)",
  python: "var(--color-python)",
  dotnet: "var(--color-dotnet)",
  other: "var(--color-other)",
};

/** Los temas en el orden en que se ofrecen. Sus rotulos, en el catalogo de idiomas. */
export const THEMES: Theme[] = ["system", "light", "dark"];

/**
 * Intervalos ofrecidos para el refresco automatico, en milisegundos.
 *
 * Las etiquetas no se traducen y por eso siguen aqui: "Off", "2s" y "5s" se escriben igual en los
 * dos idiomas. Las de los temas si se movieron al catalogo, que es donde estan las que cambian.
 */
export const REFRESH_INTERVALS = [
  { label: "Off", ms: 0 },
  { label: "2s", ms: 2000 },
  { label: "5s", ms: 5000 },
] as const;
