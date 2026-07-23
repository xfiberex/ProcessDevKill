import { AnimatePresence, motion } from "motion/react";
import { RUNTIME_ICONS } from "../icons";
import { RUNTIMES, formatMemory, formatUptime } from "../types";
import type { ProcessInfo } from "../types";
import { UsageBar } from "./UsageBar";

type ProcessTableProps = {
  processes: ProcessInfo[];
  selected: Set<number>;
  killing: Set<number>;
  onToggle: (pid: number) => void;
  onToggleAll: () => void;
  onKill: (pid: number) => void;
};

export function ProcessTable({
  processes,
  selected,
  killing,
  onToggle,
  onToggleAll,
  onKill,
}: ProcessTableProps) {
  // Referencias para las barras: el proceso que mas consume marca el 100 %.
  const maxCpu = Math.max(...processes.map((p) => p.cpu), 0.001);
  const maxMemory = Math.max(...processes.map((p) => p.memoryMb), 1);

  const allSelected =
    processes.length > 0 && processes.every((p) => selected.has(p.pid));

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-surface text-xs tracking-wide text-neutral-500 uppercase">
        <tr>
          <th className="w-9 py-2 pl-5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              aria-label="Seleccionar todos"
              className="size-3.5 accent-red-500"
            />
          </th>
          <th className="px-3 py-2 text-left font-medium">Proceso</th>
          <th className="px-3 py-2 text-left font-medium">Puerto</th>
          <th className="px-3 py-2 text-right font-medium">PID</th>
          <th className="px-3 py-2 text-right font-medium">CPU</th>
          <th className="px-3 py-2 text-right font-medium">RAM</th>
          <th className="px-3 py-2 text-right font-medium">Activo</th>
          <th className="px-5 py-2" />
        </tr>
      </thead>

      <tbody>
        <AnimatePresence initial={false}>
          {processes.map((p) => {
            const Icon = RUNTIME_ICONS[p.runtime];
            const { color, label } = RUNTIMES[p.runtime];
            const isKilling = killing.has(p.pid);

            return (
              <motion.tr
                key={p.pid}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: isKilling ? 0.4 : 1 }}
                exit={{ opacity: 0, x: -24, backgroundColor: "rgba(220,38,38,0.25)" }}
                transition={{ duration: 0.18 }}
                className="border-t border-border-subtle hover:bg-white/3"
              >
                <td className="py-2 pl-5">
                  <input
                    type="checkbox"
                    checked={selected.has(p.pid)}
                    onChange={() => onToggle(p.pid)}
                    aria-label={`Seleccionar PID ${p.pid}`}
                    className="size-3.5 accent-red-500"
                  />
                </td>

                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0" style={{ color }} />
                    <span className="truncate">{p.name}</span>
                    <span className="sr-only">{label}</span>
                  </span>
                </td>

                <td className="px-3 py-2">
                  {p.ports.length === 0 ? (
                    <span className="text-xs text-neutral-700">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {p.ports.map((port) => (
                        <span
                          key={port}
                          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-neutral-100 tabular-nums"
                        >
                          {port}
                        </span>
                      ))}
                    </span>
                  )}
                </td>

                <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                  {p.pid}
                </td>

                <td className="px-3 py-2">
                  <UsageBar
                    label={`${p.cpu.toFixed(1)}%`}
                    value={p.cpu}
                    max={maxCpu}
                    color={color}
                  />
                </td>

                <td className="px-3 py-2">
                  <UsageBar
                    label={formatMemory(p.memoryMb)}
                    value={p.memoryMb}
                    max={maxMemory}
                    color={color}
                  />
                </td>

                <td className="px-3 py-2 text-right text-neutral-500 tabular-nums">
                  {formatUptime(p.runTimeSecs)}
                </td>

                <td className="px-5 py-2 text-right">
                  <button
                    onClick={() => onKill(p.pid)}
                    disabled={isKilling}
                    className="rounded border border-red-900/60 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-900/40 disabled:opacity-40"
                  >
                    Kill
                  </button>
                </td>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </tbody>
    </table>
  );
}
