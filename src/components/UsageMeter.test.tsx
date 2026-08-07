import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageMeter, parDeMemoria } from "./UsageMeter";
import type { SystemUsage } from "../types";

/** Un equipo de 32 GB con 12 usados, de los que el entorno pone 4. */
function uso(parcial: Partial<SystemUsage> = {}): SystemUsage {
  return {
    cpu: 40,
    devCpu: 6.25,
    usedMemoryMb: 12288,
    totalMemoryMb: 32768,
    devMemoryMb: 4096,
    ...parcial,
  };
}

/** Las dos capas de una barra, en orden: primero el equipo, encima el entorno. */
function anchos(label: string): string[] {
  const fila = screen.getByText(label).closest("div")!.parentElement!;
  return [...fila.querySelectorAll<HTMLElement>("[style*='width']")].map(
    (b) => b.style.width,
  );
}

describe("UsageMeter", () => {
  it("enseña lo que consume el entorno y lo que consume el equipo", () => {
    render(<UsageMeter usage={uso()} pausado={false} />);

    expect(screen.getByText("6.3%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("4.0 GB")).toBeInTheDocument();
    expect(screen.getByText("12.0 / 32.0 GB")).toBeInTheDocument();
  });

  /**
   * Regresion de un fallo de rotulo que encontro el usuario el 2026-08-07, nada
   * mas ver la funcion: la cifra del equipo iba pegada a la suya —"1008 MB de
   * 15.6 GB"— y la leyo como su RAM instalada. Tiene 32 GB; 15,6 era lo que la
   * maquina estaba usando. Ahora **la RAM instalada esta a la vista** y la del
   * equipo va nombrada en su propia linea.
   */
  it("enseña la RAM instalada, no solo la que se usa", () => {
    render(<UsageMeter usage={uso()} pausado={false} />);

    expect(screen.getByText("12.0 / 32.0 GB")).toBeInTheDocument();
    expect(screen.getAllByText("Equipo")).toHaveLength(2);
    // Lo que se leia mal: la cifra del equipo sin decir de que es.
    expect(screen.queryByText(/de 12\.0 GB/)).not.toBeInTheDocument();
  });

  it("no repite la unidad cuando las dos cifras caen en la misma", () => {
    expect(parDeMemoria(12288, 32768)).toBe("12.0 / 32.0 GB");
    // Y la conserva cuando no: "512 / 32.0 GB" se leeria como 512 GB.
    expect(parDeMemoria(512, 32768)).toBe("512 MB / 32.0 GB");
  });

  /**
   * Las dos barras se escalan al equipo entero, no al mayor de la lista como las
   * de la tabla: es justo el denominador que el sidebar viene a dar. 4 de 32 GB
   * son el 12,5 %, y 12 de 32 el 37,5 %.
   */
  it("escala la RAM contra la instalada, no contra la que se usa", () => {
    render(<UsageMeter usage={uso()} pausado={false} />);

    expect(anchos("RAM")).toEqual(["37.5%", "12.5%"]);
  });

  it("escala la CPU contra el 100 % del equipo", () => {
    render(<UsageMeter usage={uso()} pausado={false} />);

    expect(anchos("CPU")).toEqual(["40%", "6.25%"]);
  });

  /**
   * La memoria residente cuenta dos veces las paginas compartidas, asi que la suma
   * de los vigilados puede pasarse de lo que dice usar el equipo. El numero se
   * ensena tal cual, pero la barra no puede salirse del carril.
   */
  it("recorta la barra al 100 % sin tocar la cifra", () => {
    render(
      <UsageMeter
        usage={uso({ devMemoryMb: 40000, totalMemoryMb: 32768 })}
        pausado={false}
      />,
    );

    expect(anchos("RAM")[1]).toBe("100%");
    expect(screen.getByText("39.1 GB")).toBeInTheDocument();
  });

  /**
   * Con el auto-refresco en "Off" Rust deja de medir. Dejar la ultima cifra puesta
   * seria ensenar un numero viejo con pinta de actual, que es peor que no ensenar
   * ninguno.
   */
  it("dice que esta en pausa en vez de dejar la ultima cifra", () => {
    render(<UsageMeter usage={uso()} pausado />);

    expect(screen.getByText("En pausa")).toBeInTheDocument();
    expect(screen.queryByText("6.3%")).not.toBeInTheDocument();
  });

  it("avisa de que aun no ha llegado ninguna medida", () => {
    render(<UsageMeter usage={null} pausado={false} />);

    expect(screen.getByText("Midiendo…")).toBeInTheDocument();
  });

  /** Sin nada vigilado el entorno no consume: la barra solida se queda a cero y
   *  la del equipo sigue diciendo la verdad. */
  it("con el entorno a cero solo pinta lo que usa el equipo", () => {
    render(
      <UsageMeter usage={uso({ devCpu: 0, devMemoryMb: 0 })} pausado={false} />,
    );

    expect(anchos("RAM")).toEqual(["37.5%", "0%"]);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });
});
