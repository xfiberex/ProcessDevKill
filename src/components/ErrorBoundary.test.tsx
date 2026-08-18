import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * React escribe el error por consola aunque la barrera lo capture, y eso ensucia la salida de las
 * pruebas hasta hacer creer que algo va mal. Se silencia solo dentro de estas.
 */
function pintarConFallo(mensaje: string) {
  const consola = vi.spyOn(console, "error").mockImplementation(() => {});

  function Explota(): never {
    throw new Error(mensaje);
  }

  render(
    <ErrorBoundary>
      <Explota />
    </ErrorBoundary>,
  );

  return consola;
}

describe("ErrorBoundary", () => {
  it("no estorba cuando no hay ningun fallo", () => {
    render(
      <ErrorBoundary>
        <p>contenido normal</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("contenido normal")).toBeInTheDocument();
  });

  /**
   * Sin barrera, React desmonta el arbol entero y deja la ventana en blanco: en release no hay
   * consola ni devtools donde ver por que.
   */
  it("ante un fallo del render ensena una salida en vez de la ventana vacia", () => {
    const consola = pintarConFallo("algo se rompio");

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("La ventana ha fallado")).toBeInTheDocument();
    // El mensaje del error, para poder copiarlo en un issue.
    expect(screen.getByText("algo se rompio")).toBeInTheDocument();

    consola.mockRestore();
  });

  /**
   * Lo que mas importa decirle a quien ve esta pantalla: que la app **no ha matado nada** por su
   * cuenta. Es un gestor de procesos; el susto por defecto es justo ese.
   */
  it("deja claro que no se ha cerrado ningun proceso", () => {
    const consola = pintarConFallo("boom");

    expect(screen.getByText(/Ningún proceso se ha cerrado/)).toBeInTheDocument();

    consola.mockRestore();
  });

  it("ofrece recargar la ventana, que es lo que arregla un estado corrupto", async () => {
    const consola = pintarConFallo("boom");
    const recargar = vi.fn();
    // `window.location.reload` no existe en jsdom como funcion espiable.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: recargar },
    });

    await userEvent.click(screen.getByRole("button", { name: /Recargar/ }));

    expect(recargar).toHaveBeenCalledOnce();
    consola.mockRestore();
  });
});
