//! El atajo global que cierra todo lo vigilado.
//!
//! Estaba en `lib.rs` hasta el Tier 11. Salio al crecer: la combinacion dejo de ser fija y ganó la
//! doble pulsacion, y con eso `lib.rs` pasaba de las ~450 lineas que fija CLAUDE.md. Es ademas la
//! segunda funcion de la app que mata sin preguntar —la primera es el Auto-Kill, que tambien tiene
//! modulo propio— y conviene poder leerla entera de una vez.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::processes::{self, unprotected_pids};
use crate::storage::{Hotkey, KillSource};
use crate::{kill_and_record, notify, textos, AppState};

/// Plazo para la segunda pulsacion. Tres segundos dan para leer el aviso y decidir; mas, y una
/// pulsacion suelta de hace un rato armaria un disparo que nadie recuerda haber pedido.
pub const PLAZO_SEGUNDA: Duration = Duration::from_secs(3);

/// Cuando se armo el atajo por ultima vez, o `None` si no hay nada armado.
///
/// Estatico y no un campo de `AppState`: solo lo toca este modulo, y ponerlo alli obligaria a
/// tocar las pruebas que montan un `AppState` por algo que no les va ni les viene.
static ARMADO: Mutex<Option<Instant>> = Mutex::new(None);

const TODAS: [Hotkey; 3] = [Hotkey::CtrlAltK, Hotkey::CtrlAltShiftK, Hotkey::CtrlAltF12];

fn shortcut(hotkey: Hotkey) -> Shortcut {
    let ctrl_alt = Modifiers::CONTROL | Modifiers::ALT;
    match hotkey {
        Hotkey::CtrlAltK => Shortcut::new(Some(ctrl_alt), Code::KeyK),
        Hotkey::CtrlAltShiftK => Shortcut::new(Some(ctrl_alt | Modifiers::SHIFT), Code::KeyK),
        Hotkey::CtrlAltF12 => Shortcut::new(Some(ctrl_alt), Code::F12),
    }
}

/// Registra la combinacion pedida y quita las demas, o las quita todas si esta apagado.
///
/// **Se quitan las otras aunque no se hayan tocado**: al cambiar de combinacion en Ajustes, la
/// vieja seguiria registrada —y robandosela a las demas apps— si solo se registrara la nueva.
pub fn apply(app: &AppHandle, enabled: bool, hotkey: Hotkey) {
    let manager = app.global_shortcut();
    let pedida = shortcut(hotkey);

    for otra in TODAS.map(shortcut) {
        if (!enabled || otra != pedida) && manager.is_registered(otra) {
            if let Err(e) = manager.unregister(otra) {
                crate::avisar!("No se pudo quitar el atajo global: {e}");
            }
        }
    }

    if enabled && !manager.is_registered(pedida) {
        if let Err(e) = manager.register(pedida) {
            crate::avisar!("No se pudo registrar el atajo global {}: {e}", hotkey.label());
        }
    }
}

/// Lo que hace una pulsacion.
#[derive(Debug, PartialEq)]
pub enum Pulsacion {
    /// Primera de dos: solo avisa de lo que va a pasar.
    Armar,
    /// Cierra todo.
    Disparar,
}

/// Decide que hace una pulsacion. Pura, para poder probarla sin teclado ni reloj.
///
/// Con la doble pulsacion apagada, dispara siempre. Con ella encendida, dispara solo si hay una
/// armada **y** dentro de plazo; si no, arma. Una armada caducada cuenta como ninguna: la segunda
/// pulsacion tiene que ser una respuesta al aviso, no una coincidencia.
pub fn decidir(armada: Option<Instant>, ahora: Instant, doble: bool) -> Pulsacion {
    if !doble {
        return Pulsacion::Disparar;
    }
    match armada {
        Some(cuando) if ahora.saturating_duration_since(cuando) <= PLAZO_SEGUNDA => {
            Pulsacion::Disparar
        }
        _ => Pulsacion::Armar,
    }
}

/// Lo que pasa al pulsar el atajo. Lo llama el manejador del plugin.
pub fn on_press(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (doble, hotkey) = state
        .settings
        .lock()
        .map(|s| (s.hotkey_double_press, s.hotkey))
        // Ante un candado envenenado, pedir la segunda pulsacion: es el lado que no mata a nadie.
        .unwrap_or((true, Hotkey::default()));

    let ahora = Instant::now();
    let accion = {
        let mut armada = ARMADO.lock().unwrap_or_else(|e| e.into_inner());
        let accion = decidir(*armada, ahora, doble);
        // Disparar consume lo armado: una tercera pulsacion vuelve a empezar, no dispara otra vez.
        *armada = (accion == Pulsacion::Armar).then_some(ahora);
        accion
    };

    match accion {
        Pulsacion::Armar => armar(app, hotkey),
        Pulsacion::Disparar => nuke_everything(app, hotkey),
    }
}

/// Los PIDs que cerraria el atajo ahora mismo: todos los vigilados menos los protegidos.
fn objetivos(app: &AppHandle) -> Vec<u32> {
    let state = app.state::<AppState>();
    let custom = state.custom_names();
    let protected = state.protected_names();
    let Ok(mut sys) = state.sys.lock() else {
        return Vec::new();
    };
    unprotected_pids(&mut sys, &custom, &protected)
}

/// La primera pulsacion: avisa de cuantos caerian y de como confirmarlo.
///
/// Se cuenta ahora y no al disparar para que el aviso diga algo concreto. Si en los tres segundos
/// aparece o muere alguno, la segunda pulsacion cierra los que haya entonces, que es lo que pasaria
/// igual sin doble pulsacion.
fn armar(app: &AppHandle, hotkey: Hotkey) {
    let lang = app.state::<AppState>().language();
    let n = objetivos(app).len();

    if n == 0 {
        // Sin nada que cerrar no hay nada que armar: la segunda pulsacion volveria a decir esto.
        *ARMADO.lock().unwrap_or_else(|e| e.into_inner()) = None;
        notify::show(app, textos::de(lang).sin_procesos.into());
        return;
    }
    notify::show(app, textos::atajo_armado(lang, hotkey.label(), n));
}

/// Cierra de golpe todo lo vigilado que no este protegido.
fn nuke_everything(app: &AppHandle, hotkey: Hotkey) {
    let lang = app.state::<AppState>().language();
    let pids = objetivos(app);

    if pids.is_empty() {
        notify::show(app, textos::de(lang).sin_procesos.into());
        return;
    }

    let outcomes = kill_and_record(app, pids, KillSource::Hotkey);
    let killed = outcomes.iter().filter(|o| o.killed).count();
    notify::show(
        app,
        textos::con_puertos(
            lang,
            textos::closed_sentence(lang, killed, None, Some(hotkey.label())),
            &processes::freed_ports(&outcomes),
        ),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **El criterio negativo, que es el que importa**: una pulsacion suelta no mata nada.
    #[test]
    fn con_doble_pulsacion_la_primera_solo_arma() {
        let ahora = Instant::now();
        assert_eq!(decidir(None, ahora, true), Pulsacion::Armar);
    }

    #[test]
    fn la_segunda_dentro_de_plazo_dispara() {
        let antes = Instant::now();
        let ahora = antes + Duration::from_millis(800);
        assert_eq!(decidir(Some(antes), ahora, true), Pulsacion::Disparar);
    }

    /// Una pulsacion de hace un rato no puede convertir la de ahora en un disparo: la segunda tiene
    /// que responder al aviso, y el aviso ya se fue.
    #[test]
    fn una_armada_caducada_no_dispara() {
        let antes = Instant::now();
        let ahora = antes + PLAZO_SEGUNDA + Duration::from_millis(1);
        assert_eq!(decidir(Some(antes), ahora, true), Pulsacion::Armar);
    }

    #[test]
    fn sin_doble_pulsacion_dispara_a_la_primera() {
        assert_eq!(decidir(None, Instant::now(), false), Pulsacion::Disparar);
    }

    /// Las tres combinaciones tienen que ser distintas: si dos coincidieran, `apply` quitaria la
    /// pedida creyendo que es «otra».
    #[test]
    fn las_combinaciones_no_se_pisan() {
        let atajos = TODAS.map(shortcut);
        for (i, a) in atajos.iter().enumerate() {
            for b in &atajos[i + 1..] {
                assert_ne!(a, b);
            }
        }
    }
}
