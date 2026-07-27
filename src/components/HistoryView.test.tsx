import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryView } from "./HistoryView";
import type { HistoryEntry } from "../types";

function entrada(extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    pid: 100,
    name: "node.exe",
    freedPorts: [3000],
    killedAt: 1_700_000_000_000,
    source: "window",
    ...extra,
  };
}

function pintar(entries: HistoryEntry[]) {
  const onClear = vi.fn();
  render(<HistoryView entries={entries} onClear={onClear} />);
  return { onClear };
}

/**
 * El contador singulariza la frase entera, no solo el sustantivo.
 *
 * Decia "{n} {cierre|cierres} registrados", asi que con una sola entrada salia
 * **"1 cierre registrados"**: el participio se quedaba en plural. Es el mismo
 * descuido que el "Se terminaran los 1 procesos seleccionados" del Tier 5, que
 * tambien se arreglo y tambien se fijo con un test.
 */
describe("contador de cierres", () => {
  it("concuerda en singular con una sola entrada", () => {
    pintar([entrada()]);

    expect(screen.getByText("1 cierre registrado")).toBeInTheDocument();
    expect(screen.queryByText(/registrados/)).not.toBeInTheDocument();
  });

  it("concuerda en plural con varias", () => {
    pintar([entrada({ pid: 1 }), entrada({ pid: 2 }), entrada({ pid: 3 })]);

    expect(screen.getByText("3 cierres registrados")).toBeInTheDocument();
  });
});

describe("vista vacia", () => {
  it("lo dice y no pinta la tabla", () => {
    pintar([]);

    expect(
      screen.getByText("Todavía no se ha cerrado ningún proceso."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // Sin nada que vaciar, tampoco tiene sentido ofrecerlo.
    expect(
      screen.queryByRole("button", { name: "Vaciar historial" }),
    ).not.toBeInTheDocument();
  });
});

describe("filas del historial", () => {
  it("muestra proceso, PID, puertos liberados y origen", () => {
    pintar([entrada({ pid: 4242, name: "python.exe", freedPorts: [8000, 8001] })]);

    const fila = screen.getByText("python.exe").closest("tr")!;
    expect(within(fila).getByText("4242")).toBeInTheDocument();
    expect(within(fila).getByText("8000")).toBeInTheDocument();
    expect(within(fila).getByText("8001")).toBeInTheDocument();
  });

  it("pinta un guion cuando el cierre no libero ningun puerto", () => {
    pintar([entrada({ pid: 55, freedPorts: [] })]);

    const fila = screen.getByText("node.exe").closest("tr")!;
    expect(within(fila).getByText("—")).toBeInTheDocument();
  });

  /**
   * El origen es lo que distingue un cierre que pidio el usuario de uno que hizo
   * la app por su cuenta. Importa sobre todo el Auto-Kill: es la unica funcion
   * que mata sin preguntar, y el historial es donde se comprueba que lo hizo.
   */
  it("traduce el origen de cada cierre", () => {
    pintar([
      entrada({ pid: 1, source: "window" }),
      entrada({ pid: 2, source: "tray" }),
      entrada({ pid: 3, source: "hotkey" }),
      entrada({ pid: 4, source: "auto" }),
    ]);

    expect(screen.getByText("Ventana")).toBeInTheDocument();
    expect(screen.getByText("Bandeja")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+Alt+K")).toBeInTheDocument();
    expect(screen.getByText("Auto-Kill")).toBeInTheDocument();
  });
});

describe("vaciar el historial", () => {
  /**
   * El boton no vacia nada por su cuenta: avisa a App, que abre el dialogo de
   * confirmacion. Vaciar sin preguntar seria una perdida de datos irreversible a
   * un clic de distancia.
   */
  it("avisa al padre en vez de borrar por su cuenta", async () => {
    const user = userEvent.setup();
    const { onClear } = pintar([entrada()]);

    await user.click(screen.getByRole("button", { name: "Vaciar historial" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    // La fila sigue ahi: quien borra es Rust, tras confirmar.
    expect(screen.getByText("node.exe")).toBeInTheDocument();
  });
});
