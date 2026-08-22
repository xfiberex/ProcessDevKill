import type { HistoryEntry } from "../types";
import { useT } from "../i18n";
import { formatTimestamp } from "../lib/format";
import { Button } from "@/components/ui/button";

type HistoryViewProps = {
  entries: HistoryEntry[];
  onClear: () => void;
};

export function HistoryView({ entries, onClear }: HistoryViewProps) {
  const t = useT();

  if (entries.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        {t.historial.vacio}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        {/* La frase entera cambia de número, no solo el sustantivo: singularizar
            "cierre" y dejar "registrados" daba "1 cierre registrados". Es el mismo
            descuido que el "Se terminaran los 1 procesos" del Tier 5. Por eso el
            recuento es una funcion del catalogo y no una plantilla con un hueco. */}
        <span className="text-sm text-muted-foreground">
          {t.historial.recuento(entries.length)}
        </span>
        <Button variant="outline" size="sm" onClick={onClear}>
          {t.historial.vaciar}
        </Button>
      </div>

      <table className="w-full text-sm">
        {/* Mismo motivo que en ProcessTable: sin `caption` la tabla no dice de que es. */}
        <caption className="sr-only">{t.historial.caption}</caption>
        <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-5 py-2 text-left font-medium">
              {t.historial.cuando}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t.historial.proceso}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t.historial.pid}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t.historial.puertosLiberados}
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              {t.historial.origen}
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
                {t.origenes[entry.source]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
