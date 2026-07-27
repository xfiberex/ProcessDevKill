//! Auto-Kill por memoria: lo unico de la app que cierra procesos **sin que nadie
//! se lo pida**.
//!
//! Tiene modulo propio por eso mismo. Estaba suelto entre las cien lineas de
//! arranque de `lib.rs`, y una funcion que mata sola tiene que ser facil de
//! encontrar y de leer entera de una vez.
//!
//! De fabrica viene apagado (`Settings::default`), y el umbral tiene un suelo de
//! 256 MB que impone `storage.rs`: con 50 MB, cualquier proceso vigilado lo
//! supera y el siguiente ciclo se lleva por delante el entorno entero.

use tauri::AppHandle;

use crate::notify;
use crate::processes::{over_memory_limit, KillOutcome, ProcessInfo};
use crate::storage::KillSource;

/// Cierra los procesos de `list` que pasen del umbral y lo cuenta por
/// notificacion. Devuelve `true` si cerro alguno.
///
/// Ese booleano es lo que le dice al poller que **no publique la lista que acaba
/// de leer**: `kill_and_record` ya publica una sin los muertos, y publicar antes
/// la vieja solo haria parpadear filas que estan a punto de desaparecer.
///
/// El aviso no es un adorno: es la unica forma de enterarse de que la app ha
/// matado algo por su cuenta, y puede ocurrir con la ventana oculta en la bandeja.
pub fn enforce(app: &AppHandle, list: &[ProcessInfo], limit_mb: u64) -> bool {
    let excedidos: Vec<(u32, String, f64)> = over_memory_limit(list, limit_mb)
        .into_iter()
        .map(|p| (p.pid, p.name.clone(), p.memory_mb))
        .collect();

    if excedidos.is_empty() {
        return false;
    }

    let pids: Vec<u32> = excedidos.iter().map(|(pid, _, _)| *pid).collect();
    let outcomes = crate::kill_and_record(app, pids, KillSource::Auto);

    let cerrados: Vec<&KillOutcome> = outcomes.iter().filter(|o| o.killed).collect();
    if cerrados.is_empty() {
        // Se intento y no murio ninguno (permisos, o murio solo entre medias):
        // no hay nada que contar, pero la lista leida ya no vale.
        return true;
    }

    notify::show(app, mensaje(&excedidos, &cerrados, limit_mb));
    true
}

/// Redacta el aviso: quien murio, cuanto usaba y que puertos dejo libres.
fn mensaje(
    excedidos: &[(u32, String, f64)],
    cerrados: &[&KillOutcome],
    limit_mb: u64,
) -> String {
    let limite = format_mb(limit_mb as f64);

    let mut body = if cerrados.len() == 1 {
        let (_, name, mb) = excedidos
            .iter()
            .find(|(pid, _, _)| *pid == cerrados[0].pid)
            .expect("el cierre viene de esta misma lista");
        format!(
            "{name} (PID {}) usaba {}, por encima del limite de {limite}. Cerrado automaticamente.",
            cerrados[0].pid,
            format_mb(*mb)
        )
    } else {
        format!(
            "{} procesos cerrados automaticamente por pasar de {limite}.",
            cerrados.len()
        )
    };

    let mut freed: Vec<u16> = cerrados.iter().flat_map(|o| o.freed_ports.clone()).collect();
    freed.sort_unstable();
    freed.dedup();
    if let Some(frase) = notify::freed_ports_sentence(&freed) {
        body.push(' ');
        body.push_str(&frase);
    }

    body
}

/// Memoria legible, con el mismo criterio que `formatMemory` en `src/lib/format.ts`.
fn format_mb(mb: f64) -> String {
    if mb >= 1024.0 {
        format!("{:.1} GB", mb / 1024.0)
    } else {
        format!("{mb:.0} MB")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// La notificacion dice cuanta memoria usaba el proceso; si el formato no
    /// coincide con el de la tabla, el usuario lee dos cifras distintas para lo
    /// mismo y no sabe cual creerse.
    #[test]
    fn la_memoria_se_formatea_como_en_la_tabla() {
        assert_eq!(format_mb(512.0), "512 MB");
        assert_eq!(format_mb(1024.0), "1.0 GB");
        assert_eq!(format_mb(2457.6), "2.4 GB");
    }

    /// Un aviso que no dice **cual** se cerro obliga a abrir el historial para
    /// enterarse, que es justo lo que la notificacion venia a evitar.
    #[test]
    fn el_aviso_nombra_al_proceso_cuando_solo_cae_uno() {
        let outcome = KillOutcome {
            pid: 42,
            killed: true,
            error: None,
            freed_ports: vec![3000],
            name: "node.exe".into(),
        };
        let texto = mensaje(&[(42, "node.exe".into(), 3072.0)], &[&outcome], 2048);

        assert!(texto.contains("node.exe (PID 42)"), "{texto}");
        assert!(texto.contains("3.0 GB"), "{texto}");
        assert!(texto.contains("2.0 GB"), "{texto}");
        // Los puertos liberados se pegan al mismo aviso en vez de soltar otro.
        assert!(texto.contains("El puerto 3000 ha quedado libre."), "{texto}");
    }

    /// Con varios, el aviso resume: enumerar quince nombres en un toast de
    /// Windows no cabe y no se lee.
    #[test]
    fn el_aviso_resume_cuando_caen_varios() {
        let uno = KillOutcome {
            pid: 1,
            killed: true,
            error: None,
            freed_ports: vec![],
            name: "node.exe".into(),
        };
        let dos = KillOutcome {
            pid: 2,
            killed: true,
            error: None,
            freed_ports: vec![],
            name: "python.exe".into(),
        };
        let texto = mensaje(
            &[(1, "node.exe".into(), 3000.0), (2, "python.exe".into(), 4000.0)],
            &[&uno, &dos],
            2048,
        );

        assert!(texto.starts_with("2 procesos cerrados"), "{texto}");
        // Sin puertos liberados no se inventa una frase vacia al final.
        assert!(!texto.contains("quedado libre"), "{texto}");
    }
}
