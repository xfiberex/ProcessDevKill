import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { PROCESSES_UPDATED, REFRESH_INTERVALS, RUNTIMES } from "./types";
import type {
  HistoryEntry,
  KillOutcome,
  ProcessInfo,
  Runtime,
  Settings,
} from "./types";
import { RUNTIME_ICONS } from "./icons";
import { ThemeProvider } from "./theme";
import { ProcessTable } from "./components/ProcessTable";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
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

type Filter = Runtime | "all";
type View = "processes" | "history" | "settings";

const DEFAULT_SETTINGS: Settings = {
  customNames: [],
  hotkeyEnabled: true,
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

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
    refresh();
    invoke<Settings>("get_settings").then(setSettings).catch(() => {});
  }, [refresh]);

  // El historial cambia al matar procesos desde cualquier sitio, asi que se
  // recarga al entrar en la vista en vez de mantenerlo sincronizado siempre.
  useEffect(() => {
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  async function saveSettings(next: Settings) {
    setSettings(next); // Optimista: la UI responde al instante.
    try {
      setSettings(await invoke<Settings>("save_settings", { settings: next }));
    } catch (e) {
      toast.error(String(e));
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

  const selectedVisible = useMemo(
    () => visible.filter((p) => selected.has(p.pid)),
    [visible, selected],
  );

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
      message: `Se ${uno ? "terminara" : "terminaran"} ${scope}. ${
        uno ? "El proceso se cierra" : "Los procesos se cierran"
      } de golpe, sin guardar nada. Esta accion no se puede deshacer.`,
      confirmLabel: uno ? "Cerrar proceso" : "Cerrar procesos",
      onConfirm: () => killMany(pids),
    });
  }

  return (
    <ThemeProvider theme={settings.theme}>
      <div className="flex h-full">
        <aside className="flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="border-b border-sidebar-border px-4 py-4">
            <h1 className="font-heading text-sm font-semibold tracking-wide">
              ProcessDevKill
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Process Manager
            </p>
          </div>

          <nav className="flex gap-1 border-b border-sidebar-border p-2">
            {(
              [
                ["processes", "Procesos"],
                ["history", "Historial"],
                ["settings", "Ajustes"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="xs"
                variant={view === id ? "secondary" : "ghost"}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                // px-1: con el padding por defecto las tres pestañas no caben en
                // los 208 px del sidebar y "Ajustes" se sale por el borde.
                className="min-w-0 flex-1 px-1"
              >
                {label}
              </Button>
            ))}
          </nav>

          {view === "processes" && (
            <nav className="flex flex-col gap-1 p-2">
              <FilterButton
                label="Todos"
                count={processes.length}
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              {(Object.keys(RUNTIMES) as Runtime[]).map((runtime) => (
                <FilterButton
                  key={runtime}
                  label={RUNTIMES[runtime].label}
                  runtime={runtime}
                  count={processes.filter((p) => p.runtime === runtime).length}
                  active={filter === runtime}
                  onClick={() => setFilter(runtime)}
                />
              ))}
            </nav>
          )}

          <div className="mt-auto border-t border-sidebar-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">Auto-refresco</p>
            <div className="flex gap-1">
              {REFRESH_INTERVALS.map(({ label, ms }) => (
                <Button
                  key={label}
                  size="xs"
                  variant={settings.refreshMs === ms ? "secondary" : "ghost"}
                  aria-pressed={settings.refreshMs === ms}
                  onClick={() => saveSettings({ ...settings, refreshMs: ms })}
                  className="flex-1"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {view === "processes" && (
            <header className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, PID o puerto…"
                className="min-w-0 flex-1"
              />

              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
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
              <SettingsView settings={settings} onChange={saveSettings} />
            )}

            {view === "history" && (
              <HistoryView
                entries={history}
                onClear={() =>
                  setConfirm({
                    title: "Vaciar el historial",
                    message:
                      "Se borrara el registro de procesos cerrados. No afecta a ningun proceso en ejecucion.",
                    confirmLabel: "Vaciar",
                    onConfirm: async () => {
                      await invoke("clear_history");
                      loadHistory();
                    },
                  })
                }
              />
            )}

            {view === "processes" &&
              (visible.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  {processes.length === 0
                    ? "No hay procesos de desarrollo activos."
                    : "Ningun proceso coincide con el filtro."}
                </p>
              ) : (
                <ProcessTable
                  processes={visible}
                  selected={selected}
                  killing={killing}
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
  );
}

function FilterButton({
  label,
  count,
  active,
  runtime,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  runtime?: Runtime;
  onClick: () => void;
}) {
  const Icon = runtime ? RUNTIME_ICONS[runtime] : null;

  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className="justify-start gap-2 px-3"
    >
      {Icon ? (
        <Icon
          className="size-4 shrink-0"
          style={{ color: RUNTIMES[runtime!].color }}
        />
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Button>
  );
}
