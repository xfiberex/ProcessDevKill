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
