# ProcessDevKill

Gestor de procesos de desarrollo (`node`, `python`, `dotnet`, …) para escritorio, construido con Tauri 2 + React + TypeScript.

Lista los runtimes de desarrollo activos con su consumo de CPU y RAM, **qué puerto local ocupa cada uno**, y permite terminarlos sin pasar por el Administrador de tareas. Resuelve el clásico "el puerto 3000 está ocupado y no sé por quién".

> El repositorio se llama todavía `ProcessVisorDev`, que era el nombre provisional del proyecto.

## Qué hace

- Lista Node, Python y .NET (más los ejecutables que añadas) con CPU, RAM, tiempo activo y puertos TCP en escucha.
- Mata procesos de uno en uno, por selección o de golpe ("Nuke All"), siempre con confirmación.
- Menú contextual en cada fila: matar, o copiar el PID, el nombre, el puerto o `http://localhost:PUERTO`.
- Icono en la bandeja con acciones rápidas, y atajo global `Ctrl+Alt+K` (desactivable) que cierra todo lo vigilado.
- Historial de cierres con el origen de cada uno (ventana, bandeja o atajo).
- Tema claro/oscuro que sigue al de Windows, o fijo si lo prefieres.

## Prerequisitos

- **Node.js** LTS
- **Rust** estable — instalar con [rustup](https://rustup.rs)
- En Windows, el componente **MSVC C++ build tools x64/x86** y el **Windows SDK**, desde el Visual Studio Installer (`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`). Sin los headers y librerías de MSVC, `cargo` falla al enlazar.

## Desarrollo

```bash
npm install
npm run tauri dev     # app de escritorio con hot reload
npm run build         # solo comprueba tipos y compila el frontend
```

Pruebas del backend:

```bash
cd src-tauri
cargo test
```

Regenerar los iconos tras editar `app-icon.svg`:

```bash
npm run tauri icon app-icon.svg
```

## Estructura

| Ruta | Contenido |
|---|---|
| `src/` | Frontend React: vistas, tipos compartidos con Rust y tema |
| `src/components/ui/` | Componentes de shadcn/ui (generados; se editan a mano si hace falta) |
| `src-tauri/src/lib.rs` | Comandos de Tauri y arranque |
| `src-tauri/src/{processes,ports,storage,tray}.rs` | Procesos, puertos, persistencia y bandeja |
| `app-icon.svg` | Icono fuente del que salen todos los tamaños |
| [ROADMAP.md](ROADMAP.md) | Plan de desarrollo por fases |
| [CONTEXT.md](CONTEXT.md) | Estado actual, decisiones y registro de sesiones |

Los ajustes y el historial se guardan en `%APPDATA%\com.processdevkill.app\`.
