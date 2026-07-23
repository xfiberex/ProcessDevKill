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

## 🎨 Tier 2: UX/UI y Reactividad
*Objetivo: que la app sea visualmente atractiva y fácil de usar.*

- [ ] **Visualización avanzada:**
    - [ ] Iconos por lenguaje (logos de Node.js, Python, .NET).
    - [ ] Barras de consumo (CPU y RAM) por proceso.
      > ⚠️ `sysinfo` devuelve la memoria en **bytes** (convertir a MB) y el % de CPU requiere **dos refrescos** separados por `MINIMUM_CPU_UPDATE_INTERVAL`; con el refresco periódico esto se cumple solo, pero la primera lectura mostrará 0%.
    - [ ] Animaciones al eliminar procesos de la lista con **Motion** (`AnimatePresence` + `motion.tr`).
      > ⚠️ Framer Motion fue renombrado: el paquete ahora es `motion` y se importa desde `motion/react`.
- [ ] **Automatización de UI:**
    - [ ] `setInterval` para refrescar la lista cada 2–5 s (suficiente para esta fase; en Tier 4 se migra a eventos desde Rust).
    - [ ] Buscador/filtro por nombre o PID.
- [ ] **Acciones masivas:**
    - [ ] Botón **"Nuke All"** (cerrar todos los procesos filtrados) con diálogo de confirmación.
    - [ ] Casillas de selección múltiple para matar procesos en lote.

---

## 🔧 Tier 3: Integración profunda con el sistema
*Objetivo: dar información técnica que la terminal no da fácilmente.*

- [ ] **Detección de puertos (feature estrella):**
    - [ ] Mapear cada PID a sus puertos locales en escucha (`3000`, `5173`, `8080`, …).
      > ⚠️ `sysinfo` **no expone puertos por proceso**. Usar el crate [`listeners`](https://crates.io/crates/listeners) (API simple, multiplataforma) o [`netstat2`](https://crates.io/crates/netstat2) (más control) y cruzar los PIDs con la lista de `sysinfo`.
      > ⚠️ En Windows, ver puertos de procesos de **otros usuarios** puede requerir permisos elevados; los procesos propios de desarrollo no tienen problema.
    - [ ] Mostrar el puerto de forma prominente en la UI (badge junto al nombre).
- [ ] **Notificaciones nativas:**
    - [ ] Plugin `tauri-plugin-notification` (registrar en el `Builder` + permiso en `capabilities/`).
    - [ ] Notificar cuando se libere un puerto exitosamente.
- [ ] **System Tray:**
    - [ ] Habilitar la feature `tray-icon` de Tauri y construir el menú con `TrayIconBuilder` (API de Tauri 2: `on_menu_event` + `on_tray_icon_event`).
    - [ ] Minimizar a la bandeja al cerrar la ventana (interceptar `CloseRequested`).
    - [ ] Menú rápido: "Kill All Node", "Kill All Python", "Show App".

---

## ⚡ Tier 4: Power User y optimización
*Objetivo: pulir detalles y mejorar el rendimiento.*

- [ ] **Logs y auditoría:**
    - [ ] Sección "Historial": qué procesos se cerraron y cuándo (persistir en JSON con `tauri-plugin-store` o archivo propio en `app_data_dir`).
- [ ] **Configuración personalizada:**
    - [ ] Lista de procesos vigilados editable por el usuario (añadir `docker`, `go`, `php`, …), persistida igual que el historial.
    - [ ] Hotkeys globales con `tauri-plugin-global-shortcut` (ej: `Ctrl + Alt + K` para "Nuke All") + permisos en `capabilities/`.
- [ ] **Rendimiento:**
    - [ ] Sustituir el polling del frontend por un **hilo en Rust** que refresque `sysinfo` y emita eventos (`app.emit("processes-updated", …)`) que React escucha con `listen()`. La UI deja de pedir datos: los recibe.

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
