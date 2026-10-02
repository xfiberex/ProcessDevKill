import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryView } from "./HistoryView";
import { I18nProvider } from "../i18n";
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
    expect(screen.getByText("Atajo")).toBeInTheDocument();
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

/**
 * Tier 11, E. Eran 89 filas planas con la misma hora repetida en cada tanda: un Nuke All de quince
 * procesos eran quince filas iguales salvo el PID.
 */
describe("agrupado por accion", () => {
  const NUKE = [
    entrada({ pid: 1, name: "node.exe", freedPorts: [5173], killedAt: 1_700_000_000_000 }),
    entrada({ pid: 2, name: "node.exe", freedPorts: [3000], killedAt: 1_700_000_000_000 }),
    entrada({ pid: 3, name: "dotnet.exe", freedPorts: [], killedAt: 1_700_000_000_000 }),
  ];

  it("una tanda es una fila, con el recuento, de que era y los puertos de todos", () => {
    pintar(NUKE);
    const tanda = screen.getByRole("button", { name: /3 procesos cerrados a la vez/ });
    const fila = tanda.closest("tr")!;

    expect(within(fila).getByText("node.exe ×2 · dotnet.exe")).toBeInTheDocument();
    expect(within(fila).getByText("3000")).toBeInTheDocument();
    expect(within(fila).getByText("5173")).toBeInTheDocument();
    // Plegada: los PIDs sueltos no están.
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(tanda).toHaveAttribute("aria-expanded", "false");
  });

  it("se despliega para ver cada proceso, y se vuelve a plegar", async () => {
    pintar(NUKE);
    const user = userEvent.setup();
    const tanda = screen.getByRole("button", { name: /3 procesos/ });

    await user.click(tanda);
    expect(tanda).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    await user.click(tanda);
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("un cierre suelto sigue siendo una fila normal, sin desplegable", () => {
    pintar([entrada({ pid: 42, killedAt: 1_700_000_000_000 })]);

    expect(screen.queryByRole("button", { name: /procesos/ })).not.toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("dice la hora relativa, con la exacta a mano", () => {
    const hace5min = Date.now() - 5 * 60_000;
    pintar([entrada({ killedAt: hace5min })]);

    const hora = screen.getByText("hace 5 minutos");
    expect(hora.tagName).toBe("TIME");
    expect(hora).toHaveAttribute("dateTime", new Date(hace5min).toISOString());
    expect(hora).toHaveAttribute("title");
  });
});

/**
 * T12-39: la hora exacta del `title` sigue al idioma de la app, no al del equipo.
 *
 * La relativa ya lo hacía, y la exacta usaba la configuración de Windows: con la app en inglés
 * sobre un equipo en español, la misma celda decía «5 minutes ago» y «1/10/2026, 19:12:43».
 */
describe("la hora exacta, en el idioma de la app", () => {
  const CUANDO = Date.UTC(2026, 9, 1, 19, 12, 43);

  function pintarEn(language: "es" | "en", delEquipo: string[]) {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(delEquipo);
    render(
      <I18nProvider language={language}>
        <HistoryView entries={[entrada({ killedAt: CUANDO })]} onClear={vi.fn()} />
      </I18nProvider>,
    );
    return document.querySelector("time")!.getAttribute("title");
  }

  afterEach(() => vi.restoreAllMocks());

  it("con la app en inglés y el equipo en español, sale en inglés", () => {
    const titulo = pintarEn("en", ["es-ES", "es"]);

    expect(titulo).toBe(new Date(CUANDO).toLocaleString("en"));
    expect(titulo).not.toBe(new Date(CUANDO).toLocaleString("es-ES"));
  });

  it("con la app en español y el equipo en inglés, sale en español", () => {
    expect(pintarEn("es", ["en-US", "en"])).toBe(new Date(CUANDO).toLocaleString("es"));
  });

  it("si el equipo habla el idioma de la app, se respeta su región", () => {
    // El caso que «es» a secas rompería: `Intl` lo lee como español de España.
    expect(pintarEn("es", ["es-MX", "es"])).toBe(new Date(CUANDO).toLocaleString("es-MX"));
    expect(new Date(CUANDO).toLocaleString("es-MX")).not.toBe(
      new Date(CUANDO).toLocaleString("es"),
    );
  });
});
