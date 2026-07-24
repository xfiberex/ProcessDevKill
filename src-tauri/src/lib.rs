mod ports;
mod processes;
mod storage;
mod tray;

use std::sync::Mutex;
use std::time::Duration;

use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

use processes::{
    collect_processes, kill_one, new_system, warm_up_cpu, KillOutcome, ProcessInfo,
};
use storage::{now_millis, HistoryEntry, KillSource, Settings, Storage};

/// Evento que recibe el frontend cada vez que hay una lista nueva de procesos.
const PROCESSES_UPDATED: &str = "processes-updated";

/// Limites del refresco automatico. Por debajo de 500 ms el enumerado de procesos
/// se solaparia consigo mismo sin aportar nada util.
const MIN_REFRESH_MS: u64 = 500;
const MAX_REFRESH_MS: u64 = 60_000;

pub struct AppState {
    sys: Mutex<System>,
    settings: Mutex<Settings>,
    storage: Storage,
}

impl AppState {
    /// Copia los nombres vigilados y suelta el candado enseguida.
    ///
    /// Importante para no anidar candados: quien necesite `sys` y los ajustes a la
    /// vez debe pedir esto primero y solo despues bloquear `sys`.
    fn custom_names(&self) -> Vec<String> {
        self.settings
            .lock()
            .map(|s| s.normalized_names())
            .unwrap_or_default()
    }

    fn refresh_ms(&self) -> u64 {
        self.settings.lock().map(|s| s.refresh_ms).unwrap_or(2000)
    }
}

fn atajo_nuke() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyK)
}

/// Lee la lista actual y se la manda al frontend.
fn emit_processes(app: &AppHandle) {
    let state = app.state::<AppState>();
    let custom = state.custom_names();

    let list = {
        let Ok(mut sys) = state.sys.lock() else { return };
        collect_processes(&mut sys, &custom)
    };

    if let Err(e) = app.emit(PROCESSES_UPDATED, list) {
        eprintln!("No se pudo emitir {PROCESSES_UPDATED}: {e}");
    }
}

/// Unico camino por el que se cierra un proceso, venga de la ventana, de la
/// bandeja o del atajo global.
///
/// Centralizarlo garantiza que las tres vias registren historial, notifiquen los
/// puertos liberados y refresquen la UI de la misma forma.
fn kill_and_record(app: &AppHandle, pids: Vec<u32>, source: KillSource) -> Vec<KillOutcome> {
    let state = app.state::<AppState>();
    let custom = state.custom_names();

    let outcomes: Vec<KillOutcome> = {
        let Ok(mut sys) = state.sys.lock() else {
            return Vec::new();
        };
        pids.into_iter()
            .map(|pid| match kill_one(&mut sys, &custom, pid) {
                Ok((name, freed_ports)) => KillOutcome {
                    pid,
                    killed: true,
                    error: None,
                    freed_ports,
                    name,
                },
                Err(error) => KillOutcome {
                    pid,
                    killed: false,
                    error: Some(error),
                    freed_ports: Vec::new(),
                    name: String::new(),
                },
            })
            .collect()
    };

    let killed_at = now_millis();
    let entries: Vec<HistoryEntry> = outcomes
        .iter()
        .filter(|o| o.killed)
        .map(|o| HistoryEntry {
            pid: o.pid,
            name: o.name.clone(),
            freed_ports: o.freed_ports.clone(),
            killed_at,
            source,
        })
        .collect();
    if let Err(e) = state.storage.append_history(entries) {
        eprintln!("No se pudo guardar el historial: {e}");
    }

    let mut freed: Vec<u16> = outcomes.iter().flat_map(|o| o.freed_ports.clone()).collect();
    freed.sort_unstable();
    freed.dedup();
    notify_freed_ports(app, &freed);

    // La lista cambio: que la ventana lo refleje sin esperar al siguiente ciclo.
    emit_processes(app);
    outcomes
}

/// Avisa por notificacion nativa de los puertos que acaban de quedar libres.
///
/// Vive en Rust y no en el frontend porque la bandeja y el atajo global tambien
/// matan procesos sin que la ventana intervenga (e incluso estando oculta).
fn notify_freed_ports(app: &AppHandle, ports: &[u16]) {
    if ports.is_empty() {
        return;
    }

    let list = ports
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(", ");
    let body = if ports.len() == 1 {
        format!("El puerto {list} ha quedado libre.")
    } else {
        format!("Los puertos {list} han quedado libres.")
    };

    notify(app, body);
}

fn notify(app: &AppHandle, body: String) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("ProcessDevKill")
        .body(body)
        .show()
    {
        eprintln!("No se pudo mostrar la notificacion: {e}");
    }
}

// ---------------------------------------------------------------- comandos ---

#[tauri::command]
fn get_processes(state: State<'_, AppState>) -> Result<Vec<ProcessInfo>, String> {
    let custom = state.custom_names();
    let mut sys = state.sys.lock().map_err(|_| "Estado del sistema corrupto")?;
    Ok(collect_processes(&mut sys, &custom))
}

#[tauri::command]
fn kill_process(pid: u32, app: AppHandle) -> Result<Vec<u16>, String> {
    let mut outcomes = kill_and_record(&app, vec![pid], KillSource::Window);
    let outcome = outcomes
        .pop()
        .ok_or_else(|| "No se pudo acceder al estado del sistema".to_string())?;

    if outcome.killed {
        Ok(outcome.freed_ports)
    } else {
        Err(outcome.error.unwrap_or_else(|| "Fallo desconocido".into()))
    }
}

/// Termina varios procesos y detalla que paso con cada uno.
///
/// Devuelve un resultado por PID en vez de abortar al primer fallo: en un lote es
/// normal que alguno haya muerto solo entre el ultimo refresco y el clic, y eso no
/// deberia impedir matar los demas.
#[tauri::command]
fn kill_processes(pids: Vec<u32>, app: AppHandle) -> Vec<KillOutcome> {
    kill_and_record(&app, pids, KillSource::Window)
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
fn save_settings(
    settings: Settings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Settings, String> {
    let settings = Settings {
        refresh_ms: if settings.refresh_ms == 0 {
            0
        } else {
            settings.refresh_ms.clamp(MIN_REFRESH_MS, MAX_REFRESH_MS)
        },
        ..settings
    };

    state.storage.save_settings(&settings)?;
    apply_hotkey(&app, settings.hotkey_enabled);
    *state.settings.lock().map_err(|_| "Ajustes corruptos")? = settings.clone();

    // La lista de vigilados puede haber cambiado: refrescar sin esperar al ciclo.
    emit_processes(&app);
    Ok(settings)
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Vec<HistoryEntry> {
    state.storage.load_history()
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.storage.clear_history()
}

// ------------------------------------------------------------------ arranque ---

/// Registra o quita el atajo global segun los ajustes.
fn apply_hotkey(app: &AppHandle, enabled: bool) {
    let shortcut = atajo_nuke();
    let manager = app.global_shortcut();

    let registered = manager.is_registered(shortcut);
    let result = match (enabled, registered) {
        (true, false) => manager.register(shortcut),
        (false, true) => manager.unregister(shortcut),
        _ => Ok(()),
    };

    if let Err(e) = result {
        eprintln!("No se pudo cambiar el atajo global: {e}");
    }
}

/// Cierra de golpe todo lo vigilado. Es la accion del atajo global.
fn nuke_everything(app: &AppHandle) {
    let state = app.state::<AppState>();
    let custom = state.custom_names();

    let pids: Vec<u32> = {
        let Ok(mut sys) = state.sys.lock() else { return };
        collect_processes(&mut sys, &custom)
            .into_iter()
            .map(|p| p.pid)
            .collect()
    };

    if pids.is_empty() {
        notify(app, "No hay procesos de desarrollo activos.".into());
        return;
    }

    let outcomes = kill_and_record(app, pids, KillSource::Hotkey);
    let killed = outcomes.iter().filter(|o| o.killed).count();
    notify(app, format!("{killed} procesos cerrados con Ctrl+Alt+K."));
}

/// Hilo que publica la lista de procesos al ritmo configurado.
///
/// Sustituye al `setInterval` del frontend: el trabajo pesado (enumerar procesos y
/// sockets) ocurre en Rust y la ventana solo recibe el resultado ya hecho.
fn spawn_poller(app: AppHandle) {
    std::thread::spawn(move || loop {
        let ms = app.state::<AppState>().refresh_ms();

        if ms == 0 {
            // Pausado: dormir poco para reaccionar rapido si vuelven a activarlo.
            std::thread::sleep(Duration::from_millis(300));
            continue;
        }

        std::thread::sleep(Duration::from_millis(ms.clamp(MIN_REFRESH_MS, MAX_REFRESH_MS)));
        emit_processes(&app);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Copiar PID/puertos desde el menu contextual. Va por el portapapeles del
        // sistema y no por `navigator.clipboard`, que exige que el documento
        // tenga el foco y falla con un NotAllowedError si no lo tiene.
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &atajo_nuke() {
                        nuke_everything(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            let dir = handle
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("processdevkill"));
            let storage = Storage::new(dir);
            let settings = storage.load_settings();

            app.manage(AppState {
                // Una sola instancia de System para toda la app: crearla en cada
                // llamada obliga a releer todo el arbol de procesos y es lento.
                sys: Mutex::new(new_system()),
                settings: Mutex::new(settings.clone()),
                storage,
            });

            tray::build(&handle)?;
            apply_hotkey(&handle, settings.hotkey_enabled);

            // Calentamiento en segundo plano para que la primera lectura de la UI
            // traiga CPU real. En un hilo aparte para no retrasar la ventana: si
            // el frontend pide datos antes de tiempo, se queda esperando el mutex
            // los ~400 ms que dura, que es justo lo que queremos.
            let warm = handle.clone();
            std::thread::spawn(move || {
                let custom = warm.state::<AppState>().custom_names();
                if let Ok(mut sys) = warm.state::<AppState>().sys.lock() {
                    warm_up_cpu(&mut sys, &custom);
                }
                emit_processes(&warm);
            });

            spawn_poller(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Cerrar la ventana la esconde en la bandeja en vez de terminar la app;
            // para salir de verdad esta la opcion "Salir" del menu del icono.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            kill_process,
            kill_processes,
            get_settings,
            save_settings,
            get_history,
            clear_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    // Solo lo usan los tests: en el resto de lib.rs los runtimes no se nombran.
    use processes::Runtime;

    /// El frontend lee estas claves literalmente. Si alguien renombra un campo en
    /// Rust sin tocar `src/types.ts`, la UI se llena de `undefined` sin que falle
    /// nada: este test convierte ese silencio en un fallo.
    #[test]
    fn el_json_coincide_con_los_tipos_de_typescript() {
        let info = ProcessInfo {
            pid: 42,
            name: "node.exe".into(),
            runtime: Runtime::Node,
            cpu: 6.25,
            memory_mb: 128.0,
            run_time_secs: 900,
            ports: vec![5173],
        };
        let json = serde_json::to_value(&info).expect("ProcessInfo deberia serializar");
        for clave in [
            "pid", "name", "runtime", "cpu", "memoryMb", "runTimeSecs", "ports",
        ] {
            assert!(json.get(clave).is_some(), "falta '{clave}' en ProcessInfo");
        }
        assert_eq!(json["runtime"], "node");

        let outcome = serde_json::to_value(KillOutcome {
            pid: 42,
            killed: false,
            error: Some("boom".into()),
            freed_ports: vec![3000],
            name: "node.exe".into(),
        })
        .expect("KillOutcome deberia serializar");
        for clave in ["pid", "killed", "error", "freedPorts", "name"] {
            assert!(outcome.get(clave).is_some(), "falta '{clave}' en KillOutcome");
        }

        let entry = serde_json::to_value(HistoryEntry {
            pid: 42,
            name: "node.exe".into(),
            freed_ports: vec![3000],
            killed_at: 1_700_000_000_000,
            source: KillSource::Hotkey,
        })
        .expect("HistoryEntry deberia serializar");
        for clave in ["pid", "name", "freedPorts", "killedAt", "source"] {
            assert!(entry.get(clave).is_some(), "falta '{clave}' en HistoryEntry");
        }
        assert_eq!(entry["source"], "hotkey");

        let settings = serde_json::to_value(Settings::default()).expect("Settings deberia serializar");
        for clave in ["customNames", "hotkeyEnabled", "refreshMs", "theme"] {
            assert!(settings.get(clave).is_some(), "falta '{clave}' en Settings");
        }
        assert_eq!(settings["theme"], "system");
    }
}
