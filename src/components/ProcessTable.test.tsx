import { render, screen, waitFor, within } from "@testing-library/react";
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
    onProtect: vi.fn(),
    onFreezeChange: vi.fn(),
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
  it("con un puerto, pinta su insignia y nada más", () => {
    pintar([proceso({ pid: 9, ports: [3000] })]);
    const celda = within(fila(9)).getByText("3000").closest("td")!;

    expect(celda).toHaveTextContent(/^3000$/);
    expect(celda.querySelector("[title]")).toBeNull();
  });

  /**
   * T14-06. Con una insignia por puerto, un proceso con seis triplicaba el alto de su fila. Ahora
   * se ve el primero y cuántos más hay; el resto no se pierde, cambia de sitio.
   */
  it("con varios, pinta el primero y cuántos más hay, y deja la lista entera a mano", () => {
    pintar([proceso({ pid: 10, ports: [3000, 3001, 3002, 3003, 3004, 3005] })]);
    const celda = within(fila(10)).getByText("3000").closest("td")!;

    // A la vista: dos piezas, una al lado de la otra.
    expect(within(celda).getByText("+5")).toHaveAttribute("aria-hidden", "true");
    expect(within(celda).queryByText("3005")).toBeNull();
    // Para el puntero, la lista entera…
    expect(within(celda).getByTitle("Puertos 3000, 3001, 3002, 3003, 3004, 3005")).toBeInTheDocument();
    // …y para el lector de pantalla, los seis.
    expect(celda).toHaveTextContent("3000+5, 3001, 3002, 3003, 3004, 3005");
    expect(within(celda).getByText(", 3001, 3002, 3003, 3004, 3005")).toHaveClass("sr-only");
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
    screen.getByRole("button", { name: `Kill ${name}, PID ${pid}` });

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
    expect(within(menu).getByText("Cerrar proceso")).toBeInTheDocument();
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

  /**
   * Tier 11, A6. «Cerrar proceso» —«Matar proceso» hasta D3— era la primera entrada: abierto por teclado, la primera flecha
   * caía en él, y cierra sin diálogo. Ahora va la última, tras un separador.
   */
  it("deja «Cerrar proceso» la última, tras un separador", async () => {
    await abrirMenu(proceso({ pid: 54, ports: [3000] }));

    const menu = screen.getByRole("menu");
    const entradas = within(menu).getAllByRole("menuitem");
    expect(entradas[0]).toHaveTextContent("Copiar PID");
    expect(entradas[entradas.length - 1]).toHaveTextContent("Cerrar proceso");
    // El elemento justo antes de la entrada destructiva es un separador.
    expect(entradas[entradas.length - 1]!.previousElementSibling).toHaveAttribute("role", "separator");
  });

  it("protege por la carpeta del proyecto desde el menú", async () => {
    const p = proceso({ pid: 55, script: "vite", project: "mi-web" });
    const { user, onProtect } = await abrirMenu(p);

    await user.click(screen.getByText("Proteger «mi-web»"));

    expect(onProtect).toHaveBeenCalledWith(p, true);
  });

  it("congela el orden mientras el menú está abierto", async () => {
    const { onFreezeChange } = await abrirMenu(proceso({ pid: 56 }));
    expect(onFreezeChange).toHaveBeenLastCalledWith(true);
  });
});

/** Tier 11, A2: con trece `node.exe` en la lista, la segunda línea es lo que dice cuál es cuál. */
describe("segunda línea de la fila", () => {
  it("enseña el script y la carpeta debajo del nombre", () => {
    pintar([proceso({ pid: 70, script: "vite", project: "mi-web" })]);
    expect(within(fila(70)).getByText("vite · mi-web")).toBeInTheDocument();
  });

  it("no pinta una línea vacía si no se pudo leer ninguno", () => {
    pintar([proceso({ pid: 71 })]);
    expect(within(fila(71)).queryByText(/·/)).not.toBeInTheDocument();
  });
});

/** Tier 11, A3: un protegido no se puede cerrar desde su fila, ni por el botón ni por el menú. */
describe("procesos protegidos", () => {
  it("apaga el Kill de la fila protegida y solo el de esa", () => {
    pintar([proceso({ pid: 80, protected: true }), proceso({ pid: 81 })]);

    const kill = (pid: number) =>
      screen.getByRole("button", { name: `Kill node.exe, PID ${pid}` });
    expect(kill(80)).toBeDisabled();
    expect(kill(81)).not.toBeDisabled();
    expect(within(fila(80)).getByText("Protegido")).toBeInTheDocument();
  });

  it("en el menú, «Cerrar proceso» sale apagado y se ofrece quitar la protección", async () => {
    const user = userEvent.setup();
    const p = proceso({ pid: 82, protected: true, project: "mi-api" });
    const { onKill, onProtect } = pintar([p]);
    await user.pointer({ target: fila(82), keys: "[MouseRight]" });
    const menu = await screen.findByRole("menu");

    const matar = within(menu).getByRole("menuitem", { name: "Cerrar proceso" });
    expect(matar).toHaveAttribute("aria-disabled", "true");
    await user.click(matar);
    expect(onKill).not.toHaveBeenCalled();

    await user.click(within(menu).getByText("Dejar de proteger «mi-api»"));
    expect(onProtect).toHaveBeenCalledWith(p, false);
  });
});

/**
 * Tier 11, A5. La tabla no reordena por su cuenta: avisa de cuándo congelar y App aplica el
 * orden. Lo que se prueba aquí es el aviso; el orden congelado, en `lib/sort.test.ts`.
 */
describe("orden congelado", () => {
  it("pide congelar con el puntero sobre las filas y soltar al salir", async () => {
    const user = userEvent.setup();
    const { onFreezeChange } = pintar([proceso({ pid: 90 })]);

    await user.hover(fila(90));
    expect(onFreezeChange).toHaveBeenLastCalledWith(true);

    await user.unhover(fila(90));
    expect(onFreezeChange).toHaveBeenLastCalledWith(false);
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

/**
 * Tier 11, D5 a D7: menos rojo, una escala de CPU que no exagera y una selección que se ve.
 * El color de verdad se midió en vivo; aquí se fija la regla que lo produce.
 */
describe("lo que se ve de cada fila", () => {
  /** jsdom no pinta: la barra se lee por el ancho que se le pone. */
  const barraCpu = (pid: number) =>
    within(fila(pid)).getByText(/%$/).parentElement!.querySelector<HTMLElement>("[style]")!;

  it("el Kill de la fila es neutro; el rojo solo llega con la fila bajo el puntero o el foco", () => {
    pintar([proceso({ pid: 60 })]);
    const kill = screen.getByRole("button", { name: "Kill node.exe, PID 60" });

    expect(kill).toHaveClass("text-muted-foreground");
    expect(kill).not.toHaveClass("bg-destructive/10");
    expect(kill).toHaveClass("group-hover/fila:text-destructive-text");
    expect(kill).toHaveClass("group-focus-within/fila:text-destructive-text");
    expect(fila(60)).toHaveClass("group/fila");
  });

  /**
   * En reposo el mayor era un proceso al 2,5 % y salía con la barra llena. Con el suelo de un
   * núcleo, en un equipo de 8 hilos (12,5 %), ese 2,5 % es una quinta parte.
   */
  it("la barra de CPU no se llena con un proceso casi en reposo", () => {
    pintar([proceso({ pid: 61, cpu: 2.5 }), proceso({ pid: 62, cpu: 0 })]);
    const ancho = parseFloat(barraCpu(61).style.width);

    expect(ancho).toBeLessThan(100);
    expect(ancho).toBeGreaterThan(0);
  });

  it("con carga de verdad, el mayor sigue marcando el 100 %", () => {
    pintar([proceso({ pid: 63, cpu: 80 }), proceso({ pid: 64, cpu: 40 })]);

    expect(barraCpu(63).style.width).toBe("100%");
    expect(barraCpu(64).style.width).toBe("50%");
  });

  it("el 0.0% va en gris y una cifra con carga no", () => {
    pintar([proceso({ pid: 65, cpu: 0 }), proceso({ pid: 66, cpu: 12 })]);

    expect(within(fila(65)).getByText("0.0%")).toHaveClass("text-muted-foreground");
    expect(within(fila(66)).getByText("12.0%")).not.toHaveClass("text-muted-foreground");
  });

  it("la fila seleccionada se marca, y solo ella", () => {
    pintar([proceso({ pid: 67 }), proceso({ pid: 68 })], { selected: new Set([67]) });

    expect(fila(67)).toHaveAttribute("data-selected");
    expect(fila(67)).toHaveClass("bg-muted");
    expect(fila(68)).not.toHaveAttribute("data-selected");
    expect(fila(68)).not.toHaveClass("bg-muted");
  });

  /**
   * Tier 11, E. El texto de la fila se puede seleccionar, y la clase tiene que llegar **a la fila**:
   * el disparador del menú contextual pone `select-none`, y con el `select-text` en el tbody las
   * celdas seguían sin dejarse seleccionar (medido en vivo).
   */
  it("el texto de la fila se puede seleccionar", () => {
    pintar([proceso({ pid: 69 })]);

    expect(fila(69)).toHaveClass("select-text");
    expect(fila(69)).not.toHaveClass("select-none");
  });
});

/**
 * T14-13: adónde va el foco cuando sale la fila que lo tenía.
 *
 * La tabla no cierra nada: `App` le pasa en `killing` los PID que se están cerrando y después una
 * lista sin ellos. Aquí se repite esa secuencia a mano, con `rerender`.
 */
describe("el foco tras un cierre", () => {
  const TRES = [proceso({ pid: 81 }), proceso({ pid: 82 }), proceso({ pid: 83 })];
  const kill = (pid: number) => screen.getByRole("button", { name: `Kill node.exe, PID ${pid}` });
  const casilla = (pid: number) => screen.getByLabelText(`Seleccionar PID ${pid}`);

  /** Pinta, enfoca, y devuelve cómo repetir lo que hace `App` mientras se cierra `pids`. */
  function montar(lista: ProcessInfo[], extra: Partial<Parameters<typeof ProcessTable>[0]> = {}) {
    const { rerender, unmount, ...props } = pintar(lista, extra);
    const cerrar = (pids: number[], quedan = lista.filter((p) => !pids.includes(p.pid))) => {
      rerender(<ProcessTable {...props} processes={lista} killing={new Set(pids)} />);
      rerender(<ProcessTable {...props} processes={quedan} killing={new Set()} />);
    };
    return { cerrar, unmount, rerender, props };
  }

  it("va al Kill de la fila que ocupa el sitio de la que salió", async () => {
    const { cerrar } = montar(TRES);
    kill(82).focus();

    cerrar([82]);

    await waitFor(() => expect(kill(83)).toHaveFocus());
  });

  it("si era la última, va al Kill de la anterior", async () => {
    const { cerrar } = montar(TRES);
    kill(83).focus();

    cerrar([83]);

    await waitFor(() => expect(kill(82)).toHaveFocus());
  });

  it("si la fila que queda está protegida, va a su casilla", async () => {
    const lista = [proceso({ pid: 84 }), proceso({ pid: 85, protected: true })];
    const { cerrar } = montar(lista);
    kill(84).focus();

    cerrar([84]);

    await waitFor(() => expect(casilla(85)).toHaveFocus());
  });

  it("tras un lote, va a la casilla de la primera fila que queda", async () => {
    const { cerrar } = montar(TRES);
    // Como lo deja el diálogo al cerrarse: sin dueño.
    (document.activeElement as HTMLElement | null)?.blur();

    cerrar([81, 82]);

    await waitFor(() => expect(casilla(83)).toHaveFocus());
  });

  it("sin filas, lo pide al buscador", async () => {
    const onSinFilas = vi.fn();
    const { rerender, unmount, props } = montar([proceso({ pid: 86 })], { onSinFilas });
    kill(86).focus();

    rerender(<ProcessTable {...props} processes={[proceso({ pid: 86 })]} killing={new Set([86])} />);
    // `App` deja de pintar la tabla cuando no queda ninguna fila.
    unmount();

    await waitFor(() => expect(onSinFilas).toHaveBeenCalledTimes(1));
  });

  it("no mueve el foco si el usuario ya lo llevó a otro sitio", async () => {
    const { cerrar } = montar(TRES);
    kill(82).focus();
    casilla(81).focus();

    cerrar([82]);

    await new Promise((r) => setTimeout(r, 400));
    expect(casilla(81)).toHaveFocus();
  });

  /** El criterio negativo: una fila que desaparece sin que la ventana lo pidiera. */
  it("un cierre desde fuera de la ventana no mueve el foco", async () => {
    const onSinFilas = vi.fn();
    const { rerender, props } = montar(TRES, { onSinFilas });
    expect(document.body).toHaveFocus();

    // La bandeja, el atajo global o el Auto-Kill: la lista llega sin la fila y `killing` no cambia.
    rerender(<ProcessTable {...props} processes={[TRES[0], TRES[2]]} />);

    await new Promise((r) => setTimeout(r, 400));
    expect(document.body).toHaveFocus();
    expect(onSinFilas).not.toHaveBeenCalled();
  });

  it("si el cierre falla y la fila sigue, el foco no se mueve", async () => {
    const { cerrar } = montar(TRES);
    (document.activeElement as HTMLElement | null)?.blur();

    cerrar([82], TRES);

    await new Promise((r) => setTimeout(r, 400));
    expect(document.body).toHaveFocus();
  });
});

/** T14-17: lo que la tabla hace cuando no cabe. Los anchos de verdad los mide `auditoria-ui.mjs`. */
describe("la tabla cuando no cabe", () => {
  it("«Activo» y «PID» se esconden por ancho, y Kill se queda pegado a la derecha", () => {
    pintar([proceso({ pid: 90 })]);
    const celdas = within(fila(90)).getAllByRole("cell");

    // Casilla, proceso, puerto, PID, CPU, RAM, activo y Kill.
    expect(celdas).toHaveLength(8);
    expect(celdas[3]).toHaveClass("@max-[571px]:hidden");
    expect(celdas[6]).toHaveClass("@max-[659px]:hidden");
    expect(celdas[7]).toHaveClass("@max-[571px]:sticky", "@max-[571px]:right-0");

    // Los encabezados van con sus celdas: una columna a medias descoloca la tabla entera.
    const cabeceras = screen.getAllByRole("columnheader");
    expect(cabeceras[3]).toHaveClass("@max-[571px]:hidden");
    expect(cabeceras[6]).toHaveClass("@max-[659px]:hidden");
    expect(cabeceras[7]).toHaveClass("@max-[571px]:sticky");
  });

  it("el menú de la fila dice el PID y el tiempo activo, que pueden no tener columna", async () => {
    pintar([proceso({ pid: 91, runTimeSecs: 3720 })]);
    await userEvent.setup().pointer({ target: fila(91), keys: "[MouseRight]" });
    await screen.findByRole("menu");

    expect(screen.getByText("PID 91 · activo 1h 2m")).toBeInTheDocument();
  });
});
