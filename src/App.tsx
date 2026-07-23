import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RUNTIMES } from "./types";
import type { ProcessInfo, Runtime } from "./types";

type Filter = Runtime | "all";

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export default function App() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProcesses(await invoke<ProcessInfo[]>("get_processes"));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function kill(pid: number) {
    setKilling((prev) => [...prev, pid]);
    try {
      await invoke("kill_process", { pid });
      setError(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setKilling((prev) => prev.filter((p) => p !== pid));
    }
  }

  const visible =
    filter === "all" ? processes : processes.filter((p) => p.runtime === filter);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-(--color-border-subtle) bg-(--color-surface-raised)">
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
              color={RUNTIMES[runtime].color}
              count={processes.filter((p) => p.runtime === runtime).length}
              active={filter === runtime}
              onClick={() => setFilter(runtime)}
            />
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-3">
          <span className="text-sm text-neutral-400">
            {visible.length} {visible.length === 1 ? "proceso" : "procesos"}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
        </header>

        {error && (
          <p className="border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">
              No hay procesos de desarrollo activos.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-(--color-surface) text-xs tracking-wide text-neutral-500 uppercase">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Proceso</th>
                  <th className="px-3 py-2 text-right font-medium">PID</th>
                  <th className="px-3 py-2 text-right font-medium">CPU</th>
                  <th className="px-3 py-2 text-right font-medium">RAM</th>
                  <th className="px-3 py-2 text-right font-medium">Activo</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr
                    key={p.pid}
                    className="border-t border-(--color-border-subtle) hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: RUNTIMES[p.runtime].color }}
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                      {p.pid}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-300 tabular-nums">
                      {p.cpu.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-300 tabular-nums">
                      {p.memoryMb.toFixed(0)} MB
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-500 tabular-nums">
                      {formatUptime(p.runTimeSecs)}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={() => kill(p.pid)}
                        disabled={killing.includes(p.pid)}
                        className="rounded border border-red-900/60 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-900/40 disabled:opacity-40"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
        active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5"
      }`}
    >
      {color && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-neutral-500 tabular-nums">{count}</span>
    </button>
  );
}
