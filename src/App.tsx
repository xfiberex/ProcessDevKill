import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PROCESSES_UPDATED, REFRESH_INTERVALS, RUNTIMES } from "./types";
import type {
  HistoryEntry,
  KillOutcome,
  ProcessInfo,
  Runtime,
  Settings,
} from "./types";
import { RUNTIME_ICONS } from "./icons";
import { ProcessTable } from "./components/ProcessTable";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ConfirmRequest } from "./components/ConfirmDialog";

type Filter = Runtime | "all";
type View = "processes" | "history" | "settings";

const DEFAULT_SETTINGS: Settings = {
  customNames: [],
  hotkeyEnabled: true,
  refreshMs: 2000,
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
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [applyList]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await invoke<HistoryEntry[]>("get_history"));
    } catch (e) {
      setError(String(e));
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
      setError(null);
    } catch (e) {
      setError(String(e));
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
      setError(
        failed.length === 0
          ? null
          : failed.length === outcomes.length
            ? (failed[0].error ?? "No se pudo terminar el proceso")
            : `${failed.length} de ${outcomes.length} no se pudieron terminar: ${failed[0].error}`,
      );
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setKilling(new Set());
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
    setConfirm({
      title: `Cerrar ${pids.length} ${pids.length === 1 ? "proceso" : "procesos"}`,
      message: `Se terminaran ${scope}. Los procesos se cierran de golpe, sin guardar nada. Esta accion no se puede deshacer.`,
      confirmLabel: "Cerrar procesos",
      onConfirm: () => killMany(pids),
    });
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border-subtle bg-surface-raised">
        <div className="border-b border-border-subtle px-4 py-4">
          <h1 className="text-sm font-semibold tracking-wide">ProcessVisor</h1>
          <p className="mt-0.5 text-xs text-neutral-500">Process Manager</p>
        </div>

        <nav className="flex gap-1 border-b border-border-subtle p-2">
          {(
            [
              ["processes", "Procesos"],
              ["history", "Historial"],
              ["settings", "Ajustes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex-1 rounded px-2 py-1 text-xs transition ${
                view === id
                  ? "bg-white/15 text-white"
                  : "text-neutral-400 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
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

        <div className="mt-auto border-t border-border-subtle p-3">
          <p className="mb-2 text-xs text-neutral-500">Auto-refresco</p>
          <div className="flex gap-1">
            {REFRESH_INTERVALS.map(({ label, ms }) => (
              <button
                key={label}
                onClick={() => saveSettings({ ...settings, refreshMs: ms })}
                className={`flex-1 rounded px-2 py-1 text-xs transition ${
                  settings.refreshMs === ms
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {view === "processes" && (
          <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, PID o puerto…"
              className="min-w-0 flex-1 rounded-md border border-border-subtle bg-black/20 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />

            <span className="shrink-0 text-sm text-neutral-500 tabular-nums">
              {visible.length}
            </span>

            <button
              onClick={refresh}
              className="shrink-0 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-white/5"
            >
              Refrescar
            </button>

            {selectedVisible.length > 0 ? (
              <button
                onClick={() =>
                  askNuke(
                    selectedVisible.map((p) => p.pid),
                    `los ${selectedVisible.length} procesos seleccionados`,
                  )
                }
                className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
              >
                Matar {selectedVisible.length}
              </button>
            ) : (
              <button
                onClick={() =>
                  askNuke(
                    visible.map((p) => p.pid),
                    filter === "all" && !query
                      ? "todos los procesos de desarrollo activos"
                      : "todos los procesos de la lista filtrada",
                  )
                }
                disabled={visible.length === 0}
                className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-30"
              >
                Nuke All
              </button>
            )}
          </header>
        )}

        {error && (
          <p className="border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
            {error}
          </p>
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
              <p className="px-5 py-10 text-center text-sm text-neutral-500">
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
              />
            ))}
        </div>
      </main>

      <ConfirmDialog request={confirm} onCancel={() => setConfirm(null)} />
    </div>
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
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
        active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5"
      }`}
    >
      {Icon ? (
        <Icon
          className="size-4 shrink-0"
          style={{ color: RUNTIMES[runtime!].color }}
        />
      ) : (
        <span className="size-4 shrink-0" />
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-neutral-500 tabular-nums">{count}</span>
    </button>
  );
}
