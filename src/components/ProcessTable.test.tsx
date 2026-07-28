import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProcessTable } from "./ProcessTable";
import { proceso } from "../test/tauri-mock";
import type { ProcessInfo } from "../types";
import { DEFAULT_SORT } from "../lib/sort";

function pintar(processes: ProcessInfo[], extra: Partial<Parameters<typeof ProcessTable>[0]> = {}) {
  const props = {
    processes,
    selected: new Set<number>(),
    killing: new Set<number>(),
    // La tabla recibe la lista **ya ordenada** y solo la pinta; quien ordena es
    // App. Aqui solo hace falta el estado para saber que flecha dibujar.
    sort: DEFAULT_SORT,
    onSort: vi.fn(),
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onKill: vi.fn(),
    onCopy: vi.fn(),
    ...extra,
  };
  // Se devuelve tambien lo que da `render` (sobre todo `unmount`) para que nadie
  // tenga que repetir la lista de props a mano: cada vez que la tabla gana una,
  // esa copia suelta se queda corta y rompe la suite.
  return { ...props, ...render(<ProcessTable {...props} />) };
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

    const { unmount } = pintar(todos, { selected: new Set([33]) });
    expect(screen.getByLabelText("Seleccionar todos")).not.toBeChecked();
    unmount();

    pintar(todos, { selected: new Set([33, 34]) });
    expect(screen.getByLabelText("Seleccionar todos")).toBeChecked();
  });
});

describe("boton Kill", () => {
  /** Por nombre accesible, que desde el Tier 7.4 incluye proceso y PID. */
  const matar = (pid: number, name = "node.exe") =>
    screen.getByRole("button", { name: `Cerrar ${name}, PID ${pid}` });

  it("manda el PID de su propia fila", async () => {
    const user = userEvent.setup();
    const { onKill } = pintar([proceso({ pid: 40 }), proceso({ pid: 41 })]);

    await user.click(matar(41));

    expect(onKill).toHaveBeenCalledWith(41);
  });

  it("se deshabilita mientras ese proceso se esta cerrando", () => {
    pintar([proceso({ pid: 42 }), proceso({ pid: 43 })], {
      killing: new Set([42]),
    });

    expect(matar(42)).toBeDisabled();
    expect(matar(43)).not.toBeDisabled();
  });

  /**
   * Con veinte filas hay veinte botones que ponen "Kill". Sin nombre accesible
   * propio, un lector de pantalla los anuncia todos igual y no hay forma de saber
   * cual mata cual: es la etiqueta que menos se puede fallar de toda la app. El
   * checkbox de la misma fila ya se nombraba bien desde el Tier 6.
   */
  it("cada boton dice a que proceso mata", () => {
    pintar([
      proceso({ pid: 50, name: "node.exe" }),
      proceso({ pid: 51, name: "python.exe" }),
    ]);

    expect(matar(50, "node.exe")).toBeInTheDocument();
    expect(matar(51, "python.exe")).toBeInTheDocument();
    // El texto visible sigue siendo "Kill": lo que cambia es lo que se anuncia.
    expect(within(fila(50)).getByText("Kill")).toBeInTheDocument();
  });
});

/**
 * `scope="col"` es lo que permite a un lector de pantalla decir "Puerto: 3000" al
 * recorrer celdas. En una tabla de ocho columnas, sin el se leen numeros sueltos.
 */
describe("semantica de la tabla", () => {
  it("marca las cabeceras como cabeceras de columna", () => {
    pintar([proceso({ pid: 60 })]);

    const cabeceras = screen.getAllByRole("columnheader");
    expect(cabeceras.length).toBe(8);
    for (const th of cabeceras) {
      expect(th).toHaveAttribute("scope", "col");
    }
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

/**
 * La tabla **no ordena**: recibe la lista ya ordenada y avisa de la columna que
 * se pulsa. Lo que se prueba aqui es lo que ve el usuario —la flecha y el estado
 * accesible— y que el aviso llega. El criterio de ordenacion se prueba aparte,
 * en `lib/sort.test.ts`.
 */
describe("encabezados que ordenan", () => {
  const cabecera = (nombre: string) => screen.getByRole("button", { name: nombre });

  it("avisa de la columna pulsada sin reordenar por su cuenta", async () => {
    const user = userEvent.setup();
    const { onSort } = pintar([proceso({ pid: 60 }), proceso({ pid: 61 })]);

    await user.click(cabecera("CPU"));

    expect(onSort).toHaveBeenCalledWith("cpu");
    // Sigue pintando el orden en el que llego: reordenar es cosa de App.
    expect(screen.getAllByLabelText(/Seleccionar PID/)).toHaveLength(2);
  });

  it("las seis columnas de datos se pueden ordenar", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    pintar([proceso({ pid: 62 })], { onSort });

    for (const etiqueta of ["Proceso", "Puerto", "PID", "CPU", "RAM", "Activo"]) {
      await user.click(cabecera(etiqueta));
    }

    expect(onSort.mock.calls.map((c) => c[0])).toEqual([
      "name",
      "port",
      "pid",
      "cpu",
      "memoryMb",
      "runTimeSecs",
    ]);
  });

  /**
   * `aria-sort` es lo que anuncia un lector de pantalla al entrar en la columna.
   * La flecha es su equivalente visual, y va `aria-hidden` para no decirlo dos
   * veces; sin el atributo, quien no ve la flecha no sabe por que esta ordenado.
   */
  it("marca con aria-sort solo la columna activa, y en su direccion", () => {
    const { unmount } = pintar([proceso({ pid: 63 })], {
      sort: { key: "cpu", dir: "desc" },
    });

    expect(screen.getByRole("columnheader", { name: /CPU/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: /RAM/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    unmount();

    pintar([proceso({ pid: 63 })], { sort: { key: "name", dir: "asc" } });
    expect(screen.getByRole("columnheader", { name: /Proceso/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("la columna de acciones no ordena nada", () => {
    pintar([proceso({ pid: 64 })]);
    expect(screen.queryByRole("button", { name: "Acciones" })).not.toBeInTheDocument();
  });
});
