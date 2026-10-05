/**
 * La auditoría de diseño, repetible: arranca la copia de prueba, la recorre y deja capturas y
 * medidas en una carpeta (T14-01).
 *
 *     node tools/auditoria-ui.mjs                          # todas las fases
 *     node tools/auditoria-ui.mjs --fases contraste,medidas
 *     node tools/auditoria-ui.mjs --sin-compilar           # reutiliza el binario de la vez anterior
 *     node tools/auditoria-ui.mjs --salida D:\auditoria    # por defecto, una carpeta temporal
 *
 * ## Por qué existe
 *
 * El Tier 14 salió de 186 capturas y 26 archivos de medidas que hizo un guion escrito en la
 * carpeta temporal de aquella sesión, y que se perdió con ella. Casi todas sus tareas piden, para
 * darse por hechas, **volver a medir lo mismo**: cuánto mide una fila, si Kill cabe al 150 %, si
 * un interruptor encendido se distingue de uno apagado con un tema de contraste. Sin el guion,
 * cada una se comprobaría a ojo.
 *
 * **No sustituye a `prueba-en-marcha.mjs`**, y no va en el corte. Aquel comprueba que la app hace
 * lo que dice y falla si no; este no afirma nada: mide y enseña, para que decida quien mira. Sale
 * con 0 aunque axe encuentre algo.
 *
 * ## Las fases
 *
 * - `vistas`: las cuatro vistas, en claro y oscuro, en español e inglés, a 1000×680.
 * - `tamanos`: las cuatro vistas a 900×480, 1000×680, 1280×800, 1600×1000 y 1920×1080.
 * - `zoom`: las cuatro vistas al 125, 150 y 200 % en la ventana de fábrica.
 * - `estados`: la búsqueda, una fila marcada, el menú de una fila y el diálogo de un lote.
 * - `foco`: el orden de tabulación de cada vista, con la captura de cada parada.
 * - `contraste`: `forced-colors`, que es como llegan al WebView los temas de contraste de
 *   Windows. Las capturas, y **medido sobre los píxeles** qué color tiene cada estado.
 * - `medidas`: axe-core, los objetivos de menos de 24 px, lo que se recorta, lo que hace scroll y
 *   lo que mide cada fila y cada columna, en cada tamaño y cada zoom.
 * - `ventana`: la ventana entera con su barra de título, que una captura por CDP no enseña.
 *
 * ## Lo que NO toca, y cómo se asegura
 *
 * Lo de `envivo.mjs` —otra carpeta de datos, otro candado, otro binario— y además:
 *
 * - **No cierra nada desde la app.** No pulsa Kill ni confirma ningún diálogo. Los procesos que
 *   lanza para tener filas propias los cierra al final como hijos suyos, sin pasar por la ventana.
 * - **Antes de abrir el diálogo de un lote comprueba que todo lo visible es suyo**: busca por el
 *   nombre de sus carpetas, compara los PID que quedan con los que lanzó y, si hay uno de más, no
 *   lo abre. El diálogo se cancela siempre.
 * - **No enciende nada que cierre procesos solo.** `ajustar` solo admite el tema, el idioma y los
 *   filtros del sidebar; el atajo global, el Auto-Kill y el arranque como administrador se quedan
 *   como vienen, apagados. No pulsa Arrancar, Detener, Deshacer, Instalar ni Reiniciar.
 * - **Solo pulsa Tabulador y Escape.** Nunca Intro ni Espacio, que sobre un Kill enfocado cierran.
 * - **No consulta la red**: arranca con la búsqueda de actualizaciones apagada.
 *
 * ## Lo que sale, y dónde
 *
 * En una carpeta **fuera del repositorio**: las capturas enseñan los procesos y los servicios
 * reales del equipo de quien lo lanza. El guion se niega a escribir dentro del repositorio.
 *
 * Sin línea `#!`, como `envivo.mjs`.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {
  Cdp,
  DATOS,
  EXE,
  RAIZ,
  TRABAJO,
  WEBVIEW,
  cerrarArbol,
  dormir,
  esperar,
  exigir,
  hijos,
  info,
  lanzar,
  lanzarDisfrazado,
  limpiar,
  prepararBinario,
  puertoLibre,
  vivo,
} from "./envivo.mjs";

const FASES = ["vistas", "tamanos", "zoom", "estados", "foco", "contraste", "medidas", "ventana"];

/** La ventana de fábrica (`tauri.conf.json`) y los demás tamaños de la auditoría. */
const FABRICA = [1000, 680];
const TAMANOS = [[900, 480], FABRICA, [1280, 800], [1600, 1000], [1920, 1080]];
const ZOOMS = [125, 150, 200];

/** Cada vista: el botón del sidebar que lleva a ella y el título que confirma que se llegó. */
const VISTAS = {
  procesos: { es: ["Procesos", "Procesos"], en: ["Processes", "Processes"] },
  servicios: { es: ["Servicios", "Servicios de desarrollo"], en: ["Services", "Development services"] },
  historial: { es: ["Historial", "Historial"], en: ["History", "History"] },
  ajustes: { es: ["Ajustes", "Ajustes"], en: ["Settings", "Settings"] },
};

/** Lo único que este guion puede cambiar en los ajustes de la copia. Ver la cabecera. */
const AJUSTES_PERMITIDOS = ["theme", "language", "showAllFilters"];

// ── Argumentos ──────────────────────────────────────────────────────────────

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : (process.argv[i + 1] ?? "");
}

const sinCompilar = process.argv.includes("--sin-compilar");
const fases = (argumento("--fases") ?? FASES.join(",")).split(",").map((f) => f.trim()).filter(Boolean);
const marca = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const SALIDA = path.resolve(argumento("--salida") || path.join(os.tmpdir(), `pdk-auditoria-${marca}`));

let capturas = 0;
let medidas = 0;
/** Lo que el guion quiere que se lea sin abrir ningún archivo. */
const resumen = [];

// ── Capturas y medidas ──────────────────────────────────────────────────────

async function capturar(cdp, nombre) {
  const r = await cdp.enviar("Page.captureScreenshot", { format: "png" });
  const png = Buffer.from(r.data, "base64");
  fs.writeFileSync(path.join(SALIDA, "capturas", `${nombre}.png`), png);
  capturas++;
  return png;
}

function medir(nombre, datos) {
  fs.writeFileSync(path.join(SALIDA, "medidas", `${nombre}.json`), `${JSON.stringify(datos, null, 2)}\n`);
  medidas++;
}

/**
 * Los píxeles de un PNG de 8 bits sin entrelazar, que es lo que da `Page.captureScreenshot`.
 *
 * A mano y no con una dependencia: son treinta líneas, y lo que se quiere es **el color que de
 * verdad se pintó**. Con `forced-colors`, `getComputedStyle` devuelve lo que pide la hoja de
 * estilos y no lo que el navegador acaba poniendo; el píxel no admite esa discusión.
 */
export function leerPng(buffer) {
  exigir(buffer.readUInt32BE(0) === 0x89504e47, "no es un PNG");
  let ancho = 0;
  let alto = 0;
  let canales = 0;
  const trozos = [];
  for (let i = 8; i < buffer.length; ) {
    const largo = buffer.readUInt32BE(i);
    const tipo = buffer.toString("latin1", i + 4, i + 8);
    const datos = buffer.subarray(i + 8, i + 8 + largo);
    if (tipo === "IHDR") {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      exigir(datos[8] === 8 && datos[12] === 0, "PNG con otra profundidad o entrelazado");
      canales = { 2: 3, 6: 4 }[datos[9]];
      exigir(canales, `PNG de un tipo de color que no se esperaba: ${datos[9]}`);
    } else if (tipo === "IDAT") {
      trozos.push(datos);
    }
    i += 12 + largo;
  }

  const crudo = zlib.inflateSync(Buffer.concat(trozos));
  const fila = ancho * canales;
  const px = Buffer.alloc(fila * alto);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)];
    const de = y * (fila + 1) + 1;
    const a = y * fila;
    for (let x = 0; x < fila; x++) {
      const izq = x >= canales ? px[a + x - canales] : 0;
      const arr = y > 0 ? px[a + x - fila] : 0;
      const diag = y > 0 && x >= canales ? px[a + x - fila - canales] : 0;
      let pred = 0;
      if (filtro === 1) pred = izq;
      else if (filtro === 2) pred = arr;
      else if (filtro === 3) pred = (izq + arr) >> 1;
      else if (filtro === 4) {
        const p = izq + arr - diag;
        const [pa, pb, pc] = [Math.abs(p - izq), Math.abs(p - arr), Math.abs(p - diag)];
        pred = pa <= pb && pa <= pc ? izq : pb <= pc ? arr : diag;
      }
      px[a + x] = (crudo[de + x] + pred) & 0xff;
    }
  }
  return {
    ancho,
    alto,
    /** `[r, g, b]` del píxel, o `null` si cae fuera. */
    en(x, y) {
      const [cx, cy] = [Math.round(x), Math.round(y)];
      if (cx < 0 || cy < 0 || cx >= ancho || cy >= alto) return null;
      const i = cy * fila + cx * canales;
      return [px[i], px[i + 1], px[i + 2]];
    },
  };
}

const hex = (c) => (c ? `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}` : null);

/** El contraste entre dos colores, como lo define WCAG: de 1 a 21. */
export function contraste(a, b) {
  if (!a || !b) return null;
  const luz = (c) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [clara, oscura] = [luz(a), luz(b)].sort((x, y) => y - x);
  return Math.round(((clara + 0.05) / (oscura + 0.05)) * 100) / 100;
}

// ── Conducir la ventana ─────────────────────────────────────────────────────

/** El tamaño de la ventana y el zoom, emulados: 150 % es una ventana un tercio más pequeña. */
async function ventana(cdp, [ancho, alto], zoom = 100) {
  await cdp.enviar("Emulation.setDeviceMetricsOverride", {
    width: Math.round((ancho * 100) / zoom),
    height: Math.round((alto * 100) / zoom),
    deviceScaleFactor: zoom / 100,
    mobile: false,
  });
  await dormir(350);
}

async function ajustar(cdp, cambios) {
  for (const clave of Object.keys(cambios)) {
    exigir(AJUSTES_PERMITIDOS.includes(clave), `este guion no cambia el ajuste «${clave}»`);
  }
  const actuales = await cdp.invoke("get_settings");
  exigir(actuales.ok, actuales.error);
  const r = await cdp.invoke("save_settings", { settings: { ...actuales.valor, ...cambios } });
  exigir(r.ok, r.error);
  // Rust reemite los ajustes guardados, pero la ventana los tiene en su estado: se recarga para
  // que los lea, que es además lo que deja cada tanda de capturas empezando igual.
  await cdp.enviar("Page.reload");
  const lista = await esperar(
    () =>
      cdp.js(`(() => {
        const s = ${JSON.stringify(cambios)};
        const raiz = document.documentElement;
        if (!document.querySelector("main h2")) return false;
        if (s.language && raiz.lang !== s.language) return false;
        if (s.theme === "dark" && !raiz.classList.contains("dark")) return false;
        if (s.theme === "light" && raiz.classList.contains("dark")) return false;
        return true;
      })()`),
    { ms: 15_000 },
  );
  exigir(lista, `la ventana no aplicó ${JSON.stringify(cambios)}`);
  // El medidor del sidebar llega con el siguiente ciclo del poller, cada dos segundos: sin
  // esperarlo, todas las capturas de después de recargar salen con «Midiendo…».
  await dormir(2_600);
}

async function irA(cdp, vista, idioma = "es") {
  const [boton, titulo] = VISTAS[vista][idioma];
  const actual = await cdp.js(`document.querySelector("main h2")?.textContent`);
  // En Procesos, su botón pliega y despliega los filtros: solo se pulsa para llegar.
  if (actual !== titulo) await cdp.pulsar(boton, `document.querySelector("aside")`);
  const llego = await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === ${JSON.stringify(titulo)}`));
  exigir(llego, `no se llegó a la vista «${titulo}»`);
  // Servicios lee del SCM al abrirse, y la lista de procesos llega por evento.
  await dormir(vista === "servicios" ? 1_200 : 500);
}

async function tecla(cdp, nombre, codigo) {
  // `rawKeyDown` y no `keyDown`: es una tecla que no escribe nada, y así es como llega una real.
  for (const type of ["rawKeyDown", "keyUp"]) {
    await cdp.enviar("Input.dispatchKeyEvent", {
      type,
      key: nombre,
      code: nombre,
      windowsVirtualKeyCode: codigo,
      nativeVirtualKeyCode: codigo,
    });
  }
}

/** Escribe en el buscador como lo hace React: con el `setter` nativo y su evento. */
function buscar(cdp, texto) {
  return cdp.js(`(() => {
    const campo = document.querySelector('main header input, main input[type="search"], main input');
    if (!campo) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, ${JSON.stringify(texto)});
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
}

// ── Lo que el guion lanza para tener filas suyas ────────────────────────────

/** Un `node` escuchando en varios puertos: la fila que triplica su alto (T14-06). */
async function lanzarServidor(carpeta, cuantos = 1) {
  const dir = path.join(TRABAJO, carpeta);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "server.js"),
    // El `setInterval` lo mantiene vivo cuando no escucha en ningún puerto: sin nada pendiente,
    // Node termina solo.
    "for (const p of process.argv.slice(2)) require('net').createServer().listen(Number(p), '127.0.0.1');\n" +
      "setInterval(() => {}, 60000);\n",
  );
  const puertos = [];
  for (let i = 0; i < cuantos; i++) puertos.push(await puertoLibre());
  const hijo = lanzar(process.execPath, ["server.js", ...puertos.map(String)], { cwd: dir });
  return { hijo, pid: hijo.pid, puertos, carpeta };
}

async function lanzarLosPropios(cdp) {
  const propios = [
    await lanzarServidor("pdk-envivo-tienda-api", 1),
    await lanzarServidor("pdk-envivo-seis-puertos", 6),
    await lanzarServidor("pdk-envivo-sin-puerto", 0),
    ...["python", "dotnet", "java", "deno", "bun"].map((n) => lanzarDisfrazado(n)),
  ];
  const vistos = await esperar(
    async () => {
      const lista = await cdp.invoke("get_processes");
      return lista.ok && propios.every((p) => lista.valor.some((f) => f.pid === p.pid));
    },
    { ms: 20_000 },
  );
  exigir(vistos, "los procesos del guion no salieron todos en la lista");
  return propios;
}

/** Un historial de mentira, en la carpeta de la copia: sin él, la vista saldría vacía. */
function sembrarDatos() {
  for (const dir of [DATOS, WEBVIEW]) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(
    path.join(DATOS, "settings.json"),
    JSON.stringify({ language: "es", theme: "dark", checkUpdatesOnStart: false }),
  );
  const ahora = Date.now();
  const min = 60_000;
  const entrada = (pid, name, freedPorts, hace, source) => ({ pid, name, freedPorts, killedAt: ahora - hace, source });
  fs.writeFileSync(
    path.join(DATOS, "history.json"),
    JSON.stringify([
      entrada(4120, "node.exe", [3000], 3 * min, "window"),
      entrada(5230, "node.exe", [5173, 24678], 41 * min, "window"),
      // Tres del mismo instante: una tanda.
      entrada(6001, "node.exe", [8080], 95 * min, "tray"),
      entrada(6002, "python.exe", [], 95 * min, "tray"),
      entrada(6003, "dotnet.exe", [5000], 95 * min, "tray"),
      entrada(7310, "java.exe", [], 26 * 60 * min, "auto"),
      entrada(8450, "bun.exe", [3001], 3 * 24 * 60 * min, "hotkey"),
      entrada(9120, "deno.exe", [], 20 * 24 * 60 * min, "window"),
    ]),
  );
}

// ── Las medidas que se toman dentro de la página ────────────────────────────

/** Tamaños, recortes y scroll de lo que hay pintado ahora mismo. */
function medirPagina(cdp) {
  return cdp.js(`(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const nombre = (el) =>
      (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.id || el.tagName)
        .trim().replace(/\\s+/g, " ").slice(0, 60);
    const caja = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), ancho: Math.round(r.width * 10) / 10, alto: Math.round(r.height * 10) / 10 };
    };
    const controles = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="switch"], [role="checkbox"], [role="radio"], summary')].filter(visible);
    const todo = [...document.querySelectorAll("body *")].filter(visible);
    const filas = [...document.querySelectorAll("main tbody tr")].filter(visible);
    const principal = document.querySelector("main");
    return {
      ventana: { ancho: innerWidth, alto: innerHeight, escala: devicePixelRatio },
      titulo: document.querySelector("main h2")?.textContent ?? null,
      scrollHorizontalDeLaPagina: document.documentElement.scrollWidth > innerWidth + 1,
      objetivosPequenos: controles
        .map((el) => ({ nombre: nombre(el), ...caja(el) }))
        .filter((c) => Math.min(c.ancho, c.alto) < 24),
      // Lo que no cabe en su caja y se corta: el texto que el usuario no llega a leer.
      recortes: todo
        .filter((el) => el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")
        .map((el) => ({ texto: nombre(el), cabe: el.clientWidth, pide: el.scrollWidth })),
      scroll: todo
        .filter((el) => {
          const s = getComputedStyle(el);
          return (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
                 (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1);
        })
        .map((el) => ({
          donde: el.id || el.getAttribute("aria-label") || el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 3).join("."),
          ve: [el.clientWidth, el.clientHeight],
          pide: [el.scrollWidth, el.scrollHeight],
        })),
      columnas: [...document.querySelectorAll("main thead th")].map((th) => ({ nombre: nombre(th), ancho: caja(th).ancho })),
      filas: {
        cuantas: filas.length,
        altos: [...new Set(filas.map((f) => caja(f).alto))].sort((a, b) => a - b),
        enLaVentana: filas.filter((f) => f.getBoundingClientRect().bottom <= innerHeight).length,
      },
      // Lo que se sale por la derecha de su vista: el Kill detrás del scroll horizontal (T14-17).
      fueraPorLaDerecha: principal
        ? controles
            .filter((el) => principal.contains(el) && el.getBoundingClientRect().right > innerWidth + 1)
            .map((el) => nombre(el))
            .filter((n, i, a) => a.indexOf(n) === i)
            .slice(0, 12)
        : [],
      navegacion: [...document.querySelectorAll("aside nav button, aside button")].filter(visible).map((b) => ({ nombre: nombre(b), ...caja(b) })).slice(0, 20),
    };
  })()`);
}

let axeCargado = null;

/** axe-core, que ya está en `node_modules` por `eslint-plugin-jsx-a11y`. */
async function pasarAxe(cdp) {
  axeCargado ??= fs.readFileSync(path.join(RAIZ, "node_modules", "axe-core", "axe.min.js"), "utf8");
  // La fuente de axe pesa medio mega: solo se manda si la página no la tiene, que es tras recargar.
  if (!(await cdp.js(`typeof window.axe === "object"`))) {
    await cdp.js(`(() => { ${axeCargado}\n; return true; })()`);
  }
  return cdp.js(`axe.run(document, { resultTypes: ["violations", "incomplete"] }).then((r) => ({
    version: r.testEngine.version,
    violaciones: r.violations.map((v) => ({ regla: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(" ") })),
    incompletos: r.incomplete.map((v) => ({ regla: v.id, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(" ") })),
  }))`);
}

// ── Las fases ───────────────────────────────────────────────────────────────

async function faseVistas(cdp) {
  await ventana(cdp, FABRICA);
  for (const idioma of ["es", "en"]) {
    for (const tema of ["dark", "light"]) {
      await ajustar(cdp, { language: idioma, theme: tema });
      for (const vista of Object.keys(VISTAS)) {
        await irA(cdp, vista, idioma);
        await capturar(cdp, `vista-${vista}-${tema}-${idioma}`);
      }
    }
  }
  await ajustar(cdp, { language: "es", theme: "dark" });
}

async function faseTamanos(cdp) {
  for (const tamano of TAMANOS) {
    await ventana(cdp, tamano);
    for (const vista of Object.keys(VISTAS)) {
      await irA(cdp, vista);
      await capturar(cdp, `tamano-${tamano.join("x")}-${vista}`);
    }
  }
  await ventana(cdp, FABRICA);
}

async function faseZoom(cdp) {
  for (const zoom of ZOOMS) {
    await ventana(cdp, FABRICA, zoom);
    for (const vista of Object.keys(VISTAS)) {
      await irA(cdp, vista);
      await capturar(cdp, `zoom-${zoom}-${vista}`);
    }
  }
  await ventana(cdp, FABRICA);
}

async function faseEstados(cdp, propios) {
  await ventana(cdp, FABRICA);
  await irA(cdp, "procesos");
  const suyos = new Set(propios.map((p) => p.pid));
  const visibles = () =>
    cdp.js(`[...document.querySelectorAll('main tbody [aria-label^="Seleccionar PID "]')]
      .map((c) => Number(c.getAttribute("aria-label").replace(/\\D+/g, "")))`);

  // Todas las carpetas del guion empiezan igual: es lo que deja la lista solo con lo suyo.
  exigir(await buscar(cdp, "pdk-envivo"), "no se encontró el buscador");
  const filtradas = await esperar(async () => {
    const v = await visibles();
    return v.length > 0 && v.length <= propios.length && v;
  });
  exigir(filtradas, "la búsqueda no dejó las filas del guion");
  await capturar(cdp, "estado-busqueda");

  const ajenas = filtradas.filter((pid) => !suyos.has(pid));
  const fila = `document.querySelector('[aria-label="Seleccionar PID ${propios[0].pid}"]').closest("tr")`;

  await cdp.js(`(() => {
    const r = ${fila}.getBoundingClientRect();
    ${fila}.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: r.left + 200, clientY: r.top + r.height / 2 }));
  })()`);
  await dormir(600);
  await capturar(cdp, "estado-menu-de-fila");
  await tecla(cdp, "Escape", 27);
  await dormir(400);

  await cdp.js(`document.querySelector('[aria-label="Seleccionar PID ${propios[0].pid}"]').click()`);
  await dormir(400);
  await capturar(cdp, "estado-seleccion");
  await cdp.js(`document.querySelector('[aria-label="Seleccionar PID ${propios[0].pid}"]').click()`);

  // El diálogo de un lote. Solo si **todo** lo que se ve es del guion, y se cancela siempre.
  if (ajenas.length > 0) {
    resumen.push(`estados: no se abrió el diálogo del lote, porque la búsqueda dejó ${ajenas.length} proceso(s) que no son del guion`);
  } else {
    await cdp.pulsar("Nuke", `document.querySelector("main")`);
    const abierto = await esperar(() => cdp.js(`Boolean(document.querySelector('[role="alertdialog"]'))`), { ms: 4_000 });
    if (abierto) {
      await dormir(300);
      await capturar(cdp, "estado-dialogo-de-lote");
      medir("dialogo-de-lote", await cdp.js(`document.querySelector('[role="alertdialog"]').innerText`));
      await cdp.pulsar("Cancelar", `document.querySelector('[role="alertdialog"]')`);
      await esperar(() => cdp.js(`!document.querySelector('[role="alertdialog"]')`), { ms: 4_000 });
    }
    exigir(propios.every((p) => vivo(p.hijo)), "tras cancelar el diálogo falta algún proceso del guion");
  }
  await buscar(cdp, "");
  await dormir(300);
}

async function faseFoco(cdp) {
  await ventana(cdp, FABRICA);
  const paradas = {};
  for (const vista of Object.keys(VISTAS)) {
    await irA(cdp, vista);
    await cdp.js(`document.activeElement?.blur(); window.scrollTo(0, 0)`);
    const orden = [];
    // Hasta dar la vuelta: el foco vuelve a `body`, o a la primera parada.
    for (let i = 0; i < 160; i++) {
      await tecla(cdp, "Tab", 9);
      const donde = await cdp.js(`(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const zona = el.closest("aside") ? "sidebar" : el.closest("main header, main thead") ? "cabecera" : el.closest("main") ? "cuerpo" : "otra";
        return {
          zona,
          que: (el.getAttribute("role") || el.tagName.toLowerCase()),
          nombre: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.id || "").trim().replace(/\\s+/g, " ").slice(0, 60),
          aLaVista: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        };
      })()`);
      if (!donde) break;
      if (orden.length > 0 && donde.nombre === orden[0].nombre && donde.que === orden[0].que && donde.zona === orden[0].zona) break;
      orden.push(donde);
      // Con cuarenta capturas por vista se ve cómo es el foco de cada tipo de control; las filas
      // de una tabla son todas iguales.
      if (orden.length <= 40) await capturar(cdp, `foco-${vista}-${String(orden.length).padStart(2, "0")}`);
    }
    await cdp.js(`document.activeElement?.blur()`);
    paradas[vista] = {
      total: orden.length,
      porZona: orden.reduce((a, p) => ({ ...a, [p.zona]: (a[p.zona] ?? 0) + 1 }), {}),
      fueraDeLaVista: orden.filter((p) => !p.aLaVista).length,
      orden,
    };
    resumen.push(`foco: ${vista}, ${orden.length} paradas de tabulador`);
  }
  medir("tabulacion", paradas);
}

/** El color pintado en el centro de un elemento, y en puntos suyos elegidos por la fase. */
function puntosDe(cdp, selector) {
  return cdp.js(`[...document.querySelectorAll(${JSON.stringify(selector)})]
    .filter((el) => {
      // Entero a la vista **dentro de su zona de scroll**: lo que asoma por debajo de la cabecera
      // fija de la vista está tapado, y su píxel es el de la cabecera.
      const r = el.getBoundingClientRect();
      const zona = el.closest(".overflow-y-auto")?.getBoundingClientRect();
      return r.width > 0 && r.top >= (zona?.top ?? 0) && r.bottom <= (zona?.bottom ?? innerHeight);
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const pulgar = el.querySelector('[data-slot="switch-thumb"]')?.getBoundingClientRect();
      return {
        nombre: (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.id || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 50),
        encendido: el.getAttribute("aria-checked") ?? el.getAttribute("aria-current") ?? el.getAttribute("aria-pressed") ?? el.getAttribute("aria-selected") ?? el.getAttribute("data-state"),
        caja: [r.left, r.top, r.width, r.height],
        pulgar: pulgar ? [pulgar.left + pulgar.width / 2, pulgar.top + pulgar.height / 2] : null,
        peso: getComputedStyle(el).fontWeight,
      };
    })`);
}

async function faseContraste(cdp, propios) {
  await ventana(cdp, FABRICA);
  const estados = {};
  for (const tema of ["dark", "light"]) {
    await ajustar(cdp, { theme: tema, showAllFilters: true });
    await cdp.enviar("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
    await dormir(500);
    for (const vista of Object.keys(VISTAS)) {
      await irA(cdp, vista);
      await capturar(cdp, `contraste-${vista}-${tema}`);
    }

    // Los interruptores de Ajustes: el pulgar contra su pista, y la pista encendida contra la
    // apagada. Se miden sobre la captura, no sobre los estilos (ver `leerPng`).
    await irA(cdp, "ajustes");
    const interruptores = [];
    const elegidos = [];
    const cuerpo = `document.querySelector("main .overflow-y-auto")`;
    const alto = await cdp.js(`${cuerpo}.scrollHeight`);
    for (let y = 0; y < alto; y += 500) {
      await cdp.js(`${cuerpo}.scrollTop = ${y}`);
      await dormir(250);
      const png = leerPng(await capturar(cdp, `contraste-ajustes-${tema}-en-${String(y).padStart(4, "0")}`));
      for (const s of await puntosDe(cdp, `main [role="switch"]`)) {
        const [x, t, w, h] = s.caja;
        const pulgarA = s.pulgar[0] < x + w / 2 ? "izquierda" : "derecha";
        // La pista se mira en el lado donde no está el pulgar.
        const pista = png.en(pulgarA === "izquierda" ? x + w - 5 : x + 5, t + h / 2);
        const pulgar = png.en(...s.pulgar);
        const fondo = png.en(x - 6, t + h / 2);
        interruptores.push({
          nombre: s.nombre,
          encendido: s.encendido === "true",
          pulgar: hex(pulgar),
          pista: hex(pista),
          fondo: hex(fondo),
          pulgarContraPista: contraste(pulgar, pista),
          pistaContraFondo: contraste(pista, fondo),
        });
      }
      for (const r of await puntosDe(cdp, `main [role="radio"]`)) {
        const [x, t, , h] = r.caja;
        elegidos.push({ nombre: r.nombre, elegido: r.encendido === "true", fondo: hex(png.en(x + 4, t + h / 2)), peso: r.peso });
      }
    }
    const unicos = (lista) => [...new Map(lista.map((i) => [i.nombre, i])).values()];
    const sw = unicos(interruptores);
    const on = sw.find((s) => s.encendido);
    const off = sw.find((s) => !s.encendido);
    // El foco, que en la app es una sombra y con `forced-colors` las sombras no se pintan.
    await cdp.js(`${cuerpo}.scrollTop = 0; document.activeElement?.blur()`);
    const foco = [];
    for (let i = 1; i <= 8; i++) {
      await tecla(cdp, "Tab", 9);
      foco.push(
        await cdp.js(`(() => {
          const el = document.activeElement, e = getComputedStyle(el);
          return { que: el.getAttribute("role") || el.tagName.toLowerCase(), contorno: e.outlineStyle + " " + e.outlineWidth };
        })()`),
      );
      await capturar(cdp, `contraste-foco-${tema}-${i}`);
    }
    await cdp.js(`document.activeElement?.blur()`);

    const sidebar = [];
    await irA(cdp, "procesos");
    const png = leerPng(await capturar(cdp, `contraste-procesos-${tema}-sidebar`));
    for (const b of await puntosDe(cdp, "aside nav button, aside ul button")) {
      const [x, t, w, h] = b.caja;
      sidebar.push({ nombre: b.nombre, activo: b.encendido === "page" || b.encendido === "true", fondo: hex(png.en(x + w - 6, t + h / 2)) });
    }

    // Una barra a medio llenar: el relleno por su izquierda y el carril por su derecha.
    const barras = await cdp.js(`[...document.querySelectorAll('main [data-slot="barra"]')]
      .map((b) => [b.getBoundingClientRect(), b.querySelector('[data-slot="barra-relleno"]')?.getBoundingClientRect()])
      .filter(([c, r]) => r && c.bottom <= innerHeight && r.width > 8 && r.width < c.width - 8)
      .map(([c, r]) => ({ relleno: [r.left + 3, r.top + r.height / 2], carril: [c.right - 4, c.top + c.height / 2] }))`);
    const barra = barras[0]
      ? { relleno: hex(png.en(...barras[0].relleno)), carril: hex(png.en(...barras[0].carril)) }
      : null;

    // La fila marcada: una del guion, que se marca y se desmarca.
    const casilla = `document.querySelector('[aria-label="Seleccionar PID ${propios[0].pid}"]')`;
    if (await cdp.js(`Boolean(${casilla})`)) {
      // Se desplaza solo el cuerpo de la vista. `scrollIntoView` mueve también la ventana entera,
      // que no tiene scroll para el usuario pero sí por programa, y la captura sale cortada.
      await cdp.js(`(() => {
        const zona = ${casilla}.closest(".overflow-y-auto");
        zona.scrollTop += ${casilla}.getBoundingClientRect().top - zona.getBoundingClientRect().top - 160;
        ${casilla}.click();
      })()`);
      await dormir(400);
      await capturar(cdp, `contraste-seleccion-${tema}`);
      await cdp.js(`${casilla}.click()`);
    }

    const opciones = unicos(elegidos);
    const [elegida, sinElegir] = [opciones.find((o) => o.elegido), opciones.find((o) => !o.elegido)];
    const [activa, inactiva] = [sidebar.find((b) => b.activo), sidebar.find((b) => !b.activo)];
    const entre = (a, b) => (a && b ? contraste(colorDe(a), colorDe(b)) : null);
    estados[tema] = {
      interruptores: sw,
      encendidoContraApagado: entre(on?.pista, off?.pista),
      opciones,
      elegidaContraSinElegir: entre(elegida?.fondo, sinElegir?.fondo),
      sidebar,
      activaContraInactiva: entre(activa?.fondo, inactiva?.fondo),
      barra,
      rellenoContraCarril: entre(barra?.relleno, barra?.carril),
      foco,
    };
    const e = estados[tema];
    resumen.push(
      `contraste (${tema}): interruptor encendido ${on?.pista ?? "?"} frente a apagado ${off?.pista ?? "?"} = ${e.encendidoContraApagado ?? "?"}:1; ` +
        `pulgar contra pista, ${on?.pulgarContraPista ?? "?"}:1 encendido y ${off?.pulgarContraPista ?? "?"}:1 apagado; ` +
        `opción elegida contra las demás, ${e.elegidaContraSinElegir ?? "?"}:1; vista activa contra las demás, ${e.activaContraInactiva ?? "?"}:1; ` +
        `relleno de una barra contra su carril, ${e.rellenoContraCarril ?? "?"}:1; ` +
        `foco con contorno en ${foco.filter((f) => !f.contorno.startsWith("none")).length} de ${foco.length} paradas`,
    );
    await cdp.enviar("Emulation.setEmulatedMedia", { features: [] });
  }
  medir("forced-colors", estados);
  await ajustar(cdp, { theme: "dark", showAllFilters: false });
}

const colorDe = (h) => (h ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);

async function faseMedidas(cdp) {
  // axe, donde lo pasó la auditoría: las cuatro vistas, los dos temas y los dos idiomas.
  await ventana(cdp, FABRICA);
  const axe = {};
  let violaciones = 0;
  let incompletos = 0;
  for (const idioma of ["es", "en"]) {
    for (const tema of ["dark", "light"]) {
      await ajustar(cdp, { language: idioma, theme: tema });
      for (const vista of Object.keys(VISTAS)) {
        await irA(cdp, vista, idioma);
        const r = await pasarAxe(cdp);
        axe[`${vista}-${tema}-${idioma}`] = r;
        violaciones += r.violaciones.length;
        incompletos += r.incompletos.length;
      }
    }
  }
  medir("axe", axe);
  resumen.push(`medidas: axe ${Object.values(axe)[0]?.version}, ${violaciones} violaciones y ${incompletos} incompletos en ${Object.keys(axe).length} pasadas`);
  await ajustar(cdp, { language: "es", theme: "dark" });

  const tandas = [
    ...TAMANOS.map((t) => ({ nombre: t.join("x"), tamano: t, zoom: 100 })),
    ...ZOOMS.map((z) => ({ nombre: `zoom-${z}`, tamano: FABRICA, zoom: z })),
  ];
  for (const { nombre, tamano, zoom } of tandas) {
    await ventana(cdp, tamano, zoom);
    const pagina = {};
    for (const vista of Object.keys(VISTAS)) {
      await irA(cdp, vista);
      pagina[vista] = await medirPagina(cdp);
    }
    if (zoom === 200) pagina.axe = { procesos: (await irA(cdp, "procesos"), await pasarAxe(cdp)) };
    medir(`pagina-${nombre}`, pagina);
    const p = pagina.procesos;
    resumen.push(
      `medidas (${nombre}): Procesos, filas de ${p.filas.altos.join(" y ")} px, ${p.filas.enLaVentana} a la vista; ` +
        `columna «${p.columnas[1]?.nombre ?? "?"}» de ${p.columnas[1]?.ancho ?? "?"} px` +
        (p.fueraPorLaDerecha.length > 0 ? `; fuera por la derecha: ${p.fueraPorLaDerecha.slice(0, 3).join(", ")}` : ""),
    );
  }
  await ventana(cdp, FABRICA);
}

/**
 * La ventana entera, con su marco: lo que una captura por CDP no enseña.
 *
 * `PrintWindow` le pide a la ventana que se pinte en un mapa de bits, así que no captura nada más
 * del escritorio. Y `DWMWA_USE_IMMERSIVE_DARK_MODE` dice si la barra de título va en oscuro.
 */
async function faseVentana(cdp, app) {
  await cdp.enviar("Emulation.clearDeviceMetricsOverride");
  const guion = path.join(TRABAJO, "ventana.ps1");
  fs.writeFileSync(
    guion,
    `param([int]$Pid_, [string]$Destino)
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Runtime.InteropServices;
public static class Ventana {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int n);
  public static string Capturar(IntPtr h, string destino) {
    RECT r; GetWindowRect(h, out r);
    using (var bmp = new Bitmap(r.R - r.L, r.B - r.T)) {
      using (var g = Graphics.FromImage(bmp)) { var dc = g.GetHdc(); PrintWindow(h, dc, 2); g.ReleaseHdc(dc); }
      bmp.Save(destino, System.Drawing.Imaging.ImageFormat.Png);
    }
    int oscuro; int hr = DwmGetWindowAttribute(h, 20, out oscuro, 4);
    return (r.R - r.L) + "x" + (r.B - r.T) + ";" + (hr == 0 ? oscuro.ToString() : "?");
  }
}
'@
$h = (Get-Process -Id $Pid_).MainWindowHandle
if ($h -eq [IntPtr]::Zero) { Write-Output "sin-ventana"; exit 1 }
Write-Output ([Ventana]::Capturar($h, $Destino))
`,
  );
  const marco = {};
  for (const tema of ["dark", "light"]) {
    await ajustar(cdp, { theme: tema });
    await irA(cdp, "procesos");
    const destino = path.join(SALIDA, "capturas", `ventana-${tema}.png`);
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", guion, "-Pid_", String(app.pid), "-Destino", destino],
      { encoding: "utf8", windowsHide: true },
    );
    const [tamano, oscuro] = (r.stdout ?? "").trim().split(";");
    if (r.status === 0 && fs.existsSync(destino)) capturas++;
    marco[tema] = { tamano: tamano || null, barraDeTituloEnOscuro: oscuro === "1" ? true : oscuro === "0" ? false : null, error: r.status === 0 ? null : (r.stderr || r.stdout).trim().slice(0, 300) };
    resumen.push(`ventana: con la app en ${tema === "dark" ? "oscuro" : "claro"}, la barra de título va en ${oscuro === "1" ? "oscuro" : oscuro === "0" ? "claro" : "?"}`);
  }
  medir("ventana", marco);
  await ajustar(cdp, { theme: "dark" });
}

// ── El guion ────────────────────────────────────────────────────────────────

async function main() {
  const desconocidas = fases.filter((f) => !FASES.includes(f));
  exigir(desconocidas.length === 0, `fases que no existen: ${desconocidas.join(", ")}. Las que hay: ${FASES.join(", ")}`);
  const dentro = path.relative(RAIZ, SALIDA);
  exigir(
    dentro.startsWith("..") || path.isAbsolute(dentro),
    `la salida no puede estar dentro del repositorio (${SALIDA}): las capturas enseñan los procesos del equipo`,
  );
  for (const sub of ["capturas", "medidas"]) fs.mkdirSync(path.join(SALIDA, sub), { recursive: true });

  const puertoCdp = await prepararBinario(sinCompilar);
  sembrarDatos();

  info("Arrancando la copia de prueba...");
  const app = lanzar(EXE, [], { cwd: path.dirname(EXE) });
  const cdp = await Cdp.conectar(puertoCdp);
  try {
    const cargada = await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Procesos"`), { ms: 20_000 });
    exigir(cargada, "la ventana no llegó a pintar la vista de Procesos");
    const propios = await lanzarLosPropios(cdp);
    // sysinfo necesita tres muestras para dar una CPU real, y las filas tardan en asentarse.
    await dormir(5_000);

    const todas = { vistas: faseVistas, tamanos: faseTamanos, zoom: faseZoom, estados: faseEstados, foco: faseFoco, contraste: faseContraste, medidas: faseMedidas, ventana: faseVentana };
    for (const fase of FASES.filter((f) => fases.includes(f))) {
      info(`Fase «${fase}»...`);
      await todas[fase](cdp, fase === "ventana" ? app : propios);
    }

    exigir(vivo(app), "la app se cerró sola durante la auditoría");
    if (cdp.errores.length > 0) resumen.push(`la ventana dio ${cdp.errores.length} error(es) de JavaScript: ${cdp.errores[0]}`);
  } finally {
    cdp.cerrar();
  }
}

let codigo = 0;
// Al importarlo desde su prueba no se arranca nada: solo se usan `leerPng` y `contraste`.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RAIZ, "tools", "auditoria-ui.mjs")) {
  try {
    await main();
  } catch (e) {
    codigo = 1;
    console.log(`[X] ${e?.message ?? e}`);
  } finally {
    for (const hijo of hijos) cerrarArbol(hijo);
    // WebView2 tarda un momento en soltar su carpeta después de morir el proceso que la abrió.
    await dormir(1_500);
    try {
      limpiar();
    } catch (e) {
      console.log(`[!] No se pudo borrar alguna carpeta de la copia: ${e.message}`);
    }
  }

  console.log("");
  for (const linea of resumen) console.log(`    ${linea}`);
  if (fs.existsSync(SALIDA)) {
    fs.writeFileSync(path.join(SALIDA, "resumen.txt"), `${resumen.join("\n")}\n`);
    console.log(`\n${codigo === 0 ? "[OK]" : "[!]"} ${capturas} capturas y ${medidas} archivos de medidas en ${SALIDA}`);
    console.log("    Enseñan los procesos y servicios de este equipo: se miran antes de compartirlas.");
  }
  process.exit(codigo);
}
