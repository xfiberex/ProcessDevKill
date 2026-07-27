# 🚀 Roadmap: ProcessDevKill — Process Manager para Devs

> Aplicación de escritorio construida con **Tauri 2 + React + Vite + TypeScript** para la gestión inteligente de procesos de desarrollo (`node`, `python`, `dotnet`, …).
>
> **Documento verificado** — 2026-07-23. Las notas ⚠️ marcan correcciones respecto a la idea original. El progreso y las decisiones se registran en [CONTEXT.md](CONTEXT.md).

---

## 🛠 Tier 1: Cimientos y MVP — ✅ **completado y verificado**
*Objetivo: tener una lista funcional de procesos y poder matarlos.*

- [x] **Configuración del entorno:**
    - [x] Node.js LTS (v24.18) y npm (11.12) — ya estaban instalados.
    - [x] Rust vía `rustup` → 1.97.1 instalado.
    - [x] **Microsoft C++ Build Tools** — la instalación de VS 18 venía sin headers ni librerías de escritorio; se añadió el componente `Microsoft.VisualStudio.Component.VC.Tools.x86.x64`.
    - [x] Inicializar proyecto: plantilla **React + TypeScript + Vite** de `create-tauri-app`.
    - [x] `git init` + primer commit.
    - [x] Configurar **Tailwind CSS v4**.
      > ⚠️ La instalación cambió respecto a v3: `npm install tailwindcss @tailwindcss/vite`, registrar el plugin en `vite.config.ts` y añadir `@import "tailwindcss";` en el CSS. Ya no se necesita `tailwind.config.js` ni PostCSS.
- [x] **Backend (Rust):**
    - [x] Añadir crate `sysinfo` (0.39) a `src-tauri/Cargo.toml`, solo con la feature `system`.
    - [x] Comando `get_processes`: filtra por runtime y ordena por RAM descendente.
      > ⚠️ La comparación **no** es por prefijo simple como decía el plan original: `nodemon.exe` empezaría por `node` sin ser Node. Se exige nombre exacto o sufijo de versión (`python3.11`), con tests que lo cubren.
    - [x] Comando `kill_process(pid)` con `Process::kill()`, más una guardia que rechaza PIDs que no sean de un runtime vigilado.
    - [x] Una sola instancia de `System` en `State<Mutex<System>>`, refrescada con `refresh_processes_specifics` (solo CPU y memoria).
    - [x] Calentamiento de CPU al arrancar, en un hilo aparte.
      > ⚠️ Hacen falta **tres** muestras, no una: sysinfo descarta la primera sin guardar líneas base y la segunda las compara contra cero. Ver CONTEXT.md §4.
- [x] **Frontend (React):**
    - [x] Layout Sidebar (filtros por runtime con contadores) + Main Content.
    - [x] Botón manual de "Refrescar" (`invoke("get_processes")`).
    - [x] Tabla con: Nombre, PID, CPU, RAM, tiempo activo y botón "Kill".
- [x] **Verificación end-to-end** (2026-07-23, sobre la app en ejecución):
    - [x] 5 tests de `cargo test` en verde, incluidos dos contra los procesos reales de la máquina.
    - [x] La UI lista 13 procesos `node` reales con RAM y tiempo correctos; contadores del sidebar coherentes.
    - [x] Un proceso saturando un núcleo reporta 6,28 % en un equipo de 16 núcleos (100/16 = 6,25 ✓).
    - [x] El botón "Kill" mata un proceso real: la fila desaparece y el PID deja de existir en el sistema.

---

## 🎨 Tier 2: UX/UI y Reactividad — ✅ **completado y verificado**
*Objetivo: que la app sea visualmente atractiva y fácil de usar.*

- [x] **Visualización avanzada:**
    - [x] Iconos por lenguaje (Node.js, Python, .NET) como **SVG inline** en `src/icons.tsx`, sin peticiones de red.
    - [x] Barras de consumo (CPU y RAM) por proceso.
      > ⚠️ Las barras se escalan al proceso que más consume de la lista, **no** a la capacidad total del equipo: con 32 GB de RAM, un Node de 300 MB daría una barra invisible. El número junto a la barra sí es el valor absoluto real.
    - [x] Animaciones al eliminar procesos con **Motion** (`AnimatePresence` + `motion.tr`).
      > ⚠️ Framer Motion fue renombrado: el paquete ahora es `motion` y se importa desde `motion/react`.
- [x] **Automatización de UI:**
    - [x] Auto-refresco conmutable (Off / 2 s / 5 s) con guardia para no encolar peticiones si una tarda más que el intervalo. En Tier 4 se migra a eventos desde Rust.
    - [x] Buscador por nombre o PID.
- [x] **Acciones masivas:**
    - [x] Botón **"Nuke All"** (cierra los procesos de la lista filtrada) con diálogo de confirmación.
    - [x] Casillas de selección múltiple; el botón pasa a "Matar N" cuando hay selección.
    - [x] Comando `kill_processes` en Rust que devuelve un resultado por PID en vez de abortar al primer fallo.
- [x] **Verificación end-to-end** (2026-07-23, inspeccionando el DOM real vía CDP):
    - [x] 15 iconos SVG y 30 barras de consumo renderizadas (2 por fila).
    - [x] Buscar por PID filtra de 15 filas a 1; buscar texto inexistente muestra el mensaje vacío.
    - [x] Auto-refresco: la columna "Activo" pasa de `33m` a `34m` sin intervención.
    - [x] Seleccionar 2 procesos cambia el botón a "Matar 2"; el diálogo abre con el foco en el botón destructivo.
    - [x] **Escape cancela sin matar nada** (los 2 procesos siguen vivos tras cancelar).
    - [x] Confirmar mata ambos de verdad: desaparecen de la tabla y del sistema.
    - [x] Motion anima la salida: opacidad 1 → 0 y `translateX` 0 → −24 px antes de quitar la fila del DOM.

---

## 🔧 Tier 3: Integración profunda con el sistema — ✅ **completado y verificado**
*Objetivo: dar información técnica que la terminal no da fácilmente.*

- [x] **Detección de puertos (feature estrella):**
    - [x] Mapear cada PID a sus puertos locales en escucha con el crate [`listeners`](https://crates.io/crates/listeners) 0.6.
      > ⚠️ Confirmado: `sysinfo` **no expone puertos por proceso**, hizo falta el crate aparte.
      > ⚠️ `listeners::get_all()` devuelve **todos** los sockets, incluidas las conexiones salientes. Hay que filtrar por `Protocol::TCP` + `SocketState::Listen`; si no, la UI mostraría el puerto efímero de una petición HTTP en vez del puerto donde sirve tu servidor.
      > ⚠️ Un servidor que escucha en IPv4 e IPv6 aparece dos veces con el mismo puerto: hay que deduplicar.
      > ⚠️ En Windows, ver puertos de procesos de **otros usuarios** puede requerir permisos elevados; los procesos propios de desarrollo no tienen problema.
    - [x] Columna "Puerto" prominente, justo después del nombre, con el puerto como badge.
    - [x] El buscador encuentra también por número de puerto.
- [x] **Notificaciones nativas:**
    - [x] Plugin `tauri-plugin-notification` registrado en el `Builder` + permiso `notification:default` en `capabilities/`.
    - [x] Notificación al liberar puertos, emitida **desde Rust**: el menú de la bandeja también mata procesos sin que la ventana intervenga, así que la lógica no puede vivir en el frontend.
- [x] **System Tray:**
    - [x] Features `tray-icon` e `image-png` de Tauri; menú con `TrayIconBuilder` (`on_menu_event` + `on_tray_icon_event`).
    - [x] Cerrar la ventana la esconde en la bandeja (`CloseRequested` + `api.prevent_close()`).
    - [x] Menú: "Mostrar ProcessDevKill", "Cerrar todos los Node/Python/.NET" y **"Salir"**.
      > ⚠️ La opción "Salir" no estaba en el plan pero es imprescindible: sin ella, esconder la ventana al cerrar deja la app sin forma de terminar.
- [x] **Verificación end-to-end** (2026-07-23):
    - [x] Un servidor de prueba en el 4321 aparece con ese puerto; su puerto efímero saliente (60117) **no** se muestra.
    - [x] Solo 2 de 13 procesos muestran puerto, y son los correctos — incluido el **1420 del propio Vite**.
    - [x] Buscar "4321" filtra a 1 fila y matarla libera el puerto de verdad.
    - [x] `WM_CLOSE` nativo (lo que hace el botón X): el proceso sigue vivo y la ventana deja de ser visible.
    - [x] 7 tests de `cargo test` en verde, incluidos puertos reales y selección por runtime.

---

## ⚡ Tier 4: Power User y optimización — ✅ **completado y verificado**
*Objetivo: pulir detalles y mejorar el rendimiento.*

- [x] **Refactor previo:** `lib.rs` se dividió en `processes.rs`, `ports.rs`, `storage.rs` y `tray.rs` antes de seguir creciendo.
- [x] **Logs y auditoría:**
    - [x] Vista "Historial" con fecha, proceso, PID, puertos liberados y **origen** (ventana / bandeja / atajo).
    - [x] Persistido en `app_data_dir/history.json`, lo más reciente primero, con tope de 200 entradas para que el archivo no crezca sin fin.
      > Se descartó `tauri-plugin-store`: su API es de frontend, y aquí la bandeja y el atajo escriben historial sin que la ventana intervenga.
- [x] **Configuración personalizada:**
    - [x] Lista de procesos vigilados editable (`docker`, `go`, `php`, …), persistida en `settings.json`. Los nombres se normalizan en Rust: minúsculas, sin `.exe`, sin duplicados.
      > ⚠️ Los nombres del usuario se comparan **exactos**, no por prefijo: añadir `go` no debe capturar `golang`.
    - [x] Atajo global `Ctrl+Alt+K` con `tauri-plugin-global-shortcut` + permiso en `capabilities/`.
      > ⚠️ Añadido un interruptor en Ajustes para desactivarlo: dispara un cierre masivo **sin confirmación**, y un atajo global mal pulsado no debería ser irreversible por accidente. Queda registrado en el historial.
- [x] **Rendimiento:**
    - [x] El `setInterval` del frontend se sustituyó por un hilo en Rust que emite `processes-updated`; React solo escucha con `listen()`. El intervalo se configura desde la UI y se persiste.
- [x] **Verificación end-to-end** (2026-07-23):
    - [x] La tabla se actualiza sola (13 → 14 filas, "Activo" de 34s a 38s) **sin polling en el frontend**.
    - [x] Añadir un ejecutable propio lo hace aparecer al instante, clasificado en el filtro "Otros".
    - [x] Al matar un proceso, el historial registra nombre, PID, puerto liberado y origen.
    - [x] Ajustes e historial **sobreviven al reinicio** de la app.
    - [x] Atajo global comprobado sin dispararlo: con él activo ningún otro proceso puede registrar `Ctrl+Alt+K`; al desactivarlo queda libre; al reactivarlo lo vuelve a tomar.
    - [x] 12 tests de `cargo test` en verde (antes 7).

---

## 📦 Tier 5: Distribución y estética final
*Objetivo: que parezca un producto comercial.*

> **La app pasa a llamarse ProcessDevKill** (2026-07-24). Cambian el `productName`, el título de la ventana, la bandeja, el crate de Rust y el identificador (`com.processdevkill.app`), que es lo que decide dónde viven los ajustes y el historial.

### 1. Modo oscuro / claro — ✅ **completado y verificado**
- [x] Variante `dark` de Tailwind v4 (`@custom-variant dark`) sobre las variables de tema de shadcn, con paletas propias para claro y oscuro.
- [x] Selector **Sistema / Claro / Oscuro** en Ajustes, persistido en `settings.json` junto al resto de opciones.
  > ⚠️ La clase `dark` **no** la pone la media query de CSS, sino `src/theme.tsx`: si lo decidiera el CSS, elegir "Claro" con Windows en oscuro no tendría ningún efecto. Con "Sistema" se escucha `prefers-color-scheme` en vivo y la app cambia sin reiniciar.
  > ⚠️ Añadir un campo a `Settings` habría invalidado el `settings.json` de las versiones anteriores; el struct ya llevaba `#[serde(default)]`, y ahora hay un test que lo fija.
- [x] Script en `index.html` que aplica el tema **antes** de la primera pintura, leyendo una copia en `localStorage`: los ajustes llegan de Rust de forma asíncrona y sin esto la ventana arrancaría en blanco durante unos milisegundos.

### 2. Componentes de shadcn/ui — ✅ **completado y verificado**
- [x] Alias `@/` en `vite.config.ts` **y** en `tsconfig.json` (hacen falta los dos: uno resuelve el bundle y el otro el chequeo de tipos).
- [x] `AlertDialog` para las confirmaciones, `ContextMenu` por fila y `Toaster` (Sonner) para los avisos.
  > ⚠️ shadcn ya no genera sobre Radix: el estilo actual (`base-nova`) usa **Base UI** (`@base-ui/react`). El `Toast` clásico tampoco existe: su sustituto es **Sonner**.
  > ⚠️ El `sonner.tsx` generado importa `next-themes`; se reescribió para leer el tema de `src/theme.tsx` y se desinstaló el paquete.
  > ⚠️ El foco al abrir el diálogo se fuerza con `initialFocus`: Base UI enfoca "Cancelar" y aquí se mantiene el foco en el botón destructivo de los Tiers 2-4.
- [x] `Checkbox` de shadcn en la tabla, en lugar del `<input type="checkbox">` en crudo.
  > Era lo único que rompía la coherencia visual: sobre el tema oscuro, la casilla nativa de Windows es un cuadrado blanco macizo entre componentes que respetan la paleta.
- [x] Menú contextual con "Matar proceso", "Copiar PID / nombre / puerto" y "Copiar http://localhost:PUERTO".
  > ⚠️ Copiar **no** puede usar `navigator.clipboard`: la API web exige que el documento tenga el foco y lanza `NotAllowedError` si no lo tiene. Se añadió `tauri-plugin-clipboard-manager` con el permiso `clipboard-manager:allow-write-text` (solo escritura).

### 3. Icono propio — ✅ **completado y verificado**
- [x] `app-icon.svg` en la raíz → `npm run tauri icon app-icon.svg` genera todos los tamaños de `src-tauri/icons/`.
  > ⚠️ El símbolo tiene que aguantar los 16 px de la bandeja: la primera versión llevaba un corchete `>` que a ese tamaño era un borrón sobre el anillo.
  > ⚠️ La barra vertical del símbolo de encendido no se pintaba: un degradado con el `objectBoundingBox` por defecto no se aplica a una línea de **ancho cero**. Se arregló con `gradientUnits="userSpaceOnUse"`.
- [x] Se borran `icons/android/` e `icons/ios/`, que genera el comando pero no usa una app de escritorio.

### 4. Ideas "Salsa Secreta" — ✅ **completadas y verificadas**

**Auto-Kill — ✅ completado y verificado**

- [x] Cierra automáticamente los procesos vigilados que superen un umbral de RAM configurable, con notificación nativa y entrada en el historial con origen `auto`.
- [x] **Apagado por defecto** y con umbral por defecto de 2048 MB. Interruptor y umbral en Ajustes, persistidos en `settings.json`.
  > ⚠️ Un `settings.json` de una versión anterior no trae los campos nuevos: el test `los_ajustes_de_una_version_anterior_siguen_valiendo` fija que actualizar la app **nunca** enciende solo el Auto-Kill.
- [x] Suelo de **256 MB** para el umbral (`MIN_AUTO_KILL_MB`).
  > ⚠️ No es validación de formulario: con un umbral de 50 MB, cualquier proceso vigilado lo supera y el siguiente ciclo se lleva por delante el entorno entero. Se aplica al guardar **y** al leer, porque `settings.json` es un archivo que el usuario puede editar a mano.
- [x] El umbral se compara en estricto (`>`): quien esté justo en el límite no muere. Lo fija `el_auto_kill_solo_elige_a_quien_pasa_del_umbral`, sobre la función pura `over_memory_limit`.
- [x] La vigilancia va en el hilo que ya emitía `processes-updated`, reaprovechando la misma lectura de procesos; no se enumera dos veces por ciclo.
- [x] **Sigue vigilando con el auto-refresco en "Off"**, a un ritmo fijo de 2 s y sin publicar la lista.
  > ⚠️ Es la diferencia entre una red de seguridad y un adorno: si dejara de mirar porque la ventana no se refresca, el usuario se creería protegido sin estarlo.
- [x] El campo del umbral se guarda al salir del campo, no en cada tecla.
  > ⚠️ Escribir "2048" pasa por "2": guardar en cada pulsación dejaría el umbral en el mínimo durante un instante, con el vigilante mirando.
- [x] El campo es editable con el Auto-Kill apagado, para poder configurarlo **antes** de armarlo.
  > ⚠️ Se descubrió probándolo: con el campo deshabilitado había que encender primero, y ese rato con el umbral por defecto puede cerrar algo legítimo.

**Verificación end-to-end** (2026-07-24, con procesos `node` de mentira creados para la prueba):

- [x] Un proceso de 651 MB con el puerto 4321 ocupado, umbral en 400 MB: **muere solo** en el siguiente ciclo.
- [x] Los **7 procesos `node` reales** de la máquina (el mayor, 118 MB) siguen vivos. El criterio discrimina.
- [x] El puerto 4321 queda libre y el historial registra `pid, freedPorts [4321], source "auto"`; la vista de Historial lo muestra como **Auto-Kill**.
- [x] Con el auto-refresco en "Off", un segundo proceso de 600 MB **también muere**.
- [x] Escribir 50 en el umbral lo corrige a 256 en la propia UI.
- [x] Tras apagar el interruptor, `settings.json` vuelve a `"autoKillEnabled": false` y no se cierra nada más.

**Zombie Finder — ✅ completado y verificado**

- [x] Resalta en ámbar, con una insignia "Zombi", los procesos sin actividad de CPU durante los minutos configurados **que además siguen ocupando un puerto**. No cierra nada: solo señala.
- [x] **Apagado por defecto**, con 10 minutos por defecto; interruptor y minutos en Ajustes, persistidos en `settings.json`. Mínimo 1 minuto.
- [x] `ZombieWatch` guarda desde cuándo lleva parado cada PID, que es lo que le faltaba a la app: `collect_processes` devuelve una foto sin pasado.
  > ⚠️ **La condición del puerto no es un adorno.** Casi todo proceso de desarrollo en reposo marca 0 % de CPU: en la máquina de pruebas, 7 de 10 `node`. Sin exigir puerto, la tabla entera saldría resaltada, que es lo mismo que no resaltar nada.
  > ⚠️ El umbral de CPU es 0,5 %, no 0 exacto: un servidor parado sigue despertando por sus temporizadores y el recolector de basura.
  > ⚠️ Se olvidan los PIDs que desaparecen. La app vive días en la bandeja: el mapa crecería sin fin, y un PID reciclado por Windows heredaría la racha del proceso anterior.
  > ⚠️ Al apagar la función se borran las rachas: mientras estuvo apagada nadie miraba, y contar ese rato sería inventárselo.
- [x] La marca la calcula Rust y la UI solo la pinta; `read_list` es el único sitio donde se combinan lectura y marcado, así que el refresco manual, el hilo y el evento de cierre pintan siempre lo mismo.

**Verificación end-to-end** (2026-07-24, con el umbral bajado a 1 minuto para no esperar diez):

- [x] Recién encendido no marca nada: las rachas empiezan en ese momento.
- [x] Al pasar el minuto, marca **2 de 10** procesos: el servidor de pruebas del 4321 y el propio Vite del 1420. Los otros 7 `node`, parados pero sin puerto, no se tocan.
- [x] Un proceso **ocupado** (9,4 % de CPU) con el puerto 4322 **no** se marca en ningún momento.
- [x] La insignia dice desde cuándo: *"Sin actividad desde hace 1m, y sigue ocupando el puerto 4321"*.
- [x] Al darle trabajo al servidor parado (65 000 peticiones, 5 % de CPU), **pierde la marca en el refresco siguiente**; al volver a quedarse quieto no la recupera hasta cumplir otro minuto entero.
- [x] Apagar el interruptor quita las marcas de la tabla al instante.

> ⚠️ Limitación asumida: un servidor de desarrollo que está en uso pero ocioso —el propio Vite, sin ir más lejos— también sale marcado. La insignia dice cuánto lleva parado y qué puerto ocupa; la decisión de cerrarlo sigue siendo del usuario.

### 5. Instaladores — ✅ **completado**

- [x] Metadatos de paquete: `publisher`, `copyright`, `category` y descripciones. Sin ellos, el instalador y las propiedades del `.exe` salen sin autor.
- [x] NSIS en modo **`currentUser`**: instala en `%LOCALAPPDATA%\ProcessDevKill` sin pedir UAC, que es lo razonable para una herramienta de desarrollo.
- [x] `npm run tauri build` genera los dos instaladores de Windows:
  - `bundle/nsis/ProcessDevKill_0.1.0_x64-setup.exe` — 2,44 MB
  - `bundle/msi/ProcessDevKill_0.1.0_x64_en-US.msi` — 3,54 MB
  - El ejecutable (10,3 MB) lleva producto, versión, empresa y copyright correctos.
  > macOS (`.dmg`) no se puede generar desde Windows: queda para cuando haya máquina o CI de macOS.
- [x] **Verificado sobre la app instalada**, no sobre la de desarrollo: arranca con su icono propio en la barra de título, lista los procesos y responde.
- [x] **Salvedad del atajo global, cerrada.** Se pulsó `Ctrl+Alt+K` de verdad, con entrada sintetizada por `keybd_event`.
  > ⚠️ `SendKeys` **no** sirve para esto: manda mensajes a la ventana con el foco y un atajo registrado con `RegisterHotKey` no se entera. Hace falta entrada real a nivel de sistema.
  > Cerró los 4 procesos `node` vivos, liberó el puerto 4321 y dejó las 4 entradas en el historial con origen `hotkey`. El riesgo se acotó antes de pulsar: los únicos procesos vigilados eran auxiliares de la propia sesión de trabajo más un servidor de pruebas lanzado para esto.
- [x] **Salvedad de las notificaciones, cerrada.** El toast sale en pantalla con su icono, su título y el cuerpo correcto, confirmado a ojo sobre la app instalada. Windows la registra en *Configuración → Notificaciones* con Banners y Sonidos.
  > ⚠️ Se intentó automatizar la comprobación con capturas por código (`Graphics.CopyFromScreen`) y salían vacías, lo que llevó a concluir en falso que el banner no se pintaba: **BitBlt no recoge los toast**, que DWM compone en otra capa. Para esto o mira una persona, o se consulta el centro de notificaciones por WinRT.

### 6. Publicación de releases — ✅ **completado; v1.0.0 publicada**

- [x] Script `release.ps1` propio (pruebas + bump + build + tag + GitHub Release con `gh`), adaptado del de FormatDiskPro.
  > Decidido el 2026-07-24: se descarta GitHub Actions mientras el objetivo sea Windows. Ver CONTEXT.md §4.
  > Se conserva del original: `Invoke-Git` (la lección del `NativeCommandError` al capturar la salida), validación de tags local y remoto, rechazo de archivos sin rastrear, `-DryRun` y reutilización de la credencial cacheada de `gh`.
- [x] La versión se pone en los **tres** sitios de golpe y se corre `cargo check` para que `Cargo.lock` no deje el árbol sucio justo después del commit de release.
- [x] Los `.sha256` los genera el propio script: en Tauri no hay ningún paso de build que los produzca.
  > ⚠️ Y aquí son **cortesía**, no un requisito como en FormatDiskPro: sin auto-actualización nadie los verifica automáticamente. Si algún día se añade `tauri-plugin-updater`, ese usa firmas minisign, no SHA-256.
- [x] **v1.0.0 publicada** (subida desde 0.1.0: primera versión pública de una app completa). Cuatro assets, sin firmar.
  > ⚠️ Tres tropiezos de PowerShell 5.1 que cuestan una tarde: escapar comillas con `\"` **cierra la cadena**; las comillas tipográficas `“ ”` **también** cuentan como delimitador; y un `.ps1` sin BOM se lee como ANSI y rompe los acentos, pero añadir el BOM dos veces deja un `U+FEFF` suelto que atraganta al parser antes del primer bloque de comentarios.

### 7. Verificación end-to-end (2026-07-24, sobre la app en ejecución)
- [x] La ventana arranca con el tema del sistema (Windows en oscuro → `<html class="dark">`, fondo `oklch(0.175 0.009 265)`).
- [x] Elegir "Claro" quita la clase y el fondo pasa a `oklch(0.995 0.002 265)`; elegir "Oscuro" la devuelve.
- [x] La preferencia llega al disco: `%APPDATA%\com.processdevkill.app\settings.json` contiene `"theme": "dark"`.
- [x] Clic derecho sobre una fila abre el menú contextual con sus 5 opciones; la fila queda resaltada mientras está abierto.
- [x] Copiar deja el texto en el portapapeles de Windows y sale el toast de confirmación.
- [x] El diálogo de "Nuke All" sigue cancelándose con Escape **sin matar nada**, ahora sobre el AlertDialog de shadcn.
- [x] 13 tests de `cargo test` en verde (antes 12) y `npm run build` sin errores de tipos.

**Segunda pasada (misma fecha, sesión independiente).** Se repitió la verificación desde cero sobre la app recién compilada, porque los componentes se habían tocado después de la primera:

- [x] Con Windows en oscuro, la ventana arranca en `dark`; "Claro" la deja en `oklch(0.995 0.002 265)` y la copia `light` queda en `localStorage`. Medido aparte, coincide con lo de arriba.
- [x] De 9 procesos `node` listados, solo dos muestran puerto: el **1420 de Vite** y el **4321 de un servidor de pruebas** lanzado a propósito. Los demás, "—".
- [x] Clic derecho **real** (evento de ratón nativo, no sintético) sobre una fila: el menú abre con sus 5 opciones y la fila se resalta.
- [x] "Copiar PID" con la ventana **sin foco**: `Get-Clipboard` de PowerShell devuelve `11664`, el PID exacto de esa fila. Es justo el caso que fallaba con `navigator.clipboard`.
- [x] Seleccionar una fila cambia el botón a "Matar 1", el diálogo abre con el foco en el botón destructivo y **Escape cancela**: el proceso 11664 seguía vivo y su puerto 4321 seguía ocupado después.
- [x] Confirmar sí mata: el proceso deja de existir, el 4321 queda libre, sale el toast "node.exe cerrado / Puerto 4321 liberado" y el historial registra `pid 11664, freedPorts [4321], source "window"`.
- [x] Textos en singular cuando se cierra un solo proceso ("Se terminará el proceso seleccionado", botón "Cerrar proceso").
- [x] `cargo build` sin avisos de código muerto y 13 tests en verde tras hacer que la bandeja use `pids_of_runtime`.

---

## 🏗 Tier 6: Infraestructura de proyecto publicado
*Objetivo: que el repositorio aguante a alguien que no seas tú, ahora que el instalador está en la calle.*

Sale de comparar este repo con **FormatDiskPro** (2026-07-24), que lleva 15 versiones publicadas. Aquí solo están los huecos que aplican; lo que se descartó a propósito está anotado en CONTEXT.md §4.

### 1. Licencia y avisos legales — ✅ **completado**

- [x] `LICENSE` en la raíz: **GPL-3.0** (elegida el 2026-07-24, misma que FormatDiskPro).
  > ⚠️ No era burocracia: un repositorio público **sin licencia** es "todos los derechos reservados" por defecto. Con la v1.0.0 ya publicada, nadie tenía derecho legal a usar lo que se estaba descargando.
- [x] `THIRD-PARTY-NOTICES.txt` con lo que **el instalador empaqueta y distribuye**, no con todo lo que hay en `node_modules`: las herramientas de compilación no viajan dentro del binario.
  > ⚠️ Hallazgo al montarlo: la tipografía **Geist va embebida** en la app (`.woff2` dentro del bundle) y su licencia **OFL-1.1 obliga** a distribuir el aviso de copyright junto a ella. Es la única dependencia con una obligación que no se cubre sola.
  > ⚠️ De los 515 crates del árbol de Rust, **5 son MPL-2.0**: compatible con GPLv3 y con copyleft por archivo. Se usan sin modificar, así que no arrastran obligaciones; si algún día se parchea uno de esos archivos, hay que publicarlo bajo MPL-2.0.
  > ⚠️ Ninguna licencia del árbol es incompatible con la GPLv3 — todo es MIT, Apache-2.0, BSD, Zlib, ISC, Unicode-3.0, MPL-2.0 o equivalente. Apache-2.0 solo es compatible con GPL**v3**, no con la v2, lo que confirma la elección.
  > El archivo declara su propio alcance: se construyó con el campo `license` de cada paquete y no sustituye a una revisión legal.
- [x] `license` en `package.json` y `Cargo.toml` (`GPL-3.0-only`), y sección de licencia en el README.
- [x] Los avisos **viajan dentro del instalador**: `LICENSE` y `THIRD-PARTY-NOTICES.txt` van como `bundle.resources`, y una sección **Acerca de** en Ajustes los abre, junto al enlace al repositorio y la versión.
  > ⚠️ La licencia se empaqueta renombrada a **`LICENSE.txt`** aunque en el repositorio se llame `LICENSE` (que es lo que espera GitHub). Un archivo **sin extensión no tiene asociación en Windows**: al pulsar el botón no pasaba nada visible. El formato de mapa de `resources` permite renombrar al copiar.
  > ⚠️ `opener:default` **no incluye** `open_path`, solo `open_url`. Hay que concederlo aparte y con ámbito; aquí se limita a esos dos archivos concretos, no a una carpeta.
  > La versión que muestra la sección la da `getVersion()` de Tauri, que la lee de `tauri.conf.json`: así no hay una segunda copia del número en el frontend que se quede vieja al cortar un release.
- [x] **Verificado sobre la app**: los dos archivos aparecen en el directorio de recursos y los dos botones abren de verdad (`LICENSE.txt: Bloc de notas` y `THIRD-PARTY-NOTICES.txt: Bloc de notas`).

### 2. Nombre del repositorio — ✅ **completado**

- [x] Renombrado a `ProcessDevKill` en GitHub y remoto local apuntando a la URL nueva.
  > Comprobado tras el cambio: el tag `v1.0.0` responde desde `xfiberex/ProcessDevKill` y el release conserva sus 4 assets. GitHub redirige la URL vieja, así que los enlaces ya publicados no se rompen.
  > La **carpeta local** sigue llamándose `ProcessVisorDev`. Es cosmético y renombrarla obliga a reabrir el proyecto en el editor, así que se deja para cuando toque.

### 3. README de producto — ✅ **completado y verificado**

Tenía 5 secciones; ahora tiene 12, con lo que mira quien llega de fuera.

- [x] **Descarga e instalación** apuntando a Releases, con la tabla de los dos instaladores, el aviso de SmartScreen y cómo verificar el `.sha256`.
  > ⚠️ Se dice también **qué no protege** el hash: viaja por el mismo sitio que el instalador, así que detecta una descarga corrupta, no demuestra quién publicó el archivo. Prometer más sería engañar.
- [x] **Capturas** de la app: lista en oscuro y en claro, menú contextual y la vista de Ajustes entera.
- [x] `tools/capture-screenshots.ps1` para regenerarlas sin trabajo manual.
  > Las imágenes salen del **webview** (`Page.captureScreenshot`), no de la pantalla: sin barra de título, sin fondo de escritorio y con tamaño fijo por `Emulation.setDeviceMetricsOverride`, así que se ven igual las genere quien las genere. A x2 para que aguanten el zoom de GitHub.
  > ⚠️ El puerto de depuración obliga a tocar `tauri.conf.json`: el script guarda los bytes originales y los restaura en el `finally`, y **cierra la app antes de restaurar** — al revés, Tauri detecta el cambio y reinicia la app en mitad de la limpieza.
  > ⚠️ `Emulation.setDeviceMetricsOverride` **no encoge** el viewport si ya había uno más alto: la captura en claro salió con el alto de la de Ajustes. Se arregló limpiando el override antes de fijar el nuevo, y dejando la única captura alta para el final.
  > ⚠️ `Start-Process` une los argumentos con espacios y **no entrecomilla nada**: el `node -e "…const t=…"` de los servidores de demostración llegaba partido y moría con *Unexpected end of input*. Las comillas van a mano.
  > ⚠️ Un `.GetAwaiter().GetResult()` sobre un `Task` no genérico **emite un `VoidTaskResult`** a la salida de la función: `return $ws` acababa devolviendo un array de dos elementos y el `SendAsync` fallaba. Va con `| Out-Null`.
  > Sigue sin poder capturarse lo que dibuja Windows por encima del webview (menú de la bandeja, notificaciones nativas). Los toast de la app sí salen: son HTML.
- [x] El script levanta **dos servidores Node de verdad** (3000 y 8080, uno con carga) mientras captura, y los cierra al terminar.
  > ⚠️ Sin ellos la columna de puertos sale vacía, que es justo la que justifica la app; y sin nada consumiendo CPU las barras salen todas a cero y la columna parece estropeada. No se simula nada: son procesos reales escuchando de verdad.
- [x] Secciones de **arquitectura** (con diagrama Mermaid y las cuatro decisiones que explican el diseño), **stack**, **privacidad** y licencia.
  > La de privacidad dice lo que la app lee, lo que **no** lee (línea de comandos, entorno), dónde guarda las cosas y que no tiene concedido ningún permiso de red — enlazando al `capabilities/default.json`, que es comprobable.
- [x] `.github/FUNDING.yml`.

**Verificación** (2026-07-25):

- [x] Las cuatro capturas salen a 2000×1280 (1000×640 a x2) menos la de Ajustes, que se mide sola y sale a 2000×1820 para que quepan Auto-Kill, Zombie Finder y el atajo global.
- [x] El menú contextual se abre sobre una fila **con puerto**, así que enseña las cinco opciones, incluida "Copiar http://localhost:1420".
- [x] Tras ejecutar el script, `git status` no ve `tauri.conf.json` tocado y `settings.json` vuelve a `"theme": "system"`: la app queda como estaba.
- [x] No sobrevive ningún proceso del script: ni la sesión de `tauri dev`, ni los dos servidores de demostración.

### 4. Pruebas del frontend — ✅ **completado y verificado**

- [x] **98 pruebas** con **Vitest + Testing Library** en jsdom, repartidas en 7 archivos. Antes eran cero.
  > Era el hueco de calidad más serio: los tests de Rust cubrían bien el backend, pero todo lo que se verificó de React —menú contextual, Escape en el diálogo destructivo, cambio de tema, insignia de zombi— fueron scripts CDP a mano en una carpeta temporal que ya no existe.
- [x] Los módulos de Tauri se doblan una sola vez, en `src/test/setup.ts`, no en cada archivo.
  > ⚠️ Las fábricas de `vi.mock` **se izan por encima de los imports**, así que los `vi.fn()` viven en `src/test/tauri-mock.ts` y se traen con un `await import` dentro de la fábrica. Declarados arriba del propio setup, la fábrica correría antes de que existieran.
- [x] **Motion también se dobla.** `AnimatePresence` mantiene montada la fila que sale hasta que acaba su animación.
  > ⚠️ Sin el doble, filtrar la tabla seguía contando las filas de antes y la aserción medía la animación en vez del filtro. El doble deja `motion.tr` en un `<tr>` y quita las props de animación a mano, que si no React avisa de cada una por consola.
- [x] `src/types.test.ts` **lee el fuente de Rust** y compara las constantes espejo (`MIN_AUTO_KILL_MB`, `MIN_ZOMBIE_MINUTES`, el nombre del evento y las variantes de `KillSource`).
  > Nada obligaba a que `types.ts` siguiera siendo un espejo: cambiar una constante en `storage.rs` y olvidarse aquí no rompía ni el build ni `cargo test`. Ahora sí.
- [x] Que `release.ps1` las ejecute junto a `cargo test`.

**Lo que cubren, por orden de lo que cuesta romperlo:**

- [x] **`Escape` cancela el diálogo destructivo sin confirmar** — la garantía verificada a mano en los Tiers 2, 4 y 5, ahora fijada. También que el foco arranca en el botón destructivo (contrario al defecto de Base UI) y que Enter confirma.
- [x] Búsqueda por **puerto**, por PID y por nombre; y que los tres son subcadena, así que `300` acierta el PID 300 **y** el puerto 3000.
- [x] La **poda de la selección**: un PID que desaparece de la lista deja de contar para «Matar N».
- [x] El **suelo de 256 MB** del Auto-Kill y que el umbral no se guarda en cada tecla.
- [x] Que se copia con el **plugin de Tauri**, no con `navigator.clipboard`.
- [x] Que la clase `dark` la pone JS: elegir «Claro» con Windows en oscuro tiene efecto.
- [x] La insignia de zombi con su texto de ayuda, y el menú contextual abierto con **clic derecho real**.

**Un fallo real encontrado al montarlas:** los dos campos numéricos de Ajustes (umbral del Auto-Kill
y minutos del Zombie Finder) **no tenían nombre accesible**, solo `aria-describedby`, que describe
pero no nombra. Un lector de pantalla los anunciaba sin decir qué eran. Se les añadió `aria-label`.

> Las pruebas end-to-end sobre la ventana real quedan fuera a propósito. El 80 % del valor está en
> Vitest, se mantienen solas y corren en dos segundos; montar Tauri en cada corte de release para
> repetir lo que ya se verificó por CDP no compensa hoy.

### 5. Auto-actualización — ✅ **completado**

> **Reescrito el 2026-07-26.** Se implementó primero con `tauri-plugin-updater` y firmas minisign, y se **descartó** tras dos días de fricción con la clave: el archivo se filtró, la rotación se atascó y el prompt de contraseña resultó impegable. Se sustituyó por el modelo de **FormatDiskPro**, decisión del usuario. El recorrido está en CONTEXT.md §8; aquí queda solo lo que hay.

- [x] Actualizaciones vía **GitHub Releases**, verificadas con **SHA-256**, en `src-tauri/src/update.rs`.
  > Mismo esquema que `UpdateService.cs` de FormatDiskPro: se consulta la API, se elige el instalador NSIS y su `.sha256`, se descarga, se **verifica antes de ejecutar** y se lanza. Si el hash no coincide, el archivo se borra y no se ejecuta nada.
  > ⚠️ **El `.sha256` deja de ser cortesía y pasa a ser el mecanismo.** Un release sin él hace que la app se niegue a actualizarse a esa versión — que es lo correcto, pero hay que saberlo: `release.ps1` lo genera siempre.
- [x] **Sin plugin y sin clave**: `reqwest` (rustls) + `sha2` directamente. Fuera `tauri-plugin-updater` y `tauri-plugin-process`.
  > La red la usa **solo Rust**. Las capabilities gobiernan la superficie JS↔Rust, así que el frontend sigue sin ningún permiso que le deje salir a internet por su cuenta.
- [x] La lógica que decide **qué es más nuevo** es pura y está cubierta por pruebas: `parse_tag` e `is_newer`, calcadas de `UpdateChecker.cs`. Tolera `v1.2.3`, `1.2`, `-beta` y `+build`, y ante una etiqueta ilegible responde "no hay actualización" en vez de arriesgarse.
- [x] La comprobación del arranque va en **modo silencioso**.
  > ⚠️ Un fallo de red al abrir la app —equipo sin conexión, VPN levantándose— es lo normal y no puede pintar un error en la cara de nadie. Solo se avisa, con un toast que lleva a Ajustes, cuando de verdad hay versión nueva.
- [x] **Descargar e instalar no ocurre solo**: hace falta pulsarlo en *Ajustes → Actualizaciones*, con la versión y las notas delante. La app se cierra al lanzar el instalador para que pueda reemplazar sus archivos.
- [x] `install_update` **solo acepta rutas dentro de su carpeta de descargas**.
  > ⚠️ El comando queda expuesto al frontend; sin esa guardia sería un "ejecuta lo que quieras". Mismo criterio que la guardia de PID de `kill_process`.
- [x] Documentado el modelo de confianza en el README, incluyendo qué **no** protege: no demuestra quién publicó el archivo ni sustituye a la firma de código.
- [x] **Corregida la sección de privacidad del README**, que decía que la app no tiene concedido ningún permiso de red. Con el actualizador eso pasó a ser falso.
  > No es un detalle menor: era una afirmación comprobable enlazando al `capabilities/default.json`, y habría quedado desmentida por el propio archivo.

> **Lo que se descarta a propósito:** la verificación **Authenticode** que FormatDiskPro intenta antes del hash. Sin certificado de firma de código ningún instalador propio la pasaría, así que sería código muerto — y una comprobación que siempre falla acaba ignorándose. El día que haya certificado, esa pasa a ser la comprobación fuerte y el hash queda de respaldo.

**Verificación**:

- [x] **13 pruebas de Rust** sobre la lógica pura: lectura de etiquetas con y sin `v`, componentes que faltan (`1.2` → 1.2.0), sufijos de prelanzamiento, elección del instalador NSIS frente al MSI, los dos formatos del `.sha256`, y el hash de un vector conocido (`"abc"`).
- [x] Lo que más importa de todo: **`is_newer` solo dice que sí si de verdad lo es**. La misma versión no cuenta, una anterior tampoco, y una etiqueta ilegible responde "no hay actualización" — un `latest` o una respuesta rara de GitHub no puede traducirse en "hay que actualizar".
- [x] Un `.sha256` que no contenga un hash de 64 caracteres hexadecimales **se rechaza** en vez de compararse. Un "404: Not Found" guardado como si fuera el hash daría "no coincide", pero por el motivo equivocado.
- [x] **11 pruebas de frontend** sobre el hook: modo silencioso, reutilización de lo encontrado sin volver a consultar, cálculo del porcentaje, barra indeterminada sin tamaño total, y que un hash que no cuadra **se enseña como error y no llega a instalar nada**.

**Contra el release v1.1.1 ya publicado** (2026-07-26):

- [x] El release lleva sus **4 assets**: los dos instaladores y sus dos `.sha256`.
- [x] La API que consulta la app (`/repos/xfiberex/ProcessDevKill/releases/latest`) responde **200** con `tag_name: v1.1.1`.
- [x] Aplicando la misma lógica de `pick_assets` sobre la respuesta real, se elige el **`-setup.exe`** y **su** `.sha256` — no el del MSI, que es el error fácil de cometer.
- [x] **Descargado el instalador publicado y verificado contra el hash publicado: coinciden.** Es la cadena entera que recorrerá la app —API → elección de assets → descarga → hash → comparación—, hecha sobre los archivos reales, no sobre datos de prueba.

> ⚠️ **Queda sin ejecutar en vivo el último paso**: lanzar el instalador y que reemplace la app. Necesita un release posterior a éste para que uno encuentre al otro; todo lo anterior está verificado.

### 6. Herramientas del repositorio — ✅ **completado**

- [x] `.claude/CLAUDE.md` con las convenciones del proyecto.
  > Estaban escritas en CONTEXT.md §7, pero nada se las daba al agente automáticamente. Recoge además lo que cuesta una sesión si no se sabe: que PowerShell 5.1 destroza estos `.md`, cómo inspeccionar la UI por CDP y quitarlo después, que `SendKeys` no dispara un atajo global, que los toast de Windows no se pueden capturar con BitBlt, y la lección del 2026-07-24: **una sola sesión por repositorio**.
- [x] `.mcp.json` enganchando el servidor `codegraph`, con la misma invocación que ya tenía configurada la máquina.
  > ⚠️ **La suposición de partida era incorrecta.** El roadmap daba por hecho que el índice ya existía y solo faltaba conectarlo; comprobado el 2026-07-25, `.codegraph/` contenía **únicamente su `.gitignore`**. El `.mcp.json` conecta el servidor, pero no construye nada: hay que ejecutar `codegraph init` en la raíz y abrir una sesión nueva.
  > ✅ **Índice construido el 2026-07-27**: `.codegraph/codegraph.db` existe y el servidor responde.

---

## 🧹 Tier 7: Deuda técnica y compactación de la documentación
*Objetivo: cerrar lo que encontró la revisión completa y devolver los documentos a un tamaño que alguien lea de verdad.*

Sale de una **revisión completa del repositorio** hecha el 2026-07-27 sobre la v1.1.1 publicada —código,
seguridad, rendimiento, estructura, accesibilidad, responsividad, ortografía y documentación—, con las
101 pruebas de frontend y las 35 de `cargo test` en verde y el árbol limpio. Nada de lo de aquí es un
fallo de funcionamiento: la app hace lo que promete. Es lo que se rompe o estorba a partir de ahora.

### 1. Seguridad — ✅ **completado y verificado**

- [x] **Canonicalizar la ruta en `install_update` antes de compararla.**
  > ⚠️ **La guardia se saltaba con `..`, comprobado antes de tocar nada.** `Path::starts_with` compara
  > componentes literales y **no normaliza**: `%TEMP%\ProcessDevKill_update\..\..\Windows\System32\calc.exe`
  > pasaba como válida, y `is_file()` también. El comentario de la función decía que sin ella sería un
  > "ejecuta lo que quieras", y cumplía menos de lo que prometía. La guardia de PID de `kill_process`
  > sí era sólida, porque relee el proceso y valida el nombre.
  > Arreglado con `canonicalize` sobre las dos rutas antes del `starts_with`. De paso resuelve que
  > `temp_dir()` pueda devolver una ruta corta 8.3.
- [x] La comprobación se mueve a `update::ruta_de_instalador_valida`, función pura probable sin montar
      una `App` —igual que `collect_processes` frente a `get_processes`—, y **se ejecuta la ruta
      canónica que devuelve**: validar una y lanzar otra sería reabrir el agujero por detrás.
  > ⚠️ Canonicalizar devuelve el prefijo verbatim de Windows (`\\?\C:\…`), y ahora es **esa** la ruta
  > que se lanza. Comprobado aparte que `CreateProcess` la acepta: era lo único que podía romper la
  > actualización al añadir la canonicalización, y no se habría notado hasta el siguiente release.
- [x] Test de regresión con un `..` por medio, que es lo que nadie piensa en probar.
  > El test afirma primero que la ruta de escape **sí** pasa el `starts_with` crudo. Sin esa línea no
  > se sabría si cubre el fallo real o una versión cómoda de él.
- [x] **Sanear `asset_name` antes de usarlo como nombre de archivo** en `download_and_verify`.
  > Venía de la API de GitHub y se pegaba con `join` sin mirar. No era explotable —GitHub no admite
  > separadores en nombres de asset—, pero es la misma clase de descuido y costaba una línea.
- [x] `carpeta_descargas()` pasa a ser el único sitio donde se nombra la carpeta.
  > El literal estaba duplicado entre `lib.rs` y `update.rs`. Dos copias de la ruta contra la que se
  > valida es un agujero esperando a que alguien cambie una sola.
- [x] **CSP restrictivo** en `tauri.conf.json`, que estaba en `null`.
  > ⚠️ **El CSP solo se aplica en producción**: en `tauri dev` el HTML lo sirve Vite y Tauri no llega a
  > inyectarlo (por eso existe `dev_csp` aparte). Probarlo en desarrollo no demuestra nada.
  > ⚠️ `style-src` lleva `'unsafe-inline'` **y además `style-src-attr`**. No es dejadez: Motion,
  > `UsageBar` y el color de los iconos pintan con **atributos `style`**, y como Tauri añade su propio
  > nonce a `style-src`, el `'unsafe-inline'` de ahí queda anulado para los `<style>`. `style-src-attr`
  > es lo que garantiza que los atributos sigan aplicándose.

**Verificación end-to-end** (2026-07-27, sobre el **binario de release**, conducido por CDP):

- [x] 37 pruebas de `cargo test` en verde (antes 35), las dos nuevas sobre la guardia y el nombre.
- [x] La ventana **pinta y funciona**: 8 filas con datos reales del equipo (`node.exe … 21376 … 128 MB
      … 34m`), que solo pueden venir de `get_processes` por IPC. Si el CSP hubiera roto el bundle o el
      IPC, la ventana habría quedado en blanco o la tabla vacía.
- [x] **Los estilos inline se aplican**: el icono de Node mide `rgb(108, 184, 90)`, que es
      `--runtime-node` exacto, y el fondo es `oklch(0.175 0.009 265)` con `<html class="dark">`.
- [x] **El CSP está activo y Tauri hasheó el script inline del tema**: la política servida trae
      `script-src 'self' 'sha256-hPTyHH3…' 'sha256-leISGvn…'`, dos hashes que inyecta el propio Tauri
      al compilar. O sea que el script de primera pintura **no se bloquea** y el fogonazo blanco sigue
      evitado, sin necesidad de `'unsafe-inline'` en `script-src`.
- [x] Un `<script>` inline **nuevo sí se bloquea** (`violatedDirective: script-src-elem`), que es la
      prueba de que la política hace algo y no está puesta de adorno.
- [x] El puerto de depuración se quitó de `tauri.conf.json` después, cerrando antes la app.

> Lo que **no** hizo falta tocar: las capabilities ya estaban bien acotadas y son comprobables
> —portapapeles de escritura únicamente, `open_path` limitado a los dos avisos legales, y la red solo
> en Rust—.

### 2. Cosas de cinco minutos — ✅ **completado y verificado**

- [x] **Descripción y topics del repositorio en GitHub**, que estaban vacíos (`description: ""`,
      `repositoryTopics: null`).
  > Es lo único de este proyecto que un buscador indexa: el webview no lo ve nadie, así que el "SEO"
  > empieza y acaba aquí. Puestos **15 topics** (`tauri`, `tauri-app`, `rust`, `react`, `typescript`,
  > `windows`, `desktop-app`, `developer-tools`, `process-manager`, `port-killer`, `kill-process`,
  > `task-manager`, `sysinfo`, `tailwindcss`, `vite`) y una descripción que incluye el caso de uso con
  > el que la gente busca: *"Para cuando el puerto 3000 está ocupado y no sabes por quién"*.
  > ⚠️ La descripción se publicó primero **sin tildes**, por pasar el texto por la shell. Se corrigió
  > mandando el JSON desde un archivo UTF-8 con `gh api -X PATCH --input`. Mismo problema de siempre:
  > el texto con acentos no sobrevive al viaje por la línea de órdenes.
- [x] **Actualizar los conteos de pruebas del README**, que decía 98 de frontend y 22 de backend.
      Ahora **101 y 37** (las 35 del 2026-07-26 más las dos del Tier 7.1). Corregido también el estado
      de CONTEXT.md §3, que arrastraba el 98.
- [x] **Añadir `update.rs` a la tabla de estructura del README**, que listaba
      `{processes,ports,storage,tray}.rs` y dejaba fuera precisamente el módulo más delicado.
- [x] **Cerrada la casilla de `codegraph`** en CONTEXT.md §5, y corregidos §3 y el Tier 6.6 de aquí,
      que afirmaban que `.codegraph/` contenía solo su `.gitignore`.
  > Dejó de ser cierto el 2026-07-27: el índice existe (`codegraph.db`, 3 MB). Se conserva escrito el
  > motivo del malentendido —el `.mcp.json` conecta el servidor pero no construye nada—, porque es lo
  > que hizo perder el tiempo.
- [x] Quitado `@tauri-apps/plugin-process`, huérfano desde que se fue el actualizador de minisign:
      cero usos en `src/`, cero permisos en `capabilities/` y sin crate en `Cargo.toml`. Las 101
      pruebas y el build siguen en verde sin él.

> **`npm audit` reporta 2 vulnerabilidades moderadas, y no afectan al producto.** Vienen de
> `@modelcontextprotocol/sdk`, dependencia transitiva de `shadcn`, que aquí es **herramienta de
> build**: el instalador solo lleva `dist/` y el binario de Rust, y de shadcn únicamente sale CSS a
> través del `@import "shadcn/tailwind.css"` de `index.css`. Nada de ese árbol viaja al equipo del
> usuario. Se anota para no volver a investigarlo cada vez que alguien corra `npm audit`.
>
> De paso: `shadcn` está declarada en `dependencies` cuando es de desarrollo. Con `"private": true`
> y un empaquetado que ignora `node_modules`, moverla es cosmético — pero es lo que hace que estas
> dos vulnerabilidades salgan en una auditoría de producción.

### 3. Ortografía de la UI — ✅ **completado y verificado**

Nueve textos **visibles en la ventana** iban sin tilde mientras el resto de la interfaz sí las lleva
("confirmación", "notificación", "última versión", "Mínimo", "Ábrelo"). Era una inconsistencia, no un
criterio: los comentarios del código sí van sin tildes de forma sistemática, y eso se mantiene.

- [x] `App.tsx`: "terminara/terminaran" → **terminará/terminarán**; "Se borrara… ningun proceso en
      ejecucion" → **borrará, ningún, ejecución**; "Ningun proceso coincide" → **Ningún**.
  > ⚠️ El barrido para corregirlas destapó una novena que no estaba en la lista de la revisión:
  > **"Esta accion no se puede deshacer"** → *acción*, en el mismo mensaje del diálogo destructivo.
  > Merece la pena leer el texto entero antes de ir tachando: la lista inicial venía de un `grep`.
- [x] `HistoryView.tsx`: "Todavia… ningun proceso" → **Todavía, ningún**; encabezado "Cuando" →
      **Cuándo**.
- [x] `SettingsView.tsx`: "Aqui puedes añadir" → **Aquí**; "sin la extension" → **extensión**;
      "sin pedir confirmacion" → **confirmación** (la misma vista ya lo escribía bien 150 líneas antes).
- [x] **Corregido "1 cierre registrados"** en `HistoryView.tsx`.
  > ⚠️ Era exactamente el bug que el Tier 5 cazó y arregló con "Se terminaran los 1 procesos".
  > Se singulariza **la frase entera** (`"cierre registrado"` / `"cierres registrados"`) en vez del
  > sustantivo suelto, que es lo que dejaba el participio descolgado.
- [x] Ajustados los tests que **fijaban los textos antiguos**: `App.test.tsx` (tres) y
      `ConfirmDialog.test.tsx` (dos).
  > ⚠️ No era opcional ni se descubre a tiempo: corregir la UI sin tocarlos deja la suite en rojo.
- [x] **`HistoryView.test.tsx` creado**: era el único componente de dominio sin pruebas.
  > Cubre la concordancia del contador en singular y plural, la vista vacía, el guion de "sin puertos
  > liberados", la traducción de los cuatro orígenes de cierre y que el botón de vaciar **avisa al
  > padre en vez de borrar por su cuenta** —vaciar sin confirmar sería una pérdida irreversible a un
  > clic—.

**Verificación** (2026-07-27):

- [x] **108 pruebas de frontend** en verde, en 8 archivos (antes 101 en 7).
- [x] El test de la concordancia **caza el fallo**: reintroducido el texto antiguo a propósito, falla
      con *"Unable to find an element with the text: 1 cierre registrado"*. Un test de regresión que
      no se ve fallar no demuestra nada.
- [x] `tsc` sin errores y encoding UTF-8 intacto en los cinco archivos tocados.
- [x] Barrido final del texto visible: lo único que queda sin tildes son **comentarios y nombres de
      test**, que es el estilo establecido del proyecto.

### 4. Comportamiento de la ventana, y accesibilidad

#### 4a. Dos fallos de comportamiento que encontró el usuario usando la app — ✅ **completado y verificado**

Los reportó el 2026-07-27 con una captura que enseña **tres ventanas de ProcessDevKill abiertas a la
vez y cuatro iconos en la bandeja**. No son dos fallos independientes: **se retroalimentan**. Como
cerrar la ventana la esconde, el usuario cree que cerró la app; la vuelve a lanzar y, al no haber
instancia única, arranca otra copia. Repetir eso tres veces da exactamente la captura.

- [x] **Cerrar la ventana cierra la app.** Esconderla en la bandeja pasa a ser **opcional y
      apagada de fábrica** (`closeToTray`).
  > ⚠️ Hoy `on_window_event` hace `api.prevent_close()` + `hide()` **siempre, sin condición**. Se
  > decidió en el Tier 3 junto con el icono de bandeja, y visto en uso es lo contrario de lo que
  > espera cualquiera: el botón X de Windows cierra. Que una app siga viva e invisible tras pulsarlo
  > tiene que ser una decisión del usuario, no el valor de fábrica.
  > Ajuste nuevo `closeToTray`, **`false` por defecto**. Con `#[serde(default)]` ya en el struct, un
  > `settings.json` de una versión anterior sigue valiendo y toma el valor nuevo — lo mismo que se
  > fijó para el Auto-Kill con `los_ajustes_de_una_version_anterior_siguen_valiendo`.
  > ⚠️ Comprobar que al cerrar **el proceso muere de verdad**. Con un icono de bandeja registrado, una
  > app que deja de tener ventanas puede quedarse viva e invisible, que es el peor resultado posible:
  > ni ventana, ni icono útil, ni forma de darse cuenta salvo el Administrador de tareas.
- [x] **Instancia única**: lanzar la app estando abierta trae al frente la que ya hay, no abre otra.
  > Con `tauri-plugin-single-instance` (2.4.3). El plugin **se registra el primero**, antes que los
  > demás, que es como lo pide su documentación.
  > La segunda instancia no avisa con un toast: trae al frente la ventana existente y se cierra, que
  > es lo que hace cualquier app de Windows bien educada y lo que el usuario interpreta solo. Un aviso
  > de "ya estaba abierta" sería ruido para algo que se ve en pantalla.
  > ⚠️ Reaprovechar `tray::show_main_window`, que ya hace `show` + `unminimize` + `set_focus`. Si la
  > ventana estaba escondida en la bandeja hay que **mostrarla**, no solo enfocarla.
- [x] Interruptor en Ajustes, junto al del atajo global, con una sección propia *"Al cerrar la
      ventana"*.
  > Lo que hay que contar no es que la ventana se esconde —eso se ve—, sino que la app **sigue
  > funcionando**: es la parte que sorprende y la que hace que uno la vuelva a abrir. El texto lo dice
  > y explica las dos salidas (icono de bandeja para recuperarla, "Salir" para terminarla).
- [x] Espejo en `src/types.ts`, en `DEFAULT_SETTINGS` de `App.tsx`, en `DEFAULT_TEST_SETTINGS` y en el
      test de contrato de `lib.rs`, que enumera las claves de `Settings`.

**Verificación end-to-end** (2026-07-27, sobre el **binario de release**, con `WM_CLOSE` nativo —el
mensaje que manda el botón X— y no `Stop-Process`, que no ejercitaría el manejador):

- [x] **38 pruebas de `cargo test`** (antes 37) y **114 de frontend** (antes 108).
- [x] Con `closeToTray` en `false`, pulsar la X **no deja ningún proceso vivo**. Era el riesgo serio:
      con un icono de bandeja registrado, una app sin ventanas puede quedarse viva e invisible.
- [x] Lanzar la app estando abierta **deja una sola instancia, y es la original** (mismo PID).
- [x] Con `closeToTray` en `true`, la X esconde la ventana y el proceso **sigue vivo**.
- [x] **Estando escondida, relanzarla la recupera**: mismo PID, ventana visible otra vez. Es el caso
      que cierra el círculo — si relanzar no la recuperase, el usuario volvería a creer que no está.
- [x] El `settings.json` **real del usuario** se respaldó antes de las pruebas y se restauró después;
      quedó intacto y sin `closeToTray`, que es como estaba.

> ⚠️ **Un fallo del guion de pruebas que casi se lee como un fallo de la app.** La primera pasada dijo
> que con `closeToTray=true` la app se cerraba. Repetido el caso aislado, funcionaba. La causa era el
> propio guion: mandaba el `WM_CLOSE` en cuanto `MainWindowHandle` dejaba de ser 0, sin dar tiempo a
> que la app terminara de arrancar. Que exista la ventana no significa que el arranque haya acabado.
> Antes de creerse un fallo raro, comprobar si lo raro es la prueba.
>
> ⚠️ El `settings.json` del usuario **no tenía el campo `closeToTray`**, así que las pruebas se
> hicieron sobre el caso real de "ajustes de una versión anterior": toma el valor por defecto y la app
> cierra al pulsar la X, sin descartar el resto de los ajustes. Es lo que fija
> `los_ajustes_de_una_version_anterior_siguen_valiendo`.

#### 4b. Accesibilidad y semántica — ✅ **completado y verificado**

La base está cuidada —`lang="es"`, jerarquía de encabezados correcta, `aria-label` en checkboxes y en
los dos campos numéricos, el zombi señalado con color **y** texto, Escape cancelando con test que lo
fija—. Lo que desentona:

- [x] **Nombre accesible en el botón "Kill" de cada fila** (`Cerrar node.exe, PID 1234`).
  > ⚠️ Había veinte botones que se anunciaban "Kill" a secas, sin decir de qué proceso. El checkbox de
  > la misma fila sí lo hacía bien desde el Tier 6. Para el botón que mata un proceso es justo la
  > etiqueta que no se puede fallar. El texto **visible** sigue siendo "Kill".
  > ⚠️ Cambiar el nombre accesible rompió tres pruebas que buscaban el botón por `name: "Kill"`
  > (`ProcessTable.test.tsx` ×2 y `App.test.tsx` ×1). Mismo patrón que con la ortografía del 7.3: si
  > la prueba localiza por el texto que estás cambiando, se rompe.
- [x] **`scope="col"` en los `<th>`** de las dos tablas, con prueba que lo fija.
  > En una tabla de ocho columnas es lo que permite a un lector de pantalla decir "Puerto: 3000" en
  > vez de leer números sueltos. La columna de acciones, que no tiene título visible, gana un
  > `sr-only`.
- [x] Subido el contraste del guion de "sin puerto" en las dos tablas: el `/50` lo dejaba en ~2:1.
- [x] **El menú contextual se queda solo con clic derecho.** Decisión del usuario (2026-07-27) tras
      ver las dos alternativas y su coste.
  > Se descartó `tabIndex={0}` en la fila —la opción de una línea— **por las veinte paradas de
  > tabulación que añade**: empeora la navegación por teclado de todo el mundo para arreglar un
  > camino que casi nadie usa. La otra salida, un botón visible de "más acciones" (⋮) por fila, no se
  > toma porque cambiaría el diseño de la tabla.
  > ⚠️ **Lo que esto deja fuera, dicho claro:** "Copiar PID", "Copiar puerto" y
  > "Copiar http://localhost:PUERTO" siguen siendo **solo de ratón**, sin equivalente en el resto de
  > la UI. "Matar proceso" no cuenta: ese sí lo tiene en el botón Kill de la fila. Es un compromiso
  > asumido a sabiendas, no un descuido — el mismo criterio con el que el README dice qué **no**
  > protege el `.sha256`.
- [x] **`aria-current` en la navegación** Procesos/Historial/Ajustes, en vez de `aria-pressed`.
  > Son vistas excluyentes: esto es navegación, no un interruptor. Un lector de pantalla pasa a decir
  > "vista actual" en lugar de "presionado". Con prueba que fija que solo una lo lleva a la vez.
  > No se tocan los otros tres `aria-pressed` (tema, intervalo de refresco y filtros por runtime):
  > son grupos de selección exclusiva dentro de una vista, donde lo ideal sería un `radiogroup`, pero
  > el cambio es mayor, hay una prueba que depende de él y la ganancia es pequeña. Queda escrito por
  > si algún día se hace de una pasada.

### 5. Rendimiento

- [ ] **Leer los puertos una sola vez por lote en `kill_and_record`.**
  > ⚠️ `kill_one` llama a `listening_ports()` por cada PID, y `kill_and_record` la invoca en un `map`:
  > un "Nuke All" con quince procesos **recorre la tabla TCP del sistema quince veces**. Leerlos antes
  > de matar es obligatorio y está bien razonado; lo que sobra es repetir la enumeración. Pasar el mapa
  > ya leído como parámetro lo deja en una pasada.
- [ ] **Quitar el bucle de 300 ms del poller cuando no hay nada que hacer.**
  > Con el refresco en "Off" y el Auto-Kill apagado, el hilo despierta tres veces por segundo para no
  > hacer nada. En una app pensada para vivir días en la bandeja son cientos de miles de despertares
  > diarios. Un `Condvar` señalado al guardar ajustes conserva la reactividad sin el sondeo.

> Lo que ya está bien y no se toca: una sola instancia de `System`, `watch_cycle` leyendo la lista una
> vez por ciclo, el calentamiento de CPU en hilo aparte y el frontend sin polling.

### 6. Refactor: archivos que volvieron a crecer

El Tier 4 partió `lib.rs` cuando pasaba de 450 líneas «porque el Tier 4 la habría llevado a 900». Hoy
tiene **704** y el frontend tiene dos archivos de ~480. Es el mismo síntoma, un tier después.

- [ ] **`lib.rs` (704 líneas)**: sacar los tres comandos del actualizador y el `auto_kill` a sus
      módulos. `lib.rs` debería volver a ser arranque y comandos, como dice CONTEXT.md §4.
- [ ] **`SettingsView.tsx` (489)**: el archivo más grande del frontend, con el subcomponente
      `Actualizaciones` dentro. Sale limpio a `components/Actualizaciones.tsx`.
- [ ] **`App.tsx` (471)**: lleva dentro el sidebar completo, la cabecera de búsqueda y `FilterButton`.
      El sidebar sale a `components/Sidebar.tsx`.
- [ ] **`src/types.ts` hace tres trabajos**: tipos espejo de Rust, constantes de UI (`RUNTIMES`,
      `THEMES`, `REFRESH_INTERVALS`) y funciones de formato (`formatUptime`, `formatMemory`,
      `formatTimestamp`).
  > ⚠️ Importa más de lo que parece: `types.test.ts` verifica que este archivo sea **espejo** del
  > fuente de Rust, y cuanto más contenido no-espejo arrastra, menos claro queda ese contrato. Los
  > formateadores encajan en `src/lib/utils.ts`, que ya existe.
- [ ] **`src/update.ts` es un hook de React** (`useUpdater`) viviendo en la raíz junto a los tipos.
      Su sitio está con los componentes o en un `hooks/`.

> No entra aquí `processes.rs` (572 líneas): 307 son tests, y el código son 265. Está bien como está.

### 7. Compactar la documentación

Los cuatro documentos suman **18.237 palabras**. `CONTEXT.md` solo ya son **9.508** —más que el README
y el ROADMAP juntos, y más palabras que líneas tiene todo el backend de Rust—. El problema no es el
detalle, que es lo que da valor a este repositorio; es que lo mismo está contado en varios sitios y
nada dice cuál manda.

- [ ] **Decidir qué documento responde a qué**, y que cada cosa viva en uno solo:

  | Documento | Responde a | Hoy también lleva |
  |---|---|---|
  | `README.md` | ¿Qué es y cómo la uso? (quien llega de fuera) | — está bien acotado |
  | `.claude/CLAUDE.md` | ¿Cómo se trabaja aquí? (lo que lee el agente) | — está bien acotado |
  | `CONTEXT.md` | ¿En qué estado está y por qué se decidió así? | el registro de sesiones entero |
  | `ROADMAP.md` | ¿Qué falta? | la verificación histórica de seis tiers cerrados |

- [ ] **Quitar la duplicación del modelo de confianza del actualizador**, explicado **siete veces** en
      cuatro archivos (README ×2, ROADMAP ×2, CONTEXT ×2, `src/update.ts`), más `update.rs` con otras
      palabras.
  > Que esté en el README (es información de producto) y en `update.rs` (es donde se implementa). El
  > resto, enlace. Siete copias de una explicación delicada es una garantía de que algún día seis
  > digan una cosa y una diga otra.
- [ ] **Podar las 8 decisiones tachadas de CONTEXT.md §4** y las **11 menciones a minisign**, que
      describen un mecanismo **borrado del código**.
  > ⚠️ Conservar la **lección**, no el recorrido: "nunca volcar un archivo de clave a la consola" vale
  > para siempre y ya está en CLAUDE.md; "la regeneración falló por estar en el directorio equivocado"
  > no le sirve a nadie. Mismo criterio con las filas de `createUpdaterArtifacts` y de la clave con
  > contraseña: describen un plugin que ya no se usa. La de `ProcessStartInfo` **se queda**, porque la
  > lección de PowerShell (`$env:VAR = ""` borra la variable) sigue valiendo.
- [ ] **Resolver la duplicación declarada de CONTEXT.md §7**, que dice literalmente que las
      convenciones viven también en `.claude/CLAUDE.md` y que «al cambiar una, hay que cambiarla en los
      dos sitios».
  > Es deuda que el propio documento confiesa. `CLAUDE.md` es la fuente única —es lo que se carga
  > solo—; CONTEXT.md §7 se queda en un enlace.
- [ ] **Condensar los Tiers 1-6 de este archivo.** Están todos cerrados y verificados: cada uno puede
      quedar en su objetivo, su estado y las notas ⚠️ que siguen enseñando algo, moviendo el detalle de
      verificación al registro de sesiones (que ya lo cuenta) en vez de tenerlo por duplicado.
- [ ] **Sacar el registro de sesiones de CONTEXT.md §8 a su propio archivo** (`docs/BITACORA.md` o
      similar), dejando en CONTEXT solo estado, decisiones vigentes y cómo retomar.
  > Son 180 líneas creciendo por sesión dentro del documento que alguien abre para saber en qué punto
  > está el proyecto. Separarlo no pierde nada y hace que CONTEXT.md se pueda volver a leer entero.
- [ ] Actualizar CONTEXT.md §3, que dice **«El ROADMAP.md está terminado»**: con este tier deja de
      serlo.

**Criterio para todo lo de arriba, por si se hace en otra sesión:** no se borra información, se borra
**repetición**. Lo que explica por qué algo raro está como está se queda; lo que narra un camino que ya
no existe, se va o se archiva.

> ⚠️ **Editar estos `.md` con herramientas que respeten UTF-8.** PowerShell 5.1 los lee como ANSI y al
> guardarlos destroza todos los acentos y emojis. Está en CLAUDE.md y ya costó una sesión revertirlo.

### 8. Producto (opcional, no es deuda)

Dos cosas que la revisión señala como mejora, no como fallo. Decisión del usuario si entran:

- [ ] **Ordenar la tabla por columna.** Hoy llega siempre por RAM descendente desde Rust, que es buen
      valor por defecto, pero el Administrador de tareas —con el que el usuario compara
      inevitablemente, y así lo plantea el README— ordena por lo que quieras. Por CPU es lo primero
      que se va a pedir.
- [ ] **Estado vacío que oriente.** «No hay procesos de desarrollo activos.» es lo primero que ve quien
      acaba de instalar la app sin nada corriendo; una línea sugiriendo añadir ejecutables en Ajustes
      convierte un callejón sin salida en el paso siguiente.
- [ ] **Decidir si 720 px es una anchura que se soporta de verdad.**
  > A la anchura mínima el sidebar se lleva 208 px fijos y quedan ~512 para una tabla de ocho columnas
  > que necesita unos 670. Hay scroll horizontal, así que no se pierde nada, pero una tabla densa con
  > scroll lateral y cabecera sticky se usa mal. O se colapsa el sidebar por debajo de cierto ancho, o
  > se suben los `minWidth` a ~860 y se deja de prometer un tamaño incómodo.
  > ⚠️ **Sin verificar en vivo**: medirlo obliga a abrir el puerto de depuración en `tauri.conf.json`.
  > Lo de arriba es análisis del código, no una medición.

---

## ✅ Resumen de la verificación técnica

| Punto original | Estado | Corrección aplicada |
|---|---|---|
| Tauri + React + Vite | ✅ Válido | Precisado a **Tauri 2** y TypeScript |
| Tailwind CSS | ⚠️ Desactualizado | Setup de **v4** con `@tailwindcss/vite` |
| `sysinfo` para procesos/CPU/RAM/kill | ✅ Válido | Notas de rendimiento y CPU% |
| `sysinfo` para puertos | ❌ No lo soporta | Crates `listeners` / `netstat2` |
| Framer Motion | ⚠️ Renombrado | Paquete `motion` (`motion/react`) |
| Notificaciones Tauri | ✅ Válido | Plugin `tauri-plugin-notification` + capabilities |
| System Tray | ✅ Válido | API Tauri 2 `TrayIconBuilder` |
| Hotkeys globales | ✅ Válido | Plugin `tauri-plugin-global-shortcut` |
| shadcn/ui | ⚠️ Cambió | Alias `@/` en Vite **y** tsconfig; hoy genera sobre **Base UI**, no Radix, y el Toast es **Sonner** |
| Portapapeles del navegador | ❌ No sirve | `navigator.clipboard` exige foco; `tauri-plugin-clipboard-manager` |
| CI en cada commit | ⚠️ Costoso | Descartado: release local con `release.ps1` (ver Tier 5.6) |
