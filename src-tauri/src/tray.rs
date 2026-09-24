//! Icono y menu de la bandeja del sistema.

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::processes::{pids_of_runtime, Runtime};
use crate::storage::{KillSource, Language};
use crate::{kill_and_record, notify, textos, AppState};

/// Id del icono en la bandeja. Hace falta para poder recuperarlo y cambiarle el menu al cambiar
/// de idioma: sin id, `tray_by_id` no tiene por donde encontrarlo.
const TRAY_ID: &str = "main";

/// Trae la ventana principal al frente, restaurandola si estaba oculta o minimizada.
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Cierra todos los procesos de un runtime desde el menu de la bandeja.
///
/// Se ejecuta sin que la ventana este necesariamente visible, asi que la
/// notificacion es el unico feedback que recibe el usuario; por eso se emite
/// tambien cuando no habia nada que cerrar.
fn kill_all_of(app: &AppHandle, runtime: Runtime) {
    let state = app.state::<AppState>();
    let custom = state.custom_names();
    let protected = state.protected_names();
    let lang = state.language();

    // Via `pids_of_runtime` y no repitiendo el filtro aqui: es la funcion que
    // cubre el test `selecciona_solo_los_pids_del_runtime_pedido`, y este menu
    // mata procesos sin ventana delante que ensene el error.
    let targets: Vec<u32> = {
        let Ok(mut sys) = state.sys.lock() else {
            return;
        };
        pids_of_runtime(&mut sys, &custom, &protected, runtime)
    };

    if targets.is_empty() {
        notify::show(app, textos::ninguno_activo(lang, runtime.label()));
        return;
    }

    let outcomes = kill_and_record(app, targets, KillSource::Tray);
    let killed = outcomes.iter().filter(|o| o.killed).count();
    notify::show(
        app,
        textos::con_puertos(
            lang,
            textos::closed_sentence(lang, killed, Some(runtime.label()), None),
            &crate::processes::freed_ports(&outcomes),
        ),
    );
}

/// Arma el menu en el idioma pedido.
///
/// Aparte de `build` porque el menu se rehace al cambiar de idioma en Ajustes: Windows no
/// retraduce nada solo, y un menu que sigue en español despues de poner la app en ingles es
/// exactamente la mitad de la app que el usuario **no** puede leer.
fn menu(app: &AppHandle, lang: Language) -> tauri::Result<Menu<Wry>> {
    let t = textos::de(lang);

    let show = MenuItemBuilder::with_id("show", t.mostrar).build(app)?;
    let quit = MenuItemBuilder::with_id("quit", t.salir).build(app)?;

    // Una entrada por runtime de fabrica, recorriendo `BUILT_INS` en vez de escribir las tres a
    // mano: asi la traduccion se pide una sola vez. El `match` de los ids es **exhaustivo** a
    // proposito —sin comodin—, para que un runtime nuevo en el enum sea un error de compilacion
    // aqui y no una entrada de menu con la etiqueta de otro.
    let cierres: Vec<_> = Runtime::BUILT_INS
        .iter()
        .map(|runtime| {
            let id = match runtime {
                Runtime::Node => "kill_node",
                Runtime::Python => "kill_python",
                Runtime::Dotnet => "kill_dotnet",
                Runtime::Other => "kill_other",
            };
            MenuItemBuilder::with_id(id, textos::cerrar_todos(lang, runtime.label())).build(app)
        })
        .collect::<tauri::Result<_>>()?;

    let mut builder = MenuBuilder::new(app).items(&[&show, &PredefinedMenuItem::separator(app)?]);
    for item in &cierres {
        builder = builder.item(item);
    }
    builder
        .items(&[&PredefinedMenuItem::separator(app)?, &quit])
        .build()
}

/// Rehace el menu de la bandeja en el idioma pedido. Se llama al guardar ajustes.
///
/// Si el icono no esta —solo pasaria con el arranque a medias—, no se hace nada: quedarse sin
/// retraducir un menu no puede tumbar el guardado de los ajustes.
pub fn retraducir(app: &AppHandle, lang: Language) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        crate::avisar!("No se encontro el icono de la bandeja para retraducir su menu");
        return;
    };

    match menu(app, lang) {
        Ok(nuevo) => {
            if let Err(e) = tray.set_menu(Some(nuevo)) {
                crate::avisar!("No se pudo cambiar el menu de la bandeja: {e}");
            }
        }
        Err(e) => crate::avisar!("No se pudo armar el menu de la bandeja: {e}"),
    }
}

pub fn build(app: &AppHandle, lang: Language) -> tauri::Result<()> {
    // Sin `unwrap`: un panico en el `setup` es una app que no arranca y no dice por que. El resto
    // del arranque degrada con elegancia -`app_data_dir` cae a `temp_dir`, unos ajustes corruptos a
    // los de fabrica-, y esto rompia esa coherencia. Se propaga por el `tauri::Result` que la
    // funcion ya devuelve.
    let icono = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::AssetNotFound("icono de la ventana".into()))?
        .clone();

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icono)
        .tooltip("ProcessDevKill")
        // Sin esto, el clic izquierdo abre el menu en vez de llegar al handler.
        .show_menu_on_left_click(false)
        .menu(&menu(app, lang)?)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "kill_node" => kill_all_of(app, Runtime::Node),
            "kill_python" => kill_all_of(app, Runtime::Python),
            "kill_dotnet" => kill_all_of(app, Runtime::Dotnet),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
