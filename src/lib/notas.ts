import type { Rico } from "../i18n";
import type { Language } from "../types";

/**
 * Un trozo de las notas de un release, listo para pintar. El texto es un [`Rico`]: conserva
 * `**negrita**` y `` `código` ``, que es lo que `Marcado` sabe pintar, y nada más.
 */
export type BloqueNota =
  | { tipo: "titulo"; texto: Rico }
  | { tipo: "parrafo"; texto: Rico }
  | { tipo: "lista"; items: Rico[] };

/**
 * El título con el que `release.ps1` empieza lo que añade a las notas: la tabla de descarga y el
 * aviso de SmartScreen. Quien las lee dentro de la app ya la tiene instalada y va a actualizar con
 * un botón, así que de ahí en adelante no se enseña nada.
 */
const COLA = "descarga";

/**
 * El título bajo el que `release.ps1` pone las notas en inglés, sacadas de `CHANGELOG.en.md`
 * (T13-04). Lo de antes es el español; lo de después, hasta `COLA`, el inglés. Igual que `COLA`:
 * no se cambia aquí sin cambiarlo allí, y `notas.test.ts` lo vigila.
 */
const INGLES = "english";

/**
 * Deja una línea en lo que `Marcado` entiende: fuera etiquetas HTML (`<kbd>`), enlaces reducidos a
 * su texto y cursivas sin asteriscos. La negrita y el código se quedan.
 */
function limpiar(texto: string): Rico {
  return (
    texto
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      // `release.ps1` escribe el código con dos acentos graves; `Marcado` espera uno.
      .replace(/``+/g, "`")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Convierte el Markdown de un release de GitHub en bloques (T12-36).
 *
 * No es un intérprete de Markdown, y no hace falta que lo sea: las notas salen del CHANGELOG por
 * `release.ps1`, así que solo llevan títulos, párrafos y listas. Lo demás —tablas, bloques de
 * código, líneas de separación— se salta, y una línea que no encaja en nada sale como párrafo:
 * peor que bien pintada, pero nunca perdida.
 *
 * Las líneas partidas a 100 columnas se vuelven a unir. Sin eso, cada frase del CHANGELOG saldría
 * cortada donde la cortó el editor.
 *
 * Lo que se devuelve se pinta como texto de React, nunca como HTML: las notas vienen de internet.
 *
 * **Las notas traen los dos idiomas** desde la v1.10.0, el inglés bajo el título `INGLES`, y se
 * devuelve la mitad de `idioma`. Los releases anteriores solo traen español, y uno cortado con
 * `-NotesFile` puede no traer inglés: entonces se enseña el español, que es mejor que no enseñar
 * nada de lo que trae la versión.
 */
export function leerNotas(markdown: string, idioma: Language = "es"): BloqueNota[] {
  const espanol: BloqueNota[] = [];
  const ingles: BloqueNota[] = [];
  let bloques = espanol;
  // El bloque al que se pega una línea de continuación; `null` tras una línea en blanco.
  let abierto: "parrafo" | "item" | null = null;
  let enCodigo = false;

  const continuar = (resto: string) => {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo.tipo === "lista") {
      ultimo.items[ultimo.items.length - 1] += ` ${resto}`;
    } else {
      ultimo.texto += ` ${resto}`;
    }
  };

  for (const cruda of markdown.split(/\r?\n/)) {
    const linea = cruda.trim();

    if (linea.startsWith("```")) {
      enCodigo = !enCodigo;
      abierto = null;
      continue;
    }
    if (enCodigo) continue;

    if (linea === "" || /^(-{3,}|\*{3,}|_{3,})$/.test(linea) || linea.startsWith("|")) {
      abierto = null;
      continue;
    }

    const titulo = /^#{1,6}\s+(.*)$/.exec(linea);
    if (titulo) {
      const texto = limpiar(titulo[1]);
      if (texto.toLowerCase() === COLA) break;
      if (texto.toLowerCase() === INGLES) {
        bloques = ingles;
        abierto = null;
        continue;
      }
      if (texto) bloques.push({ tipo: "titulo", texto });
      abierto = null;
      continue;
    }

    const item = /^[-*+]\s+(.*)$/.exec(linea);
    if (item) {
      const ultimo = bloques[bloques.length - 1];
      if (ultimo?.tipo === "lista") ultimo.items.push(item[1]);
      else bloques.push({ tipo: "lista", items: [item[1]] });
      abierto = "item";
      continue;
    }

    const texto = linea.replace(/^>\s?/, "");
    if (abierto) {
      continuar(texto);
    } else {
      bloques.push({ tipo: "parrafo", texto });
      abierto = "parrafo";
    }
  }

  // Se limpia al final y no línea a línea: una negrita o un enlace pueden empezar en una línea y
  // acabar en la siguiente.
  const limpios = (mitad: BloqueNota[]) =>
    mitad
      .map((b): BloqueNota =>
        b.tipo === "lista"
          ? { tipo: "lista", items: b.items.map(limpiar).filter(Boolean) }
          : { ...b, texto: limpiar(b.texto) },
      )
      .filter((b) => (b.tipo === "lista" ? b.items.length > 0 : b.texto !== ""));

  // Se elige después de limpiar: una mitad inglesa que solo tuviera una tabla quedaría en nada.
  const enIngles = idioma === "en" ? limpios(ingles) : [];
  return enIngles.length > 0 ? enIngles : limpios(espanol);
}
