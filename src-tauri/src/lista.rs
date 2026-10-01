//! La lista de procesos y su cierre: leerla, publicarla y cerrar lo que se pida.
//!
//! Salio de `lib.rs` en T12-16. La regla de CLAUDE.md dice que `lib.rs` es arranque y `AppState`, y
//! aqui vivia ademas el unico camino por el que se cierra un proceso. Ahora la regla y el codigo
//! dicen lo mismo.

use std::collections::HashMap;

use tauri::{AppHandle, Emitter, Manager};

use crate::processes::{
    self, collect_processes, collect_system_usage, kill_many, mark_protected, KillOutcome,
    ProcessInfo, SystemUsage,
};
use crate::storage::{now_millis, HistoryEntry, KillSource};
use crate::{notify, textos, AppState};

/// Evento que recibe el frontend cada vez que hay una lista nueva de procesos.
const PROCESSES_UPDATED: &str = "processes-updated";

/// Evento con el consumo del equipo y la parte que se lleva el entorno.
///
/// Va en un evento propio y no dentro de `PROCESSES_UPDATED` para no cambiar el
/// contrato de la lista, que es lo que escuchan la ventana y sus pruebas. Ademas
/// se emite desde menos sitios: ver `poller::cycle`.
const SYSTEM_USAGE: &str = "system-usage";

/// Lee la lista de procesos y le pega la marca del Zombie Finder.
///
/// Unico sitio donde se combinan las dos cosas: si el refresco manual, el hilo y
/// el evento de cierre no pasaran todos por aqui, la marca aparecerian y
/// desaparecerian segun de donde viniera la lista.
pub(crate) fn read_list(state: &AppState) -> Result<Vec<ProcessInfo>, String> {
    let custom = state.custom_names();
    let protected = state.protected_names();
    let zombie_after = state.zombie_after();

    let mut list = {
        let mut sys = state
            .sys
            .lock()
            .map_err(|_| textos::de(state.language()).estado_corrupto.to_string())?;
        collect_processes(&mut sys, &custom)
    };
    mark_protected(&mut list, &protected);

    if let Ok(mut watch) = state.zombies.lock() {
        watch.track(&mut list, now_millis(), zombie_after);
    }

    Ok(list)
}

/// Apunta con que hora de arranque ve la ventana cada PID. Se llama **cada vez que se le entrega
/// una lista** —por el evento o por `get_processes`— y no cada vez que se lee una: con el refresco
/// en «Off» el Auto-Kill sigue leyendo cada dos segundos sin publicar, y lo que hay que recordar es
/// lo que el usuario tiene delante, no lo ultimo que supo Rust.
pub(crate) fn recordar_vistos(state: &AppState, list: &[ProcessInfo]) {
    if let Ok(mut vistos) = state.vistos.lock() {
        *vistos = list.iter().map(|p| (p.pid, p.start_time)).collect();
    }
}

pub(crate) fn publish(app: &AppHandle, list: Vec<ProcessInfo>) {
    recordar_vistos(&app.state::<AppState>(), &list);
    if let Err(e) = app.emit(PROCESSES_UPDATED, list) {
        crate::avisar!("No se pudo emitir {PROCESSES_UPDATED}: {e}");
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
        crate::avisar!("No se pudo emitir {SYSTEM_USAGE}: {e}");
    }
}

/// Lee la lista actual y se la manda al frontend.
///
/// No aplica el Auto-Kill a proposito: `kill_and_record` llama aqui al terminar, y
/// vigilar tambien desde este camino encadenaria cierre → refresco → cierre.
pub(crate) fn emit_processes(app: &AppHandle) {
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
    // Los protegidos se vuelven a mirar aqui aunque cada via ya los deje fuera: es la unica puerta
    // por la que pasan las cuatro, y la ventana manda los PIDs que quiera.
    let protected = state.protected_names();
    // Antes de bloquear `sys`: `language()` toma el candado de los ajustes, y nunca se anidan.
    let lang = state.language();
    // Solo la ventana cierra a partir de una lista que puede tener minutos. La bandeja, el atajo y
    // el Auto-Kill eligen sus PIDs leyendo el sistema en el momento, y no hay foto vieja que
    // contrastar. Copiado y soltado antes de `sys`, como los ajustes.
    let vistos: HashMap<u32, u64> = if source == KillSource::Window {
        state.vistos.lock().map(|v| v.clone()).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let outcomes: Vec<KillOutcome> = {
        let Ok(mut sys) = state.sys.lock() else {
            return Vec::new();
        };
        // `kill_many` lee la tabla de sockets una sola vez para todo el lote.
        kill_many(&mut sys, &custom, &protected, pids, &vistos, lang)
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
        crate::avisar!("No se pudo guardar el historial: {e}");
    }

    // **Solo la ventana recibe aqui el aviso de los puertos.** Los otros tres caminos componen su
    // mensaje entero -recuento mas puertos- y lo mandan ellos: el Auto-Kill ya lo hacia, y desde
    // T3-12 tambien la bandeja y el atajo global, que antes sacaban dos notificaciones de Windows
    // por un solo clic. Con la ventana delante no aplica: ahi el recuento se ve en la propia
    // pantalla y la notificacion solo aporta los puertos.
    if source == KillSource::Window {
        notify::freed_ports(app, state.language(), &processes::freed_ports(&outcomes));
    }

    // La lista cambio: que la ventana lo refleje sin esperar al siguiente ciclo.
    emit_processes(app);
    outcomes
}
