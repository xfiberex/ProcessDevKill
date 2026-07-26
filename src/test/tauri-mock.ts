import { vi } from "vitest";
import type { ProcessInfo, Runtime } from "../types";
import type { UpdateState } from "../update";

/**
 * Dobles de todo lo que el frontend le pide a Tauri.
 *
 * Viven en su propio modulo, y no dentro de setup.ts, porque las fabricas de
 * `vi.mock` se izan por encima de los imports del archivo: si los `vi.fn()`
 * estuvieran declarados alli, la fabrica se ejecutaria antes de que existieran.
 * Importandolos de aqui de forma dinamica, el problema desaparece.
 *
 * Cada prueba los reinicia sola (`restoreMocks` no basta: son fn() propias, no
 * espias sobre un objeto), asi que setup.ts llama a resetTauriMocks().
 */
/** Lo que Rust entrega en cada evento; el payload se afina en cada prueba. */
export type TauriListener = (evento: { payload: unknown }) => void;

export const invoke = vi.fn();
// Con la firma escrita a mano: sin ella, `listen.mock.calls` sale tipado como
// `[][]` y no se puede sacar el handler para simular el evento de Rust.
export const listen = vi.fn(
  async (_evento: string, _handler: TauriListener) => () => {},
);
export const emit = vi.fn(async () => {});
export const writeText = vi.fn(async () => {});
export const openPath = vi.fn(async () => {});
export const openUrl = vi.fn(async () => {});
export const getVersion = vi.fn(async () => "0.0.0-test");
export const resolveResource = vi.fn(async (nombre: string) => `/recursos/${nombre}`);

/** Plugin de actualizacion: por defecto, no hay version nueva. */
export const check = vi.fn(async (): Promise<unknown> => null);
export const relaunch = vi.fn(async () => {});

/**
 * Doble del hook `useUpdater` para las pruebas de SettingsView.
 *
 * La vista solo pinta el estado y llama a las dos acciones; probar el hook de
 * verdad ahi mezclaria dos cosas. La logica del hook se prueba aparte contra
 * `check`, en update.test.ts.
 */
export function updaterFalso(state: UpdateState = { fase: "reposo" }) {
  return { state, buscar: vi.fn(async () => null), instalar: vi.fn(async () => {}) };
}

export function resetTauriMocks() {
  for (const fn of [
    invoke,
    listen,
    emit,
    writeText,
    openPath,
    openUrl,
    getVersion,
    resolveResource,
    check,
    relaunch,
  ]) {
    fn.mockClear();
  }
  check.mockImplementation(async () => null);

  // Valores por defecto sanos: `invoke` responde a cada comando lo que responde
  // Rust en el caso normal. Una prueba que necesite otra cosa lo sobreescribe.
  invoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case "get_processes":
        return [];
      case "get_history":
        return [];
      case "get_settings":
        return DEFAULT_TEST_SETTINGS;
      case "save_settings":
        return DEFAULT_TEST_SETTINGS;
      case "kill_processes":
        return [];
      case "clear_history":
        return null;
      default:
        throw new Error(`Comando no simulado: ${cmd}`);
    }
  });
  listen.mockImplementation(async () => () => {});
}

export const DEFAULT_TEST_SETTINGS = {
  customNames: [],
  hotkeyEnabled: true,
  refreshMs: 2000,
  theme: "dark" as const,
  autoKillEnabled: false,
  autoKillMb: 2048,
  zombieEnabled: false,
  zombieMinutes: 10,
};

/** Un ProcessInfo completo con lo justo cambiado, para no repetir 8 campos. */
export function proceso(parcial: Partial<ProcessInfo> & { pid: number }): ProcessInfo {
  return {
    name: "node.exe",
    runtime: "node" as Runtime,
    cpu: 0,
    memoryMb: 100,
    runTimeSecs: 60,
    ports: [],
    idleSecs: 0,
    zombie: false,
    ...parcial,
  };
}
