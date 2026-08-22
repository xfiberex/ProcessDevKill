import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServicesView } from "./ServicesView";
import { servicio } from "../test/tauri-mock";
import { I18nProvider } from "../i18n";
import type { ServiceInfo } from "../types";

function pintar(services: ServiceInfo[] | null) {
  const onRefresh = vi.fn();
  const onIrAAjustes = vi.fn();
  render(
    <ServicesView
      services={services}
      onRefresh={onRefresh}
      onIrAAjustes={onIrAAjustes}
    />,
  );
  return { onRefresh, onIrAAjustes, user: userEvent.setup() };
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
    expect(within(fila("postgresql-x64-17")).getByText("Automático")).toBeVisible();
    expect(within(fila("MySQL80")).getByText("Manual")).toBeVisible();
    expect(within(fila("SQLBrowser")).getByText("Deshabilitado")).toBeVisible();
    expect(within(fila("Redis")).getByText("Cambiando…")).toBeVisible();
    expect(
      within(fila("Redis")).getByText("Automático (retrasado)"),
    ).toBeVisible();
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
   * La RAM de un servicio solo se lee con permisos de administrador, y ProcessDevKill no los pide:
   * llega `null` para casi todos. Pintar eso como «0 MB» sería una cifra que el usuario se cree, y
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
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Development services")).toBeVisible();
    expect(screen.getByText("Stopped")).toBeVisible();
    expect(screen.getByText("Disabled")).toBeVisible();
    // El nombre del SCM **no** se traduce nunca: es la clave.
    expect(screen.getByText("MySQL80")).toBeVisible();
  });
});
