#!/usr/bin/env node
/**
 * Genera `THIRD-PARTY-NOTICES.txt`: qué componentes de terceros viajan en el instalador, con la
 * licencia y el aviso de copyright que publica cada uno (T12-30).
 *
 *     node tools/avisos-de-terceros.mjs               # reescribe el archivo
 *     node tools/avisos-de-terceros.mjs --comprobar   # sale con 1 si el archivo se quedó viejo
 *
 * ## Por qué existe
 *
 * Hasta la v1.9.0 el archivo se escribía a mano a partir del campo `license` de cada paquete, y
 * lo decía: «los avisos de copyright individuales no se han transcrito». MIT, BSD, ISC y
 * Unicode-3.0 piden justo eso —conservar el aviso y el texto— en una distribución binaria. Y un
 * archivo a mano se queda viejo: ya declaró una versión de shadcn que nunca estuvo instalada y le
 * faltaron cuatro crates que sí iban en el binario.
 *
 * ## De dónde sale cada cosa
 *
 * - **npm:** lo que `package-lock.json` no marca como de desarrollo, más las herramientas de
 *   `CSS_DISTRIBUIDO`, cuyo CSS acaba dentro de la app aunque ellas no viajen.
 * - **Rust:** `cargo metadata --filter-platform x86_64-pc-windows-msvc`, siguiendo solo las
 *   dependencias normales desde el crate de la app. Son los crates que se enlazan en el binario
 *   de Windows: 326 de los 566 del lockfile, que arrastra también los de Linux, macOS y los de
 *   compilar. Los de las macros de procedimiento entran: de más no hace daño, de menos sí.
 * - **Los textos:** los archivos `LICENSE*`, `COPYING*`, `NOTICE*` y parecidos de la carpeta de
 *   cada paquete, tal cual. Ahí va el aviso de copyright de cada uno. Los textos idénticos se
 *   escriben una vez, con la lista de quién los usa.
 *
 * ## Por qué `--comprobar` (T12-25)
 *
 * `release.ps1` avisaba si `package.json` o `Cargo.lock` eran más recientes que este archivo. El
 * propio corte escribe la versión en los dos, así que el aviso saltaba **siempre**, y un aviso
 * que siempre salta enseña a no leerlo. Aquí se compara el contenido: se genera de nuevo y, si
 * no coincide con lo que hay, falla. La salida no lleva fecha ni rutas, así que con las mismas
 * dependencias sale lo mismo en cualquier equipo; subir la versión de la app no la cambia.
 *
 * ## Lo que NO hace
 *
 * No decide nada legal. Admite las licencias de `ADMITIDAS`, que son las que el proyecto ya había
 * mirado contra la GPLv3, y **se para ante cualquier otra** para que la mire una persona. Y dice
 * en el propio archivo lo que no cubre: ver `ALCANCE` más abajo.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "THIRD-PARTY-NOTICES.txt");
const SKILLS = path.join(RAIZ, "tools", "avisos-de-terceros.skills.txt");

/** El binario que se publica. Con otro objetivo, la lista de crates sería otra. */
const OBJETIVO = "x86_64-pc-windows-msvc";

/**
 * Herramientas de compilación cuyo CSS **sí** se distribuye dentro de la app, aunque ellas estén
 * en `devDependencies`: Tailwind pone su hoja base, y `src/index.css` importa
 * `shadcn/tailwind.css`.
 */
const CSS_DISTRIBUIDO = ["tailwindcss", "shadcn"];

/**
 * Las licencias que el proyecto ya había revisado como compatibles con distribuirse dentro de un
 * programa GPLv3. Una que no esté aquí para la generación: no se añade sin mirarla.
 */
const ADMITIDAS = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Zlib",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "BSL-1.0",
  "Unicode-3.0",
  "MPL-2.0",
  "OFL-1.1",
  "CDLA-Permissive-2.0",
]);

/** Los archivos de un paquete que llevan su licencia o su aviso. `.spdx` es metadato, no texto. */
const ES_AVISO = /^(licen[cs]e|copying|copyright|notice|unlicense)/i;
const NO_ES_TEXTO = /\.(spdx|json|ya?ml|toml)$/i;

const ANCHO = 79;
const RAYA = "-".repeat(ANCHO);

// ── Licencias ───────────────────────────────────────────────────────────────

/**
 * Si una expresión SPDX se puede cumplir solo con licencias admitidas.
 *
 * Con `OR` basta una alternativa; con `AND` hacen falta todas. Admite la forma antigua de Cargo,
 * `MIT/Apache-2.0`, que significa `OR`.
 */
export function licenciaAdmitida(expresion, admitidas = ADMITIDAS) {
  const piezas = String(expresion ?? "")
    .replaceAll("/", " OR ")
    .replaceAll("(", " ( ")
    .replaceAll(")", " ) ")
    .split(/\s+/)
    .filter(Boolean);
  if (piezas.length === 0) return false;
  let i = 0;

  const atomo = () => {
    if (piezas[i] === "(") {
      i++;
      const dentro = alternativa();
      if (piezas[i] !== ")") throw new Error("paréntesis sin cerrar");
      i++;
      return dentro;
    }
    let id = piezas[i++];
    if (id === undefined || ["AND", "OR", "WITH", ")"].includes(id)) throw new Error("falta una licencia");
    if (piezas[i] === "WITH") {
      id = `${id} WITH ${piezas[i + 1]}`;
      i += 2;
    }
    return admitidas.has(id);
  };
  const conjunto = () => {
    let vale = atomo();
    while (piezas[i] === "AND") {
      i++;
      // El orden importa: `atomo()` tiene que consumir sus piezas aunque `vale` ya sea falso.
      vale = atomo() && vale;
    }
    return vale;
  };
  function alternativa() {
    let vale = conjunto();
    while (piezas[i] === "OR") {
      i++;
      vale = conjunto() || vale;
    }
    return vale;
  }

  try {
    const vale = alternativa();
    return i === piezas.length && vale;
  } catch {
    return false;
  }
}

/** Un texto de licencia, sin lo que cambia de un equipo a otro y no dice nada. */
export function normalizar(texto) {
  // La marca de orden de bytes, por su número: escrita tal cual es un carácter invisible.
  return (texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linea) => linea.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/** Orden por código, no por idioma: `localeCompare` cambia con la versión de ICU del equipo. */
const porTexto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const porNombre = (a, b) =>
  porTexto(a.nombre.toLowerCase(), b.nombre.toLowerCase()) || porTexto(a.version, b.version);

// ── Lectura ─────────────────────────────────────────────────────────────────

function leerJson(ruta) {
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

/** Los avisos que publica un paquete en su carpeta: `[{ archivo, texto }]`. */
function avisosDe(carpeta, ademas = []) {
  const nombres = fs.existsSync(carpeta)
    ? fs.readdirSync(carpeta).filter((f) => ES_AVISO.test(f) && !NO_ES_TEXTO.test(f))
    : [];
  for (const extra of ademas) {
    if (extra && !nombres.includes(extra) && fs.existsSync(path.join(carpeta, extra))) nombres.push(extra);
  }
  return nombres
    .filter((f) => fs.statSync(path.join(carpeta, f)).isFile())
    .sort(porTexto)
    .map((archivo) => ({ archivo, texto: normalizar(fs.readFileSync(path.join(carpeta, archivo), "utf8")) }))
    .filter((a) => a.texto.length > 0);
}

function autorDe(pj) {
  const a = pj.author;
  if (!a) return "";
  return typeof a === "string" ? a.replace(/\s*[<(].*$/, "") : (a.name ?? "");
}

function componentesNpm() {
  const lock = leerJson(path.join(RAIZ, "package-lock.json"));
  const elegidos = Object.entries(lock.packages).filter(([ruta, p]) => {
    if (!ruta) return false; // la entrada vacía es la propia app
    const nombre = ruta.replace(/^.*node_modules\//, "");
    return (!p.dev && !p.devOptional) || CSS_DISTRIBUIDO.includes(nombre);
  });

  return elegidos
    .map(([ruta, p]) => {
      const carpeta = path.join(RAIZ, ruta);
      const manifiesto = path.join(carpeta, "package.json");
      if (!fs.existsSync(manifiesto)) {
        throw new Error(`${ruta} está en package-lock.json y no en node_modules: falta un «npm ci».`);
      }
      const pj = leerJson(manifiesto);
      const nombre = ruta.replace(/^.*node_modules\//, "");
      return {
        nombre,
        version: p.version,
        licencia: pj.license ?? p.license ?? "",
        autores: autorDe(pj),
        origen: `https://www.npmjs.com/package/${nombre}`,
        avisos: avisosDe(carpeta),
        soloCss: Boolean(p.dev) && CSS_DISTRIBUIDO.includes(nombre),
      };
    })
    .sort(porNombre);
}

function componentesRust() {
  const r = spawnSync(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--filter-platform", OBJETIVO],
    { cwd: path.join(RAIZ, "src-tauri"), encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`cargo metadata falló:\n${r.stderr || r.error}`);
  const meta = JSON.parse(r.stdout);

  const paquetes = new Map(meta.packages.map((p) => [p.id, p]));
  const nodos = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const raiz = meta.resolve.root;
  // `kind: null` es una dependencia normal. Las de compilar (`build`) y las de pruebas (`dev`)
  // no se enlazan en el binario.
  const normales = (id) =>
    nodos.get(id).deps.filter((d) => d.dep_kinds.some((k) => k.kind === null)).map((d) => d.pkg);

  const vistos = new Set();
  const pendientes = [raiz];
  while (pendientes.length > 0) {
    const id = pendientes.pop();
    if (vistos.has(id)) continue;
    vistos.add(id);
    pendientes.push(...normales(id));
  }
  vistos.delete(raiz);
  const directas = new Set(normales(raiz));

  return [...vistos]
    .map((id) => {
      const p = paquetes.get(id);
      const carpeta = path.dirname(p.manifest_path);
      return {
        nombre: p.name,
        version: p.version,
        licencia: p.license ?? "",
        autores: (p.authors ?? []).map((a) => a.replace(/\s*<.*$/, "")).join(", "),
        origen: p.repository ?? `https://crates.io/crates/${p.name}`,
        avisos: avisosDe(carpeta, [p.license_file]),
        directa: directas.has(id),
      };
    })
    .sort(porNombre);
}

// ── Escritura ───────────────────────────────────────────────────────────────

/** Parte un párrafo en líneas de `ANCHO` como mucho, con sangría. */
function parrafo(texto, sangria = "") {
  const lineas = [];
  let actual = sangria;
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (actual.length > sangria.length && actual.length + 1 + palabra.length > ANCHO) {
      lineas.push(actual);
      actual = sangria + palabra;
    } else {
      actual += (actual.length > sangria.length ? " " : "") + palabra;
    }
  }
  if (actual.trim()) lineas.push(actual);
  return lineas.join("\n");
}

function titulo(numero, texto) {
  return `\n\n${RAYA}\n${numero}. ${texto}\n${RAYA}\n`;
}

/** Una tabla de nombre, versión y licencia, con las columnas alineadas. */
function tabla(componentes, marca = () => "") {
  const filas = componentes.map((c) => [marca(c) + c.nombre, c.version, c.licencia || "(sin declarar)"]);
  const ancho = [0, 1].map((i) => Math.max(...filas.map((f) => f[i].length)));
  return filas.map((f) => `    ${f[0].padEnd(ancho[0])}  ${f[1].padEnd(ancho[1])}  ${f[2]}`).join("\n");
}

/** Cuántos componentes hay de cada licencia, de más a menos. */
function reparto(componentes) {
  const cuenta = new Map();
  for (const c of componentes) {
    // `MIT/Apache-2.0` y `Apache-2.0 OR MIT` son la misma oferta escrita de dos maneras.
    const clave = (c.licencia || "(sin declarar)")
      .replaceAll("/", " OR ")
      .replace(/\s+/g, " ")
      .trim();
    const partes = /[()]| AND /.test(clave) ? [clave] : clave.split(" OR ").sort(porTexto);
    const normal = partes.join(" OR ");
    cuenta.set(normal, (cuenta.get(normal) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || porTexto(a[0], b[0]))
    .map(([licencia, n]) => `    ${String(n).padStart(4)}  ${licencia}`)
    .join("\n");
}

/** Agrupa los textos idénticos: cada uno se escribe una vez, con quién lo usa. */
function agrupar(componentes) {
  const grupos = new Map();
  for (const c of componentes) {
    for (const { archivo, texto } of c.avisos) {
      const clave = createHash("sha256").update(texto).digest("hex");
      if (!grupos.has(clave)) grupos.set(clave, { texto, usos: [] });
      grupos.get(clave).usos.push(`${c.nombre} ${c.version} (${archivo})`);
    }
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, usos: g.usos.sort(porTexto) }))
    .sort((a, b) => b.usos.length - a.usos.length || porTexto(a.usos[0], b.usos[0]));
}

export function componer({ npm, rust, skills }) {
  const todos = [...npm, ...rust];
  const sinAviso = todos.filter((c) => c.avisos.length === 0);
  const grupos = agrupar(todos);
  const mpl = rust.filter((c) => /MPL-2\.0/.test(c.licencia)).map((c) => c.nombre);
  const soloCss = npm.filter((c) => c.soloCss).map((c) => c.nombre);

  let s = `AVISOS DE TERCEROS — ProcessDevKill
===================================

ProcessDevKill se distribuye bajo la GNU General Public License v3.0 (ver LICENSE).

${parrafo(
  "Este archivo recoge los componentes de terceros que el instalador empaqueta y distribuye, con " +
    "su licencia y con el aviso de copyright que publica cada uno. No cubre las herramientas " +
    "que solo se usan para compilar (Vite, TypeScript, el compilador de Rust…), porque esas no " +
    "viajan dentro del binario.",
)}

${parrafo(
  "NO SE EDITA A MANO. Lo genera `node tools/avisos-de-terceros.mjs` a partir de " +
    "package-lock.json, de `cargo metadata` y de los archivos de licencia de cada paquete; la " +
    "sección 5 sale de tools/avisos-de-terceros.skills.txt. `release.ps1` y la CI lo vuelven a " +
    "generar y se paran si no coincide con lo que hay.",
)}

    ${npm.length} componentes de npm y ${rust.length} crates de Rust
    ${grupos.length} textos de licencia distintos, en la sección 6

ALCANCE HONESTO

${parrafo(
  "- Los textos de la sección 6 son los archivos de licencia que cada paquete publica, sin " +
    "tocar. Ahí está el aviso de copyright de cada uno. Los que son idénticos se escriben una " +
    "sola vez.",
  "  ",
).replace(/^ {2}/, "")}
${parrafo(
  sinAviso.length === 1
    ? "- 1 componente declara su licencia y no publica ningún archivo con ella. Está en la " +
        "sección 3, con lo que sí declara."
    : `- ${sinAviso.length} componentes declaran su licencia y no publican ningún archivo con ` +
        "ella. Están en la sección 3, con lo que sí declaran.",
  "  ",
).replace(/^ {2}/, "")}
${parrafo(
  "- Hay cosas que viajan en el instalador y no salen de ningún manifiesto. Están en la sección " +
    "4, dichas a mano.",
  "  ",
).replace(/^ {2}/, "")}
${parrafo(
  "- La lista de crates es la del binario de Windows (" + OBJETIVO + "). Incluye los de las " +
    "macros de procedimiento, que se usan al compilar: sobran, y se dejan porque de más no " +
    "hace daño.",
  "  ",
).replace(/^ {2}/, "")}
${parrafo(
  "- Esto no sustituye a una revisión legal, y no la ha tenido. El generador solo admite las " +
    "licencias que el proyecto ya había mirado contra la GPLv3 y se para ante cualquier otra; " +
    "que un paquete declare bien su licencia, o que incluya a su vez código de terceros sin " +
    "decirlo, no lo puede comprobar.",
  "  ",
).replace(/^ {2}/, "")}`;

  // 1 ─ npm
  s += titulo(1, "COMPONENTES DEL FRONTEND (npm)");
  s += `\n${tabla(npm.filter((c) => !c.soloCss))}\n`;
  if (soloCss.length > 0) {
    s += `\n${parrafo(
      "Herramientas de compilación cuyo CSS sí se distribuye dentro de la app, aunque ellas no " +
        "viajen en el instalador:",
      "    ",
    )}\n\n${tabla(npm.filter((c) => c.soloCss))}\n`;
  }
  const geist = npm.find((c) => c.nombre === "@fontsource-variable/geist");
  if (geist) {
    s += `\n${parrafo(
      "La tipografía Geist (@fontsource-variable/geist) va embebida en la app. Su licencia, la " +
        "SIL Open Font License 1.1, exige que el aviso y la licencia acompañen a la fuente en " +
        "cualquier distribución, y prohíbe venderla por separado: están en la sección 6.",
      "    ",
    )}\n`;
  }

  // 2 ─ Rust
  s += titulo(2, `COMPONENTES DEL BACKEND (crates de Rust en el binario de Windows)`);
  s += `\n${parrafo("Con * las que la app pide directamente; el resto llega por ellas.", "")}\n\n`;
  s += `${tabla(rust, (c) => (c.directa ? "* " : "  "))}\n`;
  s += `\nReparto de licencias de los ${rust.length} crates:\n\n${reparto(rust)}\n`;
  if (mpl.length > 0) {
    s += `\n${parrafo(
      `Nota sobre la MPL-2.0 (${mpl.join(", ")}): la MPL 2.0 es compatible con la GPLv3 y su ` +
        "copyleft es por archivo. ProcessDevKill usa ese código sin modificar, así que no " +
        "arrastra ninguna obligación adicional; si algún día se parchea uno de esos archivos, " +
        "habría que publicar el archivo modificado bajo MPL-2.0.",
      "    ",
    )}\n`;
  }

  // 3 ─ Sin archivo
  s += titulo(3, "COMPONENTES QUE NO PUBLICAN ARCHIVO DE LICENCIA");
  s += `\n${parrafo(
    "Declaran su licencia en su manifiesto, pero el paquete publicado no trae ningún archivo " +
      "con el texto ni con el aviso de copyright. Se pone lo que sí declaran: la licencia, " +
      "los autores y de dónde salen. El texto de cada una de esas licencias está en la sección " +
      "6, en la copia de otros componentes.",
  )}\n`;
  for (const c of sinAviso) {
    s += `\n    ${c.nombre} ${c.version}\n        Licencia: ${c.licencia || "(sin declarar)"}\n`;
    if (c.autores) s += `${parrafo(`Autores: ${c.autores}`, "        ")}\n`;
    s += `        Origen:   ${c.origen}\n`;
  }

  // 4 ─ Lo que no sale de ningún manifiesto
  s += titulo(4, "LO QUE VIAJA EN EL INSTALADOR Y NO SALE DE NINGÚN MANIFIESTO");
  s += `
${parrafo(
  "La biblioteca estándar de Rust. Se enlaza en el binario. MIT OR Apache-2.0, con " +
    "componentes de terceros bajo otras licencias permisivas; su relación está en " +
    "https://github.com/rust-lang/rust/blob/master/COPYRIGHT",
  "    ",
)}

${parrafo(
  "El cargador de WebView2 de Microsoft. El crate webview2-com-sys lo enlaza de forma " +
    "estática y no trae su licencia. Es la del paquete Microsoft.Web.WebView2, que publica su " +
    "propio LICENSE.txt: https://www.nuget.org/packages/Microsoft.Web.WebView2 . NO ESTÁ " +
    "REPRODUCIDA AQUÍ: es lo primero que tendría que mirar una revisión legal.",
  "    ",
)}

${parrafo(
  "El propio instalador. El .exe es un instalador NSIS (licencia zlib/libpng, " +
    "https://nsis.sourceforge.io/License) con los complementos de Tauri, y el .msi se compila " +
    "con WiX Toolset (https://wixtoolset.org). Son el programa que instala, no parte de la app.",
  "    ",
)}

${parrafo(
  "El entorno WebView2 no viaja en el instalador: lo pone Windows, o lo descarga el instalador " +
    "de Microsoft si falta.",
  "    ",
)}
`;

  // 5 ─ Skills
  s += titulo(5, "PACKS DE SKILLS DE AGENTE (viven en el repositorio, NO se distribuyen)");
  s += `\n${normalizar(skills)}\n`;

  // 6 ─ Textos
  s += titulo(6, "AVISOS DE COPYRIGHT Y TEXTOS DE LICENCIA");
  s += `\n${parrafo(
    "Cada bloque es un archivo de licencia tal como lo publica su paquete, con la lista de los " +
      "componentes que lo traen idéntico. Donde un componente ofrece varias licencias a elegir, " +
      "se reproducen todas las que publica.",
  )}\n`;
  for (const g of grupos) {
    s += `\n${"=".repeat(ANCHO)}\n`;
    const quien =
      g.usos.length === 1 ? `Lo trae ${g.usos[0]}` : `Lo traen ${g.usos.length} componentes: ${g.usos.join("; ")}`;
    s += `${parrafo(quien)}\n`;
    s += `${"=".repeat(ANCHO)}\n\n${g.texto}\n`;
  }

  return `${s.replace(/[ \t]+$/gm, "")}`.replace(/\n*$/, "\n");
}

// ── El guion ────────────────────────────────────────────────────────────────

function generar() {
  const npm = componentesNpm();
  const rust = componentesRust();

  const rechazadas = [...npm, ...rust].filter((c) => !licenciaAdmitida(c.licencia));
  if (rechazadas.length > 0) {
    throw new Error(
      "Hay componentes con una licencia que el proyecto no ha revisado. No se añade a " +
        "`ADMITIDAS` sin mirar antes si se puede distribuir dentro de un programa GPLv3:\n" +
        rechazadas.map((c) => `  ${c.nombre} ${c.version}: ${c.licencia || "(sin declarar)"}`).join("\n"),
    );
  }

  return {
    texto: componer({ npm, rust, skills: fs.readFileSync(SKILLS, "utf8") }),
    npm: npm.length,
    rust: rust.length,
  };
}

function main() {
  const comprobar = process.argv.includes("--comprobar");
  const { texto, npm, rust } = generar();

  if (!comprobar) {
    // En Windows, con sus finales de línea: es el archivo que abre el Bloc de notas desde Ajustes.
    fs.writeFileSync(DESTINO, process.platform === "win32" ? texto.replaceAll("\n", "\r\n") : texto);
    console.log(`[OK] THIRD-PARTY-NOTICES.txt generado: ${npm} componentes de npm y ${rust} crates.`);
    return 0;
  }

  const actual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, "utf8").replace(/\r\n/g, "\n") : "";
  if (actual === texto) {
    console.log(`[OK] THIRD-PARTY-NOTICES.txt está al día: ${npm} componentes de npm y ${rust} crates.`);
    return 0;
  }

  const [a, b] = [actual.split("\n"), texto.split("\n")];
  const linea = a.findIndex((l, i) => l !== b[i]);
  const donde = linea === -1 ? a.length : linea;
  console.log(
    "[X] THIRD-PARTY-NOTICES.txt no coincide con las dependencias de ahora.\n" +
      `    Primera diferencia, en la línea ${donde + 1}:\n` +
      `      en el archivo: ${a[donde] ?? "(fin del archivo)"}\n` +
      `      debería ser:   ${b[donde] ?? "(fin del archivo)"}\n` +
      "    Ese archivo viaja dentro del instalador. Regenéralo con\n" +
      "      node tools/avisos-de-terceros.mjs\n" +
      "    y revisa el cambio antes de commitearlo.",
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (e) {
    console.log(`[X] ${e?.message ?? e}`);
    process.exit(2);
  }
}
