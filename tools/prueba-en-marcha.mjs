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

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IDENTIFICADOR = "com.processdevkill.app.envivo";
const DATOS = path.join(process.env.APPDATA ?? "", IDENTIFICADOR);
const WEBVIEW = path.join(process.env.LOCALAPPDATA ?? "", IDENTIFICADOR);
const TARGET = path.join(RAIZ, "src-tauri", "target", "envivo");
const EXE = path.join(TARGET, "release", "processdevkill.exe");
const TRABAJO = path.join(os.tmpdir(), `pdk-envivo-${process.pid}`);
const REPO = "xfiberex/ProcessDevKill";

/** Un solo campo inválido: basta para que la app no pueda leer el archivo (T12-12). */
const AJUSTES_ILEGIBLES = '{ "customNames": ["docker"], "protected": ["mi-api"], "refreshMs": "rapido" }';

const sinCompilar = process.argv.includes("--sin-compilar");

// ── Salida ──────────────────────────────────────────────────────────────────

const fallos = [];
let hechos = 0;

const info = (m) => console.log(`==> ${m}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lanza si la condición no se cumple. El mensaje dice qué se esperaba, no qué se hizo. */
function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

/** Una comprobación con nombre. Si falla se anota y se sigue: interesa ver todas las que fallan. */
async function paso(nombre, fn) {
  try {
    const detalle = await fn();
    hechos++;
    console.log(`[OK] ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  } catch (e) {
    fallos.push(nombre);
    console.log(`[X] ${nombre}\n      ${String(e?.message ?? e).split("\n").join("\n      ")}`);
  }
}

/** Repite `fn` hasta que devuelva algo, o se acabe el plazo. */
async function esperar(fn, { ms = 10_000, cada = 200 } = {}) {
  const hasta = Date.now() + ms;
  for (;;) {
    const valor = await fn();
    if (valor) return valor;
    if (Date.now() > hasta) return null;
    await dormir(cada);
  }
}

// ── Lo que este guion lanza, para poder cerrarlo pase lo que pase ───────────

const hijos = new Set();

function lanzar(comando, args, opciones = {}) {
  const hijo = spawn(comando, args, { stdio: "ignore", windowsHide: true, ...opciones });
  hijos.add(hijo);
  hijo.on("exit", () => hijos.delete(hijo));
  return hijo;
}

const vivo = (hijo) => hijo.exitCode === null && hijo.signalCode === null;

/** Un puerto libre. Con `preferido`, ese si se puede; si está ocupado, el que dé el sistema. */
function puertoLibre(preferido = 0) {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    servidor.on("error", (e) => {
      if (preferido !== 0) puertoLibre().then(resolve, reject);
      else reject(e);
    });
    servidor.listen(preferido, "127.0.0.1", () => {
      const { port } = servidor.address();
      servidor.close(() => resolve(port));
    });
  });
}

/** Un `node` de verdad, en su carpeta, escuchando en un puerto: lo que la app existe para ver. */
async function lanzarServidor(carpeta) {
  const dir = path.join(TRABAJO, carpeta);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "pre.js"), "// cargado con -r\n");
  fs.writeFileSync(
    path.join(dir, "app.js"),
    "require('net').createServer().listen(Number(process.argv[2]), '127.0.0.1');\n",
  );
  const puerto = await puertoLibre();
  // Con `-r`: es el caso de T12-10, donde el valor de la opción se tomaba por el script.
  const hijo = lanzar(process.execPath, ["-r", "./pre.js", "app.js", String(puerto)], { cwd: dir });
  return { hijo, pid: hijo.pid, puerto, carpeta };
}

// ── CDP ─────────────────────────────────────────────────────────────────────

class Cdp {
  #ws;
  #id = 0;
  #pendientes = new Map();
  /** Excepciones de JavaScript y errores de consola vistos durante toda la sesión. */
  errores = [];

  static async conectar(puerto) {
    const pagina = await esperar(
      async () => {
        try {
          const lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json();
          return lista.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        } catch {
          return null;
        }
      },
      { ms: 30_000, cada: 300 },
    );
    exigir(pagina, `la ventana no abrió su puerto de depuración (${puerto}) en 30 s`);

    const cdp = new Cdp();
    await new Promise((resolve, reject) => {
      cdp.#ws = new WebSocket(pagina.webSocketDebuggerUrl);
      cdp.#ws.addEventListener("open", resolve);
      cdp.#ws.addEventListener("error", () => reject(new Error("no se pudo conectar por CDP")));
      cdp.#ws.addEventListener("message", (m) => cdp.#recibir(JSON.parse(m.data)));
    });
    await cdp.enviar("Runtime.enable");
    await cdp.enviar("Log.enable");
    return cdp;
  }

  #recibir(mensaje) {
    if (mensaje.id) {
      const pendiente = this.#pendientes.get(mensaje.id);
      this.#pendientes.delete(mensaje.id);
      if (mensaje.error) pendiente?.reject(new Error(mensaje.error.message));
      else pendiente?.resolve(mensaje.result);
    } else if (mensaje.method === "Runtime.exceptionThrown") {
      const d = mensaje.params.exceptionDetails;
      this.errores.push(d.exception?.description ?? d.text);
    } else if (mensaje.method === "Log.entryAdded" && mensaje.params.entry.level === "error") {
      this.errores.push(mensaje.params.entry.text);
    }
  }

  enviar(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pendientes.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evalúa una expresión en la ventana y devuelve su valor. Las promesas se esperan. */
  async js(expresion) {
    const r = await this.enviar("Runtime.evaluate", {
      expression: expresion,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  }

  /**
   * Llama a un comando de Rust por el mismo camino que la ventana.
   *
   * Devuelve `{ ok, valor }` o `{ ok: false, error }` en vez de lanzar: la mitad de lo que se
   * comprueba aquí es que Rust **se niegue**, y un rechazo es un resultado, no un accidente.
   */
  invoke(comando, args = {}) {
    return this.js(
      `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(comando)}, ${JSON.stringify(args)})
         .then((valor) => ({ ok: true, valor }), (error) => ({ ok: false, error: String(error) }))`,
    );
  }

  /** Pulsa el botón cuyo texto empieza por `texto`, dentro de `dentro`. */
  async pulsar(texto, dentro = "document") {
    const pulsado = await this.js(`(() => {
      const boton = [...(${dentro}).querySelectorAll("button")]
        .find((b) => b.textContent.trim().startsWith(${JSON.stringify(texto)}));
      boton?.click();
      return Boolean(boton);
    })()`);
    exigir(pulsado, `no hay ningún botón «${texto}» en la ventana`);
  }

  cerrar() {
    this.#ws?.close();
  }
}

// ── Preparación ─────────────────────────────────────────────────────────────

function compilar(puertoCdp) {
  const conf = JSON.parse(fs.readFileSync(path.join(RAIZ, "src-tauri", "tauri.conf.json"), "utf8"));
  const cambios = {
    identifier: IDENTIFICADOR,
    app: {
      // Un `--config` no mezcla listas, las sustituye: la ventana va entera, con lo suyo más el
      // puerto. La variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` no sirve: Tauri la pisa.
      windows: [
        { ...conf.app.windows[0], additionalBrowserArgs: `--remote-debugging-port=${puertoCdp}` },
      ],
    },
  };
  const archivo = path.join(TRABAJO, "tauri.envivo.json");
  fs.writeFileSync(archivo, JSON.stringify(cambios));

  info("Compilando el binario de prueba (identificador propio, en target/envivo)...");
  const r = spawnSync(
    process.execPath,
    [
      path.join(RAIZ, "node_modules", "@tauri-apps", "cli", "tauri.js"),
      "build",
      "--no-bundle",
      "--config",
      archivo,
    ],
    { cwd: RAIZ, stdio: "inherit", env: { ...process.env, CARGO_TARGET_DIR: TARGET } },
  );
  exigir(r.status === 0, "la compilación del binario de prueba falló");
}

/** El puerto con el que se compiló el binario, para repetirlo la próxima vez. */
const MARCA_PUERTO = path.join(TARGET, "puerto-cdp.txt");

function limpiar() {
  for (const dir of [DATOS, WEBVIEW, TRABAJO]) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
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

    await cdp.pulsar("Español", `document.querySelector("main")`);
    const vuelta = await esperar(() => cdp.js(`document.documentElement.lang === "es"`));
    exigir(vuelta, "la ventana no volvió al español");
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
}

async function actualizador(cdp) {
  await paso("Buscar actualizaciones consulta GitHub sin error", async () => {
    const r = await cdp.invoke("check_update");
    exigir(r.ok, r.error);
    return r.valor ? `hay una versión más nueva: ${r.valor.tag}` : "la app está al día";
  });

  let descargado = null;

  await paso("El instalador publicado se descarga y coincide con su .sha256", async () => {
    const respuesta = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "ProcessDevKill-prueba-en-marcha" },
    });
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
  exigir(process.platform === "win32", "ProcessDevKill es solo de Windows");
  exigir(typeof WebSocket === "function", "hace falta Node 22 o posterior (WebSocket global)");
  fs.mkdirSync(TRABAJO, { recursive: true });

  // El puerto va **dentro del binario**, así que cambiarlo obliga a recompilar. Se repite el de la
  // vez anterior mientras siga libre: con el código sin tocar, la compilación no tiene nada que
  // hacer y la prueba entera baja de minutos a segundos.
  const anterior = fs.existsSync(MARCA_PUERTO) ? Number(fs.readFileSync(MARCA_PUERTO, "utf8")) : 0;
  let puertoCdp;
  if (sinCompilar && fs.existsSync(EXE) && anterior) {
    puertoCdp = anterior;
    info(`Reutilizando el binario de prueba (puerto ${puertoCdp}).`);
  } else {
    puertoCdp = await puertoLibre(anterior);
    compilar(puertoCdp);
    fs.writeFileSync(MARCA_PUERTO, String(puertoCdp));
  }

  // La carpeta de datos de la copia, de cero, con unos ajustes que no se pueden leer.
  for (const dir of [DATOS, WEBVIEW]) fs.rmSync(dir, { recursive: true, force: true });
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
  for (const hijo of hijos) hijo.kill();
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
} else {
  console.log(`[OK] Pruebas en marcha: las ${hechos} comprobaciones pasan.`);
}
process.exit(codigo);
