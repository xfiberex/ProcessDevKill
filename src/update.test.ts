import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUpdater } from "./update";
import { check, relaunch } from "./test/tauri-mock";

/** Doble de un `Update` del plugin, con lo que usa el hook. */
function actualizacion(version = "1.2.0", body: string | undefined = "Notas.") {
  const downloadAndInstall = vi.fn(async () => {});
  check.mockImplementation(async () => ({ version, body, downloadAndInstall }));
  return { downloadAndInstall };
}

describe("buscar", () => {
  it("en reposo no ha consultado nada", () => {
    const { result } = renderHook(() => useUpdater());
    expect(result.current.state).toEqual({ fase: "reposo" });
    expect(check).not.toHaveBeenCalled();
  });

  it("sin version nueva queda al dia", async () => {
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.buscar();
    });

    expect(result.current.state).toEqual({ fase: "al-dia" });
  });

  it("con version nueva la expone con sus notas", async () => {
    actualizacion("1.2.0", "Arregla el puerto.");
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

  it("devuelve la version encontrada para que quien llame avise", async () => {
    actualizacion("2.0.0");
    const { result } = renderHook(() => useUpdater());

    let devuelto: string | null = null;
    await act(async () => {
      devuelto = await result.current.buscar();
    });

    expect(devuelto).toBe("2.0.0");
  });

  it("un fallo de red se enseña como error", async () => {
    check.mockImplementation(async () => {
      throw new Error("sin conexion");
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
      check.mockImplementation(async () => {
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
      actualizacion("1.5.0");
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

    expect(relaunch).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ fase: "reposo" });
  });

  it("descarga la que se encontro y reinicia", async () => {
    const { downloadAndInstall } = actualizacion();
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });

    await act(async () => {
      await result.current.instalar();
    });

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("reutiliza lo encontrado sin volver a consultar la red", async () => {
    actualizacion();
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });
    const consultas = check.mock.calls.length;

    await act(async () => {
      await result.current.instalar();
    });

    expect(check.mock.calls).toHaveLength(consultas);
  });

  it("calcula el porcentaje con el tamaño que anuncia el servidor", async () => {
    const downloadAndInstall = vi.fn(
      async (cb: (e: Record<string, unknown>) => void) => {
        cb({ event: "Started", data: { contentLength: 1000 } });
        cb({ event: "Progress", data: { chunkLength: 250 } });
        cb({ event: "Progress", data: { chunkLength: 250 } });
      },
    );
    check.mockImplementation(async () => ({
      version: "1.2.0",
      body: null,
      downloadAndInstall,
    }));

    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });
    await act(async () => {
      await result.current.instalar();
    });

    expect(result.current.state).toEqual({ fase: "descargando", porcentaje: 50 });
  });

  /** Sin Content-Length no se puede calcular: barra indeterminada, no un numero inventado. */
  it("deja el porcentaje en null si el servidor no dice el tamaño", async () => {
    const downloadAndInstall = vi.fn(
      async (cb: (e: Record<string, unknown>) => void) => {
        cb({ event: "Started", data: { contentLength: undefined } });
        cb({ event: "Progress", data: { chunkLength: 500 } });
      },
    );
    check.mockImplementation(async () => ({
      version: "1.2.0",
      body: null,
      downloadAndInstall,
    }));

    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });
    await act(async () => {
      await result.current.instalar();
    });

    expect(result.current.state).toEqual({ fase: "descargando", porcentaje: null });
  });

  it("un fallo al descargar se enseña como error y no reinicia", async () => {
    check.mockImplementation(async () => ({
      version: "1.2.0",
      body: null,
      downloadAndInstall: vi.fn(async () => {
        throw new Error("descarga interrumpida");
      }),
    }));

    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await result.current.buscar();
    });
    await act(async () => {
      await result.current.instalar();
    });

    await waitFor(() => expect(result.current.state).toMatchObject({ fase: "error" }));
    expect(relaunch).not.toHaveBeenCalled();
  });
});
