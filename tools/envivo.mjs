/**
 * Lo que comparten los guiones que conducen la app en marcha: la copia de prueba, la conexión por
 * CDP y los procesos que cada guion lanza para tener algo suyo que mirar.
 *
 * Salió de `prueba-en-marcha.mjs` el 2026-10-05, al llegar `auditoria-ui.mjs` (T14-01): los dos
 * arrancan la misma copia y la conducen igual, y dos copias de trescientas líneas se habrían
 * separado a la primera corrección. Aquí no hay ninguna comprobación: solo cómo se llega a la app.
 *
 * ## Lo que NO toca, y cómo se asegura
 *
 * - **Ni los ajustes ni el historial del usuario, ni su app abierta.** El binario se compila con
 *   otro identificador (`IDENTIFICADOR`), y de él salen la carpeta de datos, la de WebView2 y el
 *   candado de instancia única. La copia tiene los suyos, y `limpiar` los borra al acabar.
 * - **Ni `tauri.conf.json`.** El identificador y el puerto de depuración entran por `--config`, en
 *   un archivo temporal.
 * - **Ni el binario que se publica.** Se compila en `target/envivo`, no en `target/release`.
 * - **Ningún proceso del usuario.** `lanzar` apunta en `hijos` todo lo que arranca, y lo único que
 *   un guion puede cerrar por su cuenta es eso.
 *
 * Los dos guiones usan la misma carpeta de datos: **no se lanzan a la vez**.
 *
 * Sin línea `#!`: este archivo se importa, y en el runner de Windows llega con finales CRLF (ver
 * `avisos-de-terceros.mjs`).
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const IDENTIFICADOR = "com.processdevkill.app.envivo";
export const DATOS = path.join(process.env.APPDATA ?? "", IDENTIFICADOR);
export const WEBVIEW = path.join(process.env.LOCALAPPDATA ?? "", IDENTIFICADOR);
export const TARGET = path.join(RAIZ, "src-tauri", "target", "envivo");
export const EXE = path.join(TARGET, "release", "processdevkill.exe");
export const TRABAJO = path.join(os.tmpdir(), `pdk-envivo-${process.pid}`);

// ── Salida y esperas ────────────────────────────────────────────────────────

export const info = (m) => console.log(`==> ${m}`);
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lanza si la condición no se cumple. El mensaje dice qué se esperaba, no qué se hizo. */
export function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

/** Repite `fn` hasta que devuelva algo, o se acabe el plazo. */
export async function esperar(fn, { ms = 10_000, cada = 200 } = {}) {
  const hasta = Date.now() + ms;
  for (;;) {
    const valor = await fn();
    if (valor) return valor;
    if (Date.now() > hasta) return null;
    await dormir(cada);
  }
}

// ── Lo que este guion lanza, para poder cerrarlo pase lo que pase ───────────

export const hijos = new Set();

export function lanzar(comando, args, opciones = {}) {
  const hijo = spawn(comando, args, { stdio: "ignore", windowsHide: true, ...opciones });
  hijos.add(hijo);
  hijo.on("exit", () => hijos.delete(hijo));
  return hijo;
}

export const vivo = (hijo) => hijo.exitCode === null && hijo.signalCode === null;

/**
 * Cierra un proceso lanzado por el guion **con todo lo que cuelga de él**.
 *
 * Para la copia de la app, `hijo.kill()` no basta: mata el `processdevkill.exe` y deja a sus
 * procesos de WebView2 cerrándose por su cuenta. Si la app llevaba un par de segundos abierta
 * —el paso del pánico la cierra en cuanto lee el log—, WebView2 todavía estaba arrancando y tarda
 * mucho más en soltar su carpeta de lo que el borrado espera: `EPERM` al borrarla, y la prueba
 * entera caída en la preparación. Pasó el 2026-10-05 en un equipo donde nunca había pasado.
 *
 * `taskkill /T` recorre el árbol por el PID del padre, así que solo alcanza a lo que este proceso
 * lanzó: nada del usuario cuelga de un hijo del guion.
 */
export function cerrarArbol(hijo) {
  if (!vivo(hijo)) return;
  const r = spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { windowsHide: true });
  if (r.status !== 0) hijo.kill();
}

// ── Lo que CDP no alcanza: las ventanas de Windows y las teclas de verdad ───

function ventanaReal(hijo, accion, extra = []) {
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(RAIZ, "tools", "ventana-real.ps1"),
      "-IdProceso", String(hijo.pid), "-Accion", accion, ...extra],
    { windowsHide: true, encoding: "utf8" },
  );
  exigir(r.status === 0, `ventana-real.ps1 falló: ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
}

/**
 * Las ventanas visibles de la copia y de sus procesos de WebView2.
 *
 * El menú de clic derecho del navegador no está en el DOM: es una ventana de Windows aparte
 * (`Chrome_WidgetWin_1`). Contarlas antes y después es la forma de saber si ha salido (T14-02).
 */
export const ventanasDe = (hijo) => ventanaReal(hijo, "ventanas");

export const TECLA = { ESC: 0x1b, CTRL: 0x11, R: 0x52, F5: 0x74 };

/**
 * Pulsa una combinación con teclas de verdad (`keybd_event`), con la ventana de la copia delante.
 *
 * Un atajo del navegador —F5, Ctrl+R— no se dispara con `Input.dispatchKeyEvent` de CDP: ese evento
 * entra ya dentro de la página. **Una tecla real va a quien tenga el foco**, así que el script
 * comprueba antes de cada pulsación que la ventana de delante es la de la copia; si no lo es, no
 * pulsa y esto devuelve `{ ok: false, motivo }`. Quien llama lo deja «sin comprobar», no lo
 * reintenta: si Windows no cede el foco es que el usuario está escribiendo en otra cosa.
 */
export const teclasReales = (hijo, codigos) =>
  ventanaReal(hijo, "teclas", ["-Teclas", codigos.join(",")]);

/** Un puerto libre. Con `preferido`, ese si se puede; si está ocupado, el que dé el sistema. */
export function puertoLibre(preferido = 0) {
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
export async function lanzarServidor(carpeta) {
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

/**
 * Una copia de `PING.EXE` con otro nombre, en su carpeta: un proceso con el nombre de un runtime
 * sin depender de que el equipo lo tenga, y sin que ninguno del usuario pueda confundirse con él.
 * Es el mismo truco que `lanzar_disfrazado` en las pruebas de Rust.
 */
export function lanzarDisfrazado(nombre, carpeta = `pdk-envivo-${nombre}`) {
  const ping = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "PING.EXE");
  const dir = path.join(TRABAJO, carpeta);
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, `${nombre}.exe`);
  fs.copyFileSync(ping, exe);
  const hijo = lanzar(exe, ["-n", "600", "127.0.0.1"], { cwd: dir });
  return { nombre, hijo, pid: hijo.pid, carpeta };
}

// ── CDP ─────────────────────────────────────────────────────────────────────

export class Cdp {
  #ws;
  #id = 0;
  #pendientes = new Map();
  /** Excepciones de JavaScript y errores de consola vistos durante toda la sesión. */
  errores = [];
  /** Los comandos de Rust que la ventana ha pedido, en orden. Ver `recargar`. */
  comandos = [];

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
    await cdp.enviar("Network.enable");
    await cdp.enviar("Page.enable");
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
    } else if (mensaje.method === "Network.requestWillBeSent") {
      // El IPC de Tauri viaja como una petición a `ipc.localhost/<comando>`: se ve desde fuera,
      // sin inyectar nada en la página.
      const url = new URL(mensaje.params.request.url);
      if (url.hostname === "ipc.localhost") this.comandos.push(decodeURIComponent(url.pathname.slice(1)));
    }
  }

  /** Recarga la ventana y devuelve cómo leer los comandos que pide al volver a arrancar. */
  async recargar() {
    const desde = this.comandos.length;
    await this.enviar("Page.reload");
    return () => this.comandos.slice(desde);
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

export function compilar(puertoCdp) {
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
      // El disparador del pánico de prueba (`logging::panico_de_prueba`). Los instaladores se
      // compilan sin esta feature: el binario publicado no lo lleva.
      "--features",
      "envivo",
    ],
    { cwd: RAIZ, stdio: "inherit", env: { ...process.env, CARGO_TARGET_DIR: TARGET } },
  );
  exigir(r.status === 0, "la compilación del binario de prueba falló");
}

/** El puerto con el que se compiló el binario, para repetirlo la próxima vez. */
export const MARCA_PUERTO = path.join(TARGET, "puerto-cdp.txt");

export function limpiar() {
  for (const dir of [DATOS, WEBVIEW, TRABAJO]) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

/**
 * Deja el binario de prueba listo y dice en qué puerto escucha su depuración.
 *
 * El puerto va **dentro del binario**, así que cambiarlo obliga a recompilar. Se repite el de la
 * vez anterior mientras siga libre: con el código sin tocar, la compilación no tiene nada que
 * hacer y el guion entero baja de minutos a segundos.
 */
export async function prepararBinario(sinCompilar) {
  exigir(process.platform === "win32", "ProcessDevKill es solo de Windows");
  exigir(typeof WebSocket === "function", "hace falta Node 22 o posterior (WebSocket global)");
  fs.mkdirSync(TRABAJO, { recursive: true });

  const anterior = fs.existsSync(MARCA_PUERTO) ? Number(fs.readFileSync(MARCA_PUERTO, "utf8")) : 0;
  if (sinCompilar && fs.existsSync(EXE) && anterior) {
    info(`Reutilizando el binario de prueba (puerto ${anterior}).`);
    return anterior;
  }
  const puertoCdp = await puertoLibre(anterior);
  compilar(puertoCdp);
  fs.writeFileSync(MARCA_PUERTO, String(puertoCdp));
  return puertoCdp;
}
