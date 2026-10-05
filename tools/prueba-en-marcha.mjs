#!/usr/bin/env node
/**
 * Pruebas con la app en marcha: compila el binario de release, lo arranca y lo conduce.
 *
 * Las suites prueban piezas. Esto prueba **el binario**: que la ventana carga, que la lista enseña
 * lo que hay, que Kill cierra lo que se le pide y nada más, que las guardias cortan y que el
 * actualizador descarga y verifica de verdad. Lo lanza `release.ps1` en el paso de comprobaciones
 * —también en `-DryRun`— y se puede lanzar suelto:
 *
 *     node tools/prueba-en-marcha.mjs                 # compila y prueba
 *     node tools/prueba-en-marcha.mjs --sin-compilar  # reutiliza el binario de la vez anterior
 *
 * ## Lo que NO toca, y cómo se asegura
 *
 * Cómo se llega a la copia de prueba —compilarla, arrancarla, hablarle por CDP— está en
 * `envivo.mjs`, que comparte con `auditoria-ui.mjs`. Aquí están las comprobaciones.
 *
 * - **Ni los ajustes ni el historial del usuario, ni su app abierta.** El binario se compila con
 *   otro identificador (`IDENTIFICADOR`), y de él salen la carpeta de datos, la de WebView2 y el
 *   candado de instancia única. La copia de prueba tiene los suyos, vacíos, y los borra al acabar.
 *   Por eso no hace falta respaldar `settings.json` ni pedirle a nadie que cierre la app.
 * - **Ni `tauri.conf.json`.** El identificador y el puerto de depuración entran por `--config`, en
 *   un archivo temporal. El archivo del repositorio no se abre para escribir.
 * - **Ni el binario que se publica.** Se compila en `target/envivo`, no en `target/release`: un
 *   instalador no puede llevarse por error el puerto de depuración.
 * - **Ningún proceso del usuario.** Solo se manda cerrar lo que este guion ha lanzado, por su PID.
 *   Nunca se pulsa Nuke All, ni el atajo, ni la bandeja, ni Arrancar o Detener de un servicio.
 * - **Nada se instala.** La actualización se descarga y se verifica; `install_update` solo se
 *   llama con un archivo de texto que no es el descargado, para ver que se niega.
 *
 * La copia arranca sin elevar: sus ajustes son los de fábrica. Así el puerto de depuración, que
 * no tiene autenticación, vive en un proceso sin privilegios y solo mientras dura la prueba.
 */


import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  Cdp,
  DATOS,
  EXE,
  TECLA,
  TRABAJO,
  WEBVIEW,
  cerrarArbol,
  dormir,
  esperar,
  exigir,
  hijos,
  info,
  lanzar,
  lanzarServidor,
  limpiar,
  prepararBinario,
  teclasReales,
  ventanasDe,
  vivo,
} from "./envivo.mjs";

const REPO = "xfiberex/ProcessDevKill";

/** Un solo campo inválido: basta para que la app no pueda leer el archivo (T12-12). */
const AJUSTES_ILEGIBLES = '{ "customNames": ["docker"], "protected": ["mi-api"], "refreshMs": "rapido" }';

const sinCompilar = process.argv.includes("--sin-compilar");

// ── Salida ──────────────────────────────────────────────────────────────────

const fallos = [];
const omitidos = [];
let hechos = 0;

/** Lo que un paso lanza cuando no ha podido comprobar nada, y no por culpa de la app. */
class Omitido extends Error {}

/**
 * En un runner de GitHub, un 403 de su API no es un fallo de la app: es la cuota sin autenticar,
 * que se reparte entre todo lo que sale por la misma IP. Visto en la primera ejecución de
 * `en-marcha.yml` (T13-03): 22 comprobaciones bien y las dos que consultan la API, con 403.
 *
 * **Solo en el runner** (`GITHUB_ACTIONS`). En el equipo de quien corta, un 403 sigue siendo un
 * fallo: ahí la cuota es suya, y que GitHub se niegue es justo lo que hay que saber antes de
 * publicar. La app no puede llevar un token para evitarlo, así que aquí tampoco se usa.
 */
function omitirSiEsLaCuota(error) {
  if (process.env.GITHUB_ACTIONS && /\b403\b/.test(String(error))) {
    throw new Omitido(`GitHub contestó 403 al runner (cuota compartida): ${error}`);
  }
}

/** Una comprobación con nombre. Si falla se anota y se sigue: interesa ver todas las que fallan. */
async function paso(nombre, fn) {
  try {
    const detalle = await fn();
    hechos++;
    console.log(`[OK] ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  } catch (e) {
    if (e instanceof Omitido) {
      omitidos.push(nombre);
      console.log(`[!] ${nombre}\n      sin comprobar: ${e.message}`);
      return;
    }
    fallos.push(nombre);
    console.log(`[X] ${nombre}\n      ${String(e?.message ?? e).split("\n").join("\n      ")}`);
  }
}

// ── Las comprobaciones ──────────────────────────────────────────────────────

/** El proceso elevado de los servicios, por su línea de comandos. Ninguna llega al SCM. */
async function entradaDelProcesoElevado() {
  const salida = (args) => spawnSync(EXE, args, { windowsHide: true, timeout: 20_000 }).status;

  await paso("La entrada del proceso elevado rechaza lo que no entiende o no vigila", () => {
    const casos = [
      [["--service-action"], 1, "sin verbo"],
      [["--service-action", "delete", "MySQL80"], 1, "un verbo que no existe"],
      [["--service-action", "stop", "MySQL80", "de-mas"], 1, "un argumento de más"],
      [["--service-action", "stop", "Spooler"], 2, "un servicio que no se vigila"],
      [["--service-action", "startup", "MySQL80", "boot"], 5, "un tipo de arranque que la app no pone"],
    ];
    for (const [args, esperado, que] of casos) {
      const codigo = salida(args);
      exigir(codigo === esperado, `${que}: salió con ${codigo}, se esperaba ${esperado}`);
    }
    return `${casos.length} líneas de comandos, cada una con su código de salida`;
  });
}

/**
 * El gancho de pánico, con un pánico de verdad dentro de la app arrancada (T12-14, T13-06).
 *
 * Arranca la copia aparte, con `PDK_ENVIVO_PANICO`, y la cierra: el resto de la prueba corre en
 * otro arranque, sin esa variable. El pánico es en un hilo propio, que es el caso que el gancho
 * vino a cubrir: un hilo que muere —el poller— y deja la app en pie y la lista congelada sin que
 * nada lo diga.
 */
async function panicoEnElLog() {
  await paso("Un pánico en un hilo deja su línea en el log, y la app sigue en pie", async () => {
    for (const dir of [DATOS, WEBVIEW]) fs.rmSync(dir, { recursive: true, force: true });
    const app = lanzar(EXE, [], {
      cwd: path.dirname(EXE),
      env: { ...process.env, PDK_ENVIVO_PANICO: "1" },
    });
    try {
      const log = path.join(DATOS, "processdevkill.log");
      const linea = await esperar(
        () => {
          try {
            return fs.readFileSync(log, "utf8").split(/\r?\n/).find((l) => l.includes("PANICO"));
          } catch {
            return null;
          }
        },
        { ms: 30_000 },
      );
      exigir(linea, "el log no tiene ninguna línea de pánico: ¿se compiló con --features envivo?");
      exigir(linea.includes("«pdk-envivo-panico»"), `la línea no nombra el hilo: ${linea}`);
      exigir(linea.includes("provocado por la prueba en marcha"), `no trae el mensaje: ${linea}`);
      exigir(/logging\.rs:\d+/.test(linea), `no dice dónde ocurrió: ${linea}`);
      await dormir(1_000);
      exigir(vivo(app), "el pánico de un hilo tumbó la app entera");
      return linea.replace(/^\[[^\]]*\]\s*/, "");
    } finally {
      cerrarArbol(app);
      await esperar(() => !vivo(app), { ms: 5_000 });
      // WebView2 tarda un momento en soltar su carpeta, y `main` la borra justo después.
      await dormir(1_500);
    }
  });
}

async function arranque(cdp) {
  await paso("La ventana carga y pinta la vista de Procesos", async () => {
    const titulo = await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent`));
    exigir(titulo === "Procesos", `el título de la vista es «${titulo}», no «Procesos»`);
    const version = await cdp.invoke("plugin:app|version");
    exigir(version.ok, `la ventana no pudo preguntar la versión: ${version.error}`);
    return `v${version.valor}`;
  });

  await paso("Unos ajustes ilegibles no impiden arrancar, y se conservan aparte", async () => {
    const ajustes = await cdp.invoke("get_settings");
    exigir(ajustes.ok, ajustes.error);
    exigir(
      ajustes.valor.customNames.length === 0 && ajustes.valor.refreshMs === 2000,
      "con el archivo ilegible tenían que cargarse los ajustes de fábrica",
    );
    const copias = fs.readdirSync(DATOS).filter((f) => f.startsWith("settings.json.ilegible-"));
    // Una y no dos: al arrancar el archivo se lee dos veces antes de que nada lo reescriba.
    exigir(copias.length === 1, `tenía que quedar una copia del original, y hay ${copias.length}`);
    const copia = fs.readFileSync(path.join(DATOS, copias[0]), "utf8");
    exigir(copia === AJUSTES_ILEGIBLES, "la copia no es el archivo tal como estaba");
    const log = fs.readFileSync(path.join(DATOS, "processdevkill.log"), "utf8");
    exigir(log.includes("corrupto"), "el log no dice que el archivo estaba corrupto");
    return copias[0];
  });

  await paso("La ventana no tiene los permisos que se le quitaron", async () => {
    const aviso = await cdp.invoke("plugin:notification|notify", { options: { title: "x" } });
    exigir(!aviso.ok, "la ventana pudo mandar una notificación, y no debería tener ese permiso");
    exigir(/not allowed/i.test(aviso.error), `se negó, pero no por permisos: ${aviso.error}`);
  });
}

async function listaYCierre(cdp) {
  const servidor = await lanzarServidor("pdk-envivo-app");

  await paso("La lista enseña un proceso con su script, su carpeta y su puerto", async () => {
    const fila = await esperar(async () => {
      const lista = await cdp.invoke("get_processes");
      return lista.ok && lista.valor.find((p) => p.pid === servidor.pid && p.ports.length > 0);
    });
    exigir(fila, `el node lanzado (PID ${servidor.pid}) no salió en la lista con su puerto`);
    // T12-10: con `node -r ./pre.js app.js`, el script es `app.js` y no el valor de `-r`.
    exigir(fila.script === "app.js", `el script sale como «${fila.script}», no «app.js»`);
    exigir(fila.project === servidor.carpeta, `la carpeta sale como «${fila.project}»`);
    exigir(fila.ports.includes(servidor.puerto), `no sale el puerto ${servidor.puerto}: ${fila.ports}`);
    exigir(!fila.protected, "el proceso sale protegido sin que nadie lo haya protegido");
    exigir(!("startTime" in fila), "la hora de arranque no tiene que viajar a la ventana");
    return `PID ${fila.pid}, ${fila.script}, puerto ${servidor.puerto}`;
  });

  await paso("La fila se ve en la tabla de la ventana", async () => {
    await cdp.pulsar("Procesos");
    const visto = await esperar(() =>
      cdp.js(`Boolean(document.querySelector('[aria-label="Seleccionar PID ${servidor.pid}"]'))`),
    );
    exigir(visto, "la fila del proceso lanzado no aparece en la tabla");
    const texto = await cdp.js(
      `document.querySelector('[aria-label="Seleccionar PID ${servidor.pid}"]').closest("tr").textContent`,
    );
    exigir(texto.includes("app.js"), `la fila no enseña el script: ${texto}`);
  });

  const ajeno = lanzar("cmd.exe", ["/c", "ping", "-n", "120", "127.0.0.1"]);

  await paso("Kill no cierra un proceso que no se vigila, aunque se le mande su PID", async () => {
    await dormir(500);
    const r = await cdp.invoke("kill_processes", { pids: [ajeno.pid] });
    exigir(r.ok, r.error);
    exigir(r.valor[0].killed === false, "se cerró un cmd.exe, que no es un proceso vigilado");
    exigir(/no es un proceso de desarrollo vigilado/.test(r.valor[0].error ?? ""), r.valor[0].error);
    await dormir(300);
    exigir(vivo(ajeno), "Rust dijo que no, pero el proceso murió igual");
    return r.valor[0].error;
  });
  ajeno.kill();

  await paso("Kill cierra el proceso pedido y dice qué puerto liberó", async () => {
    const r = await cdp.invoke("kill_processes", { pids: [servidor.pid] });
    exigir(r.ok, r.error);
    const [resultado] = r.valor;
    exigir(resultado.killed, `no se cerró: ${resultado.error}`);
    exigir(
      resultado.freedPorts.includes(servidor.puerto),
      `no dice que liberó el ${servidor.puerto}: ${resultado.freedPorts}`,
    );
    const muerto = await esperar(() => !vivo(servidor.hijo), { ms: 5_000 });
    exigir(muerto, "Rust dijo que lo cerró, pero el proceso sigue vivo");
    return `puerto ${servidor.puerto} liberado`;
  });

  await paso("Un Kill repetido sobre el mismo PID dice que ya no existe", async () => {
    const r = await cdp.invoke("kill_processes", { pids: [servidor.pid] });
    exigir(r.ok, r.error);
    exigir(r.valor[0].killed === false, "dijo haber cerrado un proceso que ya estaba muerto");
    exigir(/ya no existe/.test(r.valor[0].error ?? ""), `el motivo es otro: ${r.valor[0].error}`);
  });

  await paso("El cierre queda en el Historial, y la vista lo enseña", async () => {
    const historial = await cdp.invoke("get_history");
    exigir(historial.ok, historial.error);
    const [ultima] = historial.valor;
    exigir(ultima?.pid === servidor.pid, "la última entrada del historial no es el cierre de antes");
    exigir(ultima.source === "window", `el origen es «${ultima.source}», no la ventana`);
    exigir(ultima.freedPorts.includes(servidor.puerto), "la entrada no guarda el puerto liberado");

    await cdp.pulsar("Historial");
    const texto = await esperar(async () => {
      const t = await cdp.js(`document.querySelector("main").textContent`);
      return t.includes(String(servidor.puerto)) && t;
    });
    exigir(texto, "la vista de Historial no enseña el puerto liberado");
  });
}

/** Deja la ventana en Procesos con los filtros de runtime desplegados, venga de donde venga. */
async function irAProcesosConFiltros(cdp) {
  const titulo = await cdp.js(`document.querySelector("main h2")?.textContent`);
  if (titulo !== "Procesos") await cdp.pulsar("Procesos", `document.querySelector("aside")`);
  // Ya en Procesos, el mismo botón pliega y despliega los filtros, y `listaYCierre` lo pulsa
  // estando ahí: los deja plegados. Se despliegan si hace falta, mirando su `aria-expanded`.
  const plegados = await esperar(() =>
    cdp.js(`(() => {
      const b = document.querySelector("aside button[aria-expanded]");
      return b ? b.getAttribute("aria-expanded") : null;
    })()`),
  );
  if (plegados === "false") await cdp.pulsar("Procesos", `document.querySelector("aside")`);
}

/**
 * El ajuste «mostrar siempre todos los runtimes» (v1.10.1), pulsando su interruptor de verdad.
 *
 * Qué runtimes están vacíos depende del equipo —alguien puede tener un Python abierto—, así que
 * se pregunta a Rust qué hay y se mira que, apagado, **esos** no salgan y, encendido, salgan los
 * siete. Deja el ajuste como estaba: apagado.
 */
async function filtrosDelSidebar(cdp) {
  const NOMBRES = { node: "Node.js", python: "Python", dotnet: ".NET", java: "Java", deno: "Deno", bun: "Bun", other: "Otros" };
  const filtrosVistos = () =>
    cdp.js(`[...document.querySelectorAll("#filtros-runtime button")].map((b) => b.textContent.trim())`);
  const pulsarAjuste = async (encendido) => {
    await cdp.pulsar("Ajustes", `document.querySelector("aside")`);
    const interruptor = await esperar(() => cdp.js(`Boolean(document.getElementById("show-all-filters"))`));
    exigir(interruptor, "Ajustes no tiene el interruptor de los filtros del sidebar");
    await cdp.js(`document.getElementById("show-all-filters").click()`);
    const guardado = await esperar(async () => {
      const a = await cdp.invoke("get_settings");
      return a.ok && a.valor.showAllFilters === encendido;
    });
    exigir(guardado, `el ajuste no se guardó como ${encendido}`);
    await irAProcesosConFiltros(cdp);
  };

  await paso("Los filtros del sidebar se pueden enseñar todos, y volver a solo los que tienen procesos", async () => {
    const lista = await cdp.invoke("get_processes");
    exigir(lista.ok, lista.error);
    const vacios = Object.keys(NOMBRES).filter((r) => !lista.valor.some((p) => p.runtime === r));
    exigir(vacios.length > 0, "no hay ningún runtime vacío en este equipo: no se puede ver la diferencia");

    await irAProcesosConFiltros(cdp);
    const deFabrica = await filtrosVistos();
    for (const r of vacios) {
      exigir(!deFabrica.some((f) => f.startsWith(NOMBRES[r])), `de fábrica sale «${NOMBRES[r]}», que está vacío`);
    }

    await pulsarAjuste(true);
    try {
      const todos = await esperar(async () => {
        const f = await filtrosVistos();
        return Object.values(NOMBRES).every((n) => f.some((x) => x.startsWith(n))) && f;
      });
      exigir(todos, `encendido no salen los siete: ${JSON.stringify(await filtrosVistos())}`);
      for (const r of vacios) {
        exigir(todos.includes(`${NOMBRES[r]}0`), `«${NOMBRES[r]}» no sale con su recuento a cero: ${todos}`);
      }
    } finally {
      await pulsarAjuste(false);
    }
    const alApagar = await esperar(async () => {
      const f = await filtrosVistos();
      return vacios.every((r) => !f.some((x) => x.startsWith(NOMBRES[r]))) && f;
    });
    exigir(alApagar, `apagado siguen saliendo los vacíos: ${JSON.stringify(await filtrosVistos())}`);
    return `vacíos aquí: ${vacios.map((r) => NOMBRES[r]).join(", ")}; de ${deFabrica.length} filtros a ${1 + Object.keys(NOMBRES).length} y vuelta`;
  });
}

/**
 * Java, Deno y Bun, vigilados de fábrica (T13-01): que salgan con su runtime, en su filtro del
 * sidebar, y que Kill los cierre.
 *
 * Son copias de `PING.EXE` con esos nombres, como en las pruebas de Rust: así no depende de que el
 * equipo los tenga, y ningún Java del usuario puede entrar en lo que se cierra —se manda cerrar
 * por PID, y solo los tres de aquí—. **Lo que no se ve así es la descripción de la fila**: `PING`
 * no acepta los argumentos de Java, Deno ni Bun, así que la clase principal o el script de cada
 * uno solo lo prueban las de `processes.rs` (`de_java_sale_la_clase_principal_o_el_jar` y las de
 * al lado).
 */
async function runtimesNuevos(cdp) {
  const ping = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "PING.EXE");
  const lanzados = ["java", "deno", "bun"].map((runtime) => {
    const dir = path.join(TRABAJO, `pdk-envivo-${runtime}`);
    fs.mkdirSync(dir, { recursive: true });
    const exe = path.join(dir, `${runtime}.exe`);
    fs.copyFileSync(ping, exe);
    const hijo = lanzar(exe, ["-n", "120", "127.0.0.1"], { cwd: dir });
    return { runtime, hijo, pid: hijo.pid };
  });

  try {
    await paso("Java, Deno y Bun salen en la lista, cada uno con su runtime", async () => {
      const filas = await esperar(async () => {
        const lista = await cdp.invoke("get_processes");
        if (!lista.ok) return null;
        const vistas = lanzados.map((l) => lista.valor.find((p) => p.pid === l.pid));
        return vistas.every(Boolean) && vistas;
      });
      exigir(filas, "alguno de los tres no salió en la lista");
      for (const [i, { runtime }] of lanzados.entries()) {
        exigir(filas[i].runtime === runtime, `${filas[i].name} sale como «${filas[i].runtime}»`);
      }
      return filas.map((f) => `${f.name} → ${f.runtime}`).join(", ");
    });

    await paso("Cada uno tiene su filtro en el sidebar, y el filtro enseña su fila", async () => {
      await irAProcesosConFiltros(cdp);
      const filtros = { java: "Java", deno: "Deno", bun: "Bun" };
      for (const { runtime, pid } of lanzados) {
        const filtro = await esperar(() =>
          cdp.js(`[...document.querySelectorAll("aside button")]
            .some((b) => b.textContent.trim().startsWith(${JSON.stringify(filtros[runtime])}))`),
        );
        const aside = filtro || (await cdp.js(`document.querySelector("aside").innerText`));
        exigir(filtro, `no hay filtro «${filtros[runtime]}» en el sidebar: ${JSON.stringify(aside)}`);
        await cdp.pulsar(filtros[runtime], `document.querySelector("aside")`);
        const fila = await esperar(() =>
          cdp.js(`Boolean(document.querySelector('[aria-label="Seleccionar PID ${pid}"]'))`),
        );
        exigir(fila, `con el filtro «${filtros[runtime]}» no se ve la fila del PID ${pid}`);
      }
      await cdp.pulsar("Todos", `document.querySelector("aside")`);
    });

    await paso("Kill cierra los tres", async () => {
      const r = await cdp.invoke("kill_processes", { pids: lanzados.map((l) => l.pid) });
      exigir(r.ok, r.error);
      const fallidos = r.valor.filter((o) => !o.killed);
      exigir(fallidos.length === 0, fallidos.map((o) => `${o.name}: ${o.error}`).join("; "));
      const muertos = await esperar(() => lanzados.every((l) => !vivo(l.hijo)), { ms: 5_000 });
      exigir(muertos, "Rust dijo que los cerró, pero alguno sigue vivo");
    });
  } finally {
    for (const { hijo } of lanzados) hijo.kill();
  }
}

async function vistasEIdioma(cdp) {
  await paso("Las cuatro vistas se pintan, cada una con su título", async () => {
    const vistas = [
      ["Servicios", "Servicios de desarrollo"],
      ["Historial", "Historial"],
      ["Ajustes", "Ajustes"],
      ["Procesos", "Procesos"],
    ];
    for (const [boton, titulo] of vistas) {
      await cdp.pulsar(boton, `document.querySelector("aside") ?? document`);
      const visto = await esperar(async () => {
        const t = await cdp.js(`document.querySelector("main h2")?.textContent`);
        return t === titulo && t;
      });
      exigir(visto, `al pulsar «${boton}» la vista no pasó a titularse «${titulo}»`);
    }
  });

  await paso("Servicios se leen sin privilegios", async () => {
    const t0 = Date.now();
    const servicios = await cdp.invoke("get_services");
    exigir(servicios.ok, servicios.error);
    exigir(Array.isArray(servicios.valor), "get_services no devolvió una lista");
    return `${servicios.valor.length} servicios de desarrollo en ${Date.now() - t0} ms`;
  });

  await paso("Cambiar de idioma cambia la ventana entera, y se guarda", async () => {
    await cdp.pulsar("Ajustes", `document.querySelector("aside") ?? document`);
    await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Ajustes"`));

    await cdp.pulsar("English", `document.querySelector("main")`);
    const ingles = await esperar(() =>
      cdp.js(
        `document.documentElement.lang === "en" && document.querySelector("main h2")?.textContent === "Settings"`,
      ),
    );
    exigir(ingles, "tras elegir English, la ventana no pasó a inglés");

    // Guardar reescribe el archivo ilegible del arranque: ahora tiene que ser JSON válido.
    const guardado = JSON.parse(fs.readFileSync(path.join(DATOS, "settings.json"), "utf8"));
    exigir(guardado.language === "en", "el idioma no llegó a settings.json");

    // Y los errores de Rust salen en el idioma de la app (T12-05).
    const r = await cdp.invoke("kill_processes", { pids: [4_000_000_001] });
    exigir(/no longer exists/.test(r.valor?.[0]?.error ?? ""), `el error no salió en inglés: ${JSON.stringify(r)}`);

    // El Historial, en inglés: el recuento (T12-35) y la hora exacta del `title`, que seguía a la
    // configuración de Windows y no a la app (T12-39). Hay una entrada: el cierre de antes.
    await cdp.pulsar("History", `document.querySelector("aside") ?? document`);
    const historial = await esperar(() =>
      cdp.js(`(() => {
        const hora = document.querySelector("main time");
        if (!hora) return null;
        const cuando = new Date(hora.dateTime);
        const delEquipo = navigator.languages.find((l) => l === "en" || l.startsWith("en-"));
        return {
          titulo: hora.title,
          enIngles: cuando.toLocaleString(delEquipo ?? "en"),
          comoWindows: cuando.toLocaleString(),
          relativa: hora.textContent,
          texto: document.querySelector("main").textContent,
          equipo: navigator.language,
        };
      })()`),
    );
    exigir(historial, "la vista de History no enseña ninguna hora");
    exigir(
      historial.titulo === historial.enIngles,
      `la hora exacta sale como «${historial.titulo}», y en inglés es «${historial.enIngles}»`,
    );
    exigir(/ago|now/.test(historial.relativa), `la hora relativa no está en inglés: ${historial.relativa}`);
    exigir(historial.texto.includes("1 closed process"), "el recuento no dice «1 closed process»");
    const distinta = historial.comoWindows !== historial.enIngles;

    await cdp.pulsar("Settings", `document.querySelector("aside") ?? document`);
    await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Settings"`));
    await cdp.pulsar("Español", `document.querySelector("main")`);
    const vuelta = await esperar(() => cdp.js(`document.documentElement.lang === "es"`));
    exigir(vuelta, "la ventana no volvió al español");
    return distinta
      ? `en inglés, la hora exacta es «${historial.titulo}», con Windows en ${historial.equipo}`
      : `Windows está en ${historial.equipo}: la hora exacta habría salido igual sin el arreglo`;
  });
}

/**
 * La consulta a GitHub del arranque se puede apagar (T12-31).
 *
 * Quien lanza esa consulta es la ventana, al montarse, y Rust solo consulta dentro del comando
 * `check_update`. Así que recargar la ventana es volver a arrancarla, y contar ese comando es
 * contar las consultas. Con el ajuste encendido tiene que salir una: es lo que prueba que el
 * recuento ve algo, y que el cero de antes no es ceguera.
 */
async function consultaDelArranque(cdp) {
  const actuales = await cdp.invoke("get_settings");
  const guardar = (encendido) =>
    cdp.invoke("save_settings", { settings: { ...actuales.valor, checkUpdatesOnStart: encendido } });

  /** Recarga, espera a que la ventana esté arrancada del todo y dice cuántas veces consultó. */
  async function consultasAlArrancar() {
    const pedidos = await cdp.recargar();
    const arrancada = await esperar(
      () => pedidos().includes("get_settings") && pedidos().includes("get_processes"),
      { ms: 15_000 },
    );
    exigir(arrancada, `la ventana no volvió a arrancar tras recargar: pidió ${pedidos().join(", ")}`);
    await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Procesos"`));
    // La consulta sale en cuanto llegan los ajustes; tres segundos es de sobra para verla.
    await dormir(3_000);
    return pedidos().filter((c) => c === "check_update").length;
  }

  await paso("Con la búsqueda del arranque apagada, la app no consulta a GitHub al arrancar", async () => {
    exigir(actuales.ok, actuales.error);
    exigir(actuales.valor.checkUpdatesOnStart === true, "de fábrica tenía que venir encendida");

    exigir((await guardar(false)).ok, "no se pudo apagar el ajuste");
    const apagada = await consultasAlArrancar();
    exigir(apagada === 0, `con el ajuste apagado la ventana consultó ${apagada} vez o veces`);

    // Y el botón sigue buscando: apagar el arranque no apaga el actualizador.
    await cdp.pulsar("Ajustes", `document.querySelector("aside") ?? document`);
    const interruptor = await esperar(() =>
      cdp.js(`(() => {
        const rotulo = document.querySelector('label[for="check-updates"]');
        const el = document.getElementById("check-updates");
        if (!rotulo || !el) return null;
        const sw = el.matches('[role="switch"]')
          ? el
          : rotulo.parentElement.querySelector('[role="switch"]');
        return sw?.getAttribute("aria-checked") ?? "sin-estado: " + rotulo.parentElement.innerHTML.slice(0, 400);
      })()`),
    );
    exigir(interruptor === "false", `el interruptor de Ajustes sale como «${interruptor}»`);
    const antes = cdp.comandos.length;
    await cdp.pulsar("Buscar actualizaciones", `document.querySelector("main")`);
    const buscada = await esperar(() => cdp.comandos.slice(antes).includes("check_update"));
    exigir(buscada, "con el ajuste apagado, el botón de buscar no consultó");

    exigir((await guardar(true)).ok, "no se pudo volver a encender el ajuste");
    const encendida = await consultasAlArrancar();
    exigir(encendida === 1, `con el ajuste encendido tenía que consultar una vez, y fueron ${encendida}`);
    return "apagada, 0 consultas; el botón, 1; encendida, 1";
  });
}

async function protegidos(cdp) {
  const carpeta = "pdk-envivo-protegido";
  const actuales = await cdp.invoke("get_settings");

  await paso("Un proceso protegido no se cierra, y sin la protección sí", async () => {
    exigir(actuales.ok, actuales.error);
    const guardar = (lista) =>
      cdp.invoke("save_settings", { settings: { ...actuales.valor, protected: lista } });

    exigir((await guardar([carpeta])).ok, "no se pudo guardar la lista de protegidos");
    const servidor = await lanzarServidor(carpeta);
    try {
      const fila = await esperar(async () => {
        const lista = await cdp.invoke("get_processes");
        return lista.ok && lista.valor.find((p) => p.pid === servidor.pid && p.project);
      });
      exigir(fila, "el proceso protegido no salió en la lista");
      exigir(fila.protected, "la lista no lo marca como protegido");

      const negado = await cdp.invoke("kill_processes", { pids: [servidor.pid] });
      exigir(negado.valor?.[0]?.killed === false, "se cerró un proceso protegido");
      exigir(/protegido/.test(negado.valor[0].error ?? ""), negado.valor[0].error);
      await dormir(300);
      exigir(vivo(servidor.hijo), "Rust dijo que no, pero el proceso protegido murió");

      exigir((await guardar([])).ok, "no se pudo quitar la protección");
      // La lista que la ventana tiene delante es la de antes de guardar: se vuelve a pedir.
      await cdp.invoke("get_processes");
      const cerrado = await cdp.invoke("kill_processes", { pids: [servidor.pid] });
      exigir(cerrado.valor?.[0]?.killed, `sin protección tenía que cerrarse: ${cerrado.valor?.[0]?.error}`);
    } finally {
      servidor.hijo.kill();
    }
  });

  // T12-08, visto en la ventana (T13-06): «protegido» solo se dice cuando de verdad se ha
  // guardado. Es el único paso que usa el ratón de verdad —clic derecho sobre la fila y luego su
  // menú—, porque lo que se prueba es lo que la ventana le dice a quien lo pulsa.
  await paso("Si el guardado falla, la ventana no dice «protegido» y el proceso no lo queda", async () => {
    const proyecto = "pdk-envivo-sin-guardar";
    const servidor = await lanzarServidor(proyecto);
    // Rust escribe en `settings.json.tmp` y luego renombra. Con una **carpeta** de ese nombre,
    // escribir falla siempre, sin tocar permisos ni dejar un archivo a medias.
    const estorbo = path.join(DATOS, "settings.json.tmp");
    try {
      if ((await cdp.js(`document.querySelector("main h2")?.textContent`)) !== "Procesos") {
        await cdp.pulsar("Procesos", `document.querySelector("aside")`);
      }
      const casilla = `[aria-label="Seleccionar PID ${servidor.pid}"]`;
      exigir(
        await esperar(() => cdp.js(`Boolean(document.querySelector('${casilla}'))`)),
        "la fila del proceso lanzado no aparece en la tabla",
      );

      fs.mkdirSync(estorbo);
      const punto = await cdp.js(`(() => {
        const fila = document.querySelector('${casilla}').closest("tr");
        fila.scrollIntoView({ block: "center" });
        const r = fila.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 3), y: Math.round(r.top + r.height / 2) };
      })()`);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await cdp.enviar("Input.dispatchMouseEvent", { type, ...punto, button: "right", clickCount: 1 });
      }
      const pulsado = await esperar(() =>
        cdp.js(`(() => {
          const item = [...document.querySelectorAll('[role="menuitem"]')]
            .find((e) => e.textContent.trim().startsWith("Proteger"));
          if (!item) return null;
          item.click();
          return item.textContent.trim();
        })()`),
      );
      exigir(pulsado, "el clic derecho sobre la fila no abrió un menú con «Proteger»");

      const avisos = () =>
        cdp.js(`[...document.querySelectorAll("[data-sonner-toast]")].map((e) => e.textContent)`);
      const conError = await esperar(async () => {
        const vistos = await avisos();
        return vistos.some((a) => a.includes("No se pudo guardar")) && vistos;
      });
      exigir(conError, `no salió el aviso de que no se pudo guardar: ${JSON.stringify(await avisos())}`);
      // El de éxito llegaba **antes** que el error: se mira después de haber visto el error.
      await dormir(500);
      const todos = await avisos();
      exigir(!todos.some((a) => /protegido$/.test(a.trim())), `sale «protegido»: ${JSON.stringify(todos)}`);

      const guardados = await cdp.invoke("get_settings");
      exigir(!guardados.valor.protected.includes(proyecto), "la protección llegó a guardarse");
      const lista = await cdp.invoke("get_processes");
      exigir(!lista.valor.find((p) => p.pid === servidor.pid)?.protected, "la lista lo marca como protegido");
      return `«${pulsado}» → ${conError.find((a) => a.includes("No se pudo guardar")).slice(0, 60)}…`;
    } finally {
      fs.rmSync(estorbo, { recursive: true, force: true });
      servidor.hijo.kill();
      // El puntero se quedó sobre la tabla, y eso congela el orden de las filas: se saca.
      await cdp.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    }
  });
}

/**
 * T14-02: la ventana no se comporta como una página.
 *
 * Son las dos cosas del guion que no pasan por CDP, porque lo que se prueba vive fuera de la
 * página: el menú de clic derecho del navegador es **una ventana de Windows**, y F5 es un atajo
 * que el navegador atiende antes de que la página lo vea. Para lo primero se cuentan las ventanas
 * de la copia; para lo segundo se pulsan teclas de verdad (`teclasReales`, que solo pulsa con la
 * ventana de la copia delante).
 */
async function ventanaDeEscritorio(cdp, app) {
  const clicDerecho = async (punto) => {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await cdp.enviar("Input.dispatchMouseEvent", { type, ...punto, button: "right", clickCount: 1 });
    }
  };
  const centroDe = (selector) =>
    cdp.js(`(() => {
      const e = ${selector};
      if (!e) return null;
      e.scrollIntoView({ block: "center" });
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
  /** Las ventanas de la copia que no estaban en `antes`. El menú tarda un instante en pintarse. */
  const nuevas = async (antes) => {
    await dormir(700);
    return ventanasDe(app).filter((v) => !antes.some((a) => a.hwnd === v.hwnd));
  };
  /** Cierra un menú del navegador que se haya quedado abierto, para no arrastrarlo al paso siguiente. */
  const cerrarMenu = async (antes) => {
    teclasReales(app, [TECLA.ESC]);
    return (await nuevas(antes)).length === 0;
  };
  const irA = async (vista) => {
    await cdp.pulsar(vista, `document.querySelector("aside")`);
    await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === ${JSON.stringify(vista)}`));
  };

  await paso("El clic derecho no saca el menú del navegador, salvo en un campo de texto", async () => {
    await irAProcesosConFiltros(cdp);
    const antes = ventanasDe(app);
    exigir(antes.length > 0, "la copia no tiene ninguna ventana visible");

    const sitios = [
      ["el sidebar", () => centroDe(`document.querySelector("aside h1")`)],
      ["la cabecera", () => centroDe(`document.querySelector("main h2")`)],
      [
        "el cuerpo de Ajustes",
        async () => {
          await irA("Ajustes");
          return centroDe(`document.querySelector("main p")`);
        },
      ],
      [
        "un diálogo",
        async () => {
          await irA("Historial");
          await cdp.pulsar("Vaciar", `document.querySelector("main")`);
          exigir(
            await esperar(() => cdp.js(`Boolean(document.querySelector('[role="alertdialog"]'))`)),
            "«Vaciar» no abrió el diálogo de confirmación",
          );
          return centroDe(`document.querySelector('[role="alertdialog"] h2')`);
        },
      ],
    ];

    try {
      for (const [nombre, punto] of sitios) {
        const donde = await punto();
        exigir(donde, `no se encontró dónde pulsar en ${nombre}`);
        await clicDerecho(donde);
        const salidas = await nuevas(antes);
        if (salidas.length > 0) await cerrarMenu(antes);
        exigir(
          salidas.length === 0,
          `en ${nombre} salió una ventana: ${salidas.map((v) => `${v.clase} ${v.ancho}×${v.alto}`).join(", ")}`,
        );
      }
    } finally {
      // El diálogo se cierra sin confirmar: el historial de la copia se queda como estaba.
      await cdp.js(`(() => {
        const d = document.querySelector('[role="alertdialog"]');
        [...(d?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === "Cancelar")?.click();
      })()`);
      await esperar(() => cdp.js(`!document.querySelector('[role="alertdialog"]')`));
    }

    // Y donde sí tiene que salir. Es también lo que da valor a lo de arriba: si aquí no se viera
    // ninguna ventana nueva, esta forma de mirar no vería el menú en ningún sitio.
    await irA("Procesos");
    const buscador = await centroDe(`document.querySelector("main header input")`);
    exigir(buscador, "la cabecera de Procesos no tiene buscador");
    await clicDerecho(buscador);
    const menu = await nuevas(antes);
    const cerrado = menu.length === 0 || (await cerrarMenu(antes));
    exigir(
      menu.length > 0,
      "en el buscador no salió ningún menú: o se cancela también ahí, o esta comprobación no lo ve",
    );
    return `cuatro sitios sin menú; en el buscador, ${menu[0].clase} ${menu[0].ancho}×${menu[0].alto}${cerrado ? "" : " (se quedó abierto)"}`;
  });

  await paso("F5 y Ctrl+R de verdad refrescan la lista, y no recargan la ventana", async () => {
    const servidor = await lanzarServidor("pdk-envivo-f5");
    const BUSQUEDA = "pdk-envivo-f5";
    const lista = () => cdp.js(`document.querySelector("main h2")?.textContent === "Procesos"`).catch(() => false);
    try {
      await irAProcesosConFiltros(cdp);

      // Primero, el control: con el oyente de la app tapado, F5 **tiene** que recargar. Si no lo
      // hace, la tecla no está llegando al WebView y lo de después no probaría nada.
      await cdp.js(`(() => {
        window.__pdkMarca = true;
        window.addEventListener("keydown", (e) => e.stopImmediatePropagation(), true);
      })()`);
      const control = teclasReales(app, [TECLA.F5]);
      if (!control.ok) throw new Omitido(control.motivo);
      const recargada = await esperar(() => cdp.js(`window.__pdkMarca !== true`).catch(() => false), { ms: 6_000 });
      if (!recargada) {
        throw new Omitido("ni con el oyente de la app tapado recarga F5: la tecla no llega al WebView");
      }
      exigir(await esperar(lista, { ms: 15_000 }), "la ventana no volvió a pintarse tras la recarga del control");
      await irAProcesosConFiltros(cdp);

      // Ahora, la app tal cual: una búsqueda y un filtro puestos, y una marca que una recarga borraría.
      const casilla = `[aria-label="Seleccionar PID ${servidor.pid}"]`;
      exigir(
        await esperar(() => cdp.js(`Boolean(document.querySelector('${casilla}'))`)),
        "la fila del proceso lanzado no aparece en la tabla",
      );
      await cdp.pulsar("Node.js", `document.getElementById("filtros-runtime")`);
      await cdp.js(`(() => {
        const campo = document.querySelector("main header input");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, ${JSON.stringify(BUSQUEDA)});
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        campo.focus();
        window.__pdkMarca = true;
      })()`);
      const estado = () =>
        cdp.js(`({
          marca: window.__pdkMarca === true,
          busqueda: document.querySelector("main header input")?.value,
          filtro: [...document.querySelectorAll('#filtros-runtime [aria-pressed="true"]')].map((b) => b.textContent.trim()).join(),
          filas: document.querySelectorAll("main tbody tr").length,
        })`);
      const antes = await estado();
      exigir(antes.busqueda === BUSQUEDA && antes.filtro.startsWith("Node.js"), `no se pudo preparar: ${JSON.stringify(antes)}`);

      for (const [nombre, teclas] of [["F5", [TECLA.F5]], ["Ctrl+R", [TECLA.CTRL, TECLA.R]]]) {
        const desde = cdp.comandos.length;
        const pulsada = teclasReales(app, teclas);
        if (!pulsada.ok) throw new Omitido(pulsada.motivo);
        const pedida = await esperar(() => cdp.comandos.slice(desde).includes("get_processes"), { ms: 5_000 });
        // Una recarga tarda más que el refresco: se le da tiempo a ocurrir antes de mirar la marca.
        await dormir(1_500);
        const despues = await estado().catch((e) => ({ error: String(e) }));
        exigir(despues.marca, `${nombre} recargó la ventana: ${JSON.stringify(despues)}`);
        exigir(pedida, `${nombre} no pidió la lista a Rust`);
        exigir(
          despues.busqueda === BUSQUEDA && despues.filtro === antes.filtro,
          `${nombre} cambió la búsqueda o el filtro: ${JSON.stringify(despues)}`,
        );
      }
      return `la búsqueda «${BUSQUEDA}» y el filtro ${antes.filtro.split(/\d/)[0]} siguen puestos; el control sí recargó`;
    } finally {
      servidor.hijo.kill();
      // Pase lo que pase, la tabla vuelve a enseñarlo todo: los pasos de detrás buscan sus filas.
      await esperar(lista, { ms: 15_000 });
      await cdp
        .js(`(() => {
          const campo = document.querySelector("main header input");
          if (campo) {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, "");
            campo.dispatchEvent(new Event("input", { bubbles: true }));
          }
          [...document.querySelectorAll("#filtros-runtime button")].find((b) => b.textContent.trim().startsWith("Todos"))?.click();
        })()`)
        .catch(() => {});
    }
  });
}

/**
 * T14-15: un aviso de error espera a que lo cierren; uno de éxito se va solo.
 *
 * El error se provoca como en `protegidos`: una carpeta donde Rust quiere escribir el archivo
 * temporal de los ajustes. El de éxito es el cierre de un servidor del guion, con su botón Kill.
 */
async function avisosDeError(cdp) {
  const avisos = () =>
    cdp.js(`[...document.querySelectorAll("[data-sonner-toast]")].map((e) => ({
      texto: e.textContent,
      cerrar: e.querySelector("[data-close-button]")?.getAttribute("aria-label") ?? null,
    }))`);
  const conTexto = (texto) => async () => (await avisos()).find((a) => a.texto.includes(texto));

  await paso("Un aviso de error se queda hasta que se cierra, y su botón tiene nombre", async () => {
    const estorbo = path.join(DATOS, "settings.json.tmp");
    try {
      await cdp.pulsar("Ajustes", `document.querySelector("aside")`);
      exigir(
        await esperar(() => cdp.js(`Boolean(document.getElementById("show-all-filters"))`)),
        "Ajustes no tiene el interruptor de los filtros del sidebar",
      );
      fs.mkdirSync(estorbo);
      await cdp.js(`document.getElementById("show-all-filters").click()`);

      const error = await esperar(conTexto("No se pudieron guardar los ajustes"));
      exigir(error, `no salió el aviso del guardado fallido: ${JSON.stringify(await avisos())}`);
      exigir(error.cerrar === "Cerrar aviso", `el botón de cerrar se llama «${error.cerrar}»`);
      const region = await cdp.js(`document.querySelector("section[aria-label]")?.getAttribute("aria-label")`);
      exigir(/^Avisos\b/.test(region ?? ""), `la región de los avisos se llama «${region}»`);

      // Se iba a los 4,3 s. A los 15 tiene que seguir: es lo que dice el criterio de la tarea.
      await dormir(15_000);
      exigir(await conTexto("No se pudieron guardar los ajustes")(), "a los 15 s el aviso de error ya no está");

      await cdp.js(`(() => {
        const aviso = [...document.querySelectorAll("[data-sonner-toast]")]
          .find((e) => e.textContent.includes("No se pudieron guardar los ajustes"));
        aviso.querySelector("[data-close-button]").click();
      })()`);
      const cerrado = await esperar(async () => !(await conTexto("No se pudieron guardar los ajustes")()));
      exigir(cerrado, "el aviso sigue ahí después de pulsar su botón de cerrar");

      const guardados = await cdp.invoke("get_settings");
      exigir(guardados.valor.showAllFilters === false, "el ajuste llegó a guardarse");
      return `«${region}» · «${error.cerrar}» · sigue a los 15 s y se va con su botón`;
    } finally {
      fs.rmSync(estorbo, { recursive: true, force: true });
    }
  });

  await paso("Un aviso de éxito se va solo", async () => {
    const servidor = await lanzarServidor("pdk-envivo-aviso");
    try {
      await cdp.pulsar("Procesos", `document.querySelector("aside")`);
      const boton = `button[aria-label^="Kill "][aria-label$=", PID ${servidor.pid}"]`;
      exigir(
        await esperar(() => cdp.js(`Boolean(document.querySelector('${boton}'))`)),
        "la fila del proceso lanzado no aparece en la tabla",
      );
      // Kill sobre un proceso que lanzó este guion: es lo único que se cierra desde la ventana.
      await cdp.js(`document.querySelector('${boton}').click()`);
      const exito = await esperar(conTexto("cerrado"));
      exigir(exito, `no salió el aviso del cierre: ${JSON.stringify(await avisos())}`);
      const ido = await esperar(async () => !(await conTexto("cerrado")()), { ms: 10_000 });
      exigir(ido, "a los 10 s el aviso de éxito sigue en la ventana");
      return exito.texto.trim().slice(0, 60);
    } finally {
      servidor.hijo.kill();
      await cdp.enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
    }
  });
}

async function actualizador(cdp) {
  let nueva = null;

  await paso("Buscar actualizaciones consulta GitHub sin error", async () => {
    const r = await cdp.invoke("check_update");
    if (!r.ok) omitirSiEsLaCuota(r.error);
    exigir(r.ok, r.error);
    nueva = r.valor;
    return nueva ? `hay una versión más nueva: ${nueva.tag}` : "la app está al día";
  });

  // Solo cuando la copia es más vieja que lo publicado, que pasa justo después de un corte y con
  // `--sin-compilar`: la versión de la copia sale de `Cargo.toml`, y recién compilada está al día.
  // Es la única ocasión de ver las notas de un release dentro de la ventana (T12-36).
  if (nueva) {
    // T14-12. El aviso sale al arrancar, así que se recarga la ventana para verlo salir.
    await paso("El aviso de versión nueva lleva a «Descargar e instalar», y «Ajustes» queda marcado", async () => {
      const pedidos = await cdp.recargar();
      exigir(
        await esperar(() => pedidos().includes("check_update"), { ms: 15_000 }),
        "al arrancar, la ventana no consultó si había versión nueva",
      );
      const aviso = await esperar(() =>
        cdp.js(`(() => {
          const aviso = [...document.querySelectorAll("[data-sonner-toast]")]
            .find((e) => e.textContent.includes("disponible"));
          const boton = aviso?.querySelector("[data-action]");
          if (!boton) return null;
          boton.click();
          return aviso.textContent.trim();
        })()`),
      );
      exigir(aviso, "no salió el aviso de versión nueva con su botón");

      exigir(
        await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Ajustes"`)),
        "el botón del aviso no llevó a Ajustes",
      );
      await dormir(500);
      const visto = await cdp.js(`(() => {
        const boton = [...document.querySelectorAll("main button")]
          .find((b) => b.textContent.trim().startsWith("Descargar e instalar"));
        if (!boton) return null;
        const r = boton.getBoundingClientRect();
        return {
          dentro: r.top >= 0 && r.bottom <= innerHeight,
          arriba: Math.round(r.top),
          alto: innerHeight,
          foco: document.activeElement?.textContent ?? null,
        };
      })()`);
      exigir(visto, "Ajustes no enseña «Descargar e instalar»");
      exigir(visto.dentro, `«Descargar e instalar» queda fuera: a ${visto.arriba} px en una ventana de ${visto.alto}`);
      exigir(visto.foco === "Actualizaciones", `el foco está en «${visto.foco}», no en el título del grupo`);

      await cdp.pulsar("Historial", `document.querySelector("aside")`);
      const marca = await cdp.js(`(() => {
        const boton = [...document.querySelectorAll("aside nav > button")]
          .find((b) => b.textContent.trim().startsWith("Ajustes"));
        return { punto: Boolean(boton?.querySelector('[data-slot="marca"]')), nombre: boton?.textContent.trim() };
      })()`);
      exigir(marca.punto, "en otra vista, «Ajustes» no lleva la marca de versión nueva");
      exigir(marca.nombre.includes("hay una versión nueva"), `el botón se lee «${marca.nombre}»`);
      return `«Descargar e instalar» a ${visto.arriba} px de ${visto.alto}; el botón se lee «${marca.nombre}»`;
    });

    await paso("Ajustes enseña las novedades de la versión nueva, sin marcas de Markdown", async () => {
      await cdp.pulsar("Ajustes", `document.querySelector("aside") ?? document`);
      await esperar(() => cdp.js(`document.querySelector("main h2")?.textContent === "Ajustes"`));
      await cdp.pulsar("Buscar actualizaciones", `document.querySelector("main")`);

      const notas = await esperar(() =>
        cdp.js(`(() => {
          const caja = document.querySelector('[role="region"][aria-label="Novedades de la versión"]');
          if (!caja) return null;
          return {
            texto: caja.textContent,
            titulos: [...caja.querySelectorAll("h4")].map((h) => h.textContent),
            elementos: caja.querySelectorAll("li").length,
            enfocable: caja.tabIndex === 0,
          };
        })()`),
      );
      exigir(notas, "no aparecieron las novedades tras buscar actualizaciones");
      const version = await cdp.js(`document.querySelector("main").textContent.includes("${nueva.tag}")`);
      exigir(version, `Ajustes no nombra la versión ${nueva.tag}`);
      exigir(notas.titulos.length > 0, "las notas no tienen ningún título");
      exigir(notas.elementos > 0, "las notas no tienen ningún elemento de lista");
      exigir(!/[#*`<|]/.test(notas.texto), `quedan marcas a la vista: ${notas.texto.slice(0, 200)}`);
      exigir(
        !/SmartScreen|setup\.exe|Get-FileHash/.test(notas.texto),
        "sale la tabla de descarga, que dentro de la app no hace falta",
      );
      exigir(notas.enfocable, "la caja tiene scroll y no se puede enfocar con el teclado");
      exigir(!/\bEnglish\b/.test(notas.texto), "en español sale la mitad inglesa de las notas");

      // Desde la v1.10.0 el release trae también las notas en inglés (T13-04): con la app en
      // inglés tiene que salir esa mitad y no la española. Uno anterior no las trae, y entonces
      // no hay nada que mirar aquí: que caiga al español lo prueba `notas.test.ts`.
      if (!/^#{1,6}\s+English\s*$/m.test(nueva.notes ?? "")) {
        return `${notas.titulos.join(" · ")} — ${notas.elementos} elementos; sin notas en inglés`;
      }
      await cdp.pulsar("English", `document.querySelector("main")`);
      try {
        const enIngles = await esperar(() =>
          cdp.js(`(() => {
            const caja = document.querySelector('[role="region"][aria-label="What\\'s new in this version"]');
            return caja ? { texto: caja.textContent, titulos: [...caja.querySelectorAll("h4")].map((h) => h.textContent) } : null;
          })()`),
        );
        exigir(enIngles, "con la app en inglés no aparecieron las novedades");
        exigir(enIngles.texto !== notas.texto, "con la app en inglés salen las mismas notas que en español");
        exigir(
          !enIngles.titulos.some((t) => notas.titulos.includes(t)),
          `en inglés sale un título de la mitad española: ${enIngles.titulos.join(" · ")}`,
        );
        exigir(!/[#*`<|]/.test(enIngles.texto), `quedan marcas a la vista: ${enIngles.texto.slice(0, 200)}`);
        return `${notas.titulos.join(" · ")} — en inglés: ${enIngles.titulos.join(" · ")}`;
      } finally {
        // Pase lo que pase, la app vuelve al español: los pasos de detrás buscan sus textos.
        await cdp.pulsar("Español", `document.querySelector("main")`);
        await esperar(() => cdp.js(`document.documentElement.lang === "es"`));
      }
    });
  }

  let descargado = null;

  await paso("El instalador publicado se descarga y coincide con su .sha256", async () => {
    const respuesta = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "ProcessDevKill-prueba-en-marcha" },
    });
    if (!respuesta.ok) omitirSiEsLaCuota(respuesta.status);
    exigir(respuesta.ok, `la API de GitHub contestó ${respuesta.status}`);
    const publicado = await respuesta.json();
    const instalador = publicado.assets.find((a) => a.name.endsWith("_x64-setup.exe"));
    const suma = publicado.assets.find((a) => a.name.endsWith("_x64-setup.exe.sha256"));
    exigir(instalador && suma, "el último release no tiene el instalador o su .sha256");

    const r = await cdp.invoke("download_update", {
      release: {
        tag: publicado.tag_name,
        version: publicado.tag_name.replace(/^v/i, ""),
        notes: publicado.body ?? "",
        htmlUrl: publicado.html_url,
        assetUrl: instalador.browser_download_url,
        assetName: instalador.name,
        assetSize: instalador.size,
        checksumUrl: suma.browser_download_url,
      },
    });
    exigir(r.ok, `la descarga falló: ${r.error}`);
    descargado = r.valor;
    exigir(fs.existsSync(descargado), `Rust devolvió ${descargado}, y ese archivo no existe`);

    // Rust ya lo comprobó; aquí se vuelve a comprobar desde fuera, con otro código.
    const real = createHash("sha256").update(fs.readFileSync(descargado)).digest("hex");
    const esperado = (await (await fetch(suma.browser_download_url)).text()).trim().split(/\s+/)[0];
    exigir(real === esperado.toLowerCase(), `el hash no coincide: ${real} frente a ${esperado}`);
    return `${publicado.tag_name}, ${instalador.size} bytes, ${real.slice(0, 8)}…`;
  });

  await paso("No se instala nada que no sea exactamente lo descargado", async () => {
    // Un archivo que existe pero no es el descargado, y que además no es un programa: si la
    // guardia fallara, Windows no tendría nada que ejecutar.
    const intrusa = path.join(TRABAJO, "otro-setup.exe");
    fs.writeFileSync(intrusa, "esto no es un instalador");
    const r = await cdp.invoke("install_update", { path: intrusa });
    exigir(!r.ok, "install_update aceptó un archivo que no es el de la descarga");
    return r.error;
  });

  // T12-02, la mitad que faltaba ver (T13-05): el instalador **verificado**, cambiado entre la
  // descarga y la instalación. Es lo que haría un programa sin privilegios mientras el usuario
  // tarda en pulsar «Instalar». Se cambia por un texto y no por otro programa: si la guardia
  // fallara, Windows no tendría nada que ejecutar. Va el último de los que usan la descarga.
  await paso("Un instalador cambiado después de descargarlo no se instala, y se borra", async () => {
    if (!descargado) throw new Omitido("no hay descarga que cambiar: el paso de la descarga no la dejó");
    fs.writeFileSync(descargado, "esto ya no es el instalador que se verificó");
    const r = await cdp.invoke("install_update", { path: descargado });
    exigir(!r.ok, "install_update aceptó un instalador cambiado después de verificarlo");
    exigir(/cambió después de descargarlo/.test(r.error), `se negó, pero por otro motivo: ${r.error}`);
    exigir(!fs.existsSync(descargado), "se negó a instalarlo, pero el archivo cambiado sigue ahí");
    // Que la app no se cerró para instalar lo dice el último paso: «La app sigue en marcha».
    return r.error;
  });

  await paso("La descarga de una dirección que no es de GitHub se rechaza antes de pedir nada", async () => {
    const r = await cdp.invoke("download_update", {
      release: {
        tag: "v9.9.9",
        version: "9.9.9",
        notes: "",
        htmlUrl: "https://example.com",
        assetUrl: "https://example.com/setup.exe",
        assetName: "setup.exe",
        assetSize: 1,
        checksumUrl: "https://example.com/setup.exe.sha256",
      },
    });
    exigir(!r.ok, "se aceptó una descarga que no viene de github.com");
    return r.error;
  });
}

// ── El guion ────────────────────────────────────────────────────────────────

async function main() {
  const puertoCdp = await prepararBinario(sinCompilar);

  await panicoEnElLog();

  // La carpeta de datos de la copia, de cero, con unos ajustes que no se pueden leer.
  for (const dir of [DATOS, WEBVIEW]) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(path.join(DATOS, "settings.json"), AJUSTES_ILEGIBLES);

  await entradaDelProcesoElevado();

  info("Arrancando la copia de prueba...");
  const app = lanzar(EXE, [], { cwd: path.dirname(EXE) });
  const cdp = await Cdp.conectar(puertoCdp);

  try {
    await arranque(cdp);
    await listaYCierre(cdp);
    await vistasEIdioma(cdp);
    await protegidos(cdp);
    // Después de `vistasEIdioma`, que cuenta un solo cierre en el Historial: este añade tres.
    await runtimesNuevos(cdp);
    await filtrosDelSidebar(cdp);
    await ventanaDeEscritorio(cdp, app);
    await avisosDeError(cdp);
    await consultaDelArranque(cdp);
    await actualizador(cdp);

    await paso("La ventana no ha dado ningún error de JavaScript en toda la prueba", () => {
      exigir(cdp.errores.length === 0, cdp.errores.join("\n"));
    });
    await paso("La app sigue en marcha al terminar", () => {
      exigir(vivo(app), "la app se cerró sola durante la prueba");
    });
  } finally {
    cdp.cerrar();
  }
}

let codigo = 0;
try {
  await main();
} catch (e) {
  fallos.push("la preparación");
  console.log(`[X] ${e?.message ?? e}`);
} finally {
  for (const hijo of hijos) cerrarArbol(hijo);
  // WebView2 tarda un momento en soltar su carpeta después de morir el proceso que la abrió.
  await dormir(1_500);
  try {
    limpiar();
  } catch (e) {
    console.log(`[!] No se pudo borrar alguna carpeta de la prueba: ${e.message}`);
  }
}

console.log("");
if (fallos.length > 0) {
  console.log(`[X] Pruebas en marcha: ${fallos.length} con fallo, ${hechos} bien.`);
  codigo = 1;
} else if (omitidos.length > 0) {
  console.log(`[OK] Pruebas en marcha: ${hechos} comprobaciones pasan y ${omitidos.length} quedan sin comprobar.`);
} else {
  console.log(`[OK] Pruebas en marcha: las ${hechos} comprobaciones pasan.`);
}
process.exit(codigo);
