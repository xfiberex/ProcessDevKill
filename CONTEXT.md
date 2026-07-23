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

**Fase actual:** 🟠 Tier 1 escrito por completo, **bloqueado** antes de poder ejecutarlo.

| Tier | Descripción | Estado |
|---|---|---|
| 1 | Cimientos y MVP | 🟠 Código completo, sin verificar en ejecución |
| 2 | UX/UI y reactividad | ⬜ Sin empezar |
| 3 | Puertos, notificaciones, tray | ⬜ Sin empezar |
| 4 | Power user y optimización | ⬜ Sin empezar |
| 5 | Distribución y estética | ⬜ Sin empezar |

Verificado hasta ahora: el frontend compila (`npm run build` pasa `tsc` y genera CSS de Tailwind v4). El backend Rust está escrito y con tests unitarios, pero **no se ha compilado ni una vez**.

### 🚧 Bloqueante: toolset MSVC incompleto

`cargo` no puede enlazar en este equipo. Diagnóstico del 2026-07-23:

- Visual Studio 18 Community está instalado con MSVC 14.51.36231 y `cl.exe`/`link.exe` presentes.
- Pero ese toolset **no tiene directorio `VC\include`** (cero headers de C/C++: falta `excpt.h`, `stdio.h`, `vcruntime.h`) y solo trae librerías `lib\onecore\`, sin las de escritorio `lib\x64`.
- Resultado: `LNK1104: no se puede abrir el archivo 'msvcrt.lib'`, y al forzar rutas OneCore, `C1083: no se puede abrir el archivo incluir 'excpt.h'`.
- El Windows SDK 10.0.26100.0 sí está completo, así que **solo falta el componente de C++ de MSVC**.

**Cómo desbloquearlo** — abrir PowerShell **como administrador** y ejecutar:

```powershell
& "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" modify `
  --installPath "C:\Program Files\Microsoft Visual Studio\18\Community" `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  --add Microsoft.VisualStudio.Component.Windows11SDK.26100 `
  --passive --norestart
```

Alternativa equivalente: abrir el Visual Studio Installer → *Modificar* → marcar **Desarrollo para el escritorio con C++**.

Después, comprobar que existe `C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\<versión>\include\excpt.h` y ejecutar `cd src-tauri && cargo test`.

**Próximo paso concreto:** reparar MSVC (arriba) → `cargo test` → `npm run tauri dev` para verificar el Tier 1 contra procesos reales.

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
| 2026-07-23 | Refresco inicial de CPU en `setup()` | Evita que la primera lectura de la UI muestre 0 % en todos los procesos |

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
