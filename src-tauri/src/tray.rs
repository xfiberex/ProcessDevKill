//! Icono y menu de la bandeja del sistema.

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::processes::{pids_of_runtime, Runtime};
use crate::storage::KillSource;
use crate::{kill_and_record, notify, AppState};

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

    // Via `pids_of_runtime` y no repitiendo el filtro aqui: es la funcion que
    // cubre el test `selecciona_solo_los_pids_del_runtime_pedido`, y este menu
    // mata procesos sin ventana delante que ensene el error.
    let targets: Vec<u32> = {
        let Ok(mut sys) = state.sys.lock() else {
            return;
        };
        pids_of_runtime(&mut sys, &custom, runtime)
    };

    if targets.is_empty() {
        notify::show(app, format!("No hay procesos {} activos.", runtime.label()));
        return;
    }

    let outcomes = kill_and_record(app, targets, KillSource::Tray);
    let killed = outcomes.iter().filter(|o| o.killed).count();
    notify::show(
        app,
        notify::con_puertos(
            notify::closed_sentence(killed, runtime.label(), ""),
            &crate::processes::freed_ports(&outcomes),
        ),
    );
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Mostrar ProcessDevKill").build(app)?;
    let kill_node = MenuItemBuilder::with_id("kill_node", "Cerrar todos los Node").build(app)?;
    let kill_python =
        MenuItemBuilder::with_id("kill_python", "Cerrar todos los Python").build(app)?;
    let kill_dotnet =
        MenuItemBuilder::with_id("kill_dotnet", "Cerrar todos los .NET").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Salir").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &kill_node,
            &kill_python,
            &kill_dotnet,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ])
        .build()?;

    // Sin `unwrap`: un panico en el `setup` es una app que no arranca y no dice por que. El resto
    // del arranque degrada con elegancia -`app_data_dir` cae a `temp_dir`, unos ajustes corruptos a
    // los de fabrica-, y esto rompia esa coherencia. Se propaga por el `tauri::Result` que la
    // funcion ya devuelve.
    let icono = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::AssetNotFound("icono de la ventana".into()))?
        .clone();

    TrayIconBuilder::with_id("main")
        .icon(icono)
        .tooltip("ProcessDevKill")
        // Sin esto, el clic izquierdo abre el menu en vez de llegar al handler.
        .show_menu_on_left_click(false)
        .menu(&menu)
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
