import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

const OPCIONES = [
  { value: 0, label: "Off" },
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
];

/** Controlado de verdad, como en la app: el valor vuelve por props después de cada cambio. */
function Grupo({ onChange }: { onChange: (v: number) => void }) {
  const [valor, setValor] = useState(2000);
  return (
    <Segmented
      label="Auto-refresco"
      options={OPCIONES}
      value={valor}
      onChange={(v) => {
        setValor(v);
        onChange(v);
      }}
    />
  );
}

describe("el control segmentado", () => {
  it("es un radiogroup con nombre y marca lo elegido", () => {
    render(<Grupo onChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Auto-refresco" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "2s" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "false");
  });

  /**
   * Un solo tabulador para el grupo (B4): antes eran tres paradas de Tab, y en Ajustes, con
   * Idioma, Tema y la combinación del atajo, eso sumaba ocho.
   */
  it("deja un solo tabulador, el de lo elegido", () => {
    render(<Grupo onChange={vi.fn()} />);

    const conTab = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("tabindex") === "0");
    expect(conTab).toHaveLength(1);
    expect(conTab[0]).toHaveAccessibleName("2s");
  });

  it("las flechas mueven la elección y dan la vuelta en los extremos", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Grupo onChange={onChange} />);

    screen.getByRole("radio", { name: "2s" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(5000);
    expect(screen.getByRole("radio", { name: "5s" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(0);

    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(5000);
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  /** Lo elegido se distingue por algo más que el color: peso de letra y borde. */
  it("lo elegido lleva seminegrita y borde, y lo demás no", () => {
    render(<Grupo onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "2s" }).className).toMatch(/font-semibold/);
    expect(screen.getByRole("radio", { name: "2s" }).className).toMatch(/ring-control/);
    expect(screen.getByRole("radio", { name: "5s" }).className).not.toMatch(/font-semibold/);
  });
});
