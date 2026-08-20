//! Avisos a un archivo, porque en release no hay stderr donde mirar.
//!
//! El binario se compila con `windows_subsystem = "windows"` —obligatorio, si no aparece una
//! consola detrás de la ventana—, y eso deja los `eprintln!` del proyecto escribiendo a ningún
//! sitio. Son la única señal cuando falla guardar el historial, escribir los ajustes o leer los
//! puertos: en `tauri dev` se ven, y **en la versión que usa la gente no los ve nadie**.
//!
//! ## Por qué a mano y no con `tauri-plugin-log`
//!
//! Mismo criterio con el que aquí se escribió el actualizador en vez de usar
//! `tauri-plugin-updater`: son ~100 líneas, la rotación se puede probar con `cargo test` sin
//! montar una `App`, y no añade una dependencia que habría que declarar en
//! `THIRD-PARTY-NOTICES.txt` por viajar dentro del instalador.
//!
//! ## Lo que este log NO es
//!
//! No es telemetría ni sale del equipo: es un archivo local, junto a `settings.json`, que el
//! usuario puede abrir, leer y borrar. La app no lo envía a ninguna parte — ver la sección de
//! privacidad del README, que sigue siendo cierta.

use std::fmt;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Tamaño a partir del cual se rota. Cada línea ronda los 80 bytes, así que medio mega son unas
/// 6.000 entradas: de sobra para reconstruir qué pasó, y nada al lado de lo que ocupa la app.
const MAX_BYTES: u64 = 512 * 1024;

/// Nombre del archivo vivo y del rotado. Solo se guarda **una** generación anterior, así que lo
/// que ocupa el log está acotado a `2 × MAX_BYTES` pase lo que pase.
const ARCHIVO: &str = "processdevkill.log";
const ARCHIVO_VIEJO: &str = "processdevkill.log.1";

/// Dónde escribir. Se fija una vez, en el arranque, cuando ya se conoce `app_data_dir()`.
static DESTINO: OnceLock<PathBuf> = OnceLock::new();

/// Fija la carpeta del log. Llamarla dos veces no hace nada: la primera manda.
pub fn iniciar(dir: &Path) {
    let _ = DESTINO.set(dir.join(ARCHIVO));
}

/// Ruta del log, o `None` si todavía no se ha iniciado. Es lo que se enseña en Acerca de.
pub fn ruta() -> Option<&'static Path> {
    DESTINO.get().map(|p| p.as_path())
}

/// Escribe un aviso. **Nunca falla hacia fuera**: un log que revienta la app que vigila no vale.
///
/// Va también a stderr, que en `tauri dev` sí existe y es donde se mira mientras se programa.
pub fn escribir(args: fmt::Arguments) {
    let mensaje = args.to_string();
    eprintln!("{mensaje}");

    if let Some(destino) = DESTINO.get() {
        let _ = escribir_en(destino, &mensaje, MAX_BYTES);
    }
}

/// El trabajo de verdad, con el destino y el tope por parámetro para poder probarlo.
///
/// **Se rota antes de escribir, no después.** Rotar después dejaría el archivo pasarse del tope
/// durante todo el rato que va de una línea a la siguiente, que en una app que puede estar horas
/// sin avisar de nada es casi todo el tiempo.
pub fn escribir_en(destino: &Path, mensaje: &str, tope: u64) -> std::io::Result<()> {
    if let Some(dir) = destino.parent() {
        fs::create_dir_all(dir)?;
    }

    if fs::metadata(destino).map(|m| m.len()).unwrap_or(0) >= tope {
        // `rename` en Windows reemplaza el destino si existe (`MOVEFILE_REPLACE_EXISTING`), así
        // que no hace falta borrar el `.1` antes — se comprobó con una mutación en T2-04, donde
        // el borrado previo resultó no defender de nada.
        let _ = fs::rename(destino, destino.with_file_name(ARCHIVO_VIEJO));
    }

    let mut archivo = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(destino)?;

    writeln!(archivo, "{} {mensaje}", marca_de_tiempo(crate::storage::now_millis()))
}

/// `[2026-08-18 21:07:33Z]` a partir de epoch en milisegundos.
///
/// **En UTC, y por eso lleva la Z.** La hora local exigiría preguntarle a Windows por la zona
/// horaria —una dependencia más, o `unsafe` con la API del sistema— para un archivo que lee quien
/// desarrolla, no el usuario. Que ponga la Z evita el malentendido de leerlo como hora local y
/// concluir que un aviso ocurrió dos horas antes de lo que ocurrió.
pub fn marca_de_tiempo(millis: u64) -> String {
    let segundos = millis / 1000;
    let dias = (segundos / 86_400) as i64;
    let resto = segundos % 86_400;

    let (a, m, d) = civil_desde_dias(dias);
    let (h, min, s) = (resto / 3600, (resto % 3600) / 60, resto % 60);

    format!("[{a:04}-{m:02}-{d:02} {h:02}:{min:02}:{s:02}Z]")
}

/// Días desde el epoch → (año, mes, día).
///
/// Es el algoritmo `civil_from_days` de Howard Hinnant: mueve el inicio del año a marzo para que
/// el día bisiesto caiga al final y desaparezca el caso especial de febrero. Se copia porque la
/// alternativa era `chrono` entero para formatear una fecha.
fn civil_desde_dias(dias: i64) -> (i64, u64, u64) {
    // 719_468: días del 1970-01-01 desde el 0000-03-01, que es el origen de este cálculo.
    let z = dias + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // día dentro de la era, [0, 146_096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // año de la era, [0, 399]
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // día del año (empezando en marzo)
    let mp = (5 * doy + 2) / 153; // mes desplazado, [0, 11] con 0 = marzo
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let a = yoe as i64 + era * 400 + i64::from(m <= 2);
    (a, m, d)
}

/// Deja un aviso en el log y en stderr.
///
/// Sustituye a los `eprintln!` sueltos del proyecto. Se usa igual que `println!`.
#[macro_export]
macro_rules! avisar {
    ($($t:tt)*) => {
        $crate::logging::escribir(format_args!($($t)*))
    };
}

// ── Comandos de Tauri ────────────────────────────────────────────────────────

/// Deja en el log un error que ocurrió en la ventana.
///
/// Lo llama el *error boundary* de React: hasta ahora escribía a la consola del webview, que en
/// release no la ve nadie — el mismo agujero que este módulo cierra en el lado de Rust.
///
/// El mensaje se marca como venido del frontend para que no se confunda con un aviso de Rust, y se
/// **recorta**: lo que llega es entrada de la ventana, y una pila de React puede ocupar kilobytes.
/// Sin el recorte, un componente que fallara en bucle rotaría el log entero y se llevaría por
/// delante justo los avisos anteriores, que son los que explican cómo se llegó ahí.
#[tauri::command]
pub fn log_error(mensaje: String) {
    const MAX: usize = 2_000;
    let recortado: String = mensaje.chars().take(MAX).collect();
    let marca = if mensaje.chars().count() > MAX { "…(recortado)" } else { "" };
    crate::avisar!("[ventana] {recortado}{marca}");
}

/// Ruta del log, para enseñarla en Ajustes → Acerca de. Vacía si aún no se ha iniciado.
#[tauri::command]
pub fn log_path() -> String {
    ruta().map(|p| p.display().to_string()).unwrap_or_default()
}

/// Abre en el Explorador la carpeta donde está el log.
///
/// **Lo abre Rust, y no la ventana con `openPath`, a propósito.** El permiso `opener:allow-open-path`
/// está acotado a los dos avisos legales (`capabilities/default.json`), así que hacerlo desde el
/// frontend obligaría a ensanchar ese permiso a `$APPDATA` entero — y con él, lo que la ventana
/// puede pedirle al sistema que abra. Aquí la ruta **no viene del frontend**: la calcula este
/// módulo a partir de la que fijó el arranque, así que no hay nada que validar ni de qué fiarse.
/// Mismo criterio que las guardias de PID y de rutas del instalador.
///
/// Se abre la carpeta y no el archivo porque un `.log` no tiene asociación en Windows: abrirlo
/// sacaría el diálogo de «cómo quieres abrir esto». Desde la carpeta se ve además el `.1` de la
/// rotación, que es la otra mitad del historial cuando hace falta.
#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let carpeta = ruta()
        .and_then(|p| p.parent())
        .ok_or("Todavía no hay ninguna carpeta de log.")?;

    app.opener()
        .open_path(carpeta.to_string_lossy(), None::<&str>)
        .map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Carpeta propia por prueba: comparten proceso y el `OnceLock` global, asi que ninguna puede
    /// depender del estado que dejo otra.
    fn carpeta(nombre: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pdk-log-{nombre}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn la_marca_de_tiempo_sale_en_utc_y_con_la_z() {
        // 0 es el epoch, el caso limite de la conversion.
        assert_eq!(marca_de_tiempo(0), "[1970-01-01 00:00:00Z]");

        // 2026-08-18 21:07:33 UTC. Comprobado aparte, no sacado de esta misma funcion.
        assert_eq!(marca_de_tiempo(1_787_087_253_000), "[2026-08-18 21:07:33Z]");

        // 29 de febrero: el caso que rompe cualquier conversion escrita a ojo.
        assert_eq!(marca_de_tiempo(1_709_164_800_000), "[2024-02-29 00:00:00Z]");
    }

    /// Los milisegundos no se pierden en el camino: la marca es del segundo, no del milisegundo,
    /// pero **no puede adelantarse** al truncar.
    #[test]
    fn los_milisegundos_sueltos_no_adelantan_el_segundo() {
        assert_eq!(marca_de_tiempo(999), "[1970-01-01 00:00:00Z]");
        assert_eq!(marca_de_tiempo(1_000), "[1970-01-01 00:00:01Z]");
    }

    #[test]
    fn cada_aviso_deja_una_linea_fechada() {
        let dir = carpeta("escritura");
        let destino = dir.join(ARCHIVO);

        escribir_en(&destino, "no se pudo guardar el historial", MAX_BYTES).unwrap();
        escribir_en(&destino, "segundo aviso", MAX_BYTES).unwrap();

        let contenido = fs::read_to_string(&destino).unwrap();
        let lineas: Vec<_> = contenido.lines().collect();

        assert_eq!(lineas.len(), 2, "cada aviso es una linea: {contenido:?}");
        assert!(lineas[0].contains("no se pudo guardar el historial"));
        assert!(lineas[1].contains("segundo aviso"));
        // Fechada: empieza por el corchete de la marca y lleva la Z del UTC.
        assert!(lineas[0].starts_with('['), "{:?}", lineas[0]);
        assert!(lineas[0].contains("Z]"), "{:?}", lineas[0]);

        let _ = fs::remove_dir_all(&dir);
    }

    /// El criterio que de verdad importa de T2-03: **que no crezca sin limite**. Un log que se come
    /// el disco de quien lo sufre es peor que no tener log.
    #[test]
    fn al_pasar_del_tope_se_rota_y_no_se_pierde_lo_anterior() {
        let dir = carpeta("rotacion");
        let destino = dir.join(ARCHIVO);
        let viejo = dir.join(ARCHIVO_VIEJO);

        // Tope minusculo para no escribir medio mega en una prueba: lo que se comprueba es el
        // mecanismo, igual que con el tope de la descarga en T3-02.
        let tope = 200;
        for i in 0..40 {
            escribir_en(&destino, &format!("aviso numero {i}"), tope).unwrap();
        }

        assert!(viejo.exists(), "la generacion anterior tiene que conservarse");
        assert!(
            fs::metadata(&destino).unwrap().len() < tope * 2,
            "el archivo vivo se paso del tope sin rotar"
        );

        // Acotado de verdad: vivo + rotado, y nada mas. Un `.2` seria un log creciendo despacio.
        let archivos: Vec<_> = fs::read_dir(&dir).unwrap().flatten().collect();
        assert_eq!(archivos.len(), 2, "solo puede haber dos archivos de log");

        // Lo ultimo escrito sigue estando: rotar no puede perder el aviso que se acaba de dar.
        let contenido = fs::read_to_string(&destino).unwrap();
        assert!(contenido.contains("aviso numero 39"), "{contenido:?}");

        let _ = fs::remove_dir_all(&dir);
    }

    /// Se escribe aunque la carpeta no exista todavia: en la primera ejecucion el log puede llegar
    /// antes que cualquier otra cosa que la cree.
    #[test]
    fn se_crea_la_carpeta_si_hace_falta() {
        let dir = carpeta("sin-carpeta");
        let destino = dir.join("todavia-no").join(ARCHIVO);

        escribir_en(&destino, "primer arranque", MAX_BYTES).unwrap();

        assert!(destino.exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
