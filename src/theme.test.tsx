import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useResolvedTheme } from "./theme";
import { setSystemDark } from "./test/setup";
import type { Theme } from "./types";

function Sonda() {
  return <span data-testid="resuelto">{useResolvedTheme()}</span>;
}

function pintar(theme: Theme) {
  const r = render(
    <ThemeProvider theme={theme}>
      <Sonda />
    </ThemeProvider>,
  );
  return {
    ...r,
    esOscuro: () => document.documentElement.classList.contains("dark"),
    resuelto: () => screen.getByTestId("resuelto").textContent,
  };
}

/**
 * La clase `dark` la pone este componente, NO la media query de CSS. Si la
 * decidiera el CSS, elegir "Claro" con Windows en oscuro no tendria ningun
 * efecto — que es justo lo que se prueba en los dos casos explicitos.
 */
describe("ThemeProvider", () => {
  it("con 'system' sigue al tema de Windows", () => {
    setSystemDark(true);
    const oscuro = pintar("system");
    expect(oscuro.esOscuro()).toBe(true);
    expect(oscuro.resuelto()).toBe("dark");
    oscuro.unmount();

    setSystemDark(false);
    const claro = pintar("system");
    expect(claro.esOscuro()).toBe(false);
    expect(claro.resuelto()).toBe("light");
  });

  it("'light' gana aunque Windows este en oscuro", () => {
    setSystemDark(true);
    const { esOscuro, resuelto } = pintar("light");

    expect(esOscuro()).toBe(false);
    expect(resuelto()).toBe("light");
  });

  it("'dark' gana aunque Windows este en claro", () => {
    setSystemDark(false);
    const { esOscuro, resuelto } = pintar("dark");

    expect(esOscuro()).toBe(true);
    expect(resuelto()).toBe("dark");
  });

  it("con 'system' cambia en vivo si Windows cambia, sin reiniciar", () => {
    setSystemDark(true);
    const { esOscuro, resuelto } = pintar("system");
    expect(esOscuro()).toBe(true);

    act(() => setSystemDark(false));

    expect(esOscuro()).toBe(false);
    expect(resuelto()).toBe("light");
  });

  it("con un tema fijo, cambiar el de Windows no le afecta", () => {
    setSystemDark(true);
    const { esOscuro } = pintar("dark");

    act(() => setSystemDark(false));

    expect(esOscuro()).toBe(true);
  });

  /**
   * La copia en localStorage la lee el script de index.html para pintar antes
   * del primer frame: los ajustes llegan de Rust de forma asincrona y sin esto
   * la ventana arrancaria en blanco unos milisegundos. La clave tiene que
   * coincidir con la que usa ese script.
   */
  it("deja el tema resuelto en localStorage para el arranque siguiente", () => {
    setSystemDark(true);
    const { unmount } = pintar("light");
    expect(localStorage.getItem("processdevkill.theme")).toBe("light");
    unmount();

    pintar("system");
    expect(localStorage.getItem("processdevkill.theme")).toBe("dark");
  });

  it("usa la misma clave que el script de index.html", async () => {
    const { readFileSync } = await import("node:fs");
    const html = readFileSync("index.html", "utf8");

    expect(html).toContain("processdevkill.theme");
  });
});
