import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { DEFAULT_TEST_SETTINGS, invoke, listen, proceso, servicio } from "./test/tauri-mock";
import { SYSTEM_USAGE } from "./types";
import type { HistoryEntry, ProcessInfo, ServiceChange, Settings, SystemUsage } from "./types";

/**
 * La ventana entera en inglés, vista a vista (T12-20).
 *
 * `i18n.test.tsx` compara los dos catálogos entre sí, pero eso no prueba que la ventana **use** el
 * inglés: una frase escrita a mano en un componente no pasa por ningún catálogo y sale en español
 * con la app en inglés. Aquí se pinta cada vista con datos y se mira lo que de verdad hay en
 * pantalla. Es además lo que ejecuta la mitad inglesa del catálogo, que casi ninguna otra prueba
 * tocaba.
 */

const EN: Settings = {
  ...DEFAULT_TEST_SETTINGS,
  language: "en",
  customNames: ["docker"],
  protected: ["mi-api"],
  customServices: ["MiMotor"],
  autoKillEnabled: true,
  zombieEnabled: true,
};

const LISTA: ProcessInfo[] = [
  proceso({ pid: 100, script: "vite", project: "web", ports: [3000, 5173], memoryMb: 900 }),
  proceso({ pid: 200, project: "mi-api", protected: true, ports: [8080] }),
  proceso({ pid: 300, name: "python.exe", runtime: "python", zombie: true, idleSecs: 1200, ports: [5000] }),
];

const HISTORIAL: HistoryEntry[] = [
  // Dos del mismo instante y origen: una tanda, que es una fila que se despliega.
  { pid: 1, name: "node.exe", freedPorts: [3000], killedAt: 1_787_000_000_000, source: "hotkey" },
  { pid: 2, name: "node.exe", freedPorts: [], killedAt: 1_787_000_000_000, source: "hotkey" },
  { pid: 3, name: "python.exe", freedPorts: [], killedAt: 1_786_000_000_000, source: "auto" },
  { pid: 4, name: "dotnet.exe", freedPorts: [5000], killedAt: 1_785_000_000_000, source: "tray" },
];

const SERVICIOS = [
  servicio({ name: "MySQL80", family: "mySql", state: "running", ports: [3306] }),
  servicio({ name: "postgresql-x64-17", family: "postgres", state: "stopped", startType: "manual", pid: 0 }),
  servicio({ name: "MSSQL$SQLEXPRESS", state: "running", startType: "disabled", memoryMb: 512 }),
];

const CAMBIOS: ServiceChange[] = [
  {
    name: "MySQL80",
    displayName: "MySQL80",
    from: "manual",
    to: "automatic",
    changedAt: 1_787_000_000_000,
  },
];

const MEDIDA: SystemUsage = {
  cpu: 40,
  devCpu: 6.25,
  usedMemoryMb: 12288,
  totalMemoryMb: 32768,
  devMemoryMb: 4096,
};

/**
 * Letras que el inglés no usa. Las comillas de apertura y los signos invertidos también cuentan:
 * `«`, `¿` y `¡` son la huella de una frase española que no pasó por el catálogo.
 */
const DEL_ESPANOL = /[áéíóúñÁÉÍÓÚÑ¿¡«»]/;

/** El texto visible y el de los nombres accesibles, sin lo que es español a propósito. */
function textoDeLaVentana(): string {
  const nodos = [...document.body.querySelectorAll("*")];
  const atributos = nodos.flatMap((n) =>
    ["aria-label", "title", "placeholder"].map((a) => n.getAttribute(a) ?? ""),
  );
  return (
    [document.body.textContent ?? "", ...atributos]
      .join("\n")
      // El selector de idioma nombra cada idioma en el suyo, y su título va en los dos.
      .replace(/Español/g, "")
      .replace(/Idioma \/ Language/g, "")
  );
}

async function montar() {
  invoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case "get_settings":
      case "save_settings":
        return EN;
      case "get_processes":
        return LISTA;
      case "get_history":
        return HISTORIAL;
      case "get_services":
        return SERVICIOS;
      case "get_service_changes":
        return CAMBIOS;
      case "get_service_dependents":
        return [];
      case "get_elevation":
        return false;
      case "log_path":
        return String.raw`C:\Users\test\AppData\Roaming\ProcessDevKill\processdevkill.log`;
      default:
        return null;
    }
  });

  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText("Select PID 100");
  return user;
}

describe("la ventana en inglés", () => {
  it("la vista de Procesos, con su sidebar y su medidor", async () => {
    await montar();

    const suscripciones = listen.mock.calls.filter((c) => c[0] === SYSTEM_USAGE);
    const handler = suscripciones[suscripciones.length - 1][1];
    await act(async () => {
      handler({ payload: MEDIDA });
    });

    expect(screen.getByRole("heading", { name: "Processes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search processes")).toBeInTheDocument();
    expect(screen.getByText("3 processes listed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuke All" })).toBeEnabled();
    expect(screen.getByText("Zombie")).toBeInTheDocument();
    expect(screen.getAllByText("Protected").length).toBeGreaterThan(0);
    expect(screen.getByText("Your environment")).toBeInTheDocument();
    // Sin elevar, el aviso del sidebar.
    expect(await screen.findByText("Not running as admin")).toBeInTheDocument();

    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });

  it("el menú de una fila y la barra de la selección", async () => {
    const user = await montar();

    await user.pointer({
      target: screen.getByLabelText("Select PID 100").closest("tr")!,
      keys: "[MouseRight]",
    });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Close process")).toBeInTheDocument();
    expect(within(menu).getByText("Copy ports")).toBeInTheDocument();
    expect(within(menu).getByText("Protect “web”")).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
    await user.keyboard("{Escape}");

    await user.click(screen.getByLabelText("Select PID 100"));
    await user.click(screen.getByLabelText("Select PID 200"));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });

  it("el diálogo de Nuke All, con el protegido que se queda fuera", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "Nuke All" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Close 2 processes")).toBeInTheDocument();
    expect(
      within(dialogo).getByText("The protected process in the list is left alone."),
    ).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });

  it("la vista de Servicios, con lo que la app ha cambiado", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "Services" }));

    expect(await screen.findByRole("button", { name: "Stop MySQL80" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start postgresql-x64-17" }),
    ).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);

    // Y el diálogo de detener, que es donde más frase hay.
    await user.click(screen.getByRole("button", { name: "Stop MySQL80" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByRole("button", { name: "Stop service" })).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });

  it("la vista de Historial, con una tanda", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: /^History/ }));

    expect(await screen.findByText("4 closed processes")).toBeInTheDocument();
    expect(screen.getByText("Shortcut")).toBeInTheDocument();
    expect(screen.getByText("Auto-Kill")).toBeInTheDocument();
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });

  it("la vista de Ajustes, con todos sus grupos", async () => {
    const user = await montar();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("log_path"));
    expect(textoDeLaVentana()).not.toMatch(DEL_ESPANOL);
  });
});
