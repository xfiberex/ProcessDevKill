# 📋 CONTEXT.md — ProcessDevKill

> **Documento vivo.** Registra el contexto, las decisiones y el progreso del proyecto para poder retomarlo desde cualquier equipo sin perder información. Se actualiza al final de cada sesión de trabajo o cuando se toma una decisión relevante.
>
> El plan detallado por fases vive en [ROADMAP.md](ROADMAP.md); aquí solo se refleja el estado.

---

## 1. Qué es este proyecto

**ProcessDevKill** es una aplicación de escritorio (Windows primero, macOS después) para desarrolladores que lista los procesos de desarrollo activos (`node`, `python`, `dotnet`, …), muestra su consumo de CPU/RAM y **qué puerto local ocupa cada uno**, y permite matarlos individualmente o en lote. Resuelve el clásico "el puerto 3000 está ocupado y no sé por quién".

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Shell de escritorio | **Tauri 2** | Rust backend + webview |
| Frontend | **React + TypeScript + Vite** | Plantilla oficial de `create tauri-app` |
| Estilos | **Tailwind CSS v4** | Vía plugin `@tailwindcss/vite` (sin config file) |
| Animaciones | **Motion** (`motion/react`) | Ex Framer Motion |
| Componentes UI | **shadcn/ui** (estilo `base-nova`) | Sobre **Base UI**, no Radix; Toast = **Sonner** |
| Info de procesos | crate **`sysinfo`** | Lista, CPU, RAM, kill |
| Puertos por PID | crate **`listeners`** (o `netstat2`) | `sysinfo` no cubre puertos |
| Plugins Tauri | `notification`, `global-shortcut`, `clipboard-manager` | + feature `tray-icon` |
| Publicación | `release.ps1` local + `gh` | Sin CI; ver §4 (2026-07-24) |

## 3. Estado actual

**Fase actual:** ✅ **El ROADMAP.md está terminado.** Tiers 1 a 6 completos.

| Tier | Descripción | Estado |
|---|---|---|
| 1 | Cimientos y MVP | ✅ Completado y verificado |
| 2 | UX/UI y reactividad | ✅ Completado y verificado |
| 3 | Puertos, notificaciones, tray | ✅ Completado y verificado |
| 4 | Power user y optimización | ✅ Completado y verificado |
| 5 | Estética (tema, shadcn/ui, icono) | ✅ Puntos 1-3 completados y verificados |
| 5 | Salsa Secreta: Auto-Kill y Zombie Finder | ✅ Punto 4 completado y verificado |
| 5 | Instaladores (NSIS + MSI) | ✅ Punto 5 completado |
| 5 | Publicación de releases (`release.ps1`) | ✅ Punto 6 completado — **v1.0.0 publicada** |
| 6 | Licencia y avisos de terceros | ✅ Punto 1 completado y verificado |
| 6 | Nombre del repositorio | ✅ Punto 2 completado |
| 6 | README de producto, capturas y `FUNDING.yml` | ✅ Punto 3 completado y verificado |
| 6 | Pruebas del frontend | ✅ Punto 4 completado y verificado — **98 pruebas** |
| 6 | Auto-actualización | ✅ Punto 5 completado (ver la salvedad de abajo) |
| 6 | Herramientas del repositorio (`.claude/CLAUDE.md`, `.mcp.json`) | ✅ Punto 6 completado |

Verificado el 2026-07-23 con la app corriendo: la UI lista procesos reales con CPU, RAM, tiempo y **puerto**; buscar por puerto localiza el proceso y matarlo lo libera de verdad; la lista se actualiza sola por eventos desde Rust; ajustes e historial sobreviven al reinicio; cerrar la ventana la esconde en la bandeja sin terminar la app.

Añadido el 2026-07-24, también sobre la app en ejecución: la ventana sigue el tema de Windows y obedece al selector de Ajustes (que persiste en disco), el menú contextual de cada fila copia PID/nombre/puerto al portapapeles real de Windows con su toast, y el diálogo destructivo —ahora el AlertDialog de shadcn— sigue cancelándose con Escape sin matar nada. El Auto-Kill, con un umbral de prueba, cierra solo un proceso de 651 MB y deja intactos los 7 `node` reales de la máquina. 16 tests de `cargo test` en verde.

**Atajo global: salvedad cerrada el 2026-07-24.** Se pulsó `Ctrl+Alt+K` de verdad sobre la app **instalada**, con la entrada sintetizada por `keybd_event` (`SendKeys` no vale: no llega a un atajo de `RegisterHotKey`). Cerró los 4 procesos `node` vivos, liberó el puerto 4321 y registró las 4 entradas con origen `hotkey`. Antes de pulsar se comprobó que ninguno de esos procesos era trabajo del usuario. Queda el texto original abajo como registro de por qué estuvo tanto tiempo sin comprobarse.

**Salvedad histórica sobre el atajo global (ya cerrada; se conserva como registro):** se comprobó que `Ctrl+Alt+K` se registra y se libera correctamente (con él activo ningún otro proceso puede tomarlo), pero **no se llegó a pulsar**: dispararlo habría cerrado los ~13 procesos `node` reales del equipo. La ruta de cierre que ejecuta es la misma `kill_and_record` que usan la ventana y la bandeja, ambas verificadas end-to-end.

**Notificaciones: salvedad cerrada el 2026-07-24.** Con la app **instalada**, el toast aparece en pantalla con su icono, su título y el cuerpo correcto (confirmado a ojo por el usuario). Se acabó la duda que arrastraba desde el Tier 3.

> ⚠️ **Cómo NO comprobarlo.** Se intentó verificar con capturas de pantalla por código (`Graphics.CopyFromScreen`) y salían vacías, lo que llevó a concluir en falso que el banner no se pintaba. `CopyFromScreen` copia el escritorio con BitBlt y **los toast de Windows los compone DWM en una capa que ese método no recoge**. Para esto no hay atajo: o lo mira una persona, o se consulta el centro de notificaciones por la API de WinRT.
>
> Lo que sí sirve como prueba indirecta de que la petición llega a Windows: la clave `HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings\com.processdevkill.app` solo se crea cuando una app envía su primer toast.

Añadido el 2026-07-25: **98 pruebas de frontend** (Vitest + Testing Library) donde antes había cero, y **auto-actualización** con firma minisign. El remoto local ya apunta a la URL nueva.

> ⚠️ **Salvedad abierta: la descarga e instalación de una actualización no está probada, y no puede estarlo todavía.** Hacen falta **dos** releases con actualizador para que una encuentre a la otra; se cierra en el próximo corte. Todo lo demás **sí** quedó verificado el 2026-07-26 tras publicar la v1.1.0: el endpoint responde 200 con la versión correcta, la firma del `latest.json` coincide con el `.sig` publicado, su `key id` (`366b8be5e0fef6cf`) es el de la clave pública compilada en el binario, y la app en ejecución contesta «Ya tienes la última versión» al buscar. Detalle en ROADMAP §Tier 6.5.

> ⚠️ **`codegraph` está conectado pero sin índice.** El `.mcp.json` ya engancha el servidor, pero `.codegraph/` contiene solo su `.gitignore`: la base de datos nunca se construyó. Para que sirva de algo hay que ejecutar `codegraph init` en la raíz y abrir una sesión nueva. Se deja al usuario a propósito.

**Publicado:** <https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.1.0> — 6 assets: instaladores NSIS (3,61 MB) y MSI (5,12 MB), sus `.sha256`, el `.sig` del NSIS y el `latest.json` del actualizador. Sin firma de código (SmartScreen sigue avisando); **sí** con firma minisign para las actualizaciones.

> La <https://github.com/xfiberex/ProcessDevKill/releases/tag/v1.0.0> sigue publicada, pero **no tiene actualizador**: quien la tenga instalada no se enterará de las siguientes por su cuenta y debe instalar la v1.1.0 a mano una vez.

### Entorno: el toolset MSVC venía incompleto (resuelto)

Merece la pena dejarlo escrito por si hay que montar el entorno en otra máquina. Visual Studio 18 Community estaba instalado con `cl.exe` y `link.exe`, pero **sin directorio `VC\include`** (cero headers de C) y solo con librerías `lib\onecore\`, sin las de escritorio `lib\x64`. Síntomas: `LNK1104: no se puede abrir el archivo 'msvcrt.lib'` y, al forzar rutas OneCore a mano, `C1083: no se puede abrir el archivo incluir 'excpt.h'`.

Se resolvió añadiendo el componente que faltaba, desde PowerShell **como administrador**:

```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --passive --norestart
```

Comprobación rápida de que el entorno está sano: debe existir `...\VC\Tools\MSVC\<versión>\include\excpt.h`.

> Nota: `vswhere.exe` de este equipo no reporta VS 18 (`-products *` devuelve vacío) aunque la instalación sí esté registrada. No impidió compilar, pero puede confundir a herramientas que dependan de él.

### Cómo inspeccionar la UI en ejecución

Para depurar el frontend dentro de la ventana de Tauri, añadir temporalmente a la ventana en `tauri.conf.json`:

```json
"additionalBrowserArgs": "--remote-debugging-port=9222"
```

Con eso, `http://127.0.0.1:9222/json` expone el protocolo CDP y se puede leer el DOM real o simular clics. **Quitarlo después**: sustituye los argumentos por defecto de Tauri y no debe llegar a producción. La variable de entorno `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` **no** sirve aquí, Tauri la sobrescribe.

Dos cosas que cuestan una sesión si no se saben:

- **Nunca evaluar `navigator.clipboard.readText()` por CDP.** Abre un diálogo de permiso *dentro* de la ventana ("… quiere ver texto e imágenes copiadas en el Portapapeles"), que se convierte en un target nuevo, deja colgada la evaluación y tapa la app. Para comprobar el portapapeles, `Get-Clipboard` desde PowerShell.
- Con la ventana sin foco (que es lo normal al conducirla por CDP desde una terminal), `navigator.clipboard.writeText` falla con `NotAllowedError: Document is not focused`. No es un fallo de la app: es la razón por la que se copia con el plugin de Tauri.

## 4. Decisiones tomadas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-07-23 | Tauri 2 (no Electron) | Binario ligero, backend Rust necesario para `sysinfo` |
| 2026-07-23 | Tailwind v4 con plugin de Vite | Setup actual oficial; v3 quedó obsoleto |
| 2026-07-23 | Crate `listeners` para puertos | `sysinfo` no mapea PID→puerto |
| 2026-07-23 | ~~CI compila release solo con tags `v*`~~ | Build multi-plataforma en cada commit es lenta y cara. **Superada el 2026-07-24**: no habrá CI, ver la fila del `release.ps1` |
| 2026-07-23 | Polling frontend en Tier 2, eventos Rust en Tier 4 | Simplicidad primero, rendimiento después |
| 2026-07-23 | `sysinfo` solo con la feature `system` | No usamos discos, red ni componentes; acorta la compilación |
| 2026-07-23 | Clasificar procesos por nombre exacto o sufijo de versión, no por prefijo | Un prefijo simple capturaría `nodemon` como si fuera Node |
| 2026-07-23 | `kill_process` valida que el PID sea de un runtime vigilado | Un comando de Tauri acepta cualquier entrada; sin la guardia sería un "mata lo que quieras" |
| 2026-07-23 | Normalizar el % de CPU dividiendo por núcleos lógicos | `cpu_usage()` suma todos los núcleos y devuelve hasta 400 en un equipo de 4 hilos |
| 2026-07-23 | Crear el `System` con `RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing())` | **Obligatorio**: sysinfo multiplica el uso de CPU por `cpus.len()`, y con `System::new()` esa lista queda vacía → todos los procesos reportan 0 % |
| 2026-07-23 | Calentar la CPU con **tres** muestras, en un hilo aparte | sysinfo descarta la primera lectura sin guardar líneas base y la segunda las compara contra cero; solo la tercera es real. En un hilo para no retrasar la ventana |
| 2026-07-23 | Separar `collect_processes()` del comando de Tauri | Permite probar la lógica contra el sistema real sin montar una `App` |
| 2026-07-23 | Barras de consumo escaladas al mayor de la lista, no al total del equipo | Un Node de 300 MB sobre 32 GB daría una barra invisible; lo útil es comparar procesos entre sí. El número sigue siendo absoluto |
| 2026-07-23 | `kill_processes` devuelve un resultado por PID, no `Result` global | En un lote es normal que algún proceso muera solo entre el refresco y el clic; eso no debe impedir matar los demás |
| 2026-07-23 | Auto-refresco con guardia `inFlight` y poda de la selección | Evita encolar peticiones si una tarda más que el intervalo, y que un PID muerto siga contando para "matar seleccionados" |
| 2026-07-23 | Iconos como SVG inline, no imágenes | La app funciona offline y así heredan el color del runtime sin peticiones de red |
| 2026-07-23 | Filtrar los sockets por `TCP` + `Listen` | `listeners::get_all()` también devuelve conexiones salientes; sin el filtro la UI mostraría puertos efímeros aleatorios en vez del puerto del servidor |
| 2026-07-23 | Emitir las notificaciones desde Rust, no desde el frontend | El menú de la bandeja mata procesos con la ventana oculta; ahí la notificación es el único feedback que recibe el usuario |
| 2026-07-23 | Añadir "Salir" al menú de la bandeja (no estaba en el plan) | Al esconder la ventana en vez de cerrarla, sin esa opción la app no se puede terminar |
| 2026-07-23 | No conceder `core:window:allow-close` al frontend | La app no necesita cerrarse a sí misma desde JS; el botón X pasa por el sistema y lo intercepta `CloseRequested` |
| 2026-07-23 | Dividir `lib.rs` en `processes`/`ports`/`storage`/`tray` | Pasaba de 450 líneas y el Tier 4 la habría llevado a 900 |
| 2026-07-23 | Persistencia con archivos JSON propios, no `tauri-plugin-store` | La bandeja y el atajo escriben historial sin que la ventana exista; el store es una API de frontend |
| 2026-07-23 | Guardar el timestamp como epoch en ms y formatearlo en JS | Evita meter `chrono` solo para esto, y `toLocaleString()` respeta el idioma y la zona del usuario |
| 2026-07-23 | Toda muerte pasa por `kill_and_record` | Ventana, bandeja y atajo registran historial, notifican y refrescan igual; tres caminos separados se habrían desincronizado |
| 2026-07-23 | Interruptor para desactivar `Ctrl+Alt+K` (no estaba en el plan) | Dispara un cierre masivo sin confirmación; un atajo global mal pulsado no debería ser irreversible |
| 2026-07-23 | Los nombres personalizados se comparan exactos, no por prefijo | Añadir `go` no debe capturar `golang`, ni `docker` capturar `dockerd` |
| 2026-07-23 | Copiar los ajustes y soltar su candado antes de bloquear `sys` | Evita anidar candados y con ello cualquier riesgo de deadlock entre el hilo emisor y los comandos |
| 2026-07-24 | **Nombre definitivo: ProcessDevKill** | Cierra la decisión pendiente. Cambia también el identificador a `com.processdevkill.app`: se hace ahora, antes del primer instalador, porque mover el identificador después dejaría huérfanos los ajustes e historial de los usuarios |
| 2026-07-24 | El tema se guarda en `settings.json`, no en `localStorage` | Vive junto al resto de ajustes, en un archivo que el usuario puede ver, copiar entre equipos o borrar. En `localStorage` queda solo una **copia** para pintar sin parpadeo antes de que Rust conteste |
| 2026-07-24 | La clase `dark` la aplica JS, no la media query de CSS | Si la decidiera el CSS, elegir "Claro" con Windows en oscuro no tendría ningún efecto. Con "Sistema" se escucha `prefers-color-scheme` en vivo |
| 2026-07-24 | Paleta propia en `.dark`, no la neutra de shadcn | Conserva el azul oscuro de los Tiers 1-4 (`#0f1115`); el gris neutro por defecto borraba la identidad de la app |
| 2026-07-24 | Forzar el foco en el botón destructivo del diálogo (`initialFocus`) | Base UI enfoca "Cancelar" por defecto; se mantiene el comportamiento verificado en el Tier 2 (confirmar con Enter). Escape sigue cancelando, que es la salida crítica |
| 2026-07-24 | `tauri-plugin-clipboard-manager` en vez de `navigator.clipboard` | La API web exige que el documento tenga el foco: falla con `NotAllowedError` justo cuando la ventana vuelve de la bandeja. Se concede solo `clipboard-manager:allow-write-text`, no lectura |
| 2026-07-24 | Rojo sólido para la acción destructiva principal | El `variant="destructive"` de este estilo de shadcn es un rojo tenue, pensado para acciones secundarias; el botón que cierra toda la lista tiene que verse que quema |
| 2026-07-24 | **Releases con `release.ps1` local, sin GitHub Actions** | La app es solo Windows por ahora y la build de Tauri en CI tarda minutos por plataforma. Se compila en la misma máquina donde se prueba, sin secretos en la nube ni minutos de CI. Si algún día se publica para macOS, entonces sí hará falta CI (no se puede compilar `.dmg` desde Windows) |
| 2026-07-24 | Se descarta `navigator.clipboard.readText()` incluso para depurar | Abre un diálogo de permiso **dentro** de la ventana de WebView2 que bloquea la evaluación por CDP; la app solo necesita escribir |
| 2026-07-24 | Tier 6 recoge solo parte de lo que tiene FormatDiskPro | De la comparación se descartan tres cosas a propósito: **CI** (ya decidido, `release.ps1` local), los **UI tests con FlaUI** (es una app WinForms; aquí el equivalente es Vitest + pruebas por CDP) y el **modelo de confianza basado en SHA-256** del updater (Tauri firma con minisign, el hash no vale para eso) |
| 2026-07-24 | El menú de la bandeja llama a `pids_of_runtime` en vez de repetir el filtro | El test `selecciona_solo_los_pids_del_runtime_pedido` decía cubrir la bandeja, pero la bandeja tenía su propia copia del filtro: el test protegía código que nadie usaba |
| 2026-07-24 | Una sola sesión de Claude Code por repositorio | Dos trabajando a la vez se sobrescriben los archivos, y el `tauri dev` de una reinicia la app que la otra está inspeccionando por CDP |
| 2026-07-24 | El Auto-Kill nace apagado y con suelo de 256 MB en el umbral | Es lo único de la app que mata sin que nadie se lo pida. Un umbral bajo por descuido (o heredado de un `settings.json` editado a mano) cerraría el entorno de desarrollo entero, así que el suelo se aplica también al leer del disco |
| 2026-07-24 | El Auto-Kill sigue vigilando con el auto-refresco en "Off" | Una red de seguridad que deja de mirar porque la ventana no se refresca no es una red de seguridad. Se vigila cada 2 s sin publicar la lista, que es lo que el usuario pidió al apagar el refresco |
| 2026-07-24 | El umbral se guarda al salir del campo, no al teclear | Escribir "2048" pasa por "2"; guardando en cada pulsación el umbral bajaría al mínimo un instante con el vigilante en marcha |
| 2026-07-24 | `watch_cycle` lee la lista una vez y luego publica | Vigilar y refrescar por separado enumeraba procesos y sockets dos veces por ciclo, que es justo el trabajo que el Tier 4 sacó del frontend |
| 2026-07-24 | Un zombi tiene que ocupar un **puerto**, no solo estar parado | Casi todo proceso de desarrollo en reposo marca 0 % de CPU (7 de 10 en la máquina de pruebas). Sin esa condición se resaltaría la tabla entera, que es igual que no resaltar nada |
| 2026-07-24 | El corte de "sin actividad" es 0,5 % de CPU, no 0 | Un servidor parado sigue despertando por sus temporizadores y el recolector de basura, y marca décimas sueltas |
| 2026-07-24 | Apagar el Zombie Finder borra las rachas acumuladas | Mientras estuvo apagado nadie miraba; contar ese rato al reactivarlo sería inventárselo |
| 2026-07-24 | `"center": true` en la ventana | Sin ello Windows coloca la ventana donde le parece y cada arranque aparecía en un sitio distinto. Tauri centra sobre el **área de trabajo**, no sobre la pantalla completa: el centro vertical queda unos píxeles más arriba, que es lo correcto para no quedar bajo la barra de tareas |
| 2026-07-24 | `ZombieWatch` olvida los PIDs que desaparecen | La app vive días en la bandeja: el mapa crecería sin fin, y un PID reciclado por Windows heredaría la racha del proceso anterior |
| 2026-07-25 | Las capturas del README salen del **webview** por CDP, no de la pantalla | Sin barra de título ni fondo de escritorio, y con `Emulation.setDeviceMetricsOverride` miden lo mismo las genere quien las genere, sin depender de la resolución ni del escalado de Windows. Van a x2 para que aguanten el zoom de GitHub. Capturar la pantalla ya se descartó en el Tier 5.5: BitBlt no recoge lo que compone DWM |
| 2026-07-25 | El script de capturas levanta **sus propios servidores Node** (3000 y 8080) | La columna de puertos es lo que justifica la app: una captura con la columna vacía no vale. Y sin nada consumiendo CPU las barras salen todas a cero, que parece un fallo. Son procesos reales escuchando de verdad, no datos inventados; se cierran al terminar |
| 2026-07-25 | La captura de Ajustes usa una ventana más alta que la de por defecto, y va la última | En 640 px solo se ve hasta el Auto-Kill, y las dos funciones estrella quedarían fuera; la app es redimensionable, así que sigue siendo una ventana posible. Va la última porque `setDeviceMetricsOverride` **no encoge** el viewport si ya había uno mayor: así el resto se capturan siempre al tamaño por defecto |
| 2026-07-25 | El README dice qué **no** protege el `.sha256` | Publicar un hash junto al archivo que valida invita a leerlo como una garantía de origen. Detecta una descarga corrupta y poco más; sin firma no demuestra quién publicó el instalador. Decirlo cuesta dos líneas y evita una falsa sensación de seguridad |
| 2026-07-25 | Vitest + Testing Library, y **no** end-to-end sobre la ventana | El 80 % del valor está en las pruebas de componente: corren en dos segundos, se mantienen solas y no necesitan compilar Tauri. Montar la ventana en cada corte de release para repetir lo que ya se verificó por CDP no compensa hoy |
| 2026-07-25 | Los dobles de Tauri viven en `tauri-mock.ts`, no en `setup.ts` | Las fábricas de `vi.mock` **se izan por encima de los imports** del archivo: unos `vi.fn()` declarados arriba del propio setup serían `undefined` al ejecutarse la fábrica. Con un `await import` dentro, el problema desaparece |
| 2026-07-25 | Motion se dobla en las pruebas | `AnimatePresence` mantiene montada la fila que sale hasta que acaba su animación. Al filtrar la tabla seguían contándose las filas de antes: la aserción medía la animación, no el filtro. La animación es presentación pura y ya se verificó a ojo en el Tier 2 |
| 2026-07-25 | `types.test.ts` lee el fuente de Rust y compara | `types.ts` se declaraba "espejo" de los tipos de Rust, pero nada lo obligaba: cambiar `MIN_AUTO_KILL_MB` en `storage.rs` y olvidarse aquí no rompía ni el build ni `cargo test`. Ahora falla una prueba |
| 2026-07-25 | `aria-label` en los dos campos numéricos de Ajustes | Lo encontraron las pruebas al no poder pedirlos por nombre: solo tenían `aria-describedby`, que **describe pero no nombra**. Un lector de pantalla los anunciaba sin decir qué eran |
| 2026-07-25 | **Auto-actualización con minisign, no con el `.sha256`** | Son cosas distintas y confundirlas es peligroso: el hash viaja por el mismo sitio que el archivo y no prueba origen. La clave pública va compilada en el binario, así que un `latest.json` manipulado no basta para instalar nada |
| 2026-07-25 | La clave privada, sin contraseña y fuera del repo | Decisión del usuario. `release.ps1` queda no interactivo y con una variable menos que puede faltar; el secreto es el archivo, en `%USERPROFILE%\.tauri\`. Con contraseña, la contraseña acabaría en una variable de entorno de la misma máquina: la ganancia real era pequeña frente a la fricción en cada corte |
| 2026-07-25 | La comprobación al arrancar va **en silencio** | Un equipo sin red o una VPN levantándose es lo normal, y un error nada más abrir la app parecería un fallo de la app. Solo se habla cuando de verdad hay versión nueva |
| 2026-07-25 | Descargar e instalar **solo a petición** | Es lo único que la app puede traerse de internet y ejecutar. Que ocurra sin pedirlo convertiría una herramienta local en algo que se modifica solo, y eso hay que pedirlo |
| 2026-07-25 | `process:allow-restart`, no `process:default` | `default` incluye además `allow-exit`. La app no necesita poder cerrarse a sí misma desde JS, igual que en el Tier 3 no se le concedió `core:window:allow-close` |
| 2026-07-25 | `release.ps1` valida la clave **antes** de compilar | Enterarse de que falta después de veinte minutos de build es la peor forma de saberlo. Y si tras el build no aparece el `.sig`, el script para: publicar sin firma deja a todos los instalados sin poder actualizarse y no se nota hasta que alguien lo intenta |
| 2026-07-25 | El endpoint es `releases/latest/download/latest.json` | GitHub lo resuelve siempre al último release no-prerelease, así que no hay que hospedar nada aparte ni tocar una URL en cada versión |
| 2026-07-25 | `"createUpdaterArtifacts": true` en `bundle` | **Sin ella no se firma nada y Tauri no avisa.** Viene a `false` de fábrica; con la clave puesta en el entorno y el plugin configurado, el build salió igual de contento produciendo los dos instaladores sin `.sig`. Lo cazó la comprobación de `release.ps1`, con el release ya a medio camino |
| 2026-07-25 | El build se lanza con `ProcessStartInfo`, no con `& npm` | **En PowerShell `$env:VAR = ""` borra la variable en vez de dejarla vacía.** Con la clave sin contraseña hay que pasar un `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío; al desaparecer, Tauri decide preguntar por consola y el build **se cuelga indefinidamente sin dar error**. `ProcessStartInfo.Environment` sí admite el valor vacío, y de paso la clave no toca la sesión de quien ejecuta el script |

## 5. Decisiones pendientes

- [x] ~~**Nombre definitivo**~~ → **ProcessDevKill** (2026-07-24).
- [x] ~~Repositorio remoto~~ → <https://github.com/xfiberex/ProcessDevKill> (rama `main`).
- [x] ~~Renombrar el repositorio~~ → hecho el 2026-07-24. GitHub redirige la URL vieja, así que los enlaces ya publicados de la v1.0.0 siguen funcionando. La **carpeta local** conserva el nombre `ProcessVisorDev`; es solo cosmético, pero renombrarla obliga a reabrir el proyecto en el editor.
- [ ] Lista inicial de procesos vigilados por defecto (¿incluir `java`, `deno`, `bun` desde el inicio?).
- [ ] Firma de código (Authenticode): sin ella, Windows sigue enseñando el aviso de SmartScreen. **No confundirla con la firma minisign del actualizador**, que sí existe desde la v1.1.0 y resuelve un problema distinto: aquélla dice quién publica el instalador que te descargas, ésta valida las actualizaciones que la app se trae sola. Cuesta un certificado de pago.
- [ ] Construir el índice de `codegraph` (`codegraph init`) para que el `.mcp.json` sirva de algo.

## 6. Cómo retomar el proyecto en otro equipo

1. Clonar el repositorio: `git clone https://github.com/xfiberex/ProcessDevKill.git`
2. Instalar prerequisitos: [Rust](https://rustup.rs) (`rustup`), Node.js LTS, y en Windows los **Microsoft C++ Build Tools**. WebView2 ya viene en Windows 11.
3. `npm install` en la raíz.
4. `npm run tauri dev` para desarrollo; `npm run tauri build` para generar el instalador.
5. `npm test` (frontend) y `cd src-tauri && cargo test` (backend) para comprobar que todo sigue en pie.
6. Leer este archivo (estado y decisiones) y el [ROADMAP.md](ROADMAP.md) (siguiente checkbox pendiente).

> ⚠️ **Para cortar un release desde otro equipo hace falta la clave privada minisign**, que no está en el repositorio: vive en `%USERPROFILE%\.tauri\processdevkill.key` de la máquina donde se generó. Copiarla a mano al equipo nuevo, o pasar su ruta con `-SigningKey`. **Generar una nueva no es una alternativa**: invalidaría las actualizaciones de todos los usuarios ya instalados.

## 7. Convenciones

> Desde el 2026-07-25 estas convenciones viven también en [.claude/CLAUDE.md](.claude/CLAUDE.md), que es lo que lee un agente automáticamente. Al cambiar una, cambiarla en los dos sitios.

- Comandos Tauri en Rust: `snake_case` (`get_processes`, `kill_process`).
- Los checkboxes del ROADMAP.md se marcan `[x]` **solo cuando la funcionalidad está probada** en `tauri dev`.
- Toda decisión técnica que contradiga o precise el roadmap se anota en la tabla de la sección 4 con fecha.
- Commits en español, imperativo: "Añade comando get_processes".
- `src/types.ts` es el espejo de los tipos de Rust: al tocar un `struct` o una constante de `storage.rs`, se toca aquí (hay una prueba que lo comprueba).

## 8. Registro de sesiones

> Añadir una entrada por sesión de trabajo, la más reciente arriba.

### 2026-07-25 (noche) — Tier 6.4, 6.5 y 6.6: se cierra el ROADMAP

- **Tier 6.4 — 98 pruebas de frontend** donde antes había cero, con Vitest + Testing Library en jsdom. La que más importa: *Escape cancela el diálogo destructivo sin confirmar*, verificada a mano en tres tiers y por fin fijada. También la búsqueda por puerto, la poda de la selección, el suelo de 256 MB y que se copia con el plugin de Tauri.
  - `src/types.test.ts` **lee el fuente de Rust** y compara las constantes espejo. `types.ts` decía ser un espejo sin que nada lo obligara.
  - **Fallo real encontrado:** los dos campos numéricos de Ajustes no tenían nombre accesible, solo `aria-describedby`. Se les añadió `aria-label`.
  - Dos tropiezos, ambos anotados en `src/test/setup.ts`: las fábricas de `vi.mock` se izan por encima de los imports (de ahí `tauri-mock.ts` aparte), y `AnimatePresence` mantiene montada la fila que sale, así que sin doblar Motion las aserciones median la animación en vez del filtro.
- **Tier 6.5 — auto-actualización** con `tauri-plugin-updater`, firma minisign y `latest.json` publicado por `release.ps1`. La comprobación del arranque va en silencio; descargar e instalar exige pulsarlo.
  - **Corregida una afirmación falsa del README**: la sección de privacidad decía que la app no tiene concedido ningún permiso de red, enlazando al `capabilities/default.json` como prueba. Con el actualizador eso quedaba desmentido por el propio archivo que se citaba.
  - El modelo de confianza se documenta con lo que **no** cubre: no sustituye a la firma de código, no protege una instalación manual, no alcanza a la v1.0.0 y depende de que la clave privada siga existiendo.
- **Tier 6.6 — `.claude/CLAUDE.md` y `.mcp.json`.** El CLAUDE.md recoge las convenciones y, sobre todo, las cinco cosas que cuestan una sesión si no se saben (PowerShell y el UTF-8, CDP, `SendKeys`, los toast y BitBlt, una sesión por repositorio).
  - **La suposición del roadmap sobre codegraph era incorrecta:** daba por hecho que el índice existía y solo faltaba conectarlo. `.codegraph/` contiene únicamente su `.gitignore`. El `.mcp.json` queda puesto, pero el índice hay que construirlo con `codegraph init`, y eso se deja al usuario.
- Verificado antes de cortar: 98 pruebas de frontend, 22 de `cargo test`, `tsc` sin errores y `release.ps1` sin errores de sintaxis.

### 2026-07-26 — v1.1.0 publicada, con dos tropiezos que casi la estropean

- **v1.1.0 publicada** con 6 assets. El corte falló **dos veces** antes de salir, y las dos merecen quedar escritas porque ninguna daba un error claro:
  - **`createUpdaterArtifacts` viene a `false` de fábrica.** Con el plugin configurado y la clave en el entorno, `tauri build` compiló los dos instaladores **sin firmar y sin quejarse**. Lo cazó la comprobación de `release.ps1` («si no aparece el `.sig`, para»), con el release ya a medio camino. Sin esa guardia se habría publicado un `latest.json` cuya firma no existía, y no se habría notado hasta que alguien intentara actualizarse.
  - **En PowerShell, `$env:VAR = ""` borra la variable.** No la deja vacía: la elimina, porque `SetEnvironmentVariable` trata la cadena vacía como `$null`. Como la clave se generó sin contraseña, Tauri necesitaba un `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` vacío; al desaparecer, el CLI decidió preguntar por consola y **el build se quedó colgado indefinidamente**, sin error y sin salir. Se arregla lanzando el build con `ProcessStartInfo.Environment`, que sí admite el valor vacío; de paso la clave ya no toca la sesión de quien ejecuta el script.
- Antes de reintentar se **borró a mano el `.sig`** creado durante el diagnóstico: dejarlo habría hecho pasar la comprobación sobre un artefacto viejo, que es una verificación falsa.
- **Verificación posterior a la publicación** (detalle en ROADMAP §Tier 6.5): endpoint 200 con la versión correcta, URL del instalador 200 con el tamaño exacto, las tres copias de la firma idénticas, el `key id` de la firma igual al de la clave pública compilada en el binario, y la app en ejecución contestando «Ya tienes la última versión».
- Para esa última prueba se abrió el puerto de depuración en `tauri.conf.json`, y se restauró después **cerrando antes la app**: al revés, Tauri detecta el cambio y la reinicia en mitad de la limpieza. `git status` quedó limpio.

### 2026-07-25 — Tier 6.3: README de producto, capturas y FUNDING

- **README reescrito de 5 a 12 secciones**: el problema que resuelve (con el `EADDRINUSE` delante), qué hace, capturas, descarga e instalación, SmartScreen, verificación del `.sha256` —diciendo también qué **no** protege—, privacidad, arquitectura con diagrama Mermaid, stack, desarrollo, estructura, estado y licencia.
- **`tools/capture-screenshots.ps1`**: lanza `tauri dev` con el puerto de depuración, conduce la ventana por CDP y guarda cuatro PNG en `docs/screenshots/`. Toca `tauri.conf.json` para abrir el puerto y restaura los bytes originales en el `finally`; **cierra la app antes de restaurar**, porque si no Tauri detecta el cambio y reinicia la app en mitad de la limpieza.
- El script levanta dos servidores Node de verdad (3000, y 8080 con carga) para que la columna de puertos y las barras de CPU enseñen algo, y los cierra al acabar. También devuelve el tema a como estaba: cambiarlo es un ajuste del usuario, no un efecto secundario aceptable.
- Cuatro tropiezos que costaron sus vueltas, todos anotados en el propio script:
  - `Emulation.setDeviceMetricsOverride` **no encoge** el viewport si ya había uno más alto: la captura en claro salió con el alto de la de Ajustes. Se limpia el override antes de fijar el nuevo y la única captura alta va la última.
  - `Start-Process` une los argumentos con espacios y **no entrecomilla nada**: el `node -e "…const t=…"` llegaba partido por el primer espacio y moría con *Unexpected end of input*.
  - `.GetAwaiter().GetResult()` sobre un `Task` no genérico **emite un `VoidTaskResult`**: `return $ws` devolvía un array de dos elementos y el `SendAsync` fallaba con un error incomprensible.
  - Para el clic derecho se usan eventos de ratón de CDP, pero para pulsar botones se usa `element.click()`: React responde igual y no hay que acertarle a un botón que puede estar fuera del área visible, que es el fallo de la sesión anterior.
- **`.github/FUNDING.yml`** con el mismo destino que FormatDiskPro.
- Verificado: 22 pruebas de `cargo test` en verde, la app queda como estaba (`tauri.conf.json` sin tocar según `git status`, `settings.json` con `"theme": "system"`) y no sobrevive ningún proceso del script.
- **Detalle que faltaba del Tier 6.2:** el remoto local de esta carpeta seguía apuntando a la URL vieja. Queda anotado en §3 con el comando; el intento de cambiarlo desde la sesión lo bloqueó el clasificador de permisos.

### 2026-07-24 (noche) — Tier 6.1: licencia GPL-3.0 y avisos de terceros

- **GPL-3.0** elegida por el usuario, la misma que FormatDiskPro. `LICENSE` en la raíz, `license = "GPL-3.0-only"` en `package.json` y `Cargo.toml`, y sección de licencia en el README.
- `THIRD-PARTY-NOTICES.txt` con lo que el instalador **empaqueta**, no con todo `node_modules`: las herramientas de compilación no viajan dentro del binario y meterlas solo habría inflado el archivo.
- Dos cosas que salieron al reunir los datos y que no se sabían:
  - La tipografía **Geist va embebida** en la app y su **OFL-1.1 obliga** a distribuir el aviso de copyright con ella. Es la única dependencia con una obligación que no se cumple sola.
  - De los **515 crates** del árbol, **5 son MPL-2.0**. Es compatible con GPLv3 y su copyleft es por archivo; se usan sin modificar, así que no arrastran nada. Ninguna licencia del árbol es incompatible con la GPLv3, y como Apache-2.0 solo es compatible con la **v3** (no con la v2), la elección queda confirmada.
- **Los avisos viajan ya dentro del instalador**: `LICENSE` y `THIRD-PARTY-NOTICES.txt` como `bundle.resources`, más una sección **Acerca de** en Ajustes que los abre y enlaza al repositorio. Dos cosas que costaron encontrarlas:
  - La licencia se empaqueta renombrada a **`LICENSE.txt`**. Sin extensión, Windows no tiene asociación y pulsar el botón no hacía nada visible; el formato de mapa de `resources` permite renombrar al copiar, y el repositorio conserva `LICENSE` como espera GitHub.
  - **`opener:default` no incluye `open_path`**, solo `open_url`. Se concede aparte y con ámbito acotado a esos dos archivos.
- Aviso para verificar por CDP: la sección quedaba **por debajo del área visible** y los clics sintéticos no llegaban al botón. Hay que hacer `scrollIntoView` antes de calcular las coordenadas; si no, parece que la app no responde cuando el problema es la prueba.

### 2026-07-24 (noche) — Tier 5.6: v1.0.0 publicada, y Tier 6 abierto

- **`release.ps1` reescrito para este proyecto.** Se conserva del de FormatDiskPro lo que valía —`Invoke-Git` con su lección del `NativeCommandError`, validación de tags, rechazo de archivos sin rastrear, `-DryRun`, reutilización de la credencial de `gh`— y se cambia lo propio de Tauri: bump en los **tres** sitios más `cargo check` para que `Cargo.lock` no ensucie el árbol, `cargo test` + `npm run build` en vez de `dotnet test`, `npm run tauri build` en lugar del `build-installer.ps1` y los `.sha256` generados por el propio script. Fuera el bloque de `-UiTests`, la elevación y la USB.
- Corregido el texto heredado: aquí el `.sha256` es **cortesía**, no un requisito, porque no hay auto-actualización que lo verifique.
- **v1.0.0 publicada** (0.1.0 → 1.0.0: primera versión pública de una app completa y verificada en Windows). Commit `073209b`, tag `v1.0.0`, cuatro assets.
- Tres tropiezos, todos de PowerShell 5.1, anotados en el propio script: escapar comillas con `\"` cierra la cadena; las comillas tipográficas `“ ”` **también** las trata como delimitador; y un `.ps1` sin BOM se lee como ANSI, pero añadir el BOM dos veces deja un `U+FEFF` suelto que rompe el parser.
- **Tier 6 creado** tras comparar el repo con FormatDiskPro. Lo que falta, por orden: licencia y avisos de terceros (bloqueante), renombrar el repositorio, README de producto con capturas, pruebas del frontend, auto-actualización y herramientas del repo.

### 2026-07-24 (noche) — Tier 5.5: instaladores

- Metadatos de paquete en `tauri.conf.json` (`publisher`, `copyright`, `category`, descripciones) y autor real en `Cargo.toml`: **Ricky Angel Jiménez Bueno**. Sin esto el instalador sale sin autor.
- NSIS en modo `currentUser`: instala en `%LOCALAPPDATA%\ProcessDevKill` sin UAC. `npm run tauri build` produce el `.exe` de NSIS (2,44 MB) y el `.msi` de WiX (3,54 MB).
- Instalada y probada de verdad: arranca con su icono, lista procesos y responde.
- **Cerrada la salvedad del atajo global** pulsándolo de verdad (ver §3). El detalle que costó descubrirlo: `SendKeys` no dispara un atajo de `RegisterHotKey`, hace falta `keybd_event`.
- **Cerrada también la salvedad de las notificaciones**: el toast se ve, con icono y texto correctos. Antes se concluyó en falso que no salía, por comprobarlo con capturas por código; BitBlt no recoge los toast (ver §3).
- Aviso para futuras sesiones: **no reescribir estos `.md` con PowerShell 5.1**. `Get-Content -Raw` los lee con la página de códigos ANSI y, al guardarlos como UTF-8, deja todos los acentos y emojis destrozados. Pasó en esta sesión y hubo que revertir el doble encoding a mano. Para editarlos, herramientas que respeten UTF-8.
- La app quedó **instalada** en el equipo. Para quitarla: *Configuración → Aplicaciones → ProcessDevKill*, o el `uninstall.exe` de `%LOCALAPPDATA%\ProcessDevKill`.

### 2026-07-24 (noche) — Tier 5.4: Zombie Finder

- `ZombieWatch` en `processes.rs` recuerda desde cuándo lleva cada PID sin consumir CPU. Era lo que le faltaba a la app: cada `collect_processes` es una foto sin pasado.
- Un proceso es zombi si lleva parado los minutos configurados **y además ocupa un puerto**. Sin la segunda condición la función no sirve: en la máquina de pruebas, 7 de 10 procesos `node` marcan 0 % de CPU estando perfectamente sanos.
- `ProcessInfo` gana `idleSecs` y `zombie`; la regla la decide Rust y la UI solo la pinta (fila en ámbar + insignia con el tiempo y el puerto en el `title`).
- `read_list` unifica lectura y marcado, así que el refresco manual, el hilo y el evento posterior a un cierre pintan lo mismo.
- Seis tests nuevos (22 en total). Uno de ellos cazó un fallo real: `track` no limpiaba la marca anterior, de modo que un proceso que volvía a trabajar seguiría resaltado si la lista se reutilizaba. La marca es un dato calculado, no acumulado.
- Verificado en vivo el ciclo entero, con el umbral en 1 minuto: se marca al cumplirlo, un proceso ocupado al 9,4 % nunca se marca, y al darle 65 000 peticiones al servidor parado pierde la marca en el refresco siguiente. Detalle en ROADMAP §Tier 5.4.

### 2026-07-24 (noche) — Tier 5.4: Auto-Kill por umbral de RAM

- Ajustes nuevos `autoKillEnabled` (false de fábrica) y `autoKillMb` (2048), con sección propia en Ajustes: interruptor, campo de MB y la advertencia de que cierra sin preguntar.
- La vigilancia vive en el hilo que ya emitía `processes-updated`: `watch_cycle` lee la lista una vez, deja actuar al Auto-Kill y publica. Con el refresco en "Off" se sigue vigilando cada 2 s sin publicar nada.
- Todo cierre automático pasa por `kill_and_record` con el origen nuevo `KillSource::Auto`, así que registra historial y refresca la UI como el resto. La notificación la compone el Auto-Kill (motivo, MB y puertos liberados) y por eso se calla la de puertos, que si no saldrían dos seguidas.
- Tres tests nuevos (16 en total): el criterio del umbral con números exactos, el suelo de 256 MB y el formato de memoria de la notificación, que debe coincidir con el de la tabla.
- Verificado con procesos `node` de mentira de 600 MB creados a propósito: mueren solos, los 7 `node` reales de la máquina no se tocan, el puerto se libera y el historial lo marca como Auto-Kill. Detalle en ROADMAP §Tier 5.4.
- Un fallo de diseño detectado al probarlo: el campo del umbral estaba deshabilitado hasta encender el interruptor, lo que obligaba a armar el Auto-Kill con el valor por defecto para poder cambiarlo. Ahora es editable siempre.
- Falsa alarma que conviene no repetir: los interruptores parecían no moverse al encenderse. Tailwind v4 usa la propiedad CSS `translate`, no `transform`; medido en el DOM, el pulsador pasa de 1 px a 15 px y cambia de color.

### 2026-07-24 (tarde) — Cierre del Tier 5.1-5.3: segunda verificación y pulido

> Sesión de repaso: dos sesiones de Claude Code trabajaron el mismo tier a la vez sobre este repo y se pisaron los archivos. Quedó una sola y esta entrada recoge lo que se comprobó y arregló después. **Lección: una sesión por repositorio**; dos agentes editando en paralelo se sobrescriben sin darse cuenta y el `tauri dev` de uno reinicia la app que el otro está inspeccionando.

- **Verificación repetida desde cero** sobre la app recién compilada, porque los componentes se habían tocado después de la primera pasada. Detalle en ROADMAP §Tier 5.7. Lo que más importa: Escape sigue cancelando el diálogo destructivo sin matar nada, y confirmar mata de verdad, libera el puerto, avisa con el toast y lo registra en el historial.
- **La bandeja ya usa `pids_of_runtime`.** Repetía el filtro por su cuenta, así que la función —y el test que la cubre— no protegían realmente al menú de la bandeja, que es el camino que mata procesos sin ventana delante. Ahora el test vale para lo que dice que vale.
- **Textos en singular.** Cerrar un solo proceso decía "Se terminaran los 1 procesos seleccionados".
- **`Checkbox` de shadcn** en la tabla: la casilla nativa era un cuadrado blanco macizo sobre el tema oscuro.
- `cargo build` queda sin avisos de código muerto (`BUILT_INS` es de test, y `Runtime` solo lo usaba el módulo de tests de `lib.rs`).
- Retirado de `tauri.conf.json` el `additionalBrowserArgs` con el puerto 9222 que hacía falta para inspeccionar la UI.

### 2026-07-24 — Tier 5 (puntos 1-3): nombre, tema, shadcn/ui e icono
- **La app pasa a llamarse ProcessDevKill.** Cambiados `productName`, título de ventana, menú y tooltip de la bandeja, título de la notificación, crate de Rust (`processdevkill_lib`), paquete npm e identificador (`com.processdevkill.app`). Los ajustes viven ahora en `%APPDATA%\com.processdevkill.app\`.
- **Tema claro/oscuro** con las variables de shadcn, pero con paleta propia para conservar el azul oscuro de los tiers anteriores. Selector Sistema/Claro/Oscuro en Ajustes, persistido en `settings.json`; `src/theme.tsx` aplica la clase `dark` y escucha `prefers-color-scheme` cuando el modo es "Sistema".
- **shadcn/ui** inicializado (estilo `base-nova`, sobre **Base UI**, no Radix). El diálogo de confirmación pasa a `AlertDialog`, cada fila tiene `ContextMenu` y los avisos van por **Sonner**. Se reescribió `sonner.tsx` para no depender de `next-themes`.
- **Portapapeles:** el menú contextual copia PID, nombre, puertos y `http://localhost:PUERTO`. Se descubrió al probarlo que `navigator.clipboard.writeText` falla con `NotAllowedError: Document is not focused`, así que se añadió `tauri-plugin-clipboard-manager` (solo permiso de escritura).
- **Icono propio** desde `app-icon.svg`. Dos tropiezos: un degradado no pinta sobre una línea de ancho cero (hay que usar `gradientUnits="userSpaceOnUse"`), y el adorno `>` que llevaba la primera versión era un borrón a 16 px.
- Dos ajustes de estética salidos de mirar la captura: las tres pestañas del sidebar no cabían en 208 px y "Ajustes" se salía por el borde; y el rojo del `variant="destructive"` de shadcn es demasiado tenue para el botón que cierra toda la lista.
- Verificado sobre la app en ejecución (ver ROADMAP §Tier 5.7): tema en los dos sentidos y persistido en disco, menú contextual con sus cinco opciones, copia real al portapapeles de Windows (`Get-Clipboard` lo confirma) y **Escape sigue cancelando el diálogo sin matar ningún proceso**.
- 13 tests de `cargo test` (antes 12): el nuevo fija que un `settings.json` de una versión anterior, sin el campo `theme`, se sigue leyendo en vez de descartarse entero.

### 2026-07-23 (noche) — Tier 4 completo
- `lib.rs` dividido en cuatro módulos antes de crecer más; los tests subieron de 7 a 12 al poder probar cada pieza por separado.
- Persistencia propia en `%APPDATA%\com.processvisor.app\{settings,history}.json`. Un JSON corrupto degrada a valores por defecto en vez de impedir el arranque, con test que lo cubre.
- Vistas nuevas de Historial y Ajustes, con navegación en el sidebar.
- El frontend ya no hace polling: Rust emite `processes-updated` desde un hilo propio.
- Atajo `Ctrl+Alt+K` con interruptor en Ajustes. Verificado por registro/liberación, sin dispararlo (habría matado los procesos reales del equipo).

### 2026-07-23 (noche) — Tier 3 completo
- Puertos por PID con el crate `listeners` 0.6, filtrando TCP en escucha y deduplicando IPv4/IPv6. Columna "Puerto" en la tabla y búsqueda por número de puerto.
- Notificaciones nativas desde Rust al liberar puertos; plugin registrado y permiso `notification:default` añadido.
- System tray con menú (Mostrar / Cerrar todos los Node·Python·.NET / Salir), clic izquierdo restaura la ventana, y cerrar la ventana la esconde en la bandeja.
- Verificado que la detección de puertos distingue escucha de conexión saliente, y que `WM_CLOSE` esconde la app sin matarla.
- Dos tests nuevos: puertos sobre sockets reales y selección de PIDs por runtime (la del menú de la bandeja, que si se equivoca mata procesos sin ventana abierta para verlo).

### 2026-07-23 (noche) — Tier 2 completo
- Backend: comando `kill_processes` para lotes, con resultado por PID.
- Frontend: iconos SVG por runtime, barras de CPU/RAM, animaciones de salida con Motion, auto-refresco conmutable (Off/2s/5s), buscador por nombre o PID, selección múltiple y "Nuke All" con diálogo de confirmación.
- Código repartido en `src/icons.tsx`, `src/components/{UsageBar,ConfirmDialog,ProcessTable}.tsx` y `src/types.ts` (helpers de formato compartidos).
- Verificado end-to-end vía CDP, incluida la parte que más importa: **Escape cancela el diálogo sin matar nada**, y confirmar sí mata los procesos de verdad.

### 2026-07-23 (tarde) — Tier 1 desbloqueado, verificado y con un bug corregido
- Reparado el toolset MSVC añadiendo el componente de C++ (ver §3). `cargo` ya compila.
- **Bug encontrado y corregido: todos los procesos reportaban 0 % de CPU.** Los tests iniciales no lo cazaron porque los procesos de la máquina estaban ociosos y 0 % parecía plausible; se descubrió al lanzar un proceso `node` quemando un núcleo a propósito. Causa: `System::new()` deja vacía la lista de CPUs y sysinfo multiplica por `cpus.len()`. Añadido `reporta_cpu_de_un_proceso_ocupado` como test de regresión.
- Descubierto además que sysinfo necesita **tres** muestras para dar un porcentaje real; el calentamiento pasó de una a dos muestras previas.
- Añadidos tests de lectura del sistema real y del contrato JSON con `src/types.ts`. Total: 5 tests en verde.
- Verificación end-to-end sobre la app en ejecución, inspeccionando el DOM real vía CDP: la tabla lista 13 procesos `node` con datos correctos y el botón "Kill" mata un proceso de verdad.

### 2026-07-23 — Tier 1 implementado, bloqueado en compilación
- Instalado Rust 1.97.1 vía `rustup` (no estaba en el equipo).
- Proyecto creado con `create-tauri-app` (React + TS + Vite), renombrado a ProcessVisor (nombre provisional; en el Tier 5 pasó a ProcessDevKill), y Tailwind v4 configurado. `npm run build` pasa.
- Backend `src-tauri/src/lib.rs`: comandos `get_processes` y `kill_process` con `sysinfo` 0.39, más dos tests de la función `classify`.
- Frontend `src/App.tsx`: sidebar con filtros por runtime, botón de refresco y tabla con nombre, PID, CPU, RAM, tiempo activo y botón Kill.
- `git init` + primer commit.
- **La API de `sysinfo` que devolvió la documentación indexada era incorrecta** (mostraba `System::new_all()` devolviendo `Result`). Se verificó contra el código fuente real del crate en `~/.cargo/registry`. Conviene repetir esa comprobación en futuras actualizaciones del crate.
- 🚧 Bloqueado: el toolset MSVC del equipo está incompleto y `cargo` no enlaza. Ver §3.

### 2026-07-23 — Planificación inicial
- Se revisó y verificó técnicamente la idea original del roadmap (correcciones: Tailwind v4, Motion, crate para puertos, estrategia de CI).
- Se crearon `ROADMAP.md` (plan verificado) y `CONTEXT.md` (este documento).
