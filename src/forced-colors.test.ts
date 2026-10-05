import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Las reglas de `forced-colors` de `index.css` y el marcado al que se agarran (T14-22, T14-23).
 *
 * Esas reglas no se ven en ninguna prueba de componente: jsdom no pinta, y menos con un tema de
 * contraste. Lo que las rompería en silencio es que el gancho desaparezca —regenerar `switch.tsx`
 * con `shadcn add`, renombrar un `data-slot`—: la regla seguiría en la hoja, sin nada que
 * seleccionar, y el interruptor volvería a salir vacío. Esto lee los dos lados y los compara, igual
 * que `types.test.ts` con Rust. Que **se vea** bien lo mide `tools/auditoria-ui.mjs --fases
 * contraste`, sobre los píxeles.
 */

const SRC = path.resolve(__dirname);
const css = readFileSync(path.join(SRC, "index.css"), "utf8");

/** El contenido del bloque `@media (forced-colors: active) { … }`, hasta su llave de cierre. */
function bloqueDeContraste(): string {
  const inicio = css.indexOf("@media (forced-colors: active)");
  expect(inicio, "index.css ya no tiene el bloque de forced-colors").toBeGreaterThan(-1);
  let hondo = 0;
  for (let i = css.indexOf("{", inicio); i < css.length; i++) {
    if (css[i] === "{") hondo++;
    if (css[i] === "}" && --hondo === 0) return css.slice(inicio, i + 1);
  }
  throw new Error("el bloque de forced-colors no se cierra");
}

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(ruta);
    return /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name) ? [ruta] : [];
  });
}

const marcado = fuentes(SRC)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("las reglas de forced-colors", () => {
  const bloque = bloqueDeContraste();

  it("cada data-slot que nombran existe en algún componente", () => {
    const slots = [...new Set([...bloque.matchAll(/\[data-slot="([^"]+)"\]/g)].map((m) => m[1]))];

    // Si esta lista se queda corta es que el bloque ha perdido reglas: son las de la auditoría.
    expect(slots).toEqual(
      expect.arrayContaining([
        "switch",
        "switch-thumb",
        "checkbox",
        "barra",
        "barra-relleno",
        "barra-fondo",
        "barra-activa",
        "estado",
      ]),
    );
    for (const slot of slots) {
      expect(marcado, `ningún componente lleva data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  it("los estados que distinguen siguen saliendo del marcado", () => {
    // El punto de un servicio: la regla mira `data-estado`, y el componente lo tiene que poner.
    for (const estado of [...bloque.matchAll(/\[data-estado="([^"]+)"\]/g)].map((m) => m[1])) {
      expect(["running", "stopped", "pending"]).toContain(estado);
    }
    expect(marcado).toContain("data-estado={estado}");
    // La fila marcada, la vista activa, el filtro activo y la opción elegida.
    expect(bloque).toContain("tr[data-selected]");
    expect(marcado).toMatch(/data-selected=\{/);
    expect(bloque).toContain('[aria-current="page"]');
    expect(bloque).toContain('[aria-pressed="true"]');
    expect(bloque).toContain('[role="radio"][aria-checked="true"]');
  });

  /** En toda la app el foco es una sombra, y con forced-colors las sombras no se pintan. */
  it("devuelven un contorno al foco", () => {
    expect(bloque).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid Highlight/);
  });

  /**
   * Un color que no sea del sistema no llega a pintarse en este modo: el navegador lo cambia. Una
   * regla con un hexadecimal o un `var(--…)` parecería hecha y no haría nada.
   */
  it("solo usan colores del sistema", () => {
    const DEL_SISTEMA = ["Highlight", "HighlightText", "Canvas", "CanvasText", "ButtonText", "GrayText"];
    const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, "");
    const colores = [...sinComentarios.matchAll(/(?:color|outline|border):\s*([^;]+);/g)].map((m) =>
      m[1].replace(/!important/, "").trim().split(/\s+/).pop()!,
    );

    expect(colores.length).toBeGreaterThan(10);
    for (const color of colores) {
      expect(DEL_SISTEMA, `«${color}» no es un color del sistema`).toContain(color);
    }
  });
});
