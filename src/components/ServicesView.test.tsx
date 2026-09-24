import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServicesView } from "./ServicesView";
import { servicio } from "../test/tauri-mock";
import { I18nProvider } from "../i18n";
import type { ServiceChange, ServiceInfo } from "../types";

function pintar(
  services: ServiceInfo[] | null,
  busy: string | null = null,
  changes: ServiceChange[] = [],
) {
  const onRefresh = vi.fn();
  const onIrAAjustes = vi.fn();
  const onAction = vi.fn();
  const onStartupChange = vi.fn();
  const onUndo = vi.fn();
  render(
    <ServicesView
      services={services}
      onRefresh={onRefresh}
      onIrAAjustes={onIrAAjustes}
      onAction={onAction}
      onStartupChange={onStartupChange}
      changes={changes}
      onUndo={onUndo}
      busy={busy}
    />,
  );
  return {
    onRefresh,
    onIrAAjustes,
    onAction,
    onStartupChange,
    onUndo,
    user: userEvent.setup(),
  };
}

/** La fila de un servicio, por su nombre del SCM. */
const fila = (nombre: string) => screen.getByText(nombre).closest("tr")!;

describe("mientras se leen", () => {
  /**
   * `null` no es lo mismo que lista vacía, y por eso son dos estados distintos.
   *
   * Enseñar «no se ha encontrado ningún servicio» durante los ~200 ms que tarda el SCM en
   * contestar sería decir algo falso, y encima justo lo que hace que alguien cierre la vista.
   */
  it("no dice que no hay servicios antes de haberlos leido", () => {
    pintar(null);

    expect(screen.getByText("Leyendo los servicios…")).toBeVisible();
    expect(
      screen.queryByText("No se ha encontrado ningún servicio de desarrollo."),
    ).not.toBeInTheDocument();
  });
});

describe("sin servicios", () => {
  it("explica que se busca y lleva a Ajustes", async () => {
    const { onIrAAjustes, user } = pintar([]);

    expect(
      screen.getByText("No se ha encontrado ningún servicio de desarrollo."),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Añadir servicios vigilados" }),
    );
    expect(onIrAAjustes).toHaveBeenCalled();
  });
});

describe("la tabla", () => {
  it("pinta el nombre del SCM y el que enseña Windows", () => {
    pintar([
      servicio({
        name: "MSSQL$SQLEXPRESS",
        displayName: "SQL Server (SQLEXPRESS)",
      }),
    ]);

    expect(screen.getByText("MSSQL$SQLEXPRESS")).toBeVisible();
    expect(screen.getByText("SQL Server (SQLEXPRESS)")).toBeVisible();
  });

  it("dice el estado y el tipo de arranque de cada uno", () => {
    pintar([
      servicio({ name: "postgresql-x64-17", state: "running", startType: "automatic" }),
      servicio({ name: "MySQL80", state: "stopped", startType: "manual" }),
      servicio({ name: "SQLBrowser", state: "stopped", startType: "disabled" }),
      servicio({ name: "Redis", state: "pending", startType: "automaticDelayed" }),
    ]);

    expect(within(fila("postgresql-x64-17")).getByText("Corriendo")).toBeVisible();
    expect(within(fila("Redis")).getByText("Cambiando…")).toBeVisible();

    // El arranque ya no es texto: es el desplegable de la fase C, y lo que importa es el valor
    // que trae puesto. Exacto: «Automático» está dentro de «Automático (retrasado)».
    const arranque = (n: string) => within(fila(n)).getByRole("combobox");
    expect(within(arranque("postgresql-x64-17")).getByText("Automático")).toBeVisible();
    expect(within(arranque("MySQL80")).getByText("Manual")).toBeVisible();
    expect(within(arranque("SQLBrowser")).getByText("Deshabilitado")).toBeVisible();
    expect(within(arranque("Redis")).getByText("Automático (retrasado)")).toBeVisible();
  });

  it("enseña los puertos que ocupa", () => {
    pintar([servicio({ name: "postgresql-x64-18", ports: [5432, 5433] })]);

    const f = within(fila("postgresql-x64-18"));
    expect(f.getByText("5432")).toBeVisible();
    expect(f.getByText("5433")).toBeVisible();
  });

  it("refresca cuando se le pide", async () => {
    const { onRefresh, user } = pintar([servicio({ name: "SQLWriter" })]);

    await user.click(screen.getByRole("button", { name: "Refrescar" }));
    expect(onRefresh).toHaveBeenCalled();
  });
});

describe("lo que no se sabe", () => {
  /**
   * **La prueba que de verdad importa de esta vista.**
   *
   * La RAM de un servicio solo se lee con permisos de administrador, y la app arranca sin ellos
   * salvo que se le pida (`runAsAdmin`): llega `null` para casi todos. Pintar eso como «0 MB» sería una cifra que el usuario se cree, y
   * es falsa — un SQL Server corriendo no ocupa cero. El guion dice la verdad, que es que no se
   * sabe, y el `title` dice por qué.
   */
  it("no convierte en cero la RAM que no se pudo leer", () => {
    pintar([servicio({ name: "MSSQL$SQLEXPRESS", memoryMb: null })]);

    const f = within(fila("MSSQL$SQLEXPRESS"));
    expect(f.queryByText("0 MB")).not.toBeInTheDocument();
    expect(f.queryByText(/^0/)).not.toBeInTheDocument();

    // Y el guion no va solo: explica por qué, que es lo que nadie adivina.
    const guiones = f.getAllByTitle(/administrador/);
    expect(guiones.length).toBeGreaterThan(0);
    expect(guiones[0]).toHaveTextContent("—");
  });

  /**
   * El nombre se trunca porque la columna tiene ancho fijo —ver el comentario de la tabla—, asi que
   * el texto entero tiene que quedar a mano. Un «MSSQLFDLauncher$SQLEX…» no identifica nada.
   */
  it("deja el nombre entero a mano aunque la columna lo trunque", () => {
    pintar([
      servicio({
        name: "MSSQLFDLauncher$SQLEXPRESS",
        displayName: "SQL Full-text Filter Daemon Launcher (SQLEXPRESS)",
      }),
    ]);

    const completo = screen.getByTitle(
      "MSSQLFDLauncher$SQLEXPRESS — SQL Full-text Filter Daemon Launcher (SQLEXPRESS)",
    );
    expect(completo).toBeVisible();
  });

  /**
   * **Lo que solo se lee pasando el raton no existe para media gente.**
   *
   * El motivo del guion vivia unicamente en un `title`, y un `title` no lo alcanza quien navega con
   * teclado ni lo anuncia de forma fiable un lector de pantalla. La explicacion va tambien en texto.
   */
  it("explica el guion sin depender del raton", () => {
    pintar([servicio({ name: "MSSQLFDLauncher$SQLEXPRESS", memoryMb: null, ports: [] })]);

    const f = within(fila("MSSQLFDLauncher$SQLEXPRESS"));
    expect(f.getByText(/solo se puede leer con permisos de administrador/)).toBeInTheDocument();
    expect(f.getByText(/no escucha en ningún puerto tcp/i)).toBeInTheDocument();
  });

  it("enseña la RAM cuando si se puede leer", () => {
    pintar([servicio({ name: "MiServicio", memoryMb: 1536 })]);

    expect(within(fila("MiServicio")).getByText("1.5 GB")).toBeVisible();
  });

  /**
   * Un servicio sin puerto no es un fallo, y decirlo importa: SQL Express viene con TCP/IP
   * desactivado, así que el servicio más pesado del equipo aparece sin nada en la columna estrella
   * de esta app. Sin explicación, se lee como que la app no supo mirarlo.
   */
  it("explica por que un servicio puede no tener ningun puerto", () => {
    pintar([servicio({ name: "MSSQL$SQLEXPRESS", ports: [] })]);

    const explicado = within(fila("MSSQL$SQLEXPRESS")).getAllByTitle(/TCP\/IP/);
    expect(explicado.length).toBeGreaterThan(0);
    expect(explicado[0]).toHaveTextContent("—");
  });
});

describe("en ingles", () => {
  it("traduce los estados y los tipos de arranque, que no son texto libre", () => {
    render(
      <I18nProvider language="en">
        <ServicesView
          services={[
            servicio({ name: "MySQL80", state: "stopped", startType: "disabled" }),
          ]}
          onRefresh={vi.fn()}
          onIrAAjustes={vi.fn()}
          onAction={vi.fn()}
          onStartupChange={vi.fn()}
          changes={[]}
          onUndo={vi.fn()}
          busy={null}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Development services")).toBeVisible();
    expect(screen.getByText("Stopped")).toBeVisible();
    expect(within(screen.getByRole("combobox")).getByText("Disabled")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start MySQL80" }),
    ).toBeVisible();
    // El nombre del SCM **no** se traduce nunca: es la clave.
    expect(screen.getByText("MySQL80")).toBeVisible();
  });
});

describe("arrancar y detener", () => {
  it("ofrece detener lo que corre y arrancar lo que esta parado", () => {
    pintar([
      servicio({ name: "postgresql-x64-17", state: "running" }),
      servicio({ name: "MySQL80", state: "stopped" }),
    ]);

    expect(
      within(fila("postgresql-x64-17")).getByRole("button", {
        name: "Detener postgresql-x64-17",
      }),
    ).toBeVisible();
    expect(
      within(fila("MySQL80")).getByRole("button", { name: "Arrancar MySQL80" }),
    ).toBeVisible();
  });

  /**
   * Un servicio corriendo no se arranca. Pintar los dos botones y apagar uno obliga a mirar cual
   * de los dos esta deshabilitado antes de pulsar, que es trabajo para el lector.
   */
  it("no ofrece las dos acciones a la vez en la misma fila", () => {
    pintar([servicio({ name: "SQLWriter", state: "running" })]);

    const f = within(fila("SQLWriter"));
    expect(f.getByRole("button", { name: "Detener SQLWriter" })).toBeVisible();
    expect(
      f.queryByRole("button", { name: "Arrancar SQLWriter" }),
    ).not.toBeInTheDocument();
  });

  it("avisa a quien manda con el servicio y la accion", async () => {
    const { onAction, user } = pintar([
      servicio({ name: "MySQL80", state: "stopped" }),
    ]);

    await user.click(
      screen.getByRole("button", { name: "Arrancar MySQL80" }),
    );

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: "MySQL80" }),
      "start",
    );
  });

  /**
   * **La prueba negativa de esta vista: que NO se puede pulsar.**
   *
   * Un servicio en transicion ya esta haciendo algo. Encargarle lo contrario a mitad de camino es
   * la forma de dejarlo atascado, asi que en `pending` no hay boton, solo el aviso de que espere.
   */
  it("no deja encargar nada a un servicio que ya esta cambiando", () => {
    pintar([servicio({ name: "MSSQL$SQLEXPRESS", state: "pending" })]);

    const f = within(fila("MSSQL$SQLEXPRESS"));
    expect(f.queryByRole("button")).not.toBeInTheDocument();
    expect(f.getByText("Esperando a Windows…")).toBeVisible();
  });

  /**
   * Con una accion en curso se apagan los botones de **toda** la tabla, no solo el de su fila: el
   * UAC de la primera sigue en pantalla cuando se podria pulsar la segunda, y dos ventanas de UAC
   * encimadas no son una respuesta a nada.
   */
  it("apaga la tabla entera mientras hay una accion en curso", () => {
    pintar(
      [
        servicio({ name: "MySQL80", state: "stopped" }),
        servicio({ name: "SQLWriter", state: "running" }),
      ],
      "MySQL80",
    );

    // La fila ocupada pierde el boton y dice que espera.
    expect(
      within(fila("MySQL80")).queryByRole("button"),
    ).not.toBeInTheDocument();
    // Y la otra lo conserva, pero deshabilitado.
    expect(
      within(fila("SQLWriter")).getByRole("button", {
        name: "Detener SQLWriter",
      }),
    ).toBeDisabled();
  });
});

describe("el tipo de arranque", () => {
  /**
   * **La prueba obligatoria de la fase C: los tipos que la app NO ofrece.**
   *
   * `boot` y `system` son de controladores que carga el nucleo antes de que exista el escritorio.
   * No aparecen en el desplegable, y un servicio que ya esta en uno de ellos ni siquiera tiene
   * desplegable: se pinta como texto, porque no hay nada que hacer ahi.
   */
  it("no ofrece los arranques del nucleo, ni siquiera para deshacerlos", async () => {
    const { user } = pintar([
      servicio({ name: "MySQL80", startType: "manual" }),
      servicio({ name: "UnDriver", startType: "boot" }),
    ]);

    await user.click(within(fila("MySQL80")).getByRole("combobox"));
    const lista = await screen.findByRole("listbox");
    const opciones = within(lista)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual([
      "Automático",
      "Automático (retrasado)",
      "Manual",
      "Deshabilitado",
    ]);
    await user.keyboard("{Escape}");

    // El de `boot` no es editable en absoluto, y dice por que.
    const f = within(fila("UnDriver"));
    expect(f.queryByRole("combobox")).not.toBeInTheDocument();
    expect(f.getByTitle(/controladores del sistema/)).toBeVisible();
  });

  it("avisa a quien manda con el servicio y el tipo elegido", async () => {
    const { onStartupChange, user } = pintar([
      servicio({ name: "SQLTELEMETRY$SQLEXPRESS", startType: "automaticDelayed" }),
    ]);

    await user.click(
      screen.getByRole("combobox", {
        name: "Tipo de arranque de SQLTELEMETRY$SQLEXPRESS",
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Deshabilitado" }));

    expect(onStartupChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "SQLTELEMETRY$SQLEXPRESS" }),
      "disabled",
    );
  });

  /**
   * **El criterio negativo de A4 (Tier 11).** Con el `<select>` nativo, una flecha sobre el control
   * cerrado ya cambiaba el valor y abría la confirmación con el foco en «Cambiar arranque»: un
   * Enter después confirmaba lo que no se había elegido. Ni la flecha ni una letra pueden pedir
   * un cambio; solo elegir una entrada.
   */
  it("ni una flecha ni una letra con la lista cerrada piden un cambio", async () => {
    const { onStartupChange, user } = pintar([
      servicio({ name: "MySQL80", startType: "automatic" }),
    ]);

    const control = screen.getByRole("combobox", {
      name: "Tipo de arranque de MySQL80",
    });
    control.focus();
    await user.keyboard("d");
    await user.keyboard("{ArrowDown}");

    expect(onStartupChange).not.toHaveBeenCalled();
  });

  /** Elegir el que ya está puesto no es un cambio: no puede abrir una confirmación vacía. */
  it("elegir el mismo valor no pide nada", async () => {
    const { onStartupChange, user } = pintar([
      servicio({ name: "MySQL80", startType: "manual" }),
    ]);

    await user.click(screen.getByRole("combobox", { name: "Tipo de arranque de MySQL80" }));
    await user.click(await screen.findByRole("option", { name: "Manual" }));

    expect(onStartupChange).not.toHaveBeenCalled();
  });
});

describe("el registro de lo que la app cambio", () => {
  const cambio = (parcial: Partial<ServiceChange> = {}): ServiceChange => ({
    name: "MySQL80",
    displayName: "MySQL80",
    from: "manual",
    to: "disabled",
    changedAt: 1_700_000_000_000,
    ...parcial,
  });

  /**
   * Sin cambios no hay seccion. Una titulada «Cambios que ha hecho ProcessDevKill» y vacia, en un
   * equipo donde no ha hecho ninguno, es una pregunta que el usuario no tenia.
   */
  it("no aparece cuando la app no ha cambiado nada", () => {
    pintar([servicio({ name: "MySQL80" })], null, []);

    expect(
      screen.queryByText("Cambios que ha hecho ProcessDevKill"),
    ).not.toBeInTheDocument();
  });

  it("dice de que a que, y ofrece deshacerlo", async () => {
    const { onUndo, user } = pintar([servicio({ name: "MySQL80" })], null, [
      cambio(),
    ]);

    expect(screen.getByText("Cambios que ha hecho ProcessDevKill")).toBeVisible();
    expect(screen.getByText('de «Manual» a «Deshabilitado»')).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Deshacer el cambio de arranque de MySQL80",
      }),
    );
    expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ name: "MySQL80" }));
  });

  it("no deja deshacer mientras hay otra accion en curso", () => {
    pintar([servicio({ name: "MySQL80" })], "MySQL80", [cambio()]);

    expect(
      screen.getByRole("button", {
        name: "Deshacer el cambio de arranque de MySQL80",
      }),
    ).toBeDisabled();
  });
});
