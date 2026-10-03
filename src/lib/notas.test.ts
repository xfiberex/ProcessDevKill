import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { leerNotas, type BloqueNota } from "./notas";

/** Todo el texto que acabaría en la ventana, de corrido. */
function textoDe(bloques: BloqueNota[]): string {
  return bloques
    .flatMap((b) => (b.tipo === "lista" ? b.items : [b.texto]))
    .join("\n");
}

describe("las notas de un release, leídas para la ventana", () => {
  it("separa títulos, párrafos y listas", () => {
    expect(
      leerNotas("Arreglos.\n\n### Cambiado\n- Uno.\n- Dos.\n\n### Seguridad\n- Tres."),
    ).toEqual([
      { tipo: "parrafo", texto: "Arreglos." },
      { tipo: "titulo", texto: "Cambiado" },
      { tipo: "lista", items: ["Uno.", "Dos."] },
      { tipo: "titulo", texto: "Seguridad" },
      { tipo: "lista", items: ["Tres."] },
    ]);
  });

  /** El CHANGELOG va partido a 100 columnas; sin unir, cada frase saldría cortada. */
  it("une las líneas partidas de un párrafo y de un elemento de lista", () => {
    expect(
      leerNotas("Una frase que\nsigue aquí.\n\n- Un elemento que\n  sigue también.\n- Otro."),
    ).toEqual([
      { tipo: "parrafo", texto: "Una frase que sigue aquí." },
      { tipo: "lista", items: ["Un elemento que sigue también.", "Otro."] },
    ]);
  });

  it("conserva la negrita y el código, que es lo que `Marcado` sabe pintar", () => {
    expect(leerNotas("- **Importa**: `svchost` y ``csrss``.")).toEqual([
      { tipo: "lista", items: ["**Importa**: `svchost` y `csrss`."] },
    ]);
  });

  it("quita las etiquetas HTML, los enlaces y las cursivas, y deja su texto", () => {
    expect(
      leerNotas(
        "<kbd>Ctrl</kbd>+<kbd>F</kbd> busca. Ver el [CHANGELOG](https://example.com/x) y *esto*.",
      ),
    ).toEqual([{ tipo: "parrafo", texto: "Ctrl+F busca. Ver el CHANGELOG y esto." }]);
  });

  /** Una negrita puede empezar en una línea y acabar en la siguiente. */
  it("limpia después de unir, no línea a línea", () => {
    expect(leerNotas("- Ver el [registro de\n  cambios](https://example.com).")).toEqual([
      { tipo: "lista", items: ["Ver el registro de cambios."] },
    ]);
  });

  it("se salta las tablas, los bloques de código y las líneas de separación", () => {
    expect(
      leerNotas("Antes.\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```powershell\nGet-X\n```\n\nDespués."),
    ).toEqual([
      { tipo: "parrafo", texto: "Antes." },
      { tipo: "parrafo", texto: "Después." },
    ]);
  });

  /** Quien las lee en la app ya la tiene instalada: la tabla de descarga no le dice nada. */
  it("corta en el título «Descarga», que es lo que añade release.ps1", () => {
    expect(
      leerNotas("- Uno.\n\n---\n\n### Descarga\n\nLos `.sha256`…\n\n### Aviso de SmartScreen\n\nNo."),
    ).toEqual([{ tipo: "lista", items: ["Uno."] }]);
  });

  it("unas notas vacías o solo con separadores no dan nada", () => {
    expect(leerNotas("")).toEqual([]);
    expect(leerNotas("\n---\n\n")).toEqual([]);
  });

  /**
   * El criterio de aceptación de T12-36, con las notas tal como están publicadas en GitHub
   * (`gh release view v1.8.0 --json body`).
   */
  describe("con las notas reales de la v1.8.0", () => {
    const bloques = leerNotas(
      readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test/notas-v1.8.0.md"),
        "utf8",
      ),
    );
    const texto = textoDe(bloques);

    it("no queda ni una marca de Markdown ni de HTML a la vista", () => {
      // La negrita y el código se quedan en el texto a propósito: los pinta `Marcado`.
      const sinMarcado = texto.replace(/\*\*[^*]+\*\*/g, "").replace(/`[^`]+`/g, "");
      expect(sinMarcado).not.toMatch(/[<>#|*`]|\]\(|^-{3,}$/m);
    });

    it("lo que cuenta la versión sigue ahí", () => {
      expect(texto).toContain("**Ctrl+F lleva al buscador** desde cualquier vista.");
      expect(bloques).toContainEqual({ tipo: "titulo", texto: "🔎 Buscar sin rodeos" });
    });

    it("y la tabla de descarga y el aviso de SmartScreen, no", () => {
      expect(texto).not.toMatch(/setup\.exe|SmartScreen|Get-FileHash/);
    });
  });

  /**
   * El corte en «Descarga» depende de un título que escribe otro archivo, en otro lenguaje. Si
   * alguien lo cambia en `release.ps1`, la tabla de descarga volvería a salir en Ajustes sin que
   * nada más lo notara. Igual que `types.test.ts` con los tipos de Rust.
   */
  it("release.ps1 sigue empezando su cola por el título «Descarga»", () => {
    const script = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../release.ps1"),
      "utf8",
    );
    const cola = /\$cola = @\(([\s\S]*?)\) -join/.exec(script)?.[1] ?? "";
    const titulos = [...cola.matchAll(/"(#{1,6} [^"]+)"/g)].map((m) => m[1]);

    expect(titulos[0]).toBe("### Descarga");
    expect(leerNotas(`- Uno.\n\n${titulos[0]}\n\nResto.`)).toEqual([
      { tipo: "lista", items: ["Uno."] },
    ]);
  });
});

/**
 * T13-04. Desde la v1.10.0 el cuerpo de un release trae las notas en español, luego las mismas en
 * inglés bajo el título «English», y al final la cola de «Descarga».
 */
describe("las notas en los dos idiomas", () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const DOBLES =
    "Resumen.\n\n### Añadido\n- Uno.\n\n## English\n\nSummary.\n\n### Added\n- One.\n\n---\n\n### Descarga\n\nTabla.";

  it("en español enseña la mitad española, sin el inglés ni la descarga", () => {
    expect(leerNotas(DOBLES, "es")).toEqual([
      { tipo: "parrafo", texto: "Resumen." },
      { tipo: "titulo", texto: "Añadido" },
      { tipo: "lista", items: ["Uno."] },
    ]);
    // Sin decir idioma, español: es lo que enseñaba la app antes de que hubiera dos.
    expect(leerNotas(DOBLES)).toEqual(leerNotas(DOBLES, "es"));
  });

  it("en inglés enseña la mitad inglesa, sin el español, el título «English» ni la descarga", () => {
    expect(leerNotas(DOBLES, "en")).toEqual([
      { tipo: "parrafo", texto: "Summary." },
      { tipo: "titulo", texto: "Added" },
      { tipo: "lista", items: ["One."] },
    ]);
  });

  /**
   * El criterio negativo: todos los releases hasta la v1.9.1 solo traen español, y uno cortado con
   * `-NotesFile` puede no traer inglés. La app en inglés enseña el español, no una caja vacía.
   */
  it("sin mitad inglesa, la app en inglés cae al español y no a nada", () => {
    const soloEspanol = "Resumen.\n\n- Uno.\n\n### Descarga\n\nTabla.";
    expect(leerNotas(soloEspanol, "en")).toEqual(leerNotas(soloEspanol, "es"));
    expect(leerNotas(soloEspanol, "en")).not.toEqual([]);

    // El título está pero debajo no hay nada que pintar: tampoco vale una caja vacía.
    const inglesVacio = "- Uno.\n\n## English\n\n| a |\n|---|\n\n### Descarga\n\nTabla.";
    expect(leerNotas(inglesVacio, "en")).toEqual([{ tipo: "lista", items: ["Uno."] }]);
  });

  it("las notas reales de la v1.8.0, que no tienen inglés, salen igual en los dos idiomas", () => {
    const v180 = readFileSync(path.join(raiz, "src/test/notas-v1.8.0.md"), "utf8");
    expect(leerNotas(v180, "en")).toEqual(leerNotas(v180, "es"));
  });

  /** La misma atadura que con «Descarga»: el título lo escribe otro archivo, en otro lenguaje. */
  it("release.ps1 pone el inglés bajo el título que la app busca, entre el español y la cola", () => {
    const script = readFileSync(path.join(raiz, "release.ps1"), "utf8");
    const titulo = /\$tituloIngles = "(#{1,6} [^"]+)"/.exec(script)?.[1];

    expect(titulo).toBe("## English");
    expect(script).toContain('"$seccion`n`n$tituloIngles`n`n$seccionEn`n`n$cola`n"');
    expect(leerNotas(`- Uno.\n\n${titulo}\n\n- One.`, "en")).toEqual([
      { tipo: "lista", items: ["One."] },
    ]);
  });

  /**
   * `CHANGELOG.en.md` se traduce al escribir el cambio, no al cortar: `release.ps1` aborta si la
   * versión no tiene su sección inglesa, pero que la tenga **a medias** solo se vería en el
   * release publicado. Se comparan los títulos y cuántos cambios hay bajo cada uno.
   */
  it("cada sección de CHANGELOG.en.md tiene la misma forma que la de CHANGELOG.md", () => {
    const TITULOS: Record<string, string> = {
      Added: "Añadido",
      Changed: "Cambiado",
      Fixed: "Corregido",
      Removed: "Eliminado",
      Security: "Seguridad",
      Documentation: "Documentación",
      Internal: "Interno",
    };
    /** Por versión, la lista de `título: nº de cambios`. */
    const forma = (archivo: string, traducir: boolean) => {
      const secciones = new Map<string, string[]>();
      let actual: string[] | null = null;
      for (const linea of readFileSync(path.join(raiz, archivo), "utf8").split(/\r?\n/)) {
        const version = /^## \[([^\]]+)\]/.exec(linea)?.[1];
        const titulo = /^### (.+)$/.exec(linea)?.[1];
        if (version) {
          const clave = version === "Unreleased" ? "Sin publicar" : version;
          secciones.set(clave, (actual = []));
        } else if (titulo && actual) {
          actual.push(`${traducir ? (TITULOS[titulo] ?? `¿${titulo}?`) : titulo}: 0`);
        } else if (/^- /.test(linea) && actual?.length) {
          const [nombre, n] = actual[actual.length - 1].split(": ");
          actual[actual.length - 1] = `${nombre}: ${Number(n) + 1}`;
        }
      }
      return secciones;
    };

    const es = forma("CHANGELOG.md", false);
    const en = forma("CHANGELOG.en.md", true);

    expect(en.size, "CHANGELOG.en.md no tiene ninguna sección").toBeGreaterThan(0);
    for (const [version, titulos] of en) {
      expect(es.get(version), `la versión ${version} no está en CHANGELOG.md`).toEqual(titulos);
    }
    // Lo que está sin publicar se traduce a la vez que se escribe.
    expect(en.get("Sin publicar")).toEqual(es.get("Sin publicar"));
  });
});
