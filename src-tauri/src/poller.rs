//! El hilo que publica la lista de procesos al ritmo configurado.
//!
//! Sustituye al `setInterval` que hacia el frontend: el trabajo pesado —enumerar
//! procesos y sockets— ocurre aqui y la ventana solo recibe el resultado ya
//! hecho. Por eso `src/App.tsx` no sondea nada y se limita a escuchar
//! `processes-updated`.

use tauri::{AppHandle, Manager};

use crate::{auto_kill, publish, read_list, AppState};

/// Limites del refresco automatico. Por debajo de 500 ms el enumerado de procesos
/// se solaparia consigo mismo sin aportar nada util.
pub const MIN_REFRESH_MS: u64 = 500;
pub const MAX_REFRESH_MS: u64 = 60_000;

/// Cada cuanto mira la RAM el Auto-Kill cuando el refresco automatico esta en
/// "Off". Una red de seguridad que deja de vigilar porque la ventana no se
/// refresca no es una red de seguridad.
const AUTO_KILL_IDLE_MS: u64 = 2000;

/// Cuanto espera el hilo cuando no tiene absolutamente nada que hacer —refresco
/// en "Off" y Auto-Kill apagado—.
///
/// Es solo una red por si se perdiera el aviso: quien cambie los ajustes despierta
/// al hilo al instante con el Condvar de `AppState`. Antes aqui habia un
/// `sleep(300)` en bucle, que en una app pensada para vivir dias en la bandeja son
/// cientos de miles de despertares diarios para no hacer nada.
pub const PAUSA_MS: u64 = 60_000;

/// Arranca el hilo. Vive lo que viva la app; no hay forma de pararlo ni hace
/// falta, porque con todo apagado se queda esperando y no consume nada.
pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let (ms, auto_enabled) = (state.refresh_ms(), state.auto_kill().0);

        if ms == 0 {
            if !auto_enabled {
                // Ni refresco ni vigilancia: no hay nada que hacer hasta que alguien
                // cambie los ajustes, y eso avisa. Antes se sondeaba cada 300 ms.
                state.esperar(PAUSA_MS);
                continue;
            }

            // Refresco apagado pero Auto-Kill encendido: se sigue vigilando la RAM
            // a ritmo fijo, sin publicar la lista.
            state.esperar(AUTO_KILL_IDLE_MS);
            cycle(&app, false);
            continue;
        }

        state.esperar(ms.clamp(MIN_REFRESH_MS, MAX_REFRESH_MS));
        cycle(&app, true);
    });
}

/// Un ciclo del vigilante: lee la lista **una sola vez**, deja que el Auto-Kill
/// actue si toca y publica el resultado.
///
/// `publish_list` separa el ciclo normal del que corre con el refresco en "Off":
/// alli se sigue mirando la RAM, pero no se emite nada, que es justo lo que pidio
/// el usuario al apagarlo.
fn cycle(app: &AppHandle, publish_list: bool) {
    let state = app.state::<AppState>();
    let (auto_enabled, limit_mb) = state.auto_kill();
    let Ok(list) = read_list(&state) else { return };

    // Si el Auto-Kill cerro algo, `kill_and_record` ya publico la lista sin los
    // muertos: publicar aqui la que se leyo antes haria parpadear filas que ya
    // no existen.
    if auto_enabled && auto_kill::enforce(app, &list, limit_mb) {
        return;
    }

    if publish_list {
        publish(app, list);
    }
}
