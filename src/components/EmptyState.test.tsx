import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";
import { invoke } from "../test/tauri-mock";

/**
 * Dos situaciones que en pantalla se parecen y no tienen nada que ver: no haber
 * encontrado nada, y no estar buscando lo correcto. Confundirlas deja al usuario
 * sin saber si la app esta rota o si es que no hay nada.
 */
describe("sin ningun proceso", () => {
  function pintar() {
    const onIrAAjustes = vi.fn();
    render(<EmptyState sinProcesos onIrAAjustes={onIrAAjustes} />);
    return { onIrAAjustes, user: userEvent.setup() };
  }

  it("dice que no hay procesos", () => {
    pintar();
    expect(
      screen.getByText("No hay procesos de desarrollo activos."),
    ).toBeInTheDocument();
  });

  /**
   * Es lo primero que ve alguien que acaba de instalar la app. Los seis de
   * fábrica se vigilan siempre, pero quien trabaje con Go, Docker o PHP no vera
   * nunca nada hasta que los añada, y eso no se adivina desde una pantalla que
   * solo dice "no hay procesos". Desde T13-01 es además el único sitio de la
   * ventana principal que nombra los seis: el sidebar solo enseña los que tienen
   * procesos.
   */
  it("explica que hay runtimes que hay que añadir a mano", () => {
    pintar();
    expect(
      screen.getByText(/Node, Python, .NET, Java, Deno y Bun se vigilan siempre/),
    ).toBeInTheDocument();
    expect(screen.getByText("docker")).toBeInTheDocument();
  });

  it("lleva a Ajustes de un clic, en vez de dejar que lo busque", async () => {
    const { user, onIrAAjustes } = pintar();

    await user.click(
      screen.getByRole("button", { name: /Añadir procesos vigilados/ }),
    );

    expect(onIrAAjustes).toHaveBeenCalledTimes(1);
  });
});

describe("con procesos pero filtrados", () => {
  function pintar() {
    render(<EmptyState sinProcesos={false} onIrAAjustes={vi.fn()} />);
  }

  it("dice que es cosa del filtro", () => {
    pintar();
    expect(screen.getByText("Ningún proceso coincide con el filtro.")).toBeInTheDocument();
  });

  /**
   * Aqui **no** se ofrece añadir procesos: los hay, solo que el filtro no los
   * deja pasar. Sugerir Ajustes mandaria al usuario a arreglar algo que no esta
   * roto en vez de a borrar lo que acaba de escribir.
   */
  it("no manda a Ajustes, que no es el problema", () => {
    pintar();
    expect(
      screen.queryByRole("button", { name: /Añadir procesos vigilados/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay procesos de desarrollo activos."),
    ).not.toBeInTheDocument();
  });
});

/**
 * T14-34: una búsqueda de puerto sin filas era un callejón sin salida, aunque Rust supiera quién lo
 * tiene. Ahora el vacío lo dice, y ofrece vigilarlo si se puede.
 */
describe("una búsqueda de puerto sin filas", () => {
  const WSL = { pid: 4120, name: "wslrelay.exe", watchable: true };

  function pintar({
    query = "3000",
    dueno = WSL as typeof WSL | null,
    enLaLista = false,
  }: { query?: string; dueno?: typeof WSL | null; enLaLista?: boolean } = {}) {
    invoke.mockImplementation(async (cmd: string) => (cmd === "who_listens" ? dueno : null));
    const onVigilar = vi.fn();
    render(
      <EmptyState
        sinProcesos={false}
        onIrAAjustes={vi.fn()}
        onQuitarFiltro={vi.fn()}
        query={query}
        enLaLista={() => enLaLista}
        onVigilar={onVigilar}
      />,
    );
    return { onVigilar, user: userEvent.setup() };
  }

  it("dice quién lo tiene, y deja vigilarlo", async () => {
    const { onVigilar, user } = pintar();

    expect(
      await screen.findByText("El puerto 3000 lo tiene wslrelay.exe (PID 4120), que la app no vigila."),
    ).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("who_listens", { port: 3000 });

    await user.click(screen.getByRole("button", { name: "Vigilar wslrelay.exe" }));
    expect(onVigilar).toHaveBeenCalledExactlyOnceWith("wslrelay.exe");
  });

  it("si el dueño está en la lista, es el filtro quien lo esconde: no ofrece vigilarlo", async () => {
    pintar({ dueno: { pid: 4120, name: "node.exe", watchable: true }, enLaLista: true });

    expect(await screen.findByText(/que el filtro deja fuera/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Vigilar/ })).toBeNull();
  });

  /** El criterio negativo: un crítico de Windows se nombra, pero no se ofrece vigilarlo. */
  it("no ofrece vigilar lo que Rust no vigilaría", async () => {
    pintar({ dueno: { pid: 4, name: "System", watchable: false } });

    expect(await screen.findByText(/lo tiene System \(PID 4\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Vigilar/ })).toBeNull();
  });

  it("sin dueño, no dice que el puerto esté libre: puede ser que no se pudo leer", async () => {
    pintar({ dueno: null });

    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("who_listens", { port: 3000 }));
    expect(screen.getByText("Ningún proceso coincide con el filtro.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lo que no es un puerto no se le pregunta a Rust", async () => {
    pintar({ query: "node" });
    pintar({ query: "70000" });

    await new Promise((r) => setTimeout(r, 50));
    expect(invoke).not.toHaveBeenCalledWith("who_listens", expect.anything());
  });
});
