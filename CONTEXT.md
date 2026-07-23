# 📋 CONTEXT.md — ProcessVisor

> **Documento vivo.** Registra el contexto, las decisiones y el progreso del proyecto para poder retomarlo desde cualquier equipo sin perder información. Se actualiza al final de cada sesión de trabajo o cuando se toma una decisión relevante.
>
> El plan detallado por fases vive en [ROADMAP.md](ROADMAP.md); aquí solo se refleja el estado.

---

## 1. Qué es este proyecto

**ProcessVisor** es una aplicación de escritorio (Windows primero, macOS después) para desarrolladores que lista los procesos de desarrollo activos (`node`, `python`, `dotnet`, …), muestra su consumo de CPU/RAM y **qué puerto local ocupa cada uno**, y permite matarlos individualmente o en lote. Resuelve el clásico "el puerto 3000 está ocupado y no sé por quién".

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Shell de escritorio | **Tauri 2** | Rust backend + webview |
| Frontend | **React + TypeScript + Vite** | Plantilla oficial de `create tauri-app` |
| Estilos | **Tailwind CSS v4** | Vía plugin `@tailwindcss/vite` (sin config file) |
| Animaciones | **Motion** (`motion/react`) | Ex Framer Motion |
| Componentes UI | **shadcn/ui** | A partir de Tier 5 |
| Info de procesos | crate **`sysinfo`** | Lista, CPU, RAM, kill |
| Puertos por PID | crate **`listeners`** (o `netstat2`) | `sysinfo` no cubre puertos |
| Plugins Tauri | `notification`, `global-shortcut` | + feature `tray-icon` |
| CI/CD | GitHub Actions + `tauri-apps/tauri-action` | Release solo por tag |

## 3. Estado actual

**Fase actual:** ✅ Tier 1 completado y verificado sobre la app en ejecución.

| Tier | Descripción | Estado |
|---|---|---|
| 1 | Cimientos y MVP | ✅ Completado y verificado |
| 2 | UX/UI y reactividad | ⬜ Sin empezar |
| 3 | Puertos, notificaciones, tray | ⬜ Sin empezar |
| 4 | Power user y optimización | ⬜ Sin empezar |
| 5 | Distribución y estética | ⬜ Sin empezar |

Verificado el 2026-07-23 con la app corriendo: 5 tests de `cargo test` en verde, la UI lista 13 procesos `node` reales con RAM y tiempo correctos, un proceso saturando un núcleo reporta 6,28 % en un equipo de 16 núcleos, y el botón "Kill" mata un proceso real (la fila desaparece y el PID deja de existir).

**Próximo paso concreto:** Tier 2 → iconos por lenguaje, barras de consumo, auto-refresco y acciones masivas.

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

## 4. Decisiones tomadas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-07-23 | Tauri 2 (no Electron) | Binario ligero, backend Rust necesario para `sysinfo` |
| 2026-07-23 | Tailwind v4 con plugin de Vite | Setup actual oficial; v3 quedó obsoleto |
| 2026-07-23 | Crate `listeners` para puertos | `sysinfo` no mapea PID→puerto |
| 2026-07-23 | CI compila release solo con tags `v*` | Build multi-plataforma en cada commit es lenta y cara |
| 2026-07-23 | Polling frontend en Tier 2, eventos Rust en Tier 4 | Simplicidad primero, rendimiento después |
| 2026-07-23 | `sysinfo` solo con la feature `system` | No usamos discos, red ni componentes; acorta la compilación |
| 2026-07-23 | Clasificar procesos por nombre exacto o sufijo de versión, no por prefijo | Un prefijo simple capturaría `nodemon` como si fuera Node |
| 2026-07-23 | `kill_process` valida que el PID sea de un runtime vigilado | Un comando de Tauri acepta cualquier entrada; sin la guardia sería un "mata lo que quieras" |
| 2026-07-23 | Normalizar el % de CPU dividiendo por núcleos lógicos | `cpu_usage()` suma todos los núcleos y devuelve hasta 400 en un equipo de 4 hilos |
| 2026-07-23 | Crear el `System` con `RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing())` | **Obligatorio**: sysinfo multiplica el uso de CPU por `cpus.len()`, y con `System::new()` esa lista queda vacía → todos los procesos reportan 0 % |
| 2026-07-23 | Calentar la CPU con **tres** muestras, en un hilo aparte | sysinfo descarta la primera lectura sin guardar líneas base y la segunda las compara contra cero; solo la tercera es real. En un hilo para no retrasar la ventana |
| 2026-07-23 | Separar `collect_processes()` del comando de Tauri | Permite probar la lógica contra el sistema real sin montar una `App` |

## 5. Decisiones pendientes

- [ ] **Nombre definitivo:** la idea original lo llamaba *DevKill*; la carpeta del proyecto es *ProcessVisorDev*. Este documento usa **ProcessVisor** provisionalmente.
- [ ] Repositorio remoto (GitHub) — aún no creado; necesario antes del Tier 5 (CI).
- [ ] Lista inicial de procesos vigilados por defecto (¿incluir `java`, `deno`, `bun` desde el inicio?).

## 6. Cómo retomar el proyecto en otro equipo

1. Clonar el repositorio (cuando exista) o copiar la carpeta.
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

### 2026-07-23 (tarde) — Tier 1 desbloqueado, verificado y con un bug corregido
- Reparado el toolset MSVC añadiendo el componente de C++ (ver §3). `cargo` ya compila.
- **Bug encontrado y corregido: todos los procesos reportaban 0 % de CPU.** Los tests iniciales no lo cazaron porque los procesos de la máquina estaban ociosos y 0 % parecía plausible; se descubrió al lanzar un proceso `node` quemando un núcleo a propósito. Causa: `System::new()` deja vacía la lista de CPUs y sysinfo multiplica por `cpus.len()`. Añadido `reporta_cpu_de_un_proceso_ocupado` como test de regresión.
- Descubierto además que sysinfo necesita **tres** muestras para dar un porcentaje real; el calentamiento pasó de una a dos muestras previas.
- Añadidos tests de lectura del sistema real y del contrato JSON con `src/types.ts`. Total: 5 tests en verde.
- Verificación end-to-end sobre la app en ejecución, inspeccionando el DOM real vía CDP: la tabla lista 13 procesos `node` con datos correctos y el botón "Kill" mata un proceso de verdad.

### 2026-07-23 — Tier 1 implementado, bloqueado en compilación
- Instalado Rust 1.97.1 vía `rustup` (no estaba en el equipo).
- Proyecto creado con `create-tauri-app` (React + TS + Vite), renombrado a ProcessVisor, y Tailwind v4 configurado. `npm run build` pasa.
- Backend `src-tauri/src/lib.rs`: comandos `get_processes` y `kill_process` con `sysinfo` 0.39, más dos tests de la función `classify`.
- Frontend `src/App.tsx`: sidebar con filtros por runtime, botón de refresco y tabla con nombre, PID, CPU, RAM, tiempo activo y botón Kill.
- `git init` + primer commit.
- **La API de `sysinfo` que devolvió la documentación indexada era incorrecta** (mostraba `System::new_all()` devolviendo `Result`). Se verificó contra el código fuente real del crate en `~/.cargo/registry`. Conviene repetir esa comprobación en futuras actualizaciones del crate.
- 🚧 Bloqueado: el toolset MSVC del equipo está incompleto y `cargo` no enlaza. Ver §3.

### 2026-07-23 — Planificación inicial
- Se revisó y verificó técnicamente la idea original del roadmap (correcciones: Tailwind v4, Motion, crate para puertos, estrategia de CI).
- Se crearon `ROADMAP.md` (plan verificado) y `CONTEXT.md` (este documento).
