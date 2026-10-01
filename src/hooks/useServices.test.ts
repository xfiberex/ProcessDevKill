import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServices } from "./useServices";
import { es } from "../i18n";
import { invoke, servicio } from "../test/tauri-mock";
import type { ConfirmRequest } from "../components/ConfirmDialog";
import type { ServiceChange } from "../types";

// Los avisos se doblan aquí, y no se buscan en pantalla: el hook no pinta nada, y lo que importa es
// **qué clase de aviso** sale —éxito, información o error— y con qué frase.
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const MYSQL = servicio({ name: "MySQL80", startType: "manual" });

/** Lo que contesta Rust a cada comando; la prueba cambia solo lo que mira. */
function rust(respuestas: Record<string, unknown>) {
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd in respuestas) {
      const r = respuestas[cmd];
      if (r instanceof Error) throw r;
      return r;
    }
    if (cmd === "get_services") return [MYSQL];
    if (cmd === "get_service_changes") return [];
    if (cmd === "get_service_dependents") return [];
    throw new Error(`Comando no simulado: ${cmd}`);
  });
}

function montar() {
  const confirmar = vi.fn<(peticion: ConfirmRequest) => void>();
  const hook = renderHook(() => useServices(es, confirmar));
  /** Lo que haría el diálogo al pulsar su botón de confirmar. */
  const confirmarUltimo = async () => {
    const peticion = confirmar.mock.calls[confirmar.mock.calls.length - 1][0];
    await act(async () => {
      await peticion.onConfirm();
    });
  };
  return { ...hook, confirmar, confirmarUltimo };
}

beforeEach(() => {
  for (const fn of Object.values(toast)) fn.mockClear();
});

describe("leer los servicios", () => {
  it("empieza sin lista, para no decir «no hay servicios» antes de leerlos", () => {
    rust({});
    const { result } = montar();

    expect(result.current.services).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("lee la lista y el registro de cambios", async () => {
    const cambio: ServiceChange = {
      name: "MySQL80",
      displayName: "MySQL80",
      from: "automatic",
      to: "manual",
      changedAt: 1_787_000_000_000,
    };
    rust({ get_service_changes: [cambio] });
    const { result } = montar();

    act(() => result.current.load());

    await waitFor(() => expect(result.current.services).toEqual([MYSQL]));
    expect(result.current.changes).toEqual([cambio]);
  });

  /** Con `null` la vista se quedaría diciendo «leyendo…» para siempre. */
  it("si falla, deja la lista vacía y lo dice", async () => {
    rust({ get_services: new Error("SCM") });
    const { result } = montar();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.services).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("No se pudieron leer los servicios", {
      description: "Error: SCM",
    });
  });

  /** Sin el registro se pierde poder deshacer, no la vista. */
  it("si falla el registro de cambios, la lista sale igual y sin aviso", async () => {
    rust({ get_service_changes: new Error("disco") });
    const { result } = montar();

    act(() => result.current.load());

    await waitFor(() => expect(result.current.services).toEqual([MYSQL]));
    expect(result.current.changes).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("arrancar y detener", () => {
  it("arrancar no pide confirmación, y dice que está corriendo", async () => {
    rust({ control_service: { outcome: "done", state: "running", blockers: [] } });
    const { result, confirmar } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "start");
    });

    expect(confirmar).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("control_service", { name: "MySQL80", action: "start" });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("MySQL80 está corriendo."),
    );
    // Pase lo que pase, la lista se relee: lo que se enseñe tiene que ser lo que dice el SCM.
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_services"));
  });

  it("detener pide confirmación, y no toca nada hasta que se da", async () => {
    rust({ control_service: { outcome: "done", state: "stopped", blockers: [] } });
    const { result, confirmar, confirmarUltimo } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "stop");
    });

    expect(invoke).not.toHaveBeenCalledWith("control_service", expect.anything());
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Detener MySQL80",
        confirmLabel: "Detener servicio",
        note: es.servicios.acciones.pideAdmin,
      }),
    );

    await confirmarUltimo();

    expect(invoke).toHaveBeenCalledWith("control_service", { name: "MySQL80", action: "stop" });
    expect(toast.success).toHaveBeenCalledWith("MySQL80 está parado.");
  });

  /** Windows se negaría después del UAC; se dice antes, y sin la nota de administrador. */
  it("con servicios que dependen de él, el diálogo los nombra", async () => {
    rust({
      get_service_dependents: [{ name: "SQLAgent", displayName: "Agente" }],
    });
    const { result, confirmar } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "stop");
    });

    const peticion = confirmar.mock.calls[0][0];
    expect(peticion.message).toBe(
      "Windows no lo detendrá mientras SQLAgent siga corriendo. Detén ese primero.",
    );
    expect(peticion.note).toBeUndefined();
  });

  it("si no se pueden leer las dependencias, el diálogo sale igual", async () => {
    rust({ get_service_dependents: new Error("SCM") });
    const { result, confirmar } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "stop");
    });

    expect(confirmar.mock.calls[0][0].message).toBe(es.servicios.acciones.detenerMensaje("MySQL80"));
  });

  it("un servicio que sigue en transición no es ni éxito ni error", async () => {
    rust({ control_service: { outcome: "pending", state: "startPending", blockers: [] } });
    const { result } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "start");
    });

    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("bloqueado por otros, dice cuáles", async () => {
    rust({
      control_service: {
        outcome: "blocked",
        state: "running",
        blockers: [
          { name: "A", displayName: "A" },
          { name: "B", displayName: "B" },
        ],
      },
    });
    const { result, confirmarUltimo } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "stop");
    });
    await confirmarUltimo();

    expect(toast.error).toHaveBeenCalledWith(
      "No se pudo detener MySQL80: siguen corriendo A y B.",
    );
  });

  it("rechazado por Windows, lo dice", async () => {
    rust({ control_service: { outcome: "refused", state: "stopped", blockers: [] } });
    const { result } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "start");
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Windows no dejó completar la acción sobre MySQL80.",
      ),
    );
  });

  /** Cerrar el UAC es una respuesta, no un fallo: no merece aviso. */
  it("cancelar el aviso de administrador no dice nada", async () => {
    rust({ control_service: { outcome: "cancelled", state: "stopped", blockers: [] } });
    const { result } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "start");
    });

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_services"));
    for (const fn of Object.values(toast)) expect(fn).not.toHaveBeenCalled();
  });

  it("si Rust falla, sale su error y los botones se liberan", async () => {
    rust({ control_service: new Error("no se pudo elevar") });
    const { result } = montar();

    await act(async () => {
      await result.current.pedirAccion(MYSQL, "start");
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Error: no se pudo elevar"),
    );
    expect(result.current.busy).toBeNull();
  });

  it("mientras dura la acción, el servicio figura como ocupado", async () => {
    let soltar: (r: unknown) => void = () => {};
    rust({});
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === "control_service") return new Promise((resolve) => (soltar = resolve));
      return [];
    });
    const { result } = montar();

    act(() => {
      result.current.pedirAccion(MYSQL, "start");
    });
    await waitFor(() => expect(result.current.busy).toBe("MySQL80"));

    await act(async () => {
      soltar({ outcome: "done", state: "running", blockers: [] });
    });
    await waitFor(() => expect(result.current.busy).toBeNull());
  });
});

describe("cambiar el tipo de arranque", () => {
  it("siempre pide confirmación, con el aviso de que sobrevive al reinicio", () => {
    rust({});
    const { result, confirmar } = montar();

    act(() => result.current.cambiarArranque(MYSQL, "automatic"));

    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cambiar el arranque de MySQL80",
        message: "MySQL80 pasará de «Manual» a «Automático».",
        warning: es.servicios.arranque.aviso,
        tone: "change",
      }),
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  /** El rojo se guarda para lo que puede romper algo que dependa del servicio (Tier 11, C4). */
  it("solo deshabilitar va en tono de peligro", () => {
    rust({});
    const { result, confirmar } = montar();

    act(() => result.current.cambiarArranque(MYSQL, "disabled"));

    expect(confirmar.mock.calls[0][0].tone).toBe("danger");
  });

  it("confirmado, lo cambia, dice a qué quedó y relee la lista y el registro", async () => {
    rust({ set_service_startup: { outcome: "done", startType: "automatic" } });
    const { result, confirmarUltimo } = montar();

    act(() => result.current.cambiarArranque(MYSQL, "automatic"));
    await confirmarUltimo();

    expect(invoke).toHaveBeenCalledWith("set_service_startup", {
      name: "MySQL80",
      displayName: MYSQL.displayName,
      startType: "automatic",
    });
    expect(toast.success).toHaveBeenCalledWith(
      es.servicios.arranque.hecho("MySQL80", "Automático"),
    );
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_service_changes"));
    expect(invoke).toHaveBeenCalledWith("get_services");
  });

  it("rechazado por Windows, lo dice", async () => {
    rust({ set_service_startup: { outcome: "refused", startType: "manual" } });
    const { result, confirmarUltimo } = montar();

    act(() => result.current.cambiarArranque(MYSQL, "automatic"));
    await confirmarUltimo();

    expect(toast.error).toHaveBeenCalledWith(es.servicios.arranque.rechazado("MySQL80"));
  });

  it("si Rust falla, sale su error y los botones se liberan", async () => {
    rust({ set_service_startup: new Error("no se pudo elevar") });
    const { result, confirmarUltimo } = montar();

    act(() => result.current.cambiarArranque(MYSQL, "automatic"));
    await confirmarUltimo();

    expect(toast.error).toHaveBeenCalledWith("Error: no se pudo elevar");
    expect(result.current.busy).toBeNull();
  });
});

describe("deshacer un cambio", () => {
  const CAMBIO: ServiceChange = {
    name: "MySQL80",
    displayName: "MySQL80",
    from: "automatic",
    to: "manual",
    changedAt: 1_787_000_000_000,
  };

  async function conLista() {
    rust({});
    const m = montar();
    act(() => m.result.current.load());
    await waitFor(() => expect(m.result.current.services).toEqual([MYSQL]));
    return m;
  }

  /** Deshacer quita la entrada del registro: prometer que «queda anotado» sería mentir. */
  it("es el mismo cambio hacia atrás, con su propio aviso", async () => {
    const { result, confirmar } = await conLista();

    act(() => result.current.deshacerCambio(CAMBIO));

    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "MySQL80 pasará de «Manual» a «Automático».",
        warning: es.servicios.arranque.avisoDeshacer,
      }),
    );
  });

  /** `from` sale del disco: un registro escrito a mano no puede colar un `boot`. */
  it("no ofrece volver a un tipo de arranque que la app no pone", async () => {
    const { result, confirmar } = await conLista();

    act(() => result.current.deshacerCambio({ ...CAMBIO, from: "boot" }));

    expect(confirmar).not.toHaveBeenCalled();
  });

  it("no hace nada si el servicio ya no está en la lista", async () => {
    const { result, confirmar } = await conLista();

    act(() => result.current.deshacerCambio({ ...CAMBIO, name: "Desinstalado" }));

    expect(confirmar).not.toHaveBeenCalled();
  });
});
