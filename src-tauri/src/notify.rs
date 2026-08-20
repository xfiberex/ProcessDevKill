//! Avisos nativos de Windows.
//!
//! Viven en Rust y no en el frontend a proposito: la bandeja, el atajo global y
//! el Auto-Kill cierran procesos **sin que la ventana intervenga**, y a veces con
//! la ventana escondida. Un toast de Sonner ahi no lo veria nadie.

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

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
pub fn freed_ports(app: &AppHandle, ports: &[u16]) {
    if let Some(body) = freed_ports_sentence(ports) {
        show(app, body);
    }
}

/// Frase sobre los puertos liberados, o `None` si no se libero ninguno.
///
/// Aparte de `freed_ports` para que el Auto-Kill pueda pegarla al final de su
/// propio mensaje en vez de soltar dos notificaciones seguidas.
pub fn freed_ports_sentence(ports: &[u16]) -> Option<String> {
    if ports.is_empty() {
        return None;
    }

    let list = ports
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Some(if ports.len() == 1 {
        format!("El puerto {list} ha quedado libre.")
    } else {
        format!("Los puertos {list} han quedado libres.")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Los puertos liberados son la razon de ser de la app: la frase que los
    /// anuncia es lo unico que se lee cuando el cierre vino de la bandeja o del
    /// atajo global y no habia ninguna ventana delante.
    #[test]
    fn la_frase_de_puertos_concuerda_en_singular_y_plural() {
        assert_eq!(freed_ports_sentence(&[]), None);
        assert_eq!(
            freed_ports_sentence(&[3000]).unwrap(),
            "El puerto 3000 ha quedado libre."
        );
        assert_eq!(
            freed_ports_sentence(&[3000, 5173]).unwrap(),
            "Los puertos 3000, 5173 han quedado libres."
        );
    }
}
