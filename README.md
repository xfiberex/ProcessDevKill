# ProcessVisor

Gestor de procesos de desarrollo (`node`, `python`, `dotnet`) para escritorio, construido con Tauri 2 + React + TypeScript.

Lista los runtimes de desarrollo activos con su consumo de CPU y RAM, y permite terminarlos sin pasar por el Administrador de tareas.

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

## Estructura

| Ruta | Contenido |
|---|---|
| `src/` | Frontend React: UI y tipos compartidos con Rust |
| `src-tauri/src/lib.rs` | Comandos Rust: `get_processes`, `kill_process` |
| [ROADMAP.md](ROADMAP.md) | Plan de desarrollo por fases |
| [CONTEXT.md](CONTEXT.md) | Estado actual, decisiones y registro de sesiones |
