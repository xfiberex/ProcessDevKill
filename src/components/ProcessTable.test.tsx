import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProcessTable } from "./ProcessTable";
import { proceso } from "../test/tauri-mock";
import type { ProcessInfo } from "../types";

function pintar(processes: ProcessInfo[], extra: Partial<Parameters<typeof ProcessTable>[0]> = {}) {
  const props = {
    processes,
    selected: new Set<number>(),
    killing: new Set<number>(),
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onKill: vi.fn(),
    onCopy: vi.fn(),
    ...extra,
  };
  render(<ProcessTable {...props} />);
  return props;
}

/** Fila de datos por PID, saltandose la cabecera. */
function fila(pid: number) {
  return screen.getByLabelText(`Seleccionar PID ${pid}`).closest("tr")!;
}

describe("columna de puertos", () => {
  it("pinta una insignia por puerto", () => {
    pintar([proceso({ pid: 10, ports: [3000, 8080] })]);
    const f = fila(10);
    expect(within(f).getByText("3000")).toBeInTheDocument();
    expect(within(f).getByText("8080")).toBeInTheDocument();
  });

  it("pinta un guion cuando el proceso no escucha en ninguno", () => {
    pintar([proceso({ pid: 11, ports: [] })]);
    expect(within(fila(11)).getByText("—")).toBeInTheDocument();
  });
});

/**
 * La insignia de zombi la decide Rust y la tabla solo la pinta. Lo que se fija
 * aqui es que la pinte cuando toca y, sobre todo, que el texto de ayuda diga
 * las dos cosas que justifican la marca: cuanto lleva parado y que puerto sigue
 * ocupando. Sin el puerto la funcion no tiene sentido (7 de cada 10 procesos de
 * desarrollo en reposo marcan 0 % de CPU).
 */
describe("insignia de zombi", () => {
  it("no marca a un proceso normal", () => {
    pintar([proceso({ pid: 20, zombie: false })]);
    expect(within(fila(20)).queryByText("Zombi")).not.toBeInTheDocument();
  });

  it("marca al zombi y dice desde cuando y en que puerto", () => {
    pintar([proceso({ pid: 21, zombie: true, idleSecs: 660, ports: [4321] })]);

    const insignia = within(fila(21)).getByText("Zombi");
    expect(insignia).toBeInTheDocument();
    expect(insignia).toHaveAttribute(
      "title",
      "Sin actividad desde hace 11m, y sigue ocupando el puerto 4321",
    );
  });

  it("pone los puertos en plural cuando hay varios", () => {
    pintar([proceso({ pid: 22, zombie: true, idleSecs: 120, ports: [3000, 3001] })]);
    expect(within(fila(22)).getByText("Zombi")).toHaveAttribute(
      "title",
      "Sin actividad desde hace 2m, y sigue ocupando los puertos 3000, 3001",
    );
  });
});

describe("seleccion", () => {
  it("marca la casilla de un PID seleccionado y no la de los demas", () => {
    pintar([proceso({ pid: 30 }), proceso({ pid: 31 })], {
      selected: new Set([30]),
    });

    expect(screen.getByLabelText("Seleccionar PID 30")).toBeChecked();
    expect(screen.getByLabelText("Seleccionar PID 31")).not.toBeChecked();
  });

  it("avisa con el PID al pulsar una casilla", async () => {
    const user = userEvent.setup();
    const { onToggle } = pintar([proceso({ pid: 32 })]);

    await user.click(screen.getByLabelText("Seleccionar PID 32"));

    expect(onToggle).toHaveBeenCalledWith(32);
  });

  it("la casilla de la cabecera solo se marca con todas las filas seleccionadas", () => {
    const todos = [proceso({ pid: 33 }), proceso({ pid: 34 })];

    const { unmount } = render(
      <ProcessTable
        processes={todos}
        selected={new Set([33])}
        killing={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onKill={vi.fn()}
        onCopy={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Seleccionar todos")).not.toBeChecked();
    unmount();

    pintar(todos, { selected: new Set([33, 34]) });
    expect(screen.getByLabelText("Seleccionar todos")).toBeChecked();
  });
});

describe("boton Kill", () => {
  it("manda el PID de su propia fila", async () => {
    const user = userEvent.setup();
    const { onKill } = pintar([proceso({ pid: 40 }), proceso({ pid: 41 })]);

    await user.click(within(fila(41)).getByRole("button", { name: "Kill" }));

    expect(onKill).toHaveBeenCalledWith(41);
  });

  it("se deshabilita mientras ese proceso se esta cerrando", () => {
    pintar([proceso({ pid: 42 }), proceso({ pid: 43 })], {
      killing: new Set([42]),
    });

    expect(within(fila(42)).getByRole("button", { name: "Kill" })).toBeDisabled();
    expect(
      within(fila(43)).getByRole("button", { name: "Kill" }),
    ).not.toBeDisabled();
  });
});

/**
 * El menu contextual se abre con clic derecho de verdad (`user.pointer`), no
 * disparando el evento a mano: es como llega en la app y como se verifico por
 * CDP en el Tier 5.
 */
describe("menu contextual", () => {
  async function abrirMenu(p: ProcessInfo) {
    const user = userEvent.setup();
    const props = pintar([p]);
    await user.pointer({ target: fila(p.pid), keys: "[MouseRight]" });
    await screen.findByRole("menu");
    return { user, ...props };
  }

  it("ofrece copiar puerto y URL cuando la fila tiene puerto", async () => {
    await abrirMenu(proceso({ pid: 50, ports: [3000] }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Matar proceso")).toBeInTheDocument();
    expect(within(menu).getByText("Copiar PID")).toBeInTheDocument();
    expect(within(menu).getByText("Copiar nombre")).toBeInTheDocument();
    expect(within(menu).getByText("Copiar puerto")).toBeInTheDocument();
    expect(
      within(menu).getByText("Copiar http://localhost:3000"),
    ).toBeInTheDocument();
  });

  it("esconde las dos opciones de puerto cuando la fila no tiene", async () => {
    await abrirMenu(proceso({ pid: 51, ports: [] }));

    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Copiar puerto")).not.toBeInTheDocument();
    expect(within(menu).queryByText(/Copiar http:/)).not.toBeInTheDocument();
  });

  it("copia la URL de localhost con el primer puerto", async () => {
    const { user, onCopy } = await abrirMenu(
      proceso({ pid: 52, ports: [4321, 4322] }),
    );

    await user.click(screen.getByText("Copiar http://localhost:4321"));

    expect(onCopy).toHaveBeenCalledWith(
      "http://localhost:4321",
      "http://localhost:4321",
    );
  });

  it("copia el PID como texto", async () => {
    const { user, onCopy } = await abrirMenu(proceso({ pid: 53 }));

    await user.click(screen.getByText("Copiar PID"));

    expect(onCopy).toHaveBeenCalledWith("53", "PID 53");
  });
});
