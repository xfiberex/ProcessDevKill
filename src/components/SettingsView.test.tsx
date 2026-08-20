import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";
import {
  DEFAULT_TEST_SETTINGS,
  invoke,
  openPath,
  updaterFalso,
  writeText,
} from "../test/tauri-mock";
import { AUTO_KILL_MIN_MB, ZOMBIE_MIN_MINUTES } from "../types";
import type { Settings } from "../types";
import type { UpdateState } from "../hooks/useUpdater";

function pintar(parcial: Partial<Settings> = {}, estadoUpdater?: UpdateState) {
  const settings: Settings = { ...DEFAULT_TEST_SETTINGS, ...parcial };
  const onChange = vi.fn();
  const updater = updaterFalso(estadoUpdater);
  render(
    <SettingsView settings={settings} onChange={onChange} updater={updater} />,
  );
  return { onChange, updater, user: userEvent.setup(), settings };
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

/**
 * Cerrar la ventana cierra la app mientras nadie diga lo contrario.
 *
 * Hasta el Tier 7.4 la escondia en la bandeja **siempre**, sin ajuste que lo
 * cambiara, y eso hacia que se acumularan instancias: quien no lo espera da la
 * app por cerrada, la vuelve a abrir y termina con varias copias vivas. El
 * usuario reporto cuatro iconos de bandeja a la vez.
 */
describe("al cerrar la ventana", () => {
  const interruptor = () =>
    screen.getByRole("switch", { name: /bandeja en vez de cerrar/ });

  it("viene apagado, o sea que la X cierra la app", () => {
    pintar({ closeToTray: false });
    expect(interruptor()).not.toBeChecked();
  });

  it("se puede pedir que la deje en la bandeja", async () => {
    const { user, onChange } = pintar({ closeToTray: false });

    await user.click(interruptor());

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ closeToTray: true }),
    );
  });

  it("y volver atras", async () => {
    const { user, onChange } = pintar({ closeToTray: true });

    expect(interruptor()).toBeChecked();
    await user.click(interruptor());

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ closeToTray: false }),
    );
  });

  /**
   * Lo que hay que contarle al usuario no es que la ventana se esconde, sino que
   * la app **sigue viva**: es la parte que sorprende y la que hace que la vuelva
   * a abrir creyendo que no estaba.
   */
  it("avisa de que la app sigue funcionando en segundo plano", () => {
    pintar({ closeToTray: true });
    expect(screen.getByText(/sigue funcionando/)).toBeInTheDocument();
    expect(screen.getByText(/para salir del todo/i)).toBeInTheDocument();
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

describe("actualizaciones", () => {
  it("el boton lanza la busqueda", async () => {
    const { user, updater } = pintar();

    await user.click(screen.getByRole("button", { name: /Buscar actualizaciones/ }));

    expect(updater.buscar).toHaveBeenCalled();
  });

  it("dice que ya esta al dia", () => {
    pintar({}, { fase: "al-dia" });
    expect(screen.getByText("Ya tienes la última versión.")).toBeInTheDocument();
  });

  it("enseña la version nueva y sus notas, con el boton de instalar", () => {
    pintar({}, { fase: "disponible", version: "1.2.0", notas: "Arregla cosas." });

    expect(screen.getByText("v1.2.0")).toBeInTheDocument();
    expect(screen.getByText("Arregla cosas.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Descargar e instalar/ }),
    ).toBeInTheDocument();
  });

  /** Descargar y reiniciar no puede pasar sin que el usuario lo pida. */
  it("no instala hasta que se pulsa el boton", async () => {
    const { user, updater } = pintar({}, {
      fase: "disponible",
      version: "1.2.0",
      notas: null,
    });

    expect(updater.instalar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Descargar e instalar/ }));
    expect(updater.instalar).toHaveBeenCalledTimes(1);
  });

  it("deshabilita el boton de buscar mientras descarga", () => {
    pintar({}, { fase: "descargando", porcentaje: 42 });

    expect(
      screen.getByRole("button", { name: /Buscar actualizaciones/ }),
    ).toBeDisabled();
    expect(screen.getByText(/42 %/)).toBeInTheDocument();
  });

  it("enseña el error si la comprobacion falla", () => {
    pintar({}, { fase: "error", mensaje: "sin conexion" });
    expect(screen.getByText(/No se pudo comprobar: sin conexion/)).toBeInTheDocument();
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

/**
 * Sin esto, el log no sirve de nada: en release nadie sabe donde cayo `app_data_dir()`, y pedirle
 * a alguien que adjunte un archivo que no puede encontrar es lo mismo que no tener log.
 */
describe("registro de avisos", () => {
  it("ensena la ruta del log, que la da Rust", async () => {
    pintar();

    expect(
      await screen.findByText(/processdevkill\.log/),
    ).toBeInTheDocument();
  });

  /**
   * **Se lo pide a Rust, no usa `openPath`.** El permiso `opener:allow-open-path` esta acotado a
   * los dos avisos legales, asi que abrir la carpeta desde la ventana fallaria en la app real — y
   * aqui no se notaria, porque `openPath` esta doblado. De ahi que la prueba mire que NO se use.
   */
  it("le pide a Rust que abra la carpeta, sin usar el permiso de la ventana", async () => {
    const { user } = pintar();
    await screen.findByText(/processdevkill\.log/);

    await user.click(screen.getByRole("button", { name: /Abrir la carpeta/ }));

    expect(invoke).toHaveBeenCalledWith("open_log_dir");
    expect(openPath).not.toHaveBeenCalled();
  });

  it("copia la ruta con el portapapeles de Tauri", async () => {
    const { user } = pintar();
    await screen.findByText(/processdevkill\.log/);

    await user.click(screen.getByRole("button", { name: /Copiar la ruta/ }));

    expect(writeText).toHaveBeenCalledWith(
      String.raw`C:\Users\test\AppData\Roaming\ProcessDevKill\processdevkill.log`,
    );
  });

  /**
   * Es un gestor de procesos que lee todo lo que corre en el equipo: decir que el log **no sale
   * de aqui** importa tanto como tenerlo. Lo mismo que ya promete el README.
   */
  it("deja claro que el log no se envia a ninguna parte", async () => {
    pintar();

    expect(
      await screen.findByText(/no se envía a ninguna parte/),
    ).toBeInTheDocument();
  });
});
