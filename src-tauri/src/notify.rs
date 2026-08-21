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

/// Frase del recuento de cierres, en singular o en plural.
///
/// «1 procesos Node cerrados.» era lo que salia al cerrar uno solo desde la bandeja. Es el mismo
/// descuido que el frontend ya arreglo dos veces —«Se terminaran los 1 procesos» en el Tier 5 y
/// «1 cierre registrados» en el historial—, asi que aqui se resuelve en un sitio con su prueba, que
/// es como esta resuelto `freed_ports_sentence`.
///
/// `que` es lo que va entre el sustantivo y el participio (el runtime, en la bandeja) y `cola` lo
/// que cierra la frase («con Ctrl+Alt+K», en el atajo). Cualquiera de los dos puede ir vacio.
pub fn closed_sentence(killed: usize, que: &str, cola: &str) -> String {
    let plural = killed != 1;
    let procesos = if plural { "procesos" } else { "proceso" };
    let cerrados = if plural { "cerrados" } else { "cerrado" };

    let que = if que.is_empty() {
        String::new()
    } else {
        format!(" {que}")
    };
    let cola = if cola.is_empty() {
        String::new()
    } else {
        format!(" {cola}")
    };

    format!("{killed} {procesos}{que} {cerrados}{cola}.")
}

/// Junta el recuento con la frase de los puertos, si hubo alguno.
///
/// **Un solo aviso por accion.** Antes la bandeja y el atajo sacaban dos notificaciones de Windows
/// por un solo clic: la de los puertos que suelta `kill_and_record` y la del recuento al volver. El
/// Auto-Kill ya evitaba el duplicado componiendo su mensaje entero; esto extiende ese criterio a
/// los otros dos caminos, que ademas son justo los que se usan **sin la ventana delante**.
pub fn con_puertos(recuento: String, ports: &[u16]) -> String {
    match freed_ports_sentence(ports) {
        Some(frase) => format!("{recuento} {frase}"),
        None => recuento,
    }
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

#[cfg(test)]
mod tests_recuento {
    use super::*;

    /// «1 procesos Node cerrados.» es lo que salia antes al cerrar uno solo desde la bandeja. El
    /// numero cambia la frase entera, no solo el sustantivo: es el mismo descuido que el frontend
    /// ya arreglo dos veces.
    #[test]
    fn el_recuento_concuerda_en_singular_y_en_plural() {
        assert_eq!(closed_sentence(1, "Node", ""), "1 proceso Node cerrado.");
        assert_eq!(closed_sentence(3, "Node", ""), "3 procesos Node cerrados.");

        // Cero tambien es plural en español: «0 procesos cerrados».
        assert_eq!(closed_sentence(0, "Python", ""), "0 procesos Python cerrados.");

        // El atajo global no lleva runtime, pero si cola.
        assert_eq!(
            closed_sentence(1, "", "con Ctrl+Alt+K"),
            "1 proceso cerrado con Ctrl+Alt+K."
        );
        assert_eq!(
            closed_sentence(5, "", "con Ctrl+Alt+K"),
            "5 procesos cerrados con Ctrl+Alt+K."
        );
    }

    /// Un solo aviso por accion: el recuento y los puertos van en el mismo mensaje.
    #[test]
    fn el_recuento_y_los_puertos_viajan_juntos() {
        assert_eq!(
            con_puertos(closed_sentence(2, "Node", ""), &[3000, 5173]),
            "2 procesos Node cerrados. Los puertos 3000, 5173 han quedado libres."
        );

        // Sin puertos liberados no se pega nada: ni frase vacia ni espacio de mas.
        assert_eq!(
            con_puertos(closed_sentence(1, "Node", ""), &[]),
            "1 proceso Node cerrado."
        );
    }
}
