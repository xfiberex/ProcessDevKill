import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";
import { invoke } from "../test/tauri-mock";

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

  /**
   * En release no hay consola ni devtools, asi que el `console.error` de arriba no lo lee nadie:
   * el log en archivo es el unico rastro que queda de por que se rompio la ventana.
   */
  it("manda el error al log en archivo de Rust", () => {
    const consola = pintarConFallo("boom");

    expect(invoke).toHaveBeenCalledWith(
      "log_error",
      expect.objectContaining({ mensaje: expect.stringContaining("boom") }),
    );

    consola.mockRestore();
  });

  /**
   * Si el puente con Rust es justo lo que ha fallado, la llamada al log tambien falla. Lo que no
   * puede pasar es que ese fallo tape la pantalla de error, que es lo unico que ve el usuario.
   */
  it("ensena la pantalla aunque el log falle", () => {
    invoke.mockRejectedValueOnce(new Error("el puente con Rust no responde"));
    const consola = pintarConFallo("boom");

    expect(screen.getByRole("alert")).toBeInTheDocument();

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
