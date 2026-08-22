import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATALOGOS, I18nProvider, Marcado, en, es, useT } from "./i18n";
import { EmptyState } from "./components/EmptyState";

/**
 * Lo que el compilador ya garantiza no se prueba aquí: que a `en` no le falte ni le sobre una
 * clave lo impone `const en: Catalogo`, y `Catalogo` es `typeof es`. Estas pruebas cubren lo que
 * **compila igual de bien estando mal**: dejarse el español copiado en la entrada inglesa, y
 * romper una marca de `**negrita**` al traducir un párrafo.
 */

/** Recorre las dos versiones a la vez y devuelve los pares de cadenas hoja, con su ruta. */
function pares(
  a: unknown,
  b: unknown,
  ruta: string[] = [],
): { ruta: string; es: string; en: string }[] {
  if (typeof a === "string" && typeof b === "string") {
    return [{ ruta: ruta.join("."), es: a, en: b }];
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    return Object.keys(a).flatMap((clave) =>
      pares(
        (a as Record<string, unknown>)[clave],
        (b as Record<string, unknown>)[clave],
        [...ruta, clave],
      ),
    );
  }
  // Las funciones —las frases con número— se cubren aparte, en `FRASES`: no hay forma honesta de
  // invocarlas a ciegas, porque cada una pide sus propios argumentos.
  return [];
}

/**
 * Las frases compuestas, invocadas a mano.
 *
 * Se listan una a una a propósito. Recorrerlas por reflexión obligaría a adivinar los argumentos
 * de cada función —una quiere un número, otra una lista de puertos—, y una llamada inventada que
 * revienta se leería como un fallo de traducción.
 */
const FRASES: ((c: typeof es) => string)[] = [
  (c) => c.medidor.tituloCpu("2,0 %", "31 %"),
  (c) => c.medidor.tituloRam("1.2 GB", "15.6 GB", "31.9 GB"),
  (c) => c.cabecera.enLaLista(1),
  (c) => c.cabecera.enLaLista(7),
  (c) => c.cabecera.matar(3),
  (c) => c.tabla.seleccionarPid(4242),
  (c) => c.tabla.zombiTitulo("2h 10m", [3000]),
  (c) => c.tabla.zombiTitulo("2h 10m", [3000, 5173]),
  (c) => c.tabla.killLabel("node.exe", 42),
  (c) => c.tabla.copiarPuertos(1),
  (c) => c.tabla.copiarPuertos(2),
  (c) => c.tabla.quePuertos([3000]),
  (c) => c.tabla.quePuertos([3000, 5173]),
  (c) => c.historial.recuento(1),
  (c) => c.historial.recuento(9),
  (c) => c.confirmar.cerrarTitulo(1),
  (c) => c.confirmar.cerrarTitulo(4),
  (c) => c.confirmar.cerrarMensaje(1, c.confirmar.ambitoSeleccionados(1)),
  (c) => c.confirmar.cerrarMensaje(4, c.confirmar.ambitoTodos),
  (c) => c.confirmar.cerrarBoton(1),
  (c) => c.confirmar.cerrarBoton(4),
  (c) => c.avisos.fallosParciales(2, 5),
  (c) => c.avisos.cerradoUno("node.exe"),
  (c) => c.avisos.cerradosVarios(3),
  (c) => c.avisos.puertosLiberados([3000]),
  (c) => c.avisos.puertosLiberados([3000, 5173]),
  (c) => c.avisos.copiado("PID 42"),
  (c) => c.avisos.hayVersion("1.5.0"),
  (c) => c.avisos.recursoNoAbierto("LICENSE.txt"),
  (c) => c.ajustes.vigilados.quitar("docker"),
  (c) => c.ajustes.autoKill.unidad("2.0 GB", 256),
  (c) => c.ajustes.autoKill.unidad(null, 256),
  (c) => c.ajustes.zombie.unidad(1),
  (c) => c.ajustes.acercaDe.descripcion(" v1.5.0"),
  // Los argumentos van sin acentos a proposito: lo que aqui se mira es el texto **del catalogo**,
  // y una muestra acentuada lo daria por sin traducir sin que el catalogo tenga la culpa.
  (c) => c.actualizador.error("network unreachable"),
];

describe("el catálogo de idiomas", () => {
  /**
   * El compilador obliga a **rellenar** cada clave, no a que diga algo distinto: copiar y pegar el
   * español en `en` compila perfectamente. Es el descuido probable al añadir una entrada nueva, y
   * es justo lo que un usuario inglés ve como texto sin traducir.
   *
   * Se buscan las letras que el inglés no usa en vez de comparar cadena a cadena, porque muchas
   * coinciden con razón: «PID», «CPU», «Nuke All», «Auto-Kill», «Ctrl+Alt+K», «Node.js».
   */
  it("no deja letras del español en la versión inglesa", () => {
    const soloEspanol = /[áéíóúüñ¿¡]/i;

    // Cada idioma se nombra **en su propio idioma** en el selector: «Español», no «Spanish». Es lo
    // que hace todo el mundo y es lo unico util aqui, porque quien busca su idioma en una lista lo
    // busca escrito como el lo escribiria. Por eso esa entrada lleva la ñ tambien en ingles.
    const EXENTAS = ["idioma.nombres.es"];

    for (const { ruta, en: texto } of pares(es, en)) {
      if (EXENTAS.includes(ruta)) continue;
      expect(soloEspanol.test(texto), `${ruta}: «${texto}»`).toBe(false);
    }

    for (const frase of FRASES) {
      const texto = frase(en);
      expect(soloEspanol.test(texto), `«${texto}»`).toBe(false);
    }
  });

  /**
   * Una marca `**` a medias no revienta nada: se pinta el asterisco tal cual y el aviso pierde la
   * negrita. Y perder la negrita **sí** importa aquí, porque es la que lleva «sin pedir
   * confirmación» y «Ningún proceso se ha cerrado».
   */
  it("mantiene las marcas de texto rico emparejadas y en los dos idiomas", () => {
    for (const { ruta, es: original, en: traducido } of pares(es, en)) {
      const negritasEs = (original.match(/\*\*/g) ?? []).length;
      const negritasEn = (traducido.match(/\*\*/g) ?? []).length;
      const codigosEs = (original.match(/`/g) ?? []).length;
      const codigosEn = (traducido.match(/`/g) ?? []).length;

      expect(negritasEs % 2, `${ruta} (es) tiene un ** suelto`).toBe(0);
      expect(negritasEn % 2, `${ruta} (en) tiene un ** suelto`).toBe(0);
      expect(codigosEs % 2, `${ruta} (es) tiene un backtick suelto`).toBe(0);
      expect(codigosEn % 2, `${ruta} (en) tiene un backtick suelto`).toBe(0);

      // Traducir sin arrastrar el enfasis deja al ingles con un aviso mas plano que el español.
      expect(negritasEn, `${ruta}: el ingles perdio una negrita`).toBe(negritasEs);
      expect(codigosEn, `${ruta}: el ingles perdio un fragmento de codigo`).toBe(
        codigosEs,
      );
    }
  });

  /**
   * Lo anterior no basta: «Historial» copiado tal cual en la entrada inglesa no lleva acento y
   * pasaría el filtro. Esta prueba exige que **cada** entrada cambie, y lleva la lista de las que
   * legítimamente coinciden. Escribirlas a mano es el punto: cada una tuvo que justificarse, y
   * añadir una nueva obliga a justificarla también.
   */
  it("no deja ninguna entrada copiada del español sin motivo", () => {
    const COINCIDEN_CON_MOTIVO: Record<string, string> = {
      // El selector se rotula en los dos idiomas para que lo encuentre quien no entienda la mitad.
      "idioma.titulo": "va en los dos idiomas a la vez, a proposito",
      // Los idiomas se nombran en su propio idioma, que es como los busca quien los busca.
      "idioma.nombres.es": "endonimo",
      "idioma.nombres.en": "endonimo",
      // Nombres de producto: traducirlos seria inventarselos.
      "runtimes.node": "nombre de producto",
      "runtimes.python": "nombre de producto",
      "runtimes.dotnet": "nombre de producto",
      "ajustes.zombie.titulo": "nombre de la funcion, como Auto-Kill",
      "origenes.auto": "nombre de la funcion",
      "origenes.hotkey": "las teclas se llaman igual en los dos idiomas",
      // Siglas y palabras que ya eran inglesas en la version española.
      "columnas.pid": "sigla",
      "columnas.cpu": "sigla",
      "columnas.memoryMb": "sigla",
      "historial.pid": "sigla",
      "sidebar.subtitulo": "ya estaba en ingles",
      "cabecera.nukeAll": "ya estaba en ingles",
      "tabla.kill": "ya estaba en ingles",
    };

    for (const { ruta, es: original, en: traducido } of pares(es, en)) {
      if (ruta in COINCIDEN_CON_MOTIVO) {
        // Y al reves: si una exenta deja de coincidir, la lista se ha quedado vieja.
        expect(traducido, `${ruta} ya no coincide: sobra de la lista de exentas`).toBe(
          original,
        );
        continue;
      }
      expect(traducido, `${ruta}: «${original}» esta igual en los dos idiomas`).not.toBe(
        original,
      );
    }
  });

  it("no deja ninguna cadena vacía", () => {
    for (const { ruta, es: original, en: traducido } of pares(es, en)) {
      expect(original.length, `${ruta} (es)`).toBeGreaterThan(0);
      expect(traducido.length, `${ruta} (en)`).toBeGreaterThan(0);
    }
  });

  /** El rótulo del selector va en los dos idiomas **en las dos entradas**: quien no entienda la
   *  mitad de la app tiene que poder encontrar dónde se cambia sin adivinar. */
  it("rotula el selector de idioma en los dos idiomas a la vez", () => {
    expect(es.idioma.titulo).toContain("Idioma");
    expect(es.idioma.titulo).toContain("Language");
    expect(en.idioma.titulo).toBe(es.idioma.titulo);
  });
});

describe("Marcado", () => {
  it("convierte las marcas en negrita y código, y deja el resto tal cual", () => {
    render(<Marcado texto="Cierra **todos** los `node` de golpe." />);

    expect(screen.getByText("todos").tagName).toBe("STRONG");
    expect(screen.getByText("node").tagName).toBe("CODE");
    // El texto de alrededor sobrevive entero, repartido entre los trozos.
    expect(document.body.textContent).toBe("Cierra todos los node de golpe.");
  });

  it("no toca un texto sin marcas", () => {
    render(<Marcado texto="Refrescar" />);
    expect(document.body.textContent).toBe("Refrescar");
    expect(document.querySelector("strong")).toBeNull();
  });
});

describe("el idioma que se pinta", () => {
  /**
   * Sin proveedor delante se habla español, y **de eso dependen las otras pruebas del frontend**:
   * las 175 que ya existían renderizan componentes sueltos y comparan contra texto en español. Si
   * este valor por defecto cambiara, fallarían todas a la vez sin decir por qué.
   */
  it("cae al español cuando no hay proveedor", () => {
    render(<EmptyState sinProcesos onIrAAjustes={() => {}} />);
    expect(screen.getByText("No hay procesos de desarrollo activos.")).toBeVisible();
  });

  it("cambia la ventana entera al elegir inglés", () => {
    render(
      <I18nProvider language="en">
        <EmptyState sinProcesos onIrAAjustes={() => {}} />
      </I18nProvider>,
    );

    expect(screen.getByText("No development processes running.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add watched processes" }),
    ).toBeVisible();
  });

  /** `CATALOGOS` es lo que usa `App` para armar los toast, que se disparan **fuera** del
   *  proveedor y no pueden pedir el contexto. */
  it("expone los dos catálogos por su código de idioma", () => {
    expect(CATALOGOS.es).toBe(es);
    expect(CATALOGOS.en).toBe(en);
  });

  it("da a useT el catálogo del proveedor que lo envuelve", () => {
    function Sonda() {
      return <p>{useT().sidebar.ajustes}</p>;
    }

    render(
      <I18nProvider language="en">
        <Sonda />
      </I18nProvider>,
    );
    expect(screen.getByText("Settings")).toBeVisible();
  });
});
