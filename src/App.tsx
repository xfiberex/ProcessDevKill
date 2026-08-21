import { useCallback, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { PROCESSES_UPDATED, SYSTEM_USAGE } from "./types";
import type {
  HistoryEntry,
  KillOutcome,
  ProcessInfo,
  Settings,
  SystemUsage,
} from "./types";
import { ThemeProvider } from "./theme";
import { DEFAULT_SORT, FIRST_DIR, sortProcesses } from "./lib/sort";
import type { SortKey } from "./lib/sort";
import { useUpdater } from "./hooks/useUpdater";
import { EmptyState } from "./components/EmptyState";
import { ProcessTable } from "./components/ProcessTable";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import type { Filter, View } from "./components/Sidebar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ConfirmRequest } from "./components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

/**
 * Rojo solido para la accion principal destructiva.
 *
 * El `variant="destructive"` de este estilo de shadcn es un rojo tenue sobre
 * fondo claro, pensado para acciones secundarias (el "Kill" de cada fila). Para
 * el boton que cierra TODA la lista de golpe hace falta que se vea que quema.
 */
const SOLID_DESTRUCTIVE =
  "shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90";

const DEFAULT_SETTINGS: Settings = {
  customNames: [],
  hotkeyEnabled: true,
  // Igual que en Rust: cerrar la ventana cierra la app. Esconderla en la bandeja
  // hay que pedirlo, porque si no se acumulan instancias invisibles.
  closeToTray: false,
  refreshMs: 2000,
  theme: "system",
  // Igual que en Rust: ni el Auto-Kill ni el Zombie Finder arrancan encendidos.
  autoKillEnabled: false,
  autoKillMb: 2048,
  zombieEnabled: false,
  zombieMinutes: 10,
};

export default function App() {
  const [view, setView] = useState<View>("processes");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // El orden vive aqui y no en la tabla porque la tabla se desmonta al filtrar a
  // cero y al cambiar de vista; dentro, la eleccion del usuario se perderia cada
  // vez que pasa por Historial y vuelve.
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [usage, setUsage] = useState<SystemUsage | null>(null);
  const updater = useUpdater();

  const applyList = useCallback((list: ProcessInfo[]) => {
    setProcesses(list);

    // Un PID seleccionado que ya no existe seguiria contando para "matar
    // seleccionados"; se poda contra la lista recien llegada.
    const alive = new Set(list.map((p) => p.pid));
    setSelected((prev) => {
      const next = new Set([...prev].filter((pid) => alive.has(pid)));
      return next.size === prev.size ? prev : next;
    });
  }, []);

  // Rust empuja la lista; la ventana ya no hace polling. El comando solo se usa
  // para la carga inicial y el boton de refresco manual.
  useEffect(() => {
    const pending = listen<ProcessInfo[]>(PROCESSES_UPDATED, (event) =>
      applyList(event.payload),
    );
    return () => {
      pending.then((unlisten) => unlisten());
    };
  }, [applyList]);

  /**
   * El medidor del sidebar, por su propio evento.
   *
   * No viaja con la lista porque no se publica desde los mismos sitios: la lista
   * la reemiten tambien los cierres y el refresco manual, y el medidor solo sale
   * del hilo del poller, que es el unico que corre a un ritmo conocido. Ver
   * `medir` en poller.rs.
   */
  useEffect(() => {
    const pending = listen<SystemUsage>(SYSTEM_USAGE, (event) =>
      setUsage(event.payload),
    );
    return () => {
      pending.then((unlisten) => unlisten());
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyList(await invoke<ProcessInfo[]>("get_processes"));
    } catch (e) {
      toast.error(String(e));
    }
  }, [applyList]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await invoke<HistoryEntry[]>("get_history"));
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  useEffect(() => {
    // `refresh` es async: el estado se toca despues de un `await`, no en el cuerpo del efecto. La
    // regla no distingue la llamada sincrona de la funcion de lo que esa funcion hace luego.
    // Pedirle datos a Rust al montar es exactamente para lo que sirve un efecto, y aqui no hay
    // render en cascada que evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    invoke<Settings>("get_settings").then(setSettings).catch(() => {});
  }, [refresh]);

  // El historial cambia al matar procesos desde cualquier sitio, asi que se
  // recarga al entrar en la vista en vez de mantenerlo sincronizado siempre.
  useEffect(() => {
    // Mismo caso que arriba: `loadHistory` es async y el `setHistory` cae despues del `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  /**
   * Comprobacion de actualizaciones al arrancar, en silencio.
   *
   * En silencio porque un fallo aqui es de lo mas normal —equipo sin red, VPN
   * levantandose— y no merece un error en la cara nada mas abrir la app. Si hay
   * version nueva se avisa con un toast que lleva a Ajustes, donde esta el boton
   * de instalar: descargar y reiniciar no puede pasar sin que el usuario lo pida.
   */
  const { buscar: buscarActualizacion } = updater;
  useEffect(() => {
    let cancelado = false;

    buscarActualizacion(true).then((version) => {
      if (cancelado || !version) return;
      toast.info(`ProcessDevKill v${version} disponible`, {
        description: "Ábrelo en Ajustes para descargarlo e instalarlo.",
        action: { label: "Ajustes", onClick: () => setView("settings") },
        duration: 12_000,
      });
    });

    return () => {
      cancelado = true;
    };
  }, [buscarActualizacion]);

  async function saveSettings(next: Settings) {
    // Se guarda el estado de antes **antes** de pintar el nuevo: si Rust rechaza, la ventana tiene
    // que volver a lo que de verdad esta vigente. Sin esto, la divergencia se queda para siempre y
    // el unico aviso -un toast- se va en segundos: la ventana podria decir 4096 MB mientras el
    // Auto-Kill sigue cerrando a los 2048, que es justo el ajuste que no puede mentir.
    const anterior = settings;
    setSettings(next); // Optimista: la UI responde al instante.
    try {
      setSettings(await invoke<Settings>("save_settings", { settings: next }));
    } catch (e) {
      setSettings(anterior);
      toast.error("No se pudieron guardar los ajustes", { description: String(e) });
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return processes.filter((p) => {
      if (filter !== "all" && p.runtime !== filter) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        String(p.pid).includes(needle) ||
        p.ports.some((port) => String(port).includes(needle))
      );
    });
  }, [processes, filter, query]);

  const ordenados = useMemo(() => sortProcesses(visible, sort), [visible, sort]);

  const selectedVisible = useMemo(
    () => visible.filter((p) => selected.has(p.pid)),
    [visible, selected],
  );

  /** Repetir la columna activa invierte; cambiar de columna estrena su direccion. */
  function ordenarPor(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );
  }

  async function killMany(pids: number[]) {
    if (pids.length === 0) return;
    setKilling(new Set(pids));

    try {
      const outcomes = await invoke<KillOutcome[]>("kill_processes", { pids });
      const failed = outcomes.filter((o) => !o.killed);

      if (failed.length === outcomes.length) {
        toast.error(failed[0].error ?? "No se pudo terminar el proceso");
      } else if (failed.length > 0) {
        toast.warning(
          `${failed.length} de ${outcomes.length} no se pudieron terminar`,
          { description: failed[0].error ?? undefined },
        );
      } else {
        // Los puertos liberados son la razon de ser de la app, asi que si los
        // hay, se dicen. Rust manda ademas una notificacion nativa: esa es para
        // cuando la orden vino de la bandeja o del atajo y no hay ventana
        // delante que ensenar.
        const freed = [...new Set(outcomes.flatMap((o) => o.freedPorts))].sort(
          (a, b) => a - b,
        );
        toast.success(
          outcomes.length === 1
            ? `${outcomes[0].name} cerrado`
            : `${outcomes.length} procesos cerrados`,
          {
            description:
              freed.length === 0
                ? undefined
                : freed.length === 1
                  ? `Puerto ${freed[0]} liberado`
                  : `Puertos ${freed.join(", ")} liberados`,
          },
        );
      }

      setSelected(new Set());
    } catch (e) {
      toast.error(String(e));
    } finally {
      setKilling(new Set());
    }
  }

  /**
   * Copia al portapapeles desde el menu contextual de una fila.
   *
   * Via el plugin de Tauri y no `navigator.clipboard`: la API web exige que el
   * documento tenga el foco y lanza NotAllowedError si no lo tiene, cosa que
   * pasa justo cuando la ventana acaba de recuperarse de la bandeja.
   */
  async function copyToClipboard(text: string, what: string) {
    try {
      await writeText(text);
      toast.success(`Copiado: ${what}`);
    } catch (e) {
      toast.error(`No se pudo copiar: ${e}`);
    }
  }

  function toggle(pid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(pid)) next.add(pid);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = visible.every((p) => selected.has(p.pid));
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.pid)));
  }

  function askNuke(pids: number[], scope: string) {
    const uno = pids.length === 1;
    setConfirm({
      title: `Cerrar ${pids.length} ${uno ? "proceso" : "procesos"}`,
      message: `Se ${uno ? "terminará" : "terminarán"} ${scope}. ${
        uno ? "El proceso se cierra" : "Los procesos se cierran"
      } de golpe, sin guardar nada. Esta acción no se puede deshacer.`,
      confirmLabel: uno ? "Cerrar proceso" : "Cerrar procesos",
      onConfirm: () => killMany(pids),
    });
  }

  return (
    /*
     * `reducedMotion="user"` respeta el interruptor de "Efectos de animación" de Windows, que
     * WebView2 traslada a `prefers-reduced-motion`. Motion desactiva entonces las animaciones de
     * transformación —el desplazamiento de las filas al salir— y deja las de opacidad, que no
     * provocan vértigo. Va aquí arriba y no en cada animación porque es una preferencia del
     * usuario, no una decisión de cada componente.
     *
     * Las transiciones de las barras son CSS y Motion no las gobierna: esas las apaga la regla de
     * `index.css`. Las dos hacen falta.
     */
    <MotionConfig reducedMotion="user">
    <ThemeProvider theme={settings.theme}>
      <div className="flex h-full">
        <Sidebar
          view={view}
          onViewChange={setView}
          filter={filter}
          onFilterChange={setFilter}
          processes={processes}
          refreshMs={settings.refreshMs}
          onRefreshMsChange={(ms) => saveSettings({ ...settings, refreshMs: ms })}
          usage={usage}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {view === "processes" && (
            <header className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, PID o puerto…"
                // El placeholder desaparece en cuanto se escribe, asi que no vale como nombre
                // accesible (WCAG 3.3.2): con texto dentro, el campo se anunciaba sin decir que es.
                aria-label="Buscar procesos"
                className="min-w-0 flex-1"
              />

              {/* Sin el aria-label esto es un numero suelto leido en voz alta, y ademas cambia al
                  filtrar sin que nada lo anuncie. `polite` y no `assertive`: interesa que se diga,
                  no que interrumpa lo que se estuviera leyendo. */}
              <span
                className="shrink-0 text-sm text-muted-foreground tabular-nums"
                aria-label={`${visible.length} ${
                  visible.length === 1 ? "proceso en la lista" : "procesos en la lista"
                }`}
                aria-live="polite"
              >
                {visible.length}
              </span>

              <Button variant="outline" onClick={refresh} className="shrink-0">
                Refrescar
              </Button>

              {selectedVisible.length > 0 ? (
                <Button
                  variant="destructive"
                  className={SOLID_DESTRUCTIVE}
                  onClick={() =>
                    askNuke(
                      selectedVisible.map((p) => p.pid),
                      selectedVisible.length === 1
                        ? "el proceso seleccionado"
                        : `los ${selectedVisible.length} procesos seleccionados`,
                    )
                  }
                >
                  Matar {selectedVisible.length}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className={SOLID_DESTRUCTIVE}
                  disabled={visible.length === 0}
                  onClick={() =>
                    askNuke(
                      visible.map((p) => p.pid),
                      filter === "all" && !query
                        ? "todos los procesos de desarrollo activos"
                        : "todos los procesos de la lista filtrada",
                    )
                  }
                >
                  Nuke All
                </Button>
              )}
            </header>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "settings" && (
              <SettingsView
                settings={settings}
                onChange={saveSettings}
                updater={updater}
              />
            )}

            {view === "history" && (
              <HistoryView
                entries={history}
                onClear={() =>
                  setConfirm({
                    title: "Vaciar el historial",
                    message:
                      "Se borrará el registro de procesos cerrados. No afecta a ningún proceso en ejecución.",
                    confirmLabel: "Vaciar",
                    onConfirm: async () => {
                      // El unico `invoke` del frontend que estaba sin `try`: si la escritura
                      // fallaba, saltaba una promesa rechazada sin gestionar y el dialogo se
                      // cerraba como si hubiera funcionado. El historial seguia entero en disco y
                      // en pantalla, sin que nada lo dijera.
                      try {
                        await invoke("clear_history");
                        loadHistory();
                      } catch (e) {
                        toast.error("No se pudo vaciar el historial", {
                          description: String(e),
                        });
                      }
                    },
                  })
                }
              />
            )}

            {view === "processes" &&
              (ordenados.length === 0 ? (
                <EmptyState
                  sinProcesos={processes.length === 0}
                  onIrAAjustes={() => setView("settings")}
                />
              ) : (
                <ProcessTable
                  processes={ordenados}
                  selected={selected}
                  killing={killing}
                  sort={sort}
                  onSort={ordenarPor}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onKill={(pid) => killMany([pid])}
                  onCopy={copyToClipboard}
                />
              ))}
          </div>
        </main>

        <ConfirmDialog request={confirm} onCancel={() => setConfirm(null)} />
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
    </MotionConfig>
  );
}
