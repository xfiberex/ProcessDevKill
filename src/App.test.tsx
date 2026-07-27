import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { invoke, listen, proceso, writeText } from "./test/tauri-mock";
import { PROCESSES_UPDATED } from "./types";
import type { ProcessInfo } from "./types";

const LISTA: ProcessInfo[] = [
  proceso({ pid: 100, name: "node.exe", ports: [3000], cpu: 12.5, memoryMb: 210 }),
  proceso({ pid: 200, name: "node.exe", ports: [], cpu: 0, memoryMb: 88 }),
  proceso({ pid: 300, name: "python.exe", runtime: "python", ports: [8080], memoryMb: 512 }),
  proceso({ pid: 400, name: "dotnet.exe", runtime: "dotnet", ports: [], memoryMb: 1024 }),
];

/** Empuja una lista nueva por el mismo evento que emite Rust. */
async function emitir(lista: ProcessInfo[]) {
  const suscripciones = listen.mock.calls.filter(
    (c) => c[0] === PROCESSES_UPDATED,
  );
  const handler = suscripciones[suscripciones.length - 1][1];
  await act(async () => {
    handler({ payload: lista });
  });
}

async function montar(lista: ProcessInfo[] = LISTA) {
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === "get_processes") return lista;
    if (cmd === "get_history") return [];
    if (cmd === "get_settings" || cmd === "save_settings")
      return {
        customNames: [],
        hotkeyEnabled: true,
        refreshMs: 2000,
        theme: "dark",
        autoKillEnabled: false,
        autoKillMb: 2048,
        zombieEnabled: false,
        zombieMinutes: 10,
      };
    if (cmd === "kill_processes") return [];
    return null;
  });

  const user = userEvent.setup();
  render(<App />);
  // Esperar a que la carga inicial haya pintado: con lista vacia lo que llega es
  // el mensaje, no filas.
  if (lista.length > 0) {
    await screen.findByLabelText(`Seleccionar PID ${lista[0].pid}`);
  } else {
    await screen.findByText("No hay procesos de desarrollo activos.");
  }
  return user;
}

const buscador = () =>
  screen.getByPlaceholderText("Buscar por nombre, PID o puerto…");
const filas = () => screen.getAllByLabelText(/^Seleccionar PID/);

describe("carga inicial", () => {
  it("pide la lista y se suscribe al evento de Rust", async () => {
    await montar();

    expect(invoke).toHaveBeenCalledWith("get_processes");
    expect(listen).toHaveBeenCalledWith(PROCESSES_UPDATED, expect.any(Function));
    expect(filas()).toHaveLength(4);
  });

  it("pinta la lista que empuja Rust sin volver a preguntar", async () => {
    await montar();
    const llamadas = invoke.mock.calls.filter((c) => c[0] === "get_processes").length;

    await emitir([...LISTA, proceso({ pid: 500 })]);

    expect(filas()).toHaveLength(5);
    expect(
      invoke.mock.calls.filter((c) => c[0] === "get_processes"),
    ).toHaveLength(llamadas);
  });
});

/**
 * El buscador por PUERTO es la razon de ser de la app: escribir 3000 tiene que
 * dejar la fila que lo ocupa. Se prueba junto al resto de criterios porque los
 * tres comparten el mismo `needle`.
 */
describe("buscador", () => {
  it("encuentra por numero de puerto", async () => {
    const user = await montar();

    await user.type(buscador(), "3000");

    expect(filas()).toHaveLength(1);
    expect(screen.getByLabelText("Seleccionar PID 100")).toBeInTheDocument();
  });

  it("encuentra por PID", async () => {
    const user = await montar();

    await user.type(buscador(), "200");

    expect(filas()).toHaveLength(1);
    expect(screen.getByLabelText("Seleccionar PID 200")).toBeInTheDocument();
  });

  /**
   * Los tres criterios son subcadena, no igualdad, asi que se solapan: "300"
   * acierta el PID 300 y tambien el puerto 3000. Es deliberado —se busca a
   * medias, mientras se escribe— y queda fijado para que nadie lo "arregle" a
   * igualdad exacta sin darse cuenta de que rompe la busqueda incremental.
   */
  it("busca por subcadena, asi que PID y puerto pueden solaparse", async () => {
    const user = await montar();

    await user.type(buscador(), "300");

    expect(filas()).toHaveLength(2);
    expect(screen.getByLabelText("Seleccionar PID 100")).toBeInTheDocument();
    expect(screen.getByLabelText("Seleccionar PID 300")).toBeInTheDocument();
  });

  it("encuentra por nombre, sin distinguir mayusculas", async () => {
    const user = await montar();

    await user.type(buscador(), "PYTHON");

    expect(filas()).toHaveLength(1);
  });

  it("avisa cuando el filtro no deja nada, distinguiendolo de la lista vacia", async () => {
    const user = await montar();

    await user.type(buscador(), "no-existe");

    expect(
      screen.getByText("Ningún proceso coincide con el filtro."),
    ).toBeInTheDocument();
  });

  it("dice que no hay procesos cuando de verdad no los hay", async () => {
    await montar([]);
    expect(
      await screen.findByText("No hay procesos de desarrollo activos."),
    ).toBeInTheDocument();
  });
});

describe("filtros por runtime del sidebar", () => {
  it("cuenta cada runtime y filtra al pulsarlo", async () => {
    const user = await montar();

    const node = screen.getByRole("button", { name: /Node\.js/ });
    expect(within(node).getByText("2")).toBeInTheDocument();

    await user.click(node);

    expect(filas()).toHaveLength(2);
  });
});

/**
 * Un PID seleccionado que muere entre el refresco y el clic seguiria contando
 * para "Matar N". La poda vive en applyList y es facil de perder en un refactor.
 */
describe("poda de la seleccion", () => {
  it("olvida los PIDs que desaparecen de la lista", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await user.click(screen.getByLabelText("Seleccionar PID 200"));
    expect(screen.getByRole("button", { name: "Matar 2" })).toBeInTheDocument();

    await emitir(LISTA.filter((p) => p.pid !== 200));

    expect(screen.getByRole("button", { name: "Matar 1" })).toBeInTheDocument();
  });

  it("mantiene la seleccion si todos siguen vivos", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await emitir(LISTA);

    expect(screen.getByRole("button", { name: "Matar 1" })).toBeInTheDocument();
  });
});

describe("boton destructivo", () => {
  it("se deshabilita con la lista vacia", async () => {
    await montar([]);
    expect(await screen.findByRole("button", { name: "Nuke All" })).toBeDisabled();
  });

  it("pasa de Nuke All a Matar N con la seleccion", async () => {
    const user = await montar();

    expect(screen.getByRole("button", { name: "Nuke All" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    expect(screen.queryByRole("button", { name: "Nuke All" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matar 1" })).toBeInTheDocument();
  });

  /** "Se terminaran los 1 procesos seleccionados" fue un bug real del Tier 5. */
  it("usa el singular al cerrar un solo proceso", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await user.click(screen.getByRole("button", { name: "Matar 1" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Cerrar 1 proceso")).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/Se terminará el proceso seleccionado/),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("button", { name: "Cerrar proceso" }),
    ).toBeInTheDocument();
  });

  it("usa el plural con varios", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await user.click(screen.getByLabelText("Seleccionar PID 200"));
    await user.click(screen.getByRole("button", { name: "Matar 2" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Cerrar 2 procesos")).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/Se terminarán los 2 procesos seleccionados/),
    ).toBeInTheDocument();
  });

  it("Nuke All sobre una lista filtrada lo dice en el mensaje", async () => {
    const user = await montar();

    await user.type(buscador(), "node");
    await user.click(screen.getByRole("button", { name: "Nuke All" }));

    expect(
      await screen.findByText(/todos los procesos de la lista filtrada/),
    ).toBeInTheDocument();
  });
});

describe("cierre de procesos", () => {
  it("Escape cancela sin llamar a Rust", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await user.click(screen.getByRole("button", { name: "Matar 1" }));
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(
      invoke.mock.calls.filter((c) => c[0] === "kill_processes"),
    ).toHaveLength(0);
  });

  it("confirmar manda los PIDs seleccionados a kill_processes", async () => {
    const user = await montar();

    await user.click(screen.getByLabelText("Seleccionar PID 100"));
    await user.click(screen.getByLabelText("Seleccionar PID 300"));
    await user.click(screen.getByRole("button", { name: "Matar 2" }));
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Cerrar procesos" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("kill_processes", {
        pids: [100, 300],
      }),
    );
  });

  it("el boton Kill de una fila no pide confirmacion", async () => {
    const user = await montar();

    const fila = screen.getByLabelText("Seleccionar PID 100").closest("tr")!;
    // El nombre accesible lleva proceso y PID desde el Tier 7.4; el texto visible
    // del boton sigue siendo "Kill".
    await user.click(
      within(fila).getByRole("button", { name: /^Cerrar .*PID 100$/ }),
    );

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("kill_processes", { pids: [100] }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("portapapeles", () => {
  /**
   * Via el plugin de Tauri, nunca `navigator.clipboard`: la API web exige que el
   * documento tenga el foco y lanza NotAllowedError justo cuando la ventana
   * vuelve de la bandeja. Si alguien la reintroduce, esta prueba lo caza.
   */
  it("copia con el plugin de Tauri, no con navigator.clipboard", async () => {
    const user = await montar();

    const fila = screen.getByLabelText("Seleccionar PID 100").closest("tr")!;
    await user.pointer({ target: fila, keys: "[MouseRight]" });
    await screen.findByRole("menu");
    await user.click(screen.getByText("Copiar http://localhost:3000"));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000");
  });
});

describe("navegacion", () => {
  beforeEach(() => {
    invoke.mockClear();
  });

  it("recarga el historial al entrar en su vista", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "Historial" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_history"));
  });

  it("el buscador solo existe en la vista de procesos", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "Ajustes" }));

    expect(
      screen.queryByPlaceholderText("Buscar por nombre, PID o puerto…"),
    ).not.toBeInTheDocument();
  });

  /**
   * Las tres vistas son excluyentes, asi que la actual se marca con
   * `aria-current="page"` y no con `aria-pressed`: esto es navegacion, no un
   * interruptor. Un lector de pantalla dice "vista actual" en vez de "presionado".
   */
  it("marca la vista actual como tal, y solo una a la vez", async () => {
    const user = await montar();
    const boton = (nombre: string) =>
      screen.getByRole("button", { name: nombre });

    expect(boton("Procesos")).toHaveAttribute("aria-current", "page");
    expect(boton("Historial")).not.toHaveAttribute("aria-current");
    expect(boton("Ajustes")).not.toHaveAttribute("aria-current");

    await user.click(boton("Ajustes"));

    expect(boton("Ajustes")).toHaveAttribute("aria-current", "page");
    expect(boton("Procesos")).not.toHaveAttribute("aria-current");
  });
});

describe("auto-refresco", () => {
  it("guarda el intervalo elegido en los ajustes", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "5s" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({ refreshMs: 5000 }),
      }),
    );
  });
});
