import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// ── Dobles de Tauri ────────────────────────────────────────────────────────
// Fuera de la ventana de Tauri no existe el puente `__TAURI_INTERNALS__`, asi
// que cualquier import real de estos modulos revienta al invocarlo. Se doblan
// aqui, una vez, en vez de repetir el vi.mock en cada archivo de pruebas.
//
// Las fabricas van con `await import`: vi.mock se iza por encima de los imports
// del archivo, y una referencia directa a algo importado arriba seria undefined.
vi.mock("@tauri-apps/api/core", async () => ({
  invoke: (await import("./tauri-mock")).invoke,
}));
vi.mock("@tauri-apps/api/event", async () => {
  const m = await import("./tauri-mock");
  return { listen: m.listen, emit: m.emit };
});
vi.mock("@tauri-apps/api/app", async () => ({
  getVersion: (await import("./tauri-mock")).getVersion,
}));
vi.mock("@tauri-apps/api/path", async () => ({
  resolveResource: (await import("./tauri-mock")).resolveResource,
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", async () => ({
  writeText: (await import("./tauri-mock")).writeText,
}));
vi.mock("@tauri-apps/plugin-opener", async () => {
  const m = await import("./tauri-mock");
  return { openPath: m.openPath, openUrl: m.openUrl };
});

/**
 * Motion sin animaciones.
 *
 * `AnimatePresence` mantiene montada la fila que sale hasta que termina su
 * animacion de salida. Es lo que se quiere en la app —la fila se desvanece en
 * rojo— pero en una prueba significa que despues de filtrar siguen contandose
 * las cuatro filas de antes, y la asercion mide la animacion en vez del filtro.
 *
 * El doble deja `motion.tr` en un <tr> normal y `AnimatePresence` en un
 * fragmento. Las props de animacion se quitan a mano: pasadas a un elemento del
 * DOM, React avisa por consola de cada una. La animacion en si es presentacion
 * pura y ya se verifico a ojo y por CDP en el Tier 2.
 */
vi.mock("motion/react", async () => {
  const { createElement, forwardRef } = await import("react");

  const PROPS_DE_MOTION = new Set([
    "layout",
    "layoutId",
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileFocus",
    "whileInView",
    "drag",
  ]);

  const componente = (tag: string) =>
    forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      const limpias: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) {
        if (!PROPS_DE_MOTION.has(k)) limpias[k] = v;
      }
      return createElement(tag, { ...limpias, ref });
    });

  const cache = new Map<string, unknown>();

  return {
    AnimatePresence: ({ children }: { children?: unknown }) => children,
    motion: new Proxy(
      {},
      {
        get(_, tag: string) {
          if (!cache.has(tag)) cache.set(tag, componente(tag));
          return cache.get(tag);
        },
      },
    ),
  };
});

// ── Lo que jsdom no trae ───────────────────────────────────────────────────

/**
 * jsdom no implementa matchMedia, y `src/theme.tsx` lo llama en el primer
 * render. El doble guarda los listeners para que una prueba pueda simular que
 * Windows cambia de tema, que es justo el camino del modo "Sistema".
 */
type MediaListener = () => void;
const mediaListeners = new Set<MediaListener>();
let systemPrefersDark = true;

export function setSystemDark(dark: boolean) {
  systemPrefersDark = dark;
  for (const fn of mediaListeners) fn();
}

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: query.includes("dark") ? systemPrefersDark : false,
  media: query,
  onchange: null,
  addEventListener: (_: string, fn: MediaListener) => mediaListeners.add(fn),
  removeEventListener: (_: string, fn: MediaListener) => mediaListeners.delete(fn),
  addListener: (fn: MediaListener) => mediaListeners.add(fn),
  removeListener: (fn: MediaListener) => mediaListeners.delete(fn),
  dispatchEvent: () => false,
}));

// Base UI mide sus popups con ResizeObserver; jsdom no lo tiene.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Base UI y Motion llaman a estos al abrir un popup o animar una fila.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
if (!globalThis.requestAnimationFrame) {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
}

beforeEach(async () => {
  systemPrefersDark = true;
  mediaListeners.clear();
  localStorage.clear();
  document.documentElement.className = "";
  (await import("./tauri-mock")).resetTauriMocks();
});

afterEach(() => {
  cleanup();
});
