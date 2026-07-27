import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUpdater } from "./useUpdater";
import { invoke, listen, release } from "../test/tauri-mock";
import { UPDATE_PROGRESS } from "../types";
import type { ReleaseInfo } from "../types";

/** Hace que `check_update` conteste con una version nueva. */
function hayVersion(parcial: Partial<ReleaseInfo> = {}) {
  const r = release(parcial);
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === "check_update") return r;
    if (cmd === "download_update") return "C:\\Temp\\ProcessDevKill_update\\setup.exe";
    if (cmd === "install_update") return null;
    return null;
  });
  return r;
}

/** Dispara el evento de progreso que emite Rust durante la descarga. */
function emitirProgreso(bajado: number, total: number) {
  const suscripciones = listen.mock.calls.filter((c) => c[0] === UPDATE_PROGRESS);
  const handler = suscripciones[suscripciones.length - 1][1];
  handler({ payload: [bajado, total] });
}

describe("buscar", () => {
  it("en reposo no ha consultado nada", () => {
    const { result } = renderHook(() => useUpdater());
    expect(result.current.state).toEqual({ fase: "reposo" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("sin version nueva queda al dia", async () => {
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.buscar();
    });

    expect(invoke).toHaveBeenCalledWith("check_update");
    expect(result.current.state).toEqual({ fase: "al-dia" });
  });

  it("con version nueva la expone con sus notas", async () => {
    hayVersion({ version: "1.2.0", notes: "Arregla el puerto." });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.buscar();
    });

    expect(result.current.state).toEqual({
      fase: "disponible",
      version: "1.2.0",
      notas: "Arregla el puerto.",
    });
  });

  it("un release sin notas no rompe nada", async () => {
    hayVersion({ notes: "" });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.buscar();
    });

    expect(result.current.state).toMatchObject({ fase: "disponible", notas: null });
  });

  it("devuelve la version encontrada para que quien llame avise", async () => {
    hayVersion({ version: "2.0.0" });
    const { result } = renderHook(() => useUpdater());

    let devuelto: string | null = null;
    await act(async () => {
      devuelto = await result.current.buscar();
    });

    expect(devuelto).toBe("2.0.0");
  });

  it("un fallo de red se enseña como error", async () => {
    invoke.mockImplementation(async () => {
      throw new Error("No se pudo consultar GitHub");
    });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.buscar();
    });

    expect(result.current.state).toMatchObject({ fase: "error" });
  });

  /**
   * La comprobacion del arranque va en silencio: un equipo sin red o una VPN
   * levantandose es lo normal, y no puede pintar un error nada mas abrir la app.
   */
  describe("modo silencioso", () => {
    it("no pinta error si falla", async () => {
      invoke.mockImplementation(async () => {
        throw new Error("sin conexion");
      });
      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.buscar(true);
      });

      expect(result.current.state).toEqual({ fase: "reposo" });
    });

    it("tampoco anuncia que esta al dia", async () => {
      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.buscar(true);
      });

      expect(result.current.state).toEqual({ fase: "reposo" });
    });

    it("pero si avisa cuando SI hay version nueva", async () => {
      hayVersion({ version: "1.5.0" });
      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.buscar(true);
      });

      expect(result.current.state).toMatchObject({
        fase: "disponible",
        version: "1.5.0",
      });
    });
  });
});

describe("instalar", () => {
  it("no hace nada si no se ha encontrado ninguna", async () => {
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.instalar();
    });

    expect(invoke).not.toHaveBeenCalledWith("download_update", expect.anything());
    expect(result.current.state).toEqual({ fase: "reposo" });
  });

  it("descarga la que se encontro y la instala", async () => {
    const r = hayVersion();
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    await act(async () => {
      await result.current.instalar();
    });

    // Se le pasa el release entero: Rust necesita la URL del instalador y la del
    // .sha256 con el que lo va a verificar.
    expect(invoke).toHaveBeenCalledWith("download_update", { release: r });
    expect(invoke).toHaveBeenCalledWith("install_update", {
      path: "C:\\Temp\\ProcessDevKill_update\\setup.exe",
    });
  });

  it("instala exactamente la ruta que devolvio la descarga", async () => {
    hayVersion();
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_update") return release();
      if (cmd === "download_update") return "D:\\otra\\ruta\\setup.exe";
      return null;
    });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    await act(async () => {
      await result.current.instalar();
    });

    expect(invoke).toHaveBeenCalledWith("install_update", {
      path: "D:\\otra\\ruta\\setup.exe",
    });
  });

  it("reutiliza lo encontrado sin volver a consultar", async () => {
    hayVersion();
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });
    const consultas = invoke.mock.calls.filter((c) => c[0] === "check_update").length;

    await act(async () => {
      await result.current.instalar();
    });

    expect(invoke.mock.calls.filter((c) => c[0] === "check_update")).toHaveLength(
      consultas,
    );
  });

  it("calcula el porcentaje con lo que informa Rust", async () => {
    hayVersion();
    // La descarga se queda colgada para poder mirar el estado a mitad.
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_update") return release();
      if (cmd === "download_update") return new Promise(() => {});
      return null;
    });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    act(() => {
      void result.current.instalar();
    });
    await waitFor(() =>
      expect(listen.mock.calls.some((c) => c[0] === UPDATE_PROGRESS)).toBe(true),
    );

    act(() => emitirProgreso(500, 1000));

    expect(result.current.state).toEqual({ fase: "descargando", porcentaje: 50 });
  });

  /** Sin tamaño total no se puede calcular: barra indeterminada, no un numero inventado. */
  it("deja el porcentaje en null si no se sabe el tamaño", async () => {
    hayVersion();
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_update") return release();
      if (cmd === "download_update") return new Promise(() => {});
      return null;
    });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    act(() => {
      void result.current.instalar();
    });
    await waitFor(() =>
      expect(listen.mock.calls.some((c) => c[0] === UPDATE_PROGRESS)).toBe(true),
    );

    act(() => emitirProgreso(500, 0));

    expect(result.current.state).toEqual({ fase: "descargando", porcentaje: null });
  });

  /**
   * Rust rechaza y borra el archivo cuando el hash no coincide. Aqui se comprueba
   * que ese fallo llega al usuario y que NO se intenta instalar nada despues.
   */
  it("un hash que no coincide se enseña como error y no instala", async () => {
    hayVersion();
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_update") return release();
      if (cmd === "download_update") {
        throw new Error(
          "El instalador descargado no coincide con el hash publicado y se ha borrado.",
        );
      }
      return null;
    });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    await act(async () => {
      await result.current.instalar();
    });

    expect(result.current.state).toMatchObject({ fase: "error" });
    expect(result.current.state).toMatchObject({
      mensaje: expect.stringContaining("no coincide con el hash"),
    });
    expect(invoke).not.toHaveBeenCalledWith("install_update", expect.anything());
  });

  /** Cada intento fallido dejaria un oyente contando bytes de una descarga muerta. */
  it("suelta la suscripcion al progreso aunque falle", async () => {
    hayVersion();
    let sueltas = 0;
    listen.mockImplementation(async () => () => {
      sueltas += 1;
    });
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_update") return release();
      if (cmd === "download_update") throw new Error("descarga interrumpida");
      return null;
    });
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    await act(async () => {
      await result.current.instalar();
    });

    expect(sueltas).toBe(1);
  });
});
