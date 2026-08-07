mod auto_kill;
mod notify;
mod poller;
mod ports;
mod processes;
mod storage;
mod tray;
mod update;

use std::sync::{Condvar, Mutex};
use std::time::Duration;

use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use poller::{MAX_REFRESH_MS, MIN_REFRESH_MS};
use processes::{
    collect_processes, collect_system_usage, kill_many, new_system, warm_up_cpu, KillOutcome,
    ProcessInfo, SystemUsage,
};
use storage::{
    now_millis, HistoryEntry, KillSource, Settings, Storage, MIN_AUTO_KILL_MB, MIN_ZOMBIE_MINUTES,
};

/// Evento que recibe el frontend cada vez que hay una lista nueva de procesos.
const PROCESSES_UPDATED: &str = "processes-updated";

/// Evento con el consumo del equipo y la parte que se lleva el entorno.
///
/// Va en un evento propio y no dentro de `PROCESSES_UPDATED` para no cambiar el
/// contrato de la lista, que es lo que escuchan la ventana y sus pruebas. Ademas
/// se emite desde menos sitios: ver `poller::cycle`.
const SYSTEM_USAGE: &str = "system-usage";

pub struct AppState {
    sys: Mutex<System>,
    settings: Mutex<Settings>,
    storage: Storage,
    /// Memoria de refrescos anteriores para el Zombie Finder. Se bloquea siempre
    /// **despues** de soltar `sys`, nunca dentro.
    zombies: Mutex<processes::ZombieWatch>,
    /// Testigo con el que despertar al hilo del poller cuando cambian los ajustes.
    ///
    /// El bool no significa nada: es lo que exige la API del `Condvar`. Lo que
    /// importa es el aviso, que evita tener que sondear para enterarse de que
    /// alguien ha vuelto a encender el refresco o el Auto-Kill.
    senal: (Mutex<bool>, Condvar),
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

    /// Configuracion del Auto-Kill: si esta activo y con que umbral (ya con suelo).
    ///
    /// Si el candado estuviera envenenado devuelve "apagado": ante la duda, esta
    /// funcion no mata a nadie.
    fn auto_kill(&self) -> (bool, u64) {
        self.settings
            .lock()
            .map(|s| (s.auto_kill_enabled, s.auto_kill_limit_mb()))
            .unwrap_or((false, u64::MAX))
    }

    /// Despierta al hilo del poller. Se llama al guardar ajustes.
    ///
    /// Sin esto, apagar y volver a encender el refresco tardaria hasta
    /// `poller::PAUSA_MS` en notarse; con esto, se nota al instante y sin sondear
    /// entre medias.
    ///
    /// **El testigo se marca dentro del candado, y no es opcional**: ver `esperar`.
    fn despertar_poller(&self) {
        let (candado, cv) = &self.senal;
        let mut pendiente = candado.lock().unwrap_or_else(|e| e.into_inner());
        *pendiente = true;
        cv.notify_all();
    }

    /// Espera `ms`, o hasta que alguien guarde ajustes, lo que pase antes.
    ///
    /// ⚠️ **El `bool` del candado no es decoracion: es lo que evita perder avisos.**
    /// El hilo del poller lee los ajustes, decide cuanto dormir y solo entonces
    /// entra aqui. Si entre esas dos cosas alguien guarda ajustes, un `notify` a
    /// secas se pierde —no habia nadie escuchando todavia— y el hilo se queda
    /// esperando el plazo entero. Con el testigo, ese aviso queda anotado y esta
    /// funcion vuelve sin esperar.
    ///
    /// Costo una verificacion en vivo descubrirlo: los tests no lo cazaban porque
    /// avisaban con el hilo ya dormido, que es justo el caso facil.
    fn esperar(&self, ms: u64) {
        let (candado, cv) = &self.senal;
        // Un candado envenenado no debe dejar al hilo girando en vacio: se recupera
        // el guard y se sigue esperando igual.
        let mut pendiente = candado.lock().unwrap_or_else(|e| e.into_inner());

        // Aviso llegado mientras el hilo miraba los ajustes: se consume y se vuelve
        // al bucle de inmediato, sin dormir.
        if *pendiente {
            *pendiente = false;
            return;
        }

        let (mut guard, _) = cv
            .wait_timeout(pendiente, Duration::from_millis(ms))
            .unwrap_or_else(|e| e.into_inner());
        *guard = false;
    }

    /// Minutos tras los que marcar zombi, o `None` si la funcion esta apagada.
    fn zombie_after(&self) -> Option<u64> {
        self.settings
            .lock()
            .ok()
            .filter(|s| s.zombie_enabled)
            .map(|s| s.zombie_after_minutes())
    }
}

/// Lee la lista de procesos y le pega la marca del Zombie Finder.
///
/// Unico sitio donde se combinan las dos cosas: si el refresco manual, el hilo y
/// el evento de cierre no pasaran todos por aqui, la marca aparecerian y
/// desaparecerian segun de donde viniera la lista.
pub(crate) fn read_list(state: &AppState) -> Result<Vec<ProcessInfo>, String> {
    let custom = state.custom_names();
    let zombie_after = state.zombie_after();

    let mut list = {
        let mut sys = state
            .sys
            .lock()
            .map_err(|_| "Estado del sistema corrupto".to_string())?;
        collect_processes(&mut sys, &custom)
    };

    if let Ok(mut watch) = state.zombies.lock() {
        watch.track(&mut list, now_millis(), zombie_after);
    }

    Ok(list)
}

fn atajo_nuke() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyK)
}

pub(crate) fn publish(app: &AppHandle, list: Vec<ProcessInfo>) {
    if let Err(e) = app.emit(PROCESSES_UPDATED, list) {
        eprintln!("No se pudo emitir {PROCESSES_UPDATED}: {e}");
    }
}

/// Mide el equipo y la parte que se llevan los vigilados de `list`.
///
/// Bloquea `sys` por segunda vez en el ciclo, despues de que `read_list` lo haya
/// soltado —seguidos, nunca anidados—. Lo unico que puede cambiar entre los dos
/// bloqueos es que muera un proceso, y entonces la parte del entorno sale de una
/// lista de hace microsegundos: irrelevante para un medidor.
pub(crate) fn measure_usage(state: &AppState, list: &[ProcessInfo]) -> Option<SystemUsage> {
    let mut sys = state.sys.lock().ok()?;
    Some(collect_system_usage(&mut sys, list))
}

pub(crate) fn publish_usage(app: &AppHandle, usage: SystemUsage) {
    if let Err(e) = app.emit(SYSTEM_USAGE, usage) {
        eprintln!("No se pudo emitir {SYSTEM_USAGE}: {e}");
    }
}

/// Lee la lista actual y se la manda al frontend.
///
/// No aplica el Auto-Kill a proposito: `kill_and_record` llama aqui al terminar, y
/// vigilar tambien desde este camino encadenaria cierre → refresco → cierre.
fn emit_processes(app: &AppHandle) {
    if let Ok(list) = read_list(&app.state::<AppState>()) {
        publish(app, list);
    }
}

/// Unico camino por el que se cierra un proceso, venga de la ventana, de la
/// bandeja, del atajo global o del Auto-Kill.
///
/// Centralizarlo garantiza que las cuatro vias registren historial, notifiquen los
/// puertos liberados y refresquen la UI de la misma forma.
pub(crate) fn kill_and_record(
    app: &AppHandle,
    pids: Vec<u32>,
    source: KillSource,
) -> Vec<KillOutcome> {
    let state = app.state::<AppState>();
    let custom = state.custom_names();

    let outcomes: Vec<KillOutcome> = {
        let Ok(mut sys) = state.sys.lock() else {
            return Vec::new();
        };
        // `kill_many` lee la tabla de sockets una sola vez para todo el lote.
        kill_many(&mut sys, &custom, pids)
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

    // El Auto-Kill compone su propio aviso, que ya incluye los puertos ademas del
    // motivo del cierre; sin esta guarda soltaria dos notificaciones seguidas.
    if source != KillSource::Auto {
        let mut freed: Vec<u16> = outcomes
            .iter()
            .flat_map(|o| o.freed_ports.clone())
            .collect();
        freed.sort_unstable();
        freed.dedup();
        notify::freed_ports(app, &freed);
    }

    // La lista cambio: que la ventana lo refleje sin esperar al siguiente ciclo.
    emit_processes(app);
    outcomes
}

// ---------------------------------------------------------------- comandos ---

#[tauri::command]
fn get_processes(state: State<'_, AppState>) -> Result<Vec<ProcessInfo>, String> {
    read_list(&state)
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
        // Se corrige aqui, y no solo al usarlo, para que la UI muestre el valor
        // que de verdad va a aplicarse en vez de mentirle al usuario.
        auto_kill_mb: settings.auto_kill_mb.max(MIN_AUTO_KILL_MB),
        zombie_minutes: settings.zombie_minutes.max(MIN_ZOMBIE_MINUTES),
        ..settings
    };

    state.storage.save_settings(&settings)?;
    apply_hotkey(&app, settings.hotkey_enabled);
    *state.settings.lock().map_err(|_| "Ajustes corruptos")? = settings.clone();

    // El hilo puede estar esperando con el refresco en "Off": sin este aviso
    // tardaria hasta poller::PAUSA_MS en enterarse de que lo han vuelto a encender.
    state.despertar_poller();

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
        let Ok(mut sys) = state.sys.lock() else {
            return;
        };
        collect_processes(&mut sys, &custom)
            .into_iter()
            .map(|p| p.pid)
            .collect()
    };

    if pids.is_empty() {
        notify::show(app, "No hay procesos de desarrollo activos.".into());
        return;
    }

    let outcomes = kill_and_record(app, pids, KillSource::Hotkey);
    let killed = outcomes.iter().filter(|o| o.killed).count();
    notify::show(app, format!("{killed} procesos cerrados con Ctrl+Alt+K."));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // El primero de todos, como pide su documentacion. Si la app ya esta
        // corriendo, la instancia nueva avisa a esta y se cierra sola en vez de
        // abrir una segunda ventana.
        //
        // Sin esto se acumulaban copias: como cerrar la ventana la escondia en la
        // bandeja, el usuario creia haber cerrado la app y la volvia a lanzar. Se
        // llegaron a ver cuatro iconos de bandeja a la vez.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Traer al frente la que ya hay. `show_main_window` hace show +
            // unminimize + set_focus: el `show` es imprescindible porque puede
            // estar escondida en la bandeja, y entonces enfocarla no la enseña.
            tray::show_main_window(app);
        }))
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
                zombies: Mutex::new(processes::ZombieWatch::default()),
                senal: (Mutex::new(false), Condvar::new()),
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

            poller::spawn(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Cerrar cierra, salvo que el usuario haya pedido lo contrario en
            // Ajustes. Hasta el Tier 7.4 esto escondia la ventana **siempre**, y era
            // justo lo que hacia que se acumularan instancias invisibles.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let esconder = window
                    .app_handle()
                    .state::<AppState>()
                    .settings
                    .lock()
                    .map(|s| s.close_to_tray)
                    // Ante un candado envenenado, cerrar: dejar la app viva e
                    // invisible es peor que cerrarla de mas.
                    .unwrap_or(false);

                if esconder {
                    api.prevent_close();
                    let _ = window.hide();
                }
                // Si no, se deja cerrar y `RunEvent::ExitRequested` termina la app.
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            kill_process,
            kill_processes,
            get_settings,
            save_settings,
            get_history,
            clear_history,
            // Los del actualizador viven en `update`, junto a la logica en la que
            // delegan y a la guardia de rutas que protege a `install_update`.
            update::check_update,
            update::download_update,
            update::install_update
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
            idle_secs: 0,
            zombie: false,
        };
        let json = serde_json::to_value(&info).expect("ProcessInfo deberia serializar");
        for clave in [
            "pid",
            "name",
            "runtime",
            "cpu",
            "memoryMb",
            "runTimeSecs",
            "ports",
            "idleSecs",
            "zombie",
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
            assert!(
                outcome.get(clave).is_some(),
                "falta '{clave}' en KillOutcome"
            );
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
            assert!(
                entry.get(clave).is_some(),
                "falta '{clave}' en HistoryEntry"
            );
        }
        assert_eq!(entry["source"], "hotkey");

        let settings =
            serde_json::to_value(Settings::default()).expect("Settings deberia serializar");
        for clave in [
            "customNames",
            "hotkeyEnabled",
            "closeToTray",
            "refreshMs",
            "theme",
            "autoKillEnabled",
            "autoKillMb",
            "zombieEnabled",
            "zombieMinutes",
        ] {
            assert!(settings.get(clave).is_some(), "falta '{clave}' en Settings");
        }
        assert_eq!(settings["theme"], "system");
        assert_eq!(
            settings["closeToTray"], false,
            "cerrar la ventana cierra la app: esconderse en la bandeja hay que pedirlo"
        );
        assert_eq!(
            settings["autoKillEnabled"], false,
            "el Auto-Kill mata sin preguntar: tiene que venir apagado de fabrica"
        );

        // El historial distingue el cierre automatico del manual, y el frontend
        // traduce esa cadena literal en KILL_SOURCES.
        let auto = serde_json::to_value(KillSource::Auto).expect("KillSource deberia serializar");
        assert_eq!(auto, "auto");
    }

    /// El hilo del poller ya no sondea: espera en un `Condvar` y se le avisa al
    /// guardar ajustes.
    ///
    /// Si el aviso no funcionara, el fallo seria de los malos: con el refresco en
    /// "Off", volver a encenderlo tardaria hasta `PAUSA_MS` —un minuto— en notarse,
    /// y la app pareceria colgada sin que nada diera un error. El sondeo de 300 ms
    /// que habia antes disimulaba esto por fuerza bruta.
    #[test]
    fn guardar_ajustes_despierta_al_poller_sin_esperar_el_timeout() {
        use std::sync::Arc;
        use std::time::Instant;

        let state = Arc::new(AppState {
            sys: Mutex::new(new_system()),
            settings: Mutex::new(Settings::default()),
            storage: Storage::new(std::env::temp_dir().join("pdk-test-senal")),
            zombies: Mutex::new(processes::ZombieWatch::default()),
            senal: (Mutex::new(false), Condvar::new()),
        });

        let hilo = {
            let state = Arc::clone(&state);
            std::thread::spawn(move || {
                let t0 = Instant::now();
                // Muy por encima de PAUSA_MS: si el test acaba rapido es porque el
                // aviso llego, no porque venciera el plazo.
                state.esperar(30_000);
                t0.elapsed()
            })
        };

        // Margen para que el hilo llegue a la espera antes de avisarle; un aviso
        // lanzado antes de que nadie escuche se pierde, y esto no probaria nada.
        std::thread::sleep(Duration::from_millis(300));
        state.despertar_poller();

        let tardo = hilo.join().expect("el hilo del poller no deberia romperse");
        assert!(
            tardo < Duration::from_secs(5),
            "el aviso no desperto al poller: espero {tardo:?} de los 30 s"
        );
    }

    /// **Regresion de un fallo real, encontrado verificando en vivo.**
    ///
    /// El caso de arriba es el facil: se avisa con el hilo ya dormido. El que se
    /// escapaba es este — el aviso llega **antes** de que el hilo entre a esperar,
    /// que es exactamente lo que pasa en la app: el poller lee los ajustes, decide
    /// dormir, y el usuario pulsa "2s" en ese hueco.
    ///
    /// Con un `notify` a secas ese aviso se pierde (no habia nadie escuchando) y el
    /// hilo se queda el plazo entero: en la app eran hasta 60 s con la ventana
    /// aparentemente colgada. Lo arregla el testigo que se marca dentro del candado.
    #[test]
    fn un_aviso_anterior_a_la_espera_no_se_pierde() {
        let state = AppState {
            sys: Mutex::new(new_system()),
            settings: Mutex::new(Settings::default()),
            storage: Storage::new(std::env::temp_dir().join("pdk-test-senal-previa")),
            zombies: Mutex::new(processes::ZombieWatch::default()),
            senal: (Mutex::new(false), Condvar::new()),
        };

        // El aviso llega ANTES, con nadie esperando todavia.
        state.despertar_poller();

        let t0 = std::time::Instant::now();
        state.esperar(30_000);
        let tardo = t0.elapsed();

        assert!(
            tardo < Duration::from_secs(1),
            "el aviso previo se perdio: la espera duro {tardo:?}"
        );

        // Y el testigo se consume: la siguiente espera sin aviso si aguarda.
        let t1 = std::time::Instant::now();
        state.esperar(300);
        assert!(
            t1.elapsed() >= Duration::from_millis(250),
            "el testigo no se consumio; el poller giraria en vacio sin dormir nunca"
        );
    }
}
