import { KILL_SOURCES } from "../types";
import type { HistoryEntry } from "../types";
import { formatTimestamp } from "../lib/format";
import { Button } from "@/components/ui/button";

type HistoryViewProps = {
  entries: HistoryEntry[];
  onClear: () => void;
};

export function HistoryView({ entries, onClear }: HistoryViewProps) {
  if (entries.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Todavía no se ha cerrado ningún proceso.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        {/* La frase entera cambia de número, no solo el sustantivo: singularizar
            "cierre" y dejar "registrados" daba "1 cierre registrados". Es el mismo
            descuido que el "Se terminaran los 1 procesos" del Tier 5. */}
        <span className="text-sm text-muted-foreground">
          {entries.length}{" "}
          {entries.length === 1 ? "cierre registrado" : "cierres registrados"}
        </span>
        <Button variant="outline" size="sm" onClick={onClear}>
          Vaciar historial
        </Button>
      </div>

      <table className="w-full text-sm">
        {/* Mismo motivo que en ProcessTable: sin `caption` la tabla no dice de que es. */}
        <caption className="sr-only">Procesos cerrados, del mas reciente al mas antiguo</caption>
        <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-5 py-2 text-left font-medium">
              Cuándo
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Proceso
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              PID
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Puertos liberados
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              Origen
            </th>
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
                  // Mismo criterio que en ProcessTable: el /50 dejaba el guion por
                  // debajo del contraste minimo.
                  <span className="text-xs text-muted-foreground">—</span>
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
