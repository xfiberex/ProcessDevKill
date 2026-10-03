mod auto_kill;
mod commands;
mod elevation;
mod hotkey;
mod lista;
// `pub` porque el macro `avisar!` que exporta se resuelve como `$crate::logging::escribir`.
pub mod logging;
mod notify;
mod poller;
mod service_control;
mod services;
mod ports;
mod processes;
mod storage;
mod textos;
mod tray;
mod update;

use std::collections::HashMap;
use std::sync::{Condvar, Mutex};
use std::time::Duration;

use sysinfo::System;
use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

use processes::{new_system, warm_up_cpu};
use storage::{Language, Settings, Storage};

pub struct AppState {
    sys: Mutex<System>,
    settings: Mutex<Settings>,
    storage: Storage,
    /// Memoria de refrescos anteriores para el Zombie Finder. Se bloquea siempre
    /// **despues** de soltar `sys`, nunca dentro.
    zombies: Mutex<processes::ZombieWatch>,
    /// La hora de arranque de cada PID **en la ultima lista que se le dio a la ventana**. Es con lo
    /// que se comprueba, al cerrar, que el proceso sigue siendo el que el usuario tenia delante y
    /// no otro que heredo su numero (T12-09). Se copia y se suelta antes de bloquear `sys`.
    vistos: Mutex<HashMap<u32, u64>>,
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

    /// Los protegidos, ya normalizados. Mismo criterio que `custom_names`: copiar y soltar.
    fn protected_names(&self) -> Vec<String> {
        self.settings
            .lock()
            .map(|s| s.normalized_protected())
            .unwrap_or_default()
    }

    /// Idioma vigente, para el texto que escribe Rust: la bandeja, las notificaciones y los
    /// errores que acaban en un toast.
    ///
    /// Ante un candado envenenado cae al de fabrica en vez de propagar el error: quedarse sin
    /// notificacion por no poder leer un ajuste seria perder el aviso de un proceso ya muerto.
    pub(crate) fn language(&self) -> Language {
        self.settings.lock().map(|s| s.language).unwrap_or_default()
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

// ------------------------------------------------------------------ arranque ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Antes que nada: desde aqui, un panico deja su linea en el log en cuanto el log exista. El
    // proceso elevado de los servicios, que sale unas lineas mas abajo, no llega a iniciarlo.
    logging::instalar_gancho_de_panico();

    // Lo primero de todo, antes de que exista una app de Tauri.
    //
    // Esta misma ejecucion puede ser el proceso elevado que la ventana relanzo para arrancar o
    // detener un servicio. Si lo es, hace su unica llamada al SCM y se muere aqui: no abre ventana,
    // no registra el atajo global, no pone icono en la bandeja y no cuenta como segunda instancia.
    if let Some(codigo) = service_control::intercept() {
        std::process::exit(codigo as i32);
    }

    // Después, y también antes de Tauri: si el usuario pidió arrancar siempre como administrador,
    // esta instancia lanza la elevada y se va sin registrarse como instancia única, que es lo que
    // le dejaría a la nueva el sitio ocupado. Ver `elevation::al_arrancar`.
    let context = tauri::generate_context!();
    if elevation::al_arrancar(&context.config().identifier) {
        std::process::exit(0);
    }

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
                // Sin mirar cual: `hotkey::apply` deja registrada una sola combinacion.
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        hotkey::on_press(app);
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
            // Antes que nada: si `Storage::new` no puede crear la carpeta, ese aviso es
            // precisamente uno de los que hay que poder leer despues.
            logging::iniciar(&dir);
            crate::avisar!("--- ProcessDevKill v{} arrancando ---", env!("CARGO_PKG_VERSION"));
            #[cfg(feature = "envivo")]
            logging::panico_de_prueba();

            let storage = Storage::new(dir);
            let settings = storage.load_settings();

            app.manage(AppState {
                // Una sola instancia de System para toda la app: crearla en cada
                // llamada obliga a releer todo el arbol de procesos y es lento.
                sys: Mutex::new(new_system()),
                settings: Mutex::new(settings.clone()),
                storage,
                zombies: Mutex::new(processes::ZombieWatch::default()),
                vistos: Mutex::new(HashMap::new()),
                senal: (Mutex::new(false), Condvar::new()),
            });

            tray::build(&handle, settings.language)?;
            hotkey::apply(&handle, settings.hotkey_enabled, settings.hotkey);

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
                lista::emit_processes(&warm);
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
            // Todos viven en su modulo; el nombre por IPC lo da el ultimo segmento, asi que desde
            // el frontend siguen llamandose igual que cuando estaban aqui.
            commands::get_processes,
            commands::kill_process,
            commands::kill_processes,
            commands::get_settings,
            commands::save_settings,
            commands::get_services,
            // Viven en su modulo, como los del actualizador: por IPC siguen siendo
            // `control_service` y `get_service_dependents`, que es el ultimo segmento.
            service_control::control_service,
            service_control::get_service_dependents,
            service_control::set_service_startup,
            service_control::get_service_changes,
            commands::get_history,
            commands::clear_history,
            // Los del actualizador viven en `update`, junto a la logica en la que
            // delegan y a la guardia de rutas que protege a `install_update`.
            update::check_update,
            update::download_update,
            update::install_update,
            // Igual que los del actualizador: viven junto a su logica, y el nombre por IPC lo da
            // el ultimo segmento, asi que desde el frontend siguen siendo `log_error` y `log_path`.
            logging::log_error,
            logging::log_path,
            logging::open_log_dir,
            elevation::get_elevation,
            elevation::restart_as_admin
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    // Solo los usan los tests: en el resto de lib.rs no se nombran.
    use processes::{KillOutcome, ProcessInfo, Runtime};
    use storage::{HistoryEntry, KillSource};

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
            start_time: 0,
            ports: vec![5173],
            idle_secs: 0,
            zombie: false,
            script: Some("vite".into()),
            project: Some("mi-web".into()),
            protected: false,
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
            "script",
            "project",
            "protected",
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
            "hotkey",
            "hotkeyDoublePress",
            "protected",
        ] {
            assert!(settings.get(clave).is_some(), "falta '{clave}' en Settings");
        }
        assert_eq!(settings["theme"], "system");
        assert_eq!(settings["hotkey"], "ctrlAltK");
        assert_eq!(
            settings["hotkeyEnabled"], false,
            "el atajo global cierra todo sin confirmar: tiene que venir apagado de fabrica"
        );
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
            vistos: Mutex::new(HashMap::new()),
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
            vistos: Mutex::new(HashMap::new()),
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
