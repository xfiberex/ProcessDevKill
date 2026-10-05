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
  (c) => c.cabecera.nukeFiltradosLabel(3),
  (c) => c.seleccion.recuento(3),
  (c) => c.seleccion.cerrarLabel(3),
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
   * coinciden con razón: «PID», «CPU», «Nuke All», «Auto-Kill», «Node.js».
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
      "runtimes.java": "nombre de producto",
      "runtimes.deno": "nombre de producto",
      "runtimes.bun": "nombre de producto",
      "ajustes.zombie.titulo": "nombre de la funcion, como Auto-Kill",
      "origenes.auto": "nombre de la funcion",
      // Siglas y palabras que ya eran inglesas en la version española.
      "columnas.pid": "sigla",
      "columnas.cpu": "sigla",
      "columnas.memoryMb": "sigla",
      "historial.pid": "sigla",
      "servicios.columnas.ram": "sigla",
      // Nombres de producto, igual que los runtimes: traducirlos seria inventarselos.
      "servicios.familias.sqlServer": "nombre de producto",
      "servicios.familias.postgres": "nombre de producto",
      "servicios.familias.mySql": "nombre de producto",
      "servicios.familias.mongoDb": "nombre de producto",
      "servicios.familias.redis": "nombre de producto",
      "servicios.familias.docker": "nombre de producto",
      "servicios.familias.iis": "nombre de producto",
      // «Manual» se escribe igual en los dos idiomas, y es la palabra que usa el propio Windows.
      "servicios.arranques.manual": "misma palabra en los dos idiomas",
      "ajustes.grupos.general": "misma palabra en los dos idiomas",
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

/**
 * T12-35: el inglés, en una sola variante y con su propia puntuación.
 *
 * El catálogo se tradujo frase a frase desde el español y arrastraba tres cosas: palabras
 * británicas junto a americanas («licence» al lado de «canceled»), la raya española —pegada al
 * inciso y con coma detrás—, y comillas rectas junto a tipográficas. Las reglas están escritas
 * encima de `en`, en `i18n.tsx`; esto es lo que las hace cumplir en lo que se añada después.
 */
describe("el inglés del catálogo", () => {
  const frasesEnIngles = () => [
    ...pares(es, en).map((p) => ({ donde: p.ruta, texto: p.en })),
    ...FRASES.map((f) => ({ donde: "frase compuesta", texto: f(en) })),
  ];

  it("usa la ortografía americana", () => {
    const britanicas = /\b(licences?|cancell(ed|ing)|colour|behaviour|favour)\b/i;

    for (const { donde, texto } of frasesEnIngles()) {
      expect(britanicas.test(texto), `${donde}: «${texto}»`).toBe(false);
    }
  });

  it("escribe los incisos con la raya entre espacios, no a la española", () => {
    for (const { donde, texto } of frasesEnIngles()) {
      expect(/\S—|—\S/.test(texto), `${donde}: «${texto}»`).toBe(false);
    }
  });

  it("cita con comillas tipográficas, nunca rectas", () => {
    const conComillas = [
      ...frasesEnIngles(),
      { donde: "arranque.mensaje", texto: en.servicios.arranque.mensaje("MySQL80", "Manual", "Disabled") },
      { donde: "arranque.hecho", texto: en.servicios.arranque.hecho("MySQL80", "Disabled") },
      { donde: "arranque.registroFila", texto: en.servicios.arranque.registroFila("Manual", "Disabled") },
      { donde: "tabla.proteger", texto: en.tabla.proteger("vite") },
    ];

    for (const { donde, texto } of conComillas) {
      expect(texto.includes('"'), `${donde}: «${texto}»`).toBe(false);
    }
    expect(en.servicios.arranque.mensaje("MySQL80", "Manual", "Disabled")).toBe(
      "MySQL80 will go from “Manual” to “Disabled”.",
    );
  });

  /** Las frases que señaló la re-auditoría, tal como quedan. */
  it("dice cada frase como la diría quien la lee", () => {
    // «closes» como sustantivo contable no se dice.
    expect(en.historial.recuento(1)).toBe("1 closed process");
    expect(en.historial.recuento(4)).toBe("4 closed processes");
    // «neither … nor» es para dos; aquí hay cinco.
    expect(en.tabla.protegidoTitulo).not.toMatch(/neither|nor/);
    expect(en.tabla.protegidoTitulo).toContain("the shortcut, and Auto-Kill");
    // «on their own» al final se leía como que los procesos se pasaban solos del límite.
    expect(en.ajustes.autoKill.interruptor).toBe(
      "Automatically close processes that go over the RAM limit",
    );
    expect(en.servicios.arranque.rechazado("MySQL80")).toBe(
      "Windows did not allow the startup type of MySQL80 to be changed.",
    );
    expect(en.ajustes.acercaDe.licencia).toBe("License");
    expect(en.ajustes.acercaDe.descripcion("")).toContain("licenses");
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

/**
 * T12-34. La clase de fallo que el proyecto ya arregló tres veces: una frase que concuerda con un
 * elemento y se rompe con dos. Se prueba con uno y con varios, en los dos idiomas.
 */
describe("las frases con una lista de nombres", () => {
  it("concuerdan con uno y con varios servicios que bloquean la parada", () => {
    expect(es.servicios.acciones.bloqueado("MSSQL", ["SQLAgent"])).toBe(
      "No se pudo detener MSSQL: sigue corriendo SQLAgent.",
    );
    expect(es.servicios.acciones.bloqueado("MSSQL", ["SQLAgent", "SSIS"])).toBe(
      "No se pudo detener MSSQL: siguen corriendo SQLAgent y SSIS.",
    );
    expect(en.servicios.acciones.bloqueado("MSSQL", ["SQLAgent"])).toBe(
      "MSSQL could not be stopped: SQLAgent is still running.",
    );
    expect(en.servicios.acciones.bloqueado("MSSQL", ["SQLAgent", "SSIS"])).toBe(
      "MSSQL could not be stopped: SQLAgent and SSIS are still running.",
    );
  });

  /** La combinación se elige en Ajustes: el origen del Historial no puede nombrar una fija. */
  it("rotulan el origen del atajo sin nombrar una combinación", () => {
    expect(es.origenes.hotkey).toBe("Atajo");
    expect(en.origenes.hotkey).toBe("Shortcut");
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

  /** T12-38: sin esto, un lector de pantalla lee la interfaz inglesa con voz española. */
  it("pone el idioma del documento y lo cambia con el de la app", () => {
    const { rerender } = render(
      <I18nProvider language="en">
        <p>x</p>
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe("en");

    rerender(
      <I18nProvider language="es">
        <p>x</p>
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe("es");
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
