import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ConfirmRequest } from "./ConfirmDialog";

/**
 * Envoltorio que reproduce como lo usa App: el `request` se pone a null al
 * cancelar. Probar el componente con `request` fijo no valdria, porque la parte
 * interesante es justo que el contenido sobrevive a que vuelva a null para que
 * la animacion de cierre tenga algo que pintar.
 */
function Anfitrion({ onConfirm }: { onConfirm: () => void }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  return (
    <>
      <button
        onClick={() =>
          setRequest({
            title: "Cerrar 2 procesos",
            message: "Se terminaran los 2 procesos seleccionados.",
            confirmLabel: "Cerrar procesos",
            onConfirm,
          })
        }
      >
        abrir
      </button>
      <ConfirmDialog request={request} onCancel={() => setRequest(null)} />
    </>
  );
}

async function abrir(onConfirm = vi.fn()) {
  const user = userEvent.setup();
  render(<Anfitrion onConfirm={onConfirm} />);
  await user.click(screen.getByRole("button", { name: "abrir" }));
  await screen.findByRole("alertdialog");
  return { user, onConfirm };
}

describe("ConfirmDialog", () => {
  it("no pinta nada hasta que hay peticion", () => {
    render(<Anfitrion onConfirm={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("muestra el titulo, el mensaje y la etiqueta que le pasan", async () => {
    await abrir();
    expect(screen.getByText("Cerrar 2 procesos")).toBeInTheDocument();
    expect(
      screen.getByText("Se terminaran los 2 procesos seleccionados."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar procesos" }),
    ).toBeInTheDocument();
  });

  /**
   * LA prueba de este archivo.
   *
   * Es la garantia que se verifico a mano en los Tiers 2, 4 y 5 y la que mas
   * caro sale romper: este dialogo es lo unico que separa un clic de matar el
   * entorno de desarrollo entero. Si alguien cambia el AlertDialog por otro
   * componente y Escape pasa a confirmar, tiene que fallar aqui.
   */
  it("Escape cancela SIN confirmar", async () => {
    const { user, onConfirm } = await abrir();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Cancelar tampoco confirma", async () => {
    const { user, onConfirm } = await abrir();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("el boton destructivo confirma una sola vez y cierra", async () => {
    const { user, onConfirm } = await abrir();

    await user.click(screen.getByRole("button", { name: "Cerrar procesos" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  /**
   * Base UI enfoca "Cancelar" por defecto; aqui se fuerza el foco al boton
   * destructivo con `initialFocus` para conservar el comportamiento de los
   * Tiers 2-4 (se llega a proposito y se confirma con Enter). Es una decision
   * consciente y contraria al defecto de la libreria, asi que se fija.
   */
  it("abre con el foco en el boton destructivo, no en Cancelar", async () => {
    await abrir();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cerrar procesos" })).toHaveFocus(),
    );
  });

  it("con el foco puesto, Enter confirma", async () => {
    const { user, onConfirm } = await abrir();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cerrar procesos" })).toHaveFocus(),
    );

    await user.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
