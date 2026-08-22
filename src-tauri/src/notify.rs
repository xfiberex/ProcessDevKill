//! Avisos nativos de Windows.
//!
//! Viven en Rust y no en el frontend a proposito: la bandeja, el atajo global y
//! el Auto-Kill cierran procesos **sin que la ventana intervenga**, y a veces con
//! la ventana escondida. Un toast de Sonner ahi no lo veria nadie.
//!
//! Aqui esta el envio; las palabras estan en `textos.rs`, con sus dos idiomas y sus pruebas. La
//! separacion no es de manual: al traducir la app, las frases con numero resultaron ser lo unico
//! de este modulo que hacia falta probar, y probarlas no requiere una `App` de Tauri — enviarlas,
//! si.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::storage::Language;
use crate::textos;

/// Saca un aviso del sistema. Si falla, se anota y ya: quedarse sin notificacion
/// no puede tumbar el cierre de un proceso que ya ocurrio.
pub fn show(app: &AppHandle, body: String) {
    if let Err(e) = app
        .notification()
        .builder()
        .title("ProcessDevKill")
        .body(body)
        .show()
    {
        crate::avisar!("No se pudo mostrar la notificacion: {e}");
    }
}

/// Avisa de los puertos que acaban de quedar libres, si quedo alguno.
pub fn freed_ports(app: &AppHandle, lang: Language, ports: &[u16]) {
    if let Some(body) = textos::freed_ports_sentence(lang, ports) {
        show(app, body);
    }
}
