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

**Fase actual:** ✅ Tiers 1 a 4 completados; Tier 5 hecho hasta el icono (puntos 1-3), pendientes las ideas "Salsa Secreta" y los instaladores.

| Tier | Descripción | Estado |
|---|---|---|
| 1 | Cimientos y MVP | ✅ Completado y verificado |
| 2 | UX/UI y reactividad | ✅ Completado y verificado |
| 3 | Puertos, notificaciones, tray | ✅ Completado y verificado |
| 4 | Power user y optimización | ✅ Completado y verificado |
| 5 | Estética (tema, shadcn/ui, icono) | ✅ Puntos 1-3 completados y verificados |
| 5 | Salsa Secreta: Auto-Kill y Zombie Finder | ✅ Punto 4 completado y verificado |
| 5 | Instaladores y publicación de releases | ⬜ Puntos 5 y 6 pendientes |

Verificado el 2026-07-23 con la app corriendo: la UI lista procesos reales con CPU, RAM, tiempo y **puerto**; buscar por puerto localiza el proceso y matarlo lo libera de verdad; la lista se actualiza sola por eventos desde Rust; ajustes e historial sobreviven al reinicio; cerrar la ventana la esconde en la bandeja sin terminar la app.

Añadido el 2026-07-24, también sobre la app en ejecución: la ventana sigue el tema de Windows y obedece al selector de Ajustes (que persiste en disco), el menú contextual de cada fila copia PID/nombre/puerto al portapapeles real de Windows con su toast, y el diálogo destructivo —ahora el AlertDialog de shadcn— sigue cancelándose con Escape sin matar nada. El Auto-Kill, con un umbral de prueba, cierra solo un proceso de 651 MB y deja intactos los 7 `node` reales de la máquina. 16 tests de `cargo test` en verde.

**Salvedad honesta sobre el atajo global:** se comprobó que `Ctrl+Alt+K` se registra y se libera correctamente (con él activo ningún otro proceso puede tomarlo), pero **no se llegó a pulsar**: dispararlo habría cerrado los ~13 procesos `node` reales del equipo. La ruta de cierre que ejecuta es la misma `kill_and_record` que usan la ventana y la bandeja, ambas verificadas end-to-end.

**Salvedad honesta sobre las notificaciones:** se comprobó que `notification().show()` devuelve `Ok` (stderr de la app limpio), pero **no** que el toast aparezca en pantalla. En Windows, una build de desarrollo sin instalar puede no renderizar el toast, y el Asistente de concentración puede suprimirlo. Conviene confirmarlo a ojo tras generar el instalador en el Tier 5.

**Próximo paso concreto:** Tier 5.5 → generar los instaladores con `npm run tauri build` y comprobar sobre la app instalada las dos salvedades de abajo. Después, el `release.ps1` (5.6).

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
| 2026-07-24 | El menú de la bandeja llama a `pids_of_runtime` en vez de repetir el filtro | El test `selecciona_solo_los_pids_del_runtime_pedido` decía cubrir la bandeja, pero la bandeja tenía su propia copia del filtro: el test protegía código que nadie usaba |
| 2026-07-24 | Una sola sesión de Claude Code por repositorio | Dos trabajando a la vez se sobrescriben los archivos, y el `tauri dev` de una reinicia la app que la otra está inspeccionando por CDP |
| 2026-07-24 | El Auto-Kill nace apagado y con suelo de 256 MB en el umbral | Es lo único de la app que mata sin que nadie se lo pida. Un umbral bajo por descuido (o heredado de un `settings.json` editado a mano) cerraría el entorno de desarrollo entero, así que el suelo se aplica también al leer del disco |
| 2026-07-24 | El Auto-Kill sigue vigilando con el auto-refresco en "Off" | Una red de seguridad que deja de mirar porque la ventana no se refresca no es una red de seguridad. Se vigila cada 2 s sin publicar la lista, que es lo que el usuario pidió al apagar el refresco |
| 2026-07-24 | El umbral se guarda al salir del campo, no al teclear | Escribir "2048" pasa por "2"; guardando en cada pulsación el umbral bajaría al mínimo un instante con el vigilante en marcha |
| 2026-07-24 | `watch_cycle` lee la lista una vez y luego publica | Vigilar y refrescar por separado enumeraba procesos y sockets dos veces por ciclo, que es justo el trabajo que el Tier 4 sacó del frontend |
| 2026-07-24 | Un zombi tiene que ocupar un **puerto**, no solo estar parado | Casi todo proceso de desarrollo en reposo marca 0 % de CPU (7 de 10 en la máquina de pruebas). Sin esa condición se resaltaría la tabla entera, que es igual que no resaltar nada |
| 2026-07-24 | El corte de "sin actividad" es 0,5 % de CPU, no 0 | Un servidor parado sigue despertando por sus temporizadores y el recolector de basura, y marca décimas sueltas |
| 2026-07-24 | Apagar el Zombie Finder borra las rachas acumuladas | Mientras estuvo apagado nadie miraba; contar ese rato al reactivarlo sería inventárselo |
| 2026-07-24 | `ZombieWatch` olvida los PIDs que desaparecen | La app vive días en la bandeja: el mapa crecería sin fin, y un PID reciclado por Windows heredaría la racha del proceso anterior |

## 5. Decisiones pendientes

- [x] ~~**Nombre definitivo**~~ → **ProcessDevKill** (2026-07-24).
- [x] ~~Repositorio remoto~~ → <https://github.com/xfiberex/ProcessVisorDev> (rama `main`).
- [ ] **El repositorio sigue llamándose `ProcessVisorDev`.** Renombrarlo en GitHub es opcional: el servicio deja una redirección automática, pero conviene actualizar el remoto local después (`git remote set-url origin https://github.com/xfiberex/ProcessDevKill.git`).
- [ ] Lista inicial de procesos vigilados por defecto (¿incluir `java`, `deno`, `bun` desde el inicio?).
- [ ] Firma de código: sin ella, Windows enseñará el aviso de SmartScreen ("editor desconocido") al instalar. Decidir antes de publicar el primer release.

## 6. Cómo retomar el proyecto en otro equipo

1. Clonar el repositorio: `git clone https://github.com/xfiberex/ProcessVisorDev.git` (el repo conserva el nombre antiguo; la app se llama ProcessDevKill).
2. Instalar prerequisitos: [Rust](https://rustup.rs) (`rustup`), Node.js LTS, y en Windows los **Microsoft C++ Build Tools**. WebView2 ya viene en Windows 11.
3. `npm install` en la raíz.
4. `npm run tauri dev` para desarrollo; `npm run tauri build` para generar el instalador.
5. Leer este archivo (estado y decisiones) y el [ROADMAP.md](ROADMAP.md) (siguiente checkbox pendiente).

## 7. Convenciones

- Comandos Tauri en Rust: `snake_case` (`get_processes`, `kill_process`).
- Los checkboxes del ROADMAP.md se marcan `[x]` **solo cuando la funcionalidad está probada** en `tauri dev`.
- Toda decisión técnica que contradiga o precise el roadmap se anota en la tabla de la sección 4 con fecha.
- Commits en español, imperativo: "Añade comando get_processes".

## 8. Registro de sesiones

> Añadir una entrada por sesión de trabajo, la más reciente arriba.

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
