import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RUNTIMES, REFRESH_INTERVALS } from "./types";
import type { KillOutcome, ProcessInfo, Runtime } from "./types";
import { RUNTIME_ICONS } from "./icons";
import { ProcessTable } from "./components/ProcessTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ConfirmRequest } from "./components/ConfirmDialog";

type Filter = Runtime | "all";

export default function App() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [refreshMs, setRefreshMs] = useState<number>(2000);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // Evita que el auto-refresco encole peticiones si una tarda mas que el intervalo.
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);

    try {
      const list = await invoke<ProcessInfo[]>("get_processes");
      setProcesses(list);
      setError(null);

      // Un PID seleccionado que ya no existe seguiria contando para "matar
      // seleccionados"; se poda contra la lista recien traida.
      const alive = new Set(list.map((p) => p.pid));
      setSelected((prev) => {
        const next = new Set([...prev].filter((pid) => alive.has(pid)));
        return next.size === prev.size ? prev : next;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (refreshMs === 0) return;
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, refresh]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return processes.filter((p) => {
      if (filter !== "all" && p.runtime !== filter) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) || String(p.pid).includes(needle)
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
      await refresh();
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
      <aside className="flex w-52 shrink-0 flex-col border-r border-(--color-border-subtle) bg-(--color-surface-raised)">
        <div className="border-b border-(--color-border-subtle) px-4 py-4">
          <h1 className="text-sm font-semibold tracking-wide">ProcessVisor</h1>
          <p className="mt-0.5 text-xs text-neutral-500">Process Manager</p>
        </div>

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

        <div className="mt-auto border-t border-(--color-border-subtle) p-3">
          <p className="mb-2 text-xs text-neutral-500">Auto-refresco</p>
          <div className="flex gap-1">
            {REFRESH_INTERVALS.map(({ label, ms }) => (
              <button
                key={label}
                onClick={() => setRefreshMs(ms)}
                className={`flex-1 rounded px-2 py-1 text-xs transition ${
                  refreshMs === ms
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
        <header className="flex items-center gap-3 border-b border-(--color-border-subtle) px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o PID…"
            className="min-w-0 flex-1 rounded-md border border-(--color-border-subtle) bg-black/20 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />

          <span className="shrink-0 text-sm text-neutral-500 tabular-nums">
            {visible.length}
          </span>

          <button
            onClick={refresh}
            disabled={loading}
            className="shrink-0 rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-white/5 disabled:opacity-50"
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

        {error && (
          <p className="border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
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
          )}
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
