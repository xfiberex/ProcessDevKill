import type { HistoryEntry, KillSource } from "../types";

/** Los procesos que cerró una misma acción: un Nuke All, un lote de la bandeja, un Kill suelto. */
export type Tanda = {
  key: string;
  killedAt: number;
  source: KillSource;
  entries: HistoryEntry[];
};

/**
 * Agrupa el historial por acción (Tier 11, E).
 *
 * Eran 89 filas planas con la misma hora repetida en cada tanda: un Nuke All de quince procesos
 * ocupaba quince filas iguales salvo el PID. **Una tanda es exacta, no adivinada**: `kill_and_record`
 * pone la misma marca de tiempo y el mismo origen a todo un lote, así que dos entradas seguidas con
 * los dos iguales vienen de la misma acción. Sin ventana de tiempo: dos Kill pulsados en el mismo
 * segundo siguen siendo dos acciones, y así se ven.
 *
 * Conserva el orden que llega —el más reciente primero— y no reordena: el historial es una cronología.
 */
export function agruparEnTandas(entries: HistoryEntry[]): Tanda[] {
  const tandas: Tanda[] = [];
  for (const e of entries) {
    const ultima = tandas[tandas.length - 1];
    if (ultima && ultima.killedAt === e.killedAt && ultima.source === e.source) {
      ultima.entries.push(e);
    } else {
      tandas.push({
        key: `${e.killedAt}-${e.source}-${tandas.length}`,
        killedAt: e.killedAt,
        source: e.source,
        entries: [e],
      });
    }
  }
  return tandas;
}

/** Los puertos que liberó una tanda entera, sin repetir y en orden. */
export function puertosDeTanda(tanda: Tanda): number[] {
  return [...new Set(tanda.entries.flatMap((e) => e.freedPorts))].sort((a, b) => a - b);
}
