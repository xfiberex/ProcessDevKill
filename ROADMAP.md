# 🚀 Roadmap: ProcessVisor — Process Manager para Devs

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
    - [x] Menú: "Mostrar ProcessVisor", "Cerrar todos los Node/Python/.NET" y **"Salir"**.
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

- [ ] **Diseño visual:**
    - [ ] Modo oscuro / claro automático según el sistema (variante `dark` de Tailwind + `prefers-color-scheme`).
    - [ ] Componentes de **shadcn/ui** (Dialog, Context Menu, Toast) — compatible con Vite + Tailwind v4; requiere configurar el alias `@/` en `vite.config.ts` y `tsconfig.json`.
- [ ] **Instalación:**
    - [ ] Icono personalizado (`npm run tauri icon icono.png` genera todos los tamaños).
    - [ ] Instaladores con el bundler de Tauri: Windows genera **NSIS (`.exe`) y/o WiX (`.msi`)**; macOS genera `.dmg`.
    - [ ] CI con **GitHub Actions** usando la action oficial `tauri-apps/tauri-action`.
      > ⚠️ Compilar en **cada commit** es lento y caro (la build de Tauri tarda varios minutos por plataforma). Recomendado: compilar y publicar release solo al pushear un **tag** (`v*`), y en commits normales ejecutar solo `cargo check` + lint.

---

## 💡 Ideas "Salsa Secreta" (Bonus, post-Tier 5)
- [ ] **Auto-Kill:** cerrar automáticamente un proceso que supere un umbral de RAM configurable (ej. Node > 2 GB), con notificación.
- [ ] **Zombie Finder:** resaltar procesos con CPU ~0% sostenido durante N minutos que siguen ocupando memoria y puertos.

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
| shadcn/ui | ✅ Válido | Requiere alias `@/` con Vite |
| CI en cada commit | ⚠️ Costoso | Release solo por tag; check/lint por commit |
