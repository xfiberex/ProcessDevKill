import { describe, expect, it } from "vitest";
import { agruparEnTandas, puertosDeTanda } from "./history";
import type { HistoryEntry } from "../types";

const entrada = (parcial: Partial<HistoryEntry> & { pid: number }): HistoryEntry => ({
  name: "node.exe",
  freedPorts: [],
  killedAt: 1_000,
  source: "window",
  ...parcial,
});

describe("agruparEnTandas", () => {
  it("junta lo que cerró una misma acción: misma hora exacta y mismo origen", () => {
    const tandas = agruparEnTandas([
      entrada({ pid: 1, killedAt: 5_000, source: "window" }),
      entrada({ pid: 2, killedAt: 5_000, source: "window" }),
      entrada({ pid: 3, killedAt: 5_000, source: "window" }),
      entrada({ pid: 4, killedAt: 2_000, source: "tray" }),
    ]);

    expect(tandas.map((t) => t.entries.map((e) => e.pid))).toEqual([[1, 2, 3], [4]]);
  });

  /**
   * El criterio negativo: no se adivina con una ventana de tiempo. Dos Kill en el mismo segundo son
   * dos acciones, y la misma hora con otro origen —el Auto-Kill actuando mientras se pulsaba— también.
   */
  it("no junta acciones distintas aunque caigan casi a la vez", () => {
    const tandas = agruparEnTandas([
      entrada({ pid: 1, killedAt: 5_300 }),
      entrada({ pid: 2, killedAt: 5_000 }),
      entrada({ pid: 3, killedAt: 5_000, source: "auto" }),
    ]);

    expect(tandas).toHaveLength(3);
  });

  it("conserva el orden en que llega: el historial es una cronologia", () => {
    const tandas = agruparEnTandas([
      entrada({ pid: 1, killedAt: 9_000 }),
      entrada({ pid: 2, killedAt: 3_000 }),
      entrada({ pid: 3, killedAt: 9_000 }),
    ]);

    // La 3 comparte hora con la 1, pero no va seguida: son tandas distintas.
    expect(tandas.map((t) => t.entries[0].pid)).toEqual([1, 2, 3]);
  });

  it("una lista vacia no da ninguna tanda", () => {
    expect(agruparEnTandas([])).toEqual([]);
  });
});

describe("puertosDeTanda", () => {
  it("junta los de toda la tanda, sin repetir y en orden", () => {
    const [tanda] = agruparEnTandas([
      entrada({ pid: 1, freedPorts: [5173, 3000] }),
      entrada({ pid: 2, freedPorts: [3000] }),
      entrada({ pid: 3, freedPorts: [] }),
    ]);

    expect(puertosDeTanda(tanda)).toEqual([3000, 5173]);
  });
});
