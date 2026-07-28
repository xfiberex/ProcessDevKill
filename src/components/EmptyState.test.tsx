import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

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
   * Es lo primero que ve alguien que acaba de instalar la app. Node, Python y
   * .NET se vigilan siempre, pero quien trabaje con Go, Docker o PHP no vera
   * nunca nada hasta que los añada, y eso no se adivina desde una pantalla que
   * solo dice "no hay procesos".
   */
  it("explica que hay runtimes que hay que añadir a mano", () => {
    pintar();
    expect(screen.getByText(/Node, Python y .NET se vigilan siempre/)).toBeInTheDocument();
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
