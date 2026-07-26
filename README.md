<div align="center">

# ProcessDevKill

**"El puerto 3000 está ocupado y no sé por quién."**

Gestor de procesos de desarrollo para Windows: lista los `node`, `python` y `dotnet` activos
con su CPU, su RAM y **el puerto local que ocupa cada uno**, y los cierra de uno en uno o en lote.

[![Última versión](https://img.shields.io/github/v/release/xfiberex/ProcessDevKill?label=descarga&color=22c55e)](https://github.com/xfiberex/ProcessDevKill/releases/latest)
[![Licencia](https://img.shields.io/badge/licencia-GPL--3.0-blue)](LICENSE)
[![Windows 10 y 11](https://img.shields.io/badge/Windows-10%20%C2%B7%2011-0078D4)](#descarga-e-instalación)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB)](https://tauri.app)

![Lista de procesos de desarrollo con su CPU, su RAM y su puerto](docs/screenshots/procesos-oscuro.png)

</div>

## El problema

Un `npm run dev` que sobrevivió al cierre de la terminal, y al día siguiente:

```
Error: listen EADDRINUSE: address already in use :::3000
```

La ruta larga es `netstat -ano | findstr :3000`, apuntar el PID, `taskkill /PID 12345 /F` y cruzar
los dedos por no haberte equivocado de número. El Administrador de tareas tampoco ayuda: enseña
veinte `node.exe` idénticos y no dice cuál escucha en el 3000.

ProcessDevKill enseña esa tabla ya hecha, con el puerto en su columna, y pone un botón al lado.

## Qué hace

- Lista **Node, Python y .NET** —más los ejecutables que añadas— con CPU, RAM, tiempo activo y los
  puertos TCP en escucha de cada proceso.
- Busca por nombre, PID **o número de puerto**: escribe `3000` y te queda la fila que lo ocupa.
- Cierra procesos de uno en uno, por selección múltiple o de golpe con **Nuke All**, siempre con
  confirmación.
- **Menú contextual** en cada fila: matar, o copiar el PID, el nombre, el puerto o
  `http://localhost:PUERTO`.
- **Icono en la bandeja** con acciones rápidas y atajo global <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>K</kbd>
  (desactivable) que cierra todo lo vigilado sin abrir la ventana.
- **Auto-Kill** (opcional, apagado de fábrica): cierra solo los procesos que pasen de un umbral de
  RAM, avisa por notificación y lo registra. Para fugas de memoria y watchers desbocados.
- **Zombie Finder** (opcional, apagado de fábrica): resalta los procesos que llevan minutos sin
  consumir CPU **y siguen ocupando un puerto** — el servidor de la semana pasada. No cierra nada,
  solo lo señala.
- **Historial** de cierres con el origen de cada uno: ventana, bandeja, atajo o Auto-Kill.
- Tema claro/oscuro que sigue al de Windows, o fijo si lo prefieres.
- **Avisa de versiones nuevas** al arrancar y las instala desde Ajustes, verificando la firma.

## Capturas

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/procesos-claro.png" alt="La misma lista en tema claro"></td>
    <td width="50%"><img src="docs/screenshots/menu-contextual.png" alt="Menú contextual de una fila, con las opciones de copiar"></td>
  </tr>
  <tr>
    <td align="center"><em>Tema claro, siguiendo al de Windows</em></td>
    <td align="center"><em>Clic derecho: matar o copiar PID, nombre, puerto o la URL</em></td>
  </tr>
</table>

<div align="center">
  <img src="docs/screenshots/ajustes.png" width="72%" alt="Vista de Ajustes con Auto-Kill, Zombie Finder y el atajo global">
  <p><em>Ajustes: procesos vigilados, Auto-Kill, Zombie Finder y el atajo global</em></p>
</div>

> Las capturas se regeneran con [`tools/capture-screenshots.ps1`](tools/capture-screenshots.ps1),
> que conduce la app de verdad; no están retocadas.

## Descarga e instalación

Desde la **[página de releases](https://github.com/xfiberex/ProcessDevKill/releases/latest)**:

| Archivo | Para qué | Tamaño |
|---|---|---|
| `ProcessDevKill_X.Y.Z_x64-setup.exe` | **Recomendado** (NSIS). Instala en `%LOCALAPPDATA%\ProcessDevKill` para el usuario actual, sin pedir permisos de administrador. | ~2,4 MB |
| `ProcessDevKill_X.Y.Z_x64_en-US.msi` | MSI, para despliegue por directiva de grupo o quien lo prefiera. | ~3,5 MB |
| `*.sha256` | El hash de cada instalador, por si quieres verificar la descarga. | — |
| `latest.json`, `*.sig` | Los usa el actualizador de la app; no hay que descargarlos a mano. | — |

Requiere **Windows 10 o 11 (x64)** con **WebView2**, que viene de serie en Windows 11 y en Windows
10 actualizado. No hay versión de macOS ni de Linux: la app usa `sysinfo` y `listeners`, que sí son
multiplataforma, pero no está probada fuera de Windows y el `.dmg` no se puede generar desde aquí.

Para desinstalar: *Configuración → Aplicaciones → ProcessDevKill*, o el `uninstall.exe` que queda
en la carpeta de instalación.

### El aviso de SmartScreen

Los instaladores **no están firmados**, así que la primera vez Windows enseñará *"Windows protegió
su PC"*: **Más información → Ejecutar de todas formas**. No es un fallo del instalador ni una
detección de nada; es lo que le pasa a cualquier ejecutable sin certificado de firma de código,
que cuesta dinero y todavía no lo tiene este proyecto.

### Verificar la descarga (opcional)

```powershell
Get-FileHash .\ProcessDevKill_1.0.0_x64-setup.exe -Algorithm SHA256
```

El resultado tiene que coincidir con el contenido del `.sha256` que acompaña al archivo (formato de
`sha256sum`: el hash y el nombre del archivo).

> **Qué protege y qué no.** El hash viaja por el mismo sitio que el instalador, así que sirve para
> detectar una descarga corrupta o a medias, **no** para demostrar quién publicó el archivo. Es
> cortesía para la primera instalación, y el actualizador **no lo usa**: ese verifica firmas, como
> se explica abajo.

## Actualizaciones

Desde la v1.1.0, la app comprueba al arrancar si hay una versión nueva y avisa con un toast. La
descarga y la instalación **no ocurren solas**: se lanzan desde *Ajustes → Actualizaciones*, con el
número de versión y las notas delante. Al terminar, la app se reinicia sola.

### El modelo de confianza, y qué no cubre

Lo que autoriza una actualización es una firma **minisign**, no el `.sha256`:

- Cada release publica un `latest.json` y un `.sig` del instalador. La app trae **compilada dentro
  del binario** la clave pública (`plugins.updater.pubkey` en
  [`tauri.conf.json`](src-tauri/tauri.conf.json)), y rechaza cualquier descarga cuya firma no
  valide contra ella.
- Por eso **no basta con manipular el `latest.json`**: sin la clave privada correspondiente, un
  instalador sustituido no llega a ejecutarse. La clave privada no está en este repositorio; vive
  en la máquina desde la que se cortan los releases.

Lo que este esquema **no** hace, dicho claramente:

- **No sustituye a la firma de código.** SmartScreen seguirá avisando la primera vez: son cosas
  distintas y esa requiere un certificado de pago que el proyecto todavía no tiene.
- **No protege a quien instale a mano.** Si te bajas el `.exe` de Releases y lo ejecutas, ahí no
  interviene ninguna verificación de firma; te queda el `.sha256` y confiar en GitHub.
- **No cubre a quien tenga la v1.0.0 ni la v1.1.0.** La v1.0.0 se publicó sin actualizador. La
  v1.1.0 lo tenía, pero su clave de firma **se rotó** (ver abajo), y una instalación solo acepta
  actualizaciones de la clave con la que nació. En ambos casos hay que instalar a mano una vez.
- **Una rotación de clave obliga a reinstalar a mano.** Ocurrió entre la v1.1.0 y la v1.1.1: la
  clave original quedó expuesta y se sustituyó por otra, esta vez protegida con contraseña. No es
  un fallo del esquema —es exactamente lo que debe pasar cuando una clave deja de ser fiable—,
  pero conviene saber que el precio de rotar lo paga quien ya tenga la app instalada.
- **Depende de que la clave privada siga existiendo.** Si se perdiera, habría que generar otra, y
  ninguna instalación anterior aceptaría ya las actualizaciones firmadas con ella.

## Privacidad

Esta app lee la lista de procesos de tu equipo, así que conviene decir en voz alta qué hace con ella:

- **Nada de lo que lee sale de tu máquina.** No hay telemetría ni analítica: ni la lista de
  procesos, ni los puertos, ni el historial se envían a ningún sitio.
- Lee **nombre, PID, CPU, RAM, tiempo activo y puertos TCP en escucha** de los procesos vigilados.
  No lee la línea de comandos, ni variables de entorno, ni el contenido de nada.
- Los ajustes y el historial se guardan **en tu equipo**, en `%APPDATA%\com.processdevkill.app\`
  (`settings.json` e `history.json`). Se pueden abrir, copiar entre equipos o borrar; el historial
  se puede vaciar desde la propia app y tiene un tope de 200 entradas.
- **La única petición de red que hace la app** es la comprobación de actualizaciones: al arrancar
  pide un archivo `latest.json` a `github.com` para comparar versiones. Es una descarga normal, sin
  identificador ni cuenta; GitHub verá tu IP como la vería si abrieras la página. No se descarga
  nada más sin que lo confirmes tú.
- Lo demás que sale al exterior lo abres tú: el navegador al pulsar **Repositorio** en Ajustes.

Los permisos concedidos a la ventana son comprobables, y son los mínimos para lo anterior:
[`capabilities/default.json`](src-tauri/capabilities/default.json). El del portapapeles es de
**escritura únicamente** y el de reinicio no permite a la app cerrarse sola por su cuenta.

## Cómo funciona

```mermaid
flowchart LR
    subgraph Rust["Backend en Rust"]
        S["sysinfo<br/>procesos, CPU, RAM"]
        L["listeners<br/>PID → puerto TCP"]
        H["hilo de refresco<br/>+ Auto-Kill"]
        K["kill_and_record"]
        J["settings.json<br/>history.json"]
    end
    subgraph Web["Ventana (React + TS)"]
        U["Tabla, Historial, Ajustes"]
    end
    B["Bandeja"]
    A["Ctrl+Alt+K"]

    S --> H
    L --> H
    H -- "evento processes-updated" --> U
    U -- "invoke" --> K
    B --> K
    A --> K
    H --> K
    K --> J
    K -- "notificación nativa" --> B
```

Cuatro decisiones explican casi todo el diseño; el resto están en
[CONTEXT.md §4](CONTEXT.md#4-decisiones-tomadas), con su fecha y su motivo:

- **El frontend no hace polling.** Un hilo de Rust enumera procesos y sockets y empuja el evento
  `processes-updated`; React solo escucha. El intervalo se configura desde la UI.
- **Todo cierre pasa por `kill_and_record`.** La ventana, la bandeja, el atajo global y el Auto-Kill
  comparten camino, así que los cuatro notifican, registran en el historial y refrescan igual. Tres
  rutas separadas se habrían desincronizado a la primera.
- **Los puertos se filtran por TCP + `Listen`.** `listeners::get_all()` devuelve también las
  conexiones salientes: sin ese filtro la columna enseñaría puertos efímeros al azar en vez del
  puerto donde sirve tu servidor.
- **La persistencia son archivos JSON propios**, no un store de frontend: la bandeja y el atajo
  escriben historial con la ventana cerrada, cuando no hay JavaScript vivo que pueda hacerlo.

## Stack

| Capa | Tecnología |
|---|---|
| Shell de escritorio | **Tauri 2** (Rust + WebView2) |
| Frontend | **React 19 + TypeScript + Vite** |
| Estilos | **Tailwind CSS v4** (plugin de Vite, sin archivo de configuración) |
| Componentes | **shadcn/ui** estilo `base-nova`, sobre **Base UI**; toasts con **Sonner** |
| Animaciones | **Motion** (`motion/react`) |
| Procesos | crate **`sysinfo`** |
| Puertos por PID | crate **`listeners`** — `sysinfo` no los expone |
| Pruebas | **Vitest + Testing Library** (frontend) y `cargo test` (backend) |
| Plugins Tauri | `notification`, `global-shortcut`, `clipboard-manager`, `opener`, `updater`, `process` + `tray-icon` |

## Desarrollo

Prerequisitos: **Node.js LTS**, **Rust estable** ([rustup](https://rustup.rs)) y, en Windows, el
componente **MSVC C++ build tools x64/x86** con el **Windows SDK** desde el Visual Studio Installer
(`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`). Sin los headers y las librerías de MSVC,
`cargo` falla al enlazar.

```bash
npm install
npm run tauri dev      # app de escritorio con hot reload
npm run build          # comprueba tipos y compila el frontend
npm run tauri build    # genera los instaladores NSIS y MSI
```

```bash
npm test                      # 98 pruebas del frontend (Vitest + Testing Library)
npm run test:watch            # las mismas, en modo vigilancia
cd src-tauri && cargo test    # 22 pruebas del backend
```

Las pruebas de Rust leen los procesos reales del equipo y **solo matan procesos que lanzan ellas
mismas**; ninguna toca los tuyos. Las del frontend corren en jsdom con los módulos de Tauri
doblados, así que no abren ninguna ventana ni tocan procesos.

Cubren lo que más caro sale romper: que <kbd>Escape</kbd> cancela el diálogo destructivo sin matar
nada, la búsqueda por puerto, el suelo de 256 MB del Auto-Kill y que el portapapeles va por el
plugin de Tauri. [`src/types.test.ts`](src/types.test.ts) además lee el fuente de Rust y compara las
constantes espejo, para que el contrato entre los dos lados no se desincronice en silencio.

| Herramienta | Para qué |
|---|---|
| [`tools/capture-screenshots.ps1`](tools/capture-screenshots.ps1) | Regenera las capturas del README conduciendo la app por CDP. |
| [`release.ps1`](release.ps1) | Corta una versión entera: pruebas, bump en los tres sitios, build firmado, `latest.json`, tag y GitHub Release. Admite `-DryRun`. |
| `npm run tauri icon app-icon.svg` | Regenera todos los tamaños de icono tras editar `app-icon.svg`. |

## Estructura

| Ruta | Contenido |
|---|---|
| `src/` | Frontend React: vistas, tipos compartidos con Rust y tema |
| `src/components/ui/` | Componentes de shadcn/ui (generados; se editan a mano si hace falta) |
| `src-tauri/src/lib.rs` | Comandos de Tauri y arranque |
| `src-tauri/src/{processes,ports,storage,tray}.rs` | Procesos, puertos, persistencia y bandeja |
| `src-tauri/capabilities/` | Permisos concedidos a la ventana |
| `tools/`, `docs/screenshots/` | Utilidades del repositorio y capturas del README |
| `app-icon.svg` | Icono fuente del que salen todos los tamaños |
| [ROADMAP.md](ROADMAP.md) | Plan de desarrollo por fases, con lo verificado en cada una |
| [CONTEXT.md](CONTEXT.md) | Estado actual, decisiones tomadas y registro de sesiones |

## Estado

Publicada y verificada sobre la app instalada. Lo que todavía **no** hay, por si importa antes de
instalarla: **firma de código** (de ahí el aviso de SmartScreen) y compilaciones para **macOS o
Linux**. El plan está en el [ROADMAP](ROADMAP.md).

Si tienes la **v1.0.0**, esa se publicó antes del actualizador y no avisa de nada: instala la
versión nueva a mano una vez y a partir de ahí ya se avisa sola.

## Licencia

Software libre bajo la **[GNU General Public License v3.0](LICENSE)** (GPLv3): puedes usarlo,
estudiarlo, modificarlo y redistribuirlo, **siempre que los derivados conserven la misma licencia y
publiquen su código fuente**. Se ofrece **sin ninguna garantía**.

Las licencias de los componentes de terceros que el instalador empaqueta —incluida la tipografía
Geist, con su licencia OFL-1.1— están en [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). Todas
son permisivas y compatibles con la GPLv3.
