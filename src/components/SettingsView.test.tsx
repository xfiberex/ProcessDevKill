import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";
import { DEFAULT_TEST_SETTINGS } from "../test/tauri-mock";
import { AUTO_KILL_MIN_MB, ZOMBIE_MIN_MINUTES } from "../types";
import type { Settings } from "../types";

function pintar(parcial: Partial<Settings> = {}) {
  const settings: Settings = { ...DEFAULT_TEST_SETTINGS, ...parcial };
  const onChange = vi.fn();
  render(<SettingsView settings={settings} onChange={onChange} />);
  return { onChange, user: userEvent.setup(), settings };
}

// Por nombre accesible: el texto de al lado ("MB por proceso…") es
// aria-describedby, que describe pero no nombra. Los aria-label de los campos
// se añadieron precisamente porque estas pruebas no encontraban como pedirlos.
const umbral = () => screen.getByRole("spinbutton", { name: "Umbral de RAM en MB" });
const minutos = () =>
  screen.getByRole("spinbutton", { name: "Minutos sin actividad" });

/**
 * El suelo del umbral no es validacion de formulario: con 50 MB, cualquier
 * proceso vigilado lo supera y el siguiente ciclo del Auto-Kill se lleva por
 * delante el entorno de desarrollo entero. Rust lo impone tambien al leer el
 * settings.json, pero la UI tiene que corregirlo a la vista del usuario.
 */
describe("umbral del Auto-Kill", () => {
  it("sube a 256 lo que se escriba por debajo", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.clear(umbral());
    await user.type(umbral(), "50");
    await user.tab();

    expect(umbral()).toHaveValue(AUTO_KILL_MIN_MB);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ autoKillMb: AUTO_KILL_MIN_MB }),
    );
  });

  it("respeta un valor por encima del suelo", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.clear(umbral());
    await user.type(umbral(), "4096");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ autoKillMb: 4096 }),
    );
  });

  /**
   * Escribir "2048" pasa por "2". Guardando en cada pulsacion, el umbral bajaria
   * al minimo durante un instante con el vigilante mirando: se guarda al salir
   * del campo.
   */
  it("no guarda nada mientras se teclea", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.clear(umbral());
    await user.type(umbral(), "4096");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter guarda sin tener que salir del campo a mano", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.clear(umbral());
    await user.type(umbral(), "3072{Enter}");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ autoKillMb: 3072 }),
    );
  });

  it("vuelve al valor guardado si el campo queda vacio o con basura", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.clear(umbral());
    await user.tab();

    expect(umbral()).toHaveValue(2048);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("no reescribe los ajustes si el valor no cambia", async () => {
    const { user, onChange } = pintar({ autoKillMb: 2048 });

    await user.click(umbral());
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * Se descubrio probandolo: con el campo deshabilitado hasta encender el
   * interruptor, habia que armar el Auto-Kill con el umbral por defecto para
   * poder cambiarlo, y ese rato con 2 GB puede cerrar algo legitimo.
   */
  it("es editable con el Auto-Kill apagado", () => {
    pintar({ autoKillEnabled: false });
    expect(umbral()).not.toBeDisabled();
  });
});

describe("minutos del Zombie Finder", () => {
  it("sube al minimo lo que se escriba por debajo", async () => {
    const { user, onChange } = pintar({ zombieMinutes: 10 });

    await user.clear(minutos());
    await user.type(minutos(), "0");
    await user.tab();

    expect(minutos()).toHaveValue(ZOMBIE_MIN_MINUTES);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ zombieMinutes: ZOMBIE_MIN_MINUTES }),
    );
  });

  it("respeta un valor valido", async () => {
    const { user, onChange } = pintar({ zombieMinutes: 10 });

    await user.clear(minutos());
    await user.type(minutos(), "30");
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ zombieMinutes: 30 }),
    );
  });
});

describe("interruptores", () => {
  it("el Auto-Kill y el Zombie Finder arrancan apagados de fabrica", () => {
    pintar();
    expect(screen.getByRole("switch", { name: /Cerrar solos/ })).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: /Resaltar los procesos olvidados/ }),
    ).not.toBeChecked();
  });

  it("encender el Auto-Kill guarda el resto de ajustes sin tocar", async () => {
    const { user, onChange, settings } = pintar({ autoKillMb: 4096 });

    await user.click(screen.getByRole("switch", { name: /Cerrar solos/ }));

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      autoKillEnabled: true,
    });
  });

  it("el atajo global se puede desactivar", async () => {
    const { user, onChange } = pintar({ hotkeyEnabled: true });

    await user.click(screen.getByRole("switch", { name: /Ctrl\+Alt\+K/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hotkeyEnabled: false }),
    );
  });
});

describe("procesos vigilados", () => {
  it("añade un nombre y limpia el campo", async () => {
    const { user, onChange } = pintar({ customNames: [] });

    await user.type(screen.getByPlaceholderText("nombre del ejecutable"), "docker");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ customNames: ["docker"] }),
    );
  });

  it("Enter tambien añade", async () => {
    const { user, onChange } = pintar({ customNames: [] });

    await user.type(
      screen.getByPlaceholderText("nombre del ejecutable"),
      "go{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ customNames: ["go"] }),
    );
  });

  it("ignora un duplicado aunque cambie de caja", async () => {
    const { user, onChange } = pintar({ customNames: ["docker"] });

    await user.type(
      screen.getByPlaceholderText("nombre del ejecutable"),
      "DOCKER{Enter}",
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignora un nombre en blanco", async () => {
    const { user, onChange } = pintar({ customNames: [] });

    await user.type(screen.getByPlaceholderText("nombre del ejecutable"), "   {Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("quita un nombre de la lista", async () => {
    const { user, onChange } = pintar({ customNames: ["docker", "go"] });

    await user.click(screen.getByRole("button", { name: "Quitar docker" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ customNames: ["go"] }),
    );
  });
});

describe("tema", () => {
  it("marca el tema activo y cambia al pulsar otro", async () => {
    const { user, onChange } = pintar({ theme: "dark" });

    expect(screen.getByRole("button", { name: "Oscuro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Claro" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "light" }),
    );
  });
});
