import { KILL_SOURCES, formatTimestamp } from "../types";
import type { HistoryEntry } from "../types";
import { Button } from "@/components/ui/button";

type HistoryViewProps = {
  entries: HistoryEntry[];
  onClear: () => void;
};

export function HistoryView({ entries, onClear }: HistoryViewProps) {
  if (entries.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Todavia no se ha cerrado ningun proceso.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "cierre" : "cierres"} registrados
        </span>
        <Button variant="outline" size="sm" onClick={onClear}>
          Vaciar historial
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-5 py-2 text-left font-medium">Cuando</th>
            <th className="px-3 py-2 text-left font-medium">Proceso</th>
            <th className="px-3 py-2 text-right font-medium">PID</th>
            <th className="px-3 py-2 text-left font-medium">Puertos liberados</th>
            <th className="px-5 py-2 text-right font-medium">Origen</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.pid}-${entry.killedAt}-${index}`}
              className="border-t border-border"
            >
              <td className="px-5 py-2 text-muted-foreground tabular-nums">
                {formatTimestamp(entry.killedAt)}
              </td>
              <td className="px-3 py-2 truncate">{entry.name}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                {entry.pid}
              </td>
              <td className="px-3 py-2">
                {entry.freedPorts.length === 0 ? (
                  <span className="text-xs text-muted-foreground/50">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {entry.freedPorts.map((port) => (
                      <span
                        key={port}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums"
                      >
                        {port}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-5 py-2 text-right text-xs text-muted-foreground">
                {KILL_SOURCES[entry.source]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
