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

### 6. Publicación de releases — ⬜ aplazado
- [ ] Script `release.ps1` propio (bump de versión + build + tag + GitHub Release con `gh`), adaptado del de FormatDiskPro.
  > Decidido el 2026-07-24: se descarta GitHub Actions mientras el objetivo sea Windows. Ver CONTEXT.md §4.
  > ⚠️ Adaptación pendiente: la versión vive en **tres** sitios (`package.json`, `tauri.conf.json` y `Cargo.toml`+`Cargo.lock`), la build es `npm run tauri build` y los artefactos salen en `src-tauri/target/release/bundle/`.

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
