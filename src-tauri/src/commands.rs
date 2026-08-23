//! Los comandos de Tauri: la superficie entera que la ventana puede llamar.
//!
//! Estaban en `lib.rs` hasta el 2026-08-23, cuando ese archivo volvió a pasar de las ~450 líneas
//! que fija CLAUDE.md. Es la **tercera** vez que se parte —las otras dos fueron el Tier 4 y el
//! Tier 7.6— y se van los comandos porque son lo que más crece: cada funcionalidad nueva de cara
//! al usuario añade uno. Lo que se queda es el arranque y `AppState`, que es lo que de verdad
//! describe a `lib.rs`.
//!
//! **No están todos los comandos de la app, y es a propósito.** Los que actúan sobre servicios
//! viven en `service_control.rs`, los del actualizador en `update.rs` y los del log en
//! `logging.rs`: junto a la lógica en la que delegan y, en el caso de los servicios, junto a la
//! guardia que los protege. El nombre por IPC lo da el **último segmento** de la ruta que se
//! registra en `generate_handler!`, así que mover un comando de archivo no cambia cómo se le
//! llama desde el frontend.

use tauri::{AppHandle, Manager, State};

use crate::poller::{MAX_REFRESH_MS, MIN_REFRESH_MS};
use crate::processes::{KillOutcome, ProcessInfo};
use crate::storage::{
    HistoryEntry, KillSource, Settings, MIN_AUTO_KILL_MB, MIN_ZOMBIE_MINUTES,
};
use crate::{
    apply_hotkey, emit_processes, kill_and_record, read_list, services, textos, tray, AppState,
};

#[tauri::command]
pub fn get_processes(state: State<'_, AppState>) -> Result<Vec<ProcessInfo>, String> {
    read_list(&state)
}

#[tauri::command]
pub fn kill_process(pid: u32, app: AppHandle) -> Result<Vec<u16>, String> {
    let mut outcomes = kill_and_record(&app, vec![pid], KillSource::Window);
    let outcome = outcomes
        .pop()
        .ok_or_else(|| {
            textos::de(app.state::<AppState>().language())
                .sin_acceso_al_sistema
                .to_string()
        })?;

    if outcome.killed {
        Ok(outcome.freed_ports)
    } else {
        Err(outcome.error.unwrap_or_else(|| {
            textos::de(app.state::<AppState>().language())
                .fallo_desconocido
                .into()
        }))
    }
}

/// Termina varios procesos y detalla que paso con cada uno.
///
/// Devuelve un resultado por PID en vez de abortar al primer fallo: en un lote es
/// normal que alguno haya muerto solo entre el ultimo refresco y el clic, y eso no
/// deberia impedir matar los demas.
#[tauri::command]
pub fn kill_processes(pids: Vec<u32>, app: AppHandle) -> Vec<KillOutcome> {
    kill_and_record(&app, pids, KillSource::Window)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn save_settings(
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
    // El menu de la bandeja se arma una vez y Windows no lo retraduce solo: si cambio el idioma,
    // hay que rehacerlo. Se hace **antes** de escribir el ajuste nuevo para poder comparar con el
    // que habia; despues ya no habria con que.
    if state.language() != settings.language {
        tray::retraducir(&app, settings.language);
    }

    *state
        .settings
        .lock()
        .map_err(|_| textos::de(settings.language).ajustes_corruptos)? = settings.clone();

    // El hilo puede estar esperando con el refresco en "Off": sin este aviso
    // tardaria hasta poller::PAUSA_MS en enterarse de que lo han vuelto a encender.
    state.despertar_poller();

    // La lista de vigilados puede haber cambiado: refrescar sin esperar al ciclo.
    emit_processes(&app);
    Ok(settings)
}

/// Los servicios de desarrollo del equipo.
///
/// **A peticion, y no empujado por el poller como la lista de procesos.** Un servicio cambia de
/// estado cuando alguien lo arranca o lo detiene, que es algo que pasa dos veces al dia; releerlo
/// cada dos segundos le sumaria a cada ciclo un recorrido del catalogo entero del SCM -cientos de
/// servicios, con una consulta de configuracion por cada uno- para no enterarse de nada nuevo. La
/// vista lo pide al abrirse y cuando el usuario pulsa refrescar.
#[tauri::command]
pub fn get_services(state: State<'_, AppState>) -> Result<Vec<services::ServiceInfo>, String> {
    let custom = state
        .settings
        .lock()
        .map(|s| s.custom_services.clone())
        .unwrap_or_default();

    // Los ajustes se copian y se suelta su candado **antes** de bloquear `sys`. Nunca anidados.
    let mut sys = state
        .sys
        .lock()
        .map_err(|_| textos::de(state.language()).estado_corrupto.to_string())?;

    Ok(services::collect_services(&mut sys, &custom))
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>) -> Vec<HistoryEntry> {
    state.storage.load_history()
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.storage.clear_history()
}

