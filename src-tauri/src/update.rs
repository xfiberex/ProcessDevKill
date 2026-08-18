//! Actualizaciones vía GitHub Releases, verificadas con SHA-256.
//!
//! Mismo modelo que FormatDiskPro (`UpdateService.cs`), adaptado a Tauri: se consulta
//! la API de GitHub, se elige el instalador NSIS y su `.sha256`, se descarga, se
//! **verifica antes de ejecutar** y se lanza. Si el hash no cuadra, el archivo se borra
//! y no se ejecuta nada.
//!
//! ## Alcance honesto de la verificación
//!
//! El instalador y su `.sha256` salen del **mismo release**, así que esto detecta una
//! descarga corrupta o manipulada **en tránsito**, pero NO protege frente a un compromiso
//! de la cuenta de GitHub: quien pudiera sustituir el `.exe` podría sustituir también el
//! hash. Es el compromiso habitual de un proyecto sin certificado de firma de código, y
//! es exactamente la garantía que sustituye a la firma.
//!
//! El día que haya certificado, la comprobación fuerte sería la **firma Authenticode**
//! (`WinVerifyTrust`), con el hash como respaldo — que es como lo tiene FormatDiskPro.
//! Aquí no se implementa porque sin certificado sería código muerto: ningún instalador
//! propio la pasaría, y una comprobación que siempre falla induce a ignorarla.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Repositorio del que salen las versiones. Es el único destino de red de la app.
const REPO: &str = "xfiberex/ProcessDevKill";

/// GitHub exige User-Agent en todas las peticiones a su API; sin él responde 403.
const USER_AGENT: &str = concat!("ProcessDevKill/", env!("CARGO_PKG_VERSION"));

/// Versión publicada, con lo que necesita la ventana para decidir y descargar.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag: String,
    pub version: String,
    pub notes: String,
    pub html_url: String,
    pub asset_url: String,
    pub asset_name: String,
    pub asset_size: u64,
    /// URL del `.sha256` del instalador. Vacía si el release no lo publica, en cuyo
    /// caso la descarga se rechaza: sin nada con que verificar no se ejecuta nada.
    pub checksum_url: String,
}

// ── Lógica pura (sin red, sin disco): es lo que cubren los tests ──────────────

/// Convierte una etiqueta ("v1.2.3", "1.2.3", "1.2") en `(mayor, menor, parche)`.
///
/// Tolera el prefijo `v`/`V` y descarta los sufijos de prelanzamiento y metadatos
/// (`-beta`, `+build`), igual que `UpdateChecker.TryParseTag` de FormatDiskPro.
pub fn parse_tag(tag: &str) -> Option<(u64, u64, u64)> {
    let s = tag.trim();
    let s = s.strip_prefix(['v', 'V']).unwrap_or(s);

    // Cortar en el primer separador de prelanzamiento o metadatos.
    let s = s.split(['-', '+', ' ']).next().unwrap_or("");
    if s.is_empty() {
        return None;
    }

    let mut partes = s.split('.');
    let mayor = partes.next()?.parse::<u64>().ok()?;
    // "1" se normaliza a 1.0.0: una etiqueta con solo el mayor es válida.
    let menor = partes.next().map_or(Some(0), |p| p.parse().ok())?;
    let parche = partes.next().map_or(Some(0), |p| p.parse().ok())?;

    // Un cuarto componente sobra pero no invalida ("1.2.3.4" -> 1.2.3).
    Some((mayor, menor, parche))
}

/// ¿`latest_tag` es **estrictamente** mayor que `current`?
///
/// En estricto a propósito: nunca se ofrece "actualizar" a la misma versión ni a una
/// anterior, que es lo que evita un bucle de reinstalación si un release se republica.
pub fn is_newer(latest_tag: &str, current: &str) -> bool {
    match (parse_tag(latest_tag), parse_tag(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

/// Elige el instalador y su checksum entre los assets de un release de GitHub.
///
/// Se queda con el `.exe` que contenga "setup" (el de NSIS): el `.msi` no sirve para
/// actualizar en sitio y el `.sha256` no compite porque no termina en `.exe`.
pub fn pick_assets(assets: &serde_json::Value) -> (Option<serde_json::Value>, String) {
    let mut instalador: Option<serde_json::Value> = None;
    let mut checksum = String::new();

    let Some(lista) = assets.as_array() else {
        return (None, checksum);
    };

    for a in lista {
        let nombre = a["name"].as_str().unwrap_or("");

        // El .sha256 que interesa es el del instalador NSIS, no el del MSI.
        if nombre.to_lowercase().ends_with("-setup.exe.sha256") {
            checksum = a["browser_download_url"].as_str().unwrap_or("").to_string();
            continue;
        }
        if !nombre.to_lowercase().ends_with(".exe") {
            continue;
        }
        if instalador.is_none() || nombre.to_lowercase().contains("setup") {
            instalador = Some(a.clone());
        }
    }

    (instalador, checksum)
}

/// Extrae el hash de un archivo `.sha256`.
///
/// Admite tanto el hash a secas como el formato de `sha256sum` ("<hash>  <archivo>"),
/// que es el que genera `release.ps1`.
pub fn hash_from_checksum_file(contenido: &str) -> Option<String> {
    let primero = contenido.split_whitespace().next()?;
    let limpio = primero.trim().to_lowercase();

    // Un SHA-256 en hexadecimal son 64 caracteres. Si no lo es, el archivo no vale y
    // más vale rechazarlo que comparar contra basura.
    if limpio.len() == 64 && limpio.chars().all(|c| c.is_ascii_hexdigit()) {
        Some(limpio)
    } else {
        None
    }
}

/// Construye el `ReleaseInfo` a partir del JSON que devuelve la API de GitHub.
pub fn parse_release(root: &serde_json::Value) -> ReleaseInfo {
    let tag = root["tag_name"].as_str().unwrap_or("").to_string();
    let (instalador, checksum_url) = pick_assets(&root["assets"]);

    let (asset_url, asset_name, asset_size) = match instalador {
        Some(a) => (
            a["browser_download_url"].as_str().unwrap_or("").to_string(),
            a["name"].as_str().unwrap_or("").to_string(),
            a["size"].as_u64().unwrap_or(0),
        ),
        None => (String::new(), String::new(), 0),
    };

    ReleaseInfo {
        version: tag.trim_start_matches(['v', 'V']).to_string(),
        tag,
        notes: root["body"].as_str().unwrap_or("").to_string(),
        html_url: root["html_url"]
            .as_str()
            .unwrap_or(&format!("https://github.com/{REPO}/releases"))
            .to_string(),
        asset_url,
        asset_name,
        asset_size,
        checksum_url,
    }
}

// ── Entrada/salida ───────────────────────────────────────────────────────────

fn cliente() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("No se pudo preparar el cliente HTTP: {e}"))
}

/// Consulta el último release publicado. `None` si no hay ninguno más nuevo.
pub async fn check_for_update(version_actual: &str) -> Result<Option<ReleaseInfo>, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");

    let resp = cliente()?
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("No se pudo consultar GitHub: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub respondió {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Respuesta de GitHub ilegible: {e}"))?;

    let info = parse_release(&json);
    Ok(is_newer(&info.tag, version_actual).then_some(info))
}

/// Carpeta donde se descargan los instaladores.
///
/// Único sitio donde se nombra. La guardia de `install_update` compara contra esto, así que
/// una segunda copia del literal dejaría la puerta abierta el día que una de las dos cambiara.
pub fn carpeta_descargas() -> PathBuf {
    std::env::temp_dir().join("ProcessDevKill_update")
}

/// Comprueba que una URL apunte de verdad a un asset de un release **de este repositorio**.
///
/// La hermana de `ruta_de_instalador_valida`, y por el mismo motivo: `download_update` recibe el
/// `ReleaseInfo` entero desde la ventana, así que las dos URLs que usa —el instalador y su
/// `.sha256`— son entrada del frontend, no datos de confianza. Sin esta guardia, quien compusiera
/// la llamada aportaría **las dos mitades** de la verificación —el archivo y el hash contra el que
/// se compara— y esta pasaría siempre; el resultado aterrizaría además justo en la carpeta que
/// `install_update` tiene en su lista blanca. Es el mismo criterio que la guardia de PID de
/// `kill_process` y la de rutas de aquí abajo: un comando de Tauri acepta lo que le manden.
///
/// **Se compara sobre la URL ya parseada, no sobre la cadena.** `Url::parse` normaliza los `..`
/// del camino y resuelve la sintaxis rara, así que
/// `https://github.com/xfiberex/ProcessDevKill/releases/download/../../../evil.exe` se queda en
/// `/xfiberex/evil.exe` y no pasa, y `https://github.com@malo.example/…` tiene por anfitrión
/// `malo.example`, no `github.com`. Un `starts_with` sobre el texto se habría tragado los dos: es
/// exactamente el fallo que ya tuvo la guardia de rutas con `Path::starts_with`.
///
/// Se valida **la URL que se pide**, no a dónde acabe llevando: GitHub redirige las descargas a
/// `objects.githubusercontent.com`, y exigir que el destino final sea github.com rompería la
/// actualización entera. La cadena de redirecciones ya la decide GitHub.
pub fn url_de_release_valida(url: &str) -> Result<(), String> {
    const HOST: &str = "github.com";

    let parsed = reqwest::Url::parse(url).map_err(|_| "La URL de la descarga no es válida.")?;

    if parsed.scheme() != "https" {
        return Err("La descarga tiene que ir por HTTPS.".into());
    }
    if parsed.host_str() != Some(HOST) {
        return Err("La descarga no viene de github.com.".into());
    }
    if !parsed.path().starts_with(&format!("/{REPO}/releases/download/")) {
        return Err("La descarga no es un asset de un release de este proyecto.".into());
    }

    Ok(())
}

/// Comprueba que `candidata` sea un archivo dentro de la carpeta de descargas y devuelve su
/// ruta canónica, que es la única que se debe ejecutar.
///
/// **Canonicaliza antes de comparar, y no es un detalle de estilo.** `Path::starts_with`
/// compara componentes literales y **no normaliza nada**: sin esto,
/// `…\ProcessDevKill_update\..\..\Windows\System32\calc.exe` empieza por la carpeta permitida
/// y pasa la guardia tan campante. Con `canonicalize` los `..` se resuelven *antes* de mirar.
///
/// Se devuelve la ruta ya normalizada a propósito: validar una y ejecutar otra sería volver a
/// abrir el agujero por la puerta de atrás.
///
/// Canonicalizar exige además que la ruta exista, así que de paso cubre el "ya no está donde
/// debería" sin una comprobación aparte.
pub fn ruta_de_instalador_valida(candidata: &Path) -> Result<PathBuf, String> {
    let permitida = carpeta_descargas()
        .canonicalize()
        .map_err(|_| "No hay ninguna descarga que instalar.".to_string())?;

    let ruta = candidata
        .canonicalize()
        .map_err(|_| "El instalador descargado ya no está donde debería.".to_string())?;

    if !ruta.starts_with(&permitida) {
        return Err("Ruta de instalador no permitida.".into());
    }
    // `canonicalize` acepta directorios: sin esto, pasar la propia carpeta llegaría a
    // intentar ejecutarla.
    if !ruta.is_file() {
        return Err("La ruta indicada no es un archivo.".into());
    }

    Ok(ruta)
}

/// Nombre de archivo con el que guardar la descarga, sin componentes de ruta.
///
/// `asset_name` viene de la API de GitHub y acaba pegado a una ruta con `join`. Hoy GitHub no
/// admite separadores en el nombre de un asset, pero quedarse con el último componente cuesta
/// una línea y cierra la puerta a que un nombre con `..\` escriba fuera de la carpeta.
fn nombre_seguro(asset_name: &str) -> &str {
    let limpio = Path::new(asset_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if limpio.is_empty() {
        "ProcessDevKill-setup.exe"
    } else {
        limpio
    }
}

/// Carpeta de descargas creada y vaciada de intentos anteriores.
fn preparar_carpeta() -> Result<PathBuf, String> {
    let dir = carpeta_descargas();
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear {dir:?}: {e}"))?;

    // Limpia descargas previas para no acumular instaladores viejos en %TEMP%.
    if let Ok(entradas) = std::fs::read_dir(&dir) {
        for e in entradas.flatten() {
            let _ = std::fs::remove_file(e.path());
        }
    }
    Ok(dir)
}

/// SHA-256 de un archivo, en hexadecimal y minúsculas.
pub fn sha256_de_archivo(ruta: &Path) -> Result<String, String> {
    let mut archivo =
        std::fs::File::open(ruta).map_err(|e| format!("No se pudo abrir el instalador: {e}"))?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut archivo, &mut hasher)
        .map_err(|e| format!("No se pudo leer el instalador: {e}"))?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Techo de lo que se acepta escribir en una descarga.
///
/// El instalador ronda los 4 MB, así que 100 MB deja muchísimo margen para crecer y sigue
/// impidiendo que una respuesta interminable llene el `%TEMP%` del usuario.
pub const MAX_DESCARGA: u64 = 100 * 1024 * 1024;

/// Vuelca el cuerpo de una respuesta en `destino` **sin pasar de `tope` bytes**.
///
/// Sale de dentro de `download_and_verify` para poder probarse: allí el bucle era inalcanzable
/// desde una prueba, porque `download_and_verify` valida la URL contra github.com antes de pedir
/// nada —y debe seguir haciéndolo—, así que ningún servidor local llegaba a ejercitarlo. Con el
/// tope como parámetro, la prueba usa uno pequeño y no hay que mover 100 MB para ver saltar la
/// guardia; la constante de producción se comprueba aparte.
///
/// El archivo se cierra al salir, antes de que quien llama lo lea para verificar el hash: con el
/// descriptor todavía abierto, esa lectura podría chocar con nuestra propia escritura.
async fn volcar_con_tope<F>(
    resp: reqwest::Response,
    destino: &Path,
    tamano_esperado: u64,
    tope: u64,
    progreso: &mut F,
) -> Result<(), String>
where
    F: FnMut(u64, u64),
{
    use futures_util::StreamExt;
    use std::io::Write;

    if !resp.status().is_success() {
        return Err(format!("La descarga respondió {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(tamano_esperado);
    let mut archivo = std::fs::File::create(destino)
        .map_err(|e| format!("No se pudo escribir en {destino:?}: {e}"))?;

    let mut bajado: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(trozo) = stream.next().await {
        let trozo = trozo.map_err(|e| format!("Descarga interrumpida: {e}"))?;
        bajado += trozo.len() as u64;
        if bajado > tope {
            // El archivo a medias no se deja en el disco: nadie debe poder ejecutarlo a mano.
            drop(archivo);
            let _ = std::fs::remove_file(destino);
            return Err("La descarga se pasa del tamaño razonable y se ha cancelado.".into());
        }
        archivo
            .write_all(&trozo)
            .map_err(|e| format!("No se pudo escribir el instalador: {e}"))?;
        progreso(bajado, total);
    }
    archivo
        .flush()
        .map_err(|e| format!("No se pudo cerrar el instalador: {e}"))
}

/// Descarga el instalador, informa del progreso y **lo verifica antes de devolverlo**.
pub async fn download_and_verify<F>(info: &ReleaseInfo, mut progreso: F) -> Result<PathBuf, String>
where
    F: FnMut(u64, u64),
{
    if info.asset_url.is_empty() {
        return Err("Esa versión no publica un instalador descargable.".into());
    }
    // Sin nada con que verificar no se descarga: es preferible mandar al usuario a la
    // página del release que ejecutar un binario que no se ha podido comprobar.
    if info.checksum_url.is_empty() {
        return Err(
            "Esa versión no publica el .sha256 del instalador, así que no se puede verificar. \
             Descárgala a mano desde la página del release."
                .into(),
        );
    }

    // Las dos URLs vienen del frontend: se comprueban **antes de pedir nada**. Verificar el
    // instalador contra un hash que trajera el mismo mensaje no verifica absolutamente nada.
    url_de_release_valida(&info.asset_url)?;
    url_de_release_valida(&info.checksum_url)?;

    let http = cliente()?;

    // El hash esperado se pide ANTES de bajar 4 MB: si no está, no merece la pena.
    let publicado = http
        .get(&info.checksum_url)
        .send()
        .await
        .map_err(|e| format!("No se pudo descargar el checksum: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Checksum ilegible: {e}"))?;

    let esperado = hash_from_checksum_file(&publicado)
        .ok_or("El archivo .sha256 publicado no contiene un hash válido.")?;

    let destino = preparar_carpeta()?.join(nombre_seguro(&info.asset_name));

    let resp = http
        .get(&info.asset_url)
        .send()
        .await
        .map_err(|e| format!("No se pudo descargar el instalador: {e}"))?;

    // El archivo se cierra dentro de `volcar_con_tope`, antes de que aquí se verifique: con el
    // descriptor todavía abierto, leerlo para el hash podría chocar con nuestra propia escritura.
    volcar_con_tope(
        resp,
        &destino,
        info.asset_size,
        MAX_DESCARGA,
        &mut progreso,
    )
    .await?;

    let real = sha256_de_archivo(&destino)?;
    if real != esperado {
        // Si no cuadra, no se deja el archivo por ahí para que nadie lo ejecute a mano.
        let _ = std::fs::remove_file(&destino);
        return Err(format!(
            "El instalador descargado no coincide con el hash publicado y se ha borrado. \
             Esperado {esperado}, obtenido {real}."
        ));
    }

    Ok(destino)
}

/// Argumentos con los que se lanza el instalador NSIS para que la actualización no
/// enseñe ni una ventana. Los tres son de la plantilla de Tauri (`installer.nsi`), no
/// inventados, y cada uno quita una parte de lo que se veía antes:
///
/// - `/S`: silencioso, el de NSIS. Sin él salía el asistente entero.
/// - `/UPDATE`: le dice que es una actualización, no una instalación nueva. La plantilla
///   entonces **no ejecuta el desinstalador** de la versión anterior (esa era la primera
///   ventana que aparecía), conserva los accesos directos y no reinstala WebView2.
/// - `/R`: relanza la app al terminar, vía `RunAsUser`. Solo lo mira en modo silencioso o
///   pasivo, porque el asistente con interfaz ya tiene su casilla de «abrir al salir».
///
/// El instalador silencioso **mata la app él mismo** si aún la encuentra corriendo
/// (`CheckIfAppIsRunning` en `utils.nsh`), así que no hay carrera con el `app.exit(0)` de
/// `install_update`: si llega antes, se la encuentra ya cerrada; si llega después, la cierra.
const ARGS_SILENCIOSOS: [&str; 3] = ["/S", "/UPDATE", "/R"];

/// Lanza el instalador descargado, en silencio. El NSIS en modo `currentUser` no pide UAC.
///
/// No se comprueba nada aquí: para cuando se llama, `download_and_verify` ya ha validado
/// el hash y `ruta_de_instalador_valida` la carpeta. Llamarla con una ruta que no venga de
/// ahí sería saltarse las dos comprobaciones.
///
/// La ruta llega **canonicalizada**, o sea con el prefijo verbatim de Windows
/// (`\\?\C:\…`). Comprobado que `CreateProcess` la acepta y el instalador arranca igual:
/// era lo único que podía romper la actualización al añadir la canonicalización, y no se
/// habría notado hasta el siguiente release.
pub fn launch_installer(ruta: &Path) -> Result<(), String> {
    std::process::Command::new(ruta)
        .args(ARGS_SILENCIOSOS)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo ejecutar el instalador: {e}"))
}

// ---------------------------------------------------------------- comandos ---
//
// Los tres viven aquí y no en `lib.rs` porque no son mas que la cara publica de
// lo de arriba: cada uno delega en la funcion de este mismo modulo que hace el
// trabajo. Tenerlos en `lib.rs` obligaba a leer dos archivos para seguir el
// camino de una actualizacion, y era donde peor se veia que `install_update`
// tiene una guardia de seguridad detras.

use tauri::{AppHandle, Emitter};

/// Evento con el avance de la descarga. Espejo de `UPDATE_PROGRESS` en `src/types.ts`.
const UPDATE_PROGRESS: &str = "update-progress";

/// Busca si hay una version mas nueva publicada. `None` si ya esta al dia.
///
/// La version instalada la da el propio paquete, no el frontend: asi no hay una segunda
/// copia del numero que se quede vieja al cortar un release.
#[tauri::command]
pub async fn check_update() -> Result<Option<ReleaseInfo>, String> {
    check_for_update(env!("CARGO_PKG_VERSION")).await
}

/// Descarga el instalador y lo verifica contra el `.sha256` publicado.
///
/// Devuelve la ruta del archivo ya comprobado. Si el hash no cuadra, borra la descarga y
/// devuelve error: nunca deja un instalador sin verificar en el disco.
#[tauri::command]
pub async fn download_update(app: AppHandle, release: ReleaseInfo) -> Result<String, String> {
    let ruta = download_and_verify(&release, |bajado, total| {
        // Un evento por trozo es demasiado ruido para la ventana; el frontend calcula el
        // porcentaje y React descarta los renders que no cambian nada.
        let _ = app.emit(UPDATE_PROGRESS, (bajado, total));
    })
    .await?;

    Ok(ruta.to_string_lossy().into_owned())
}

/// Ejecuta el instalador descargado y cierra la app para que pueda reemplazar los archivos.
///
/// Solo acepta rutas dentro de la carpeta de descargas del actualizador: el comando queda
/// expuesto al frontend y sin esa guardia seria un "ejecuta lo que quieras" —el mismo
/// criterio que la guardia de PID en `kill_process`.
///
/// La comprobacion es una funcion pura, probable sin montar una `App`, igual que
/// `collect_processes` frente a `get_processes`. Se ejecuta **la ruta que devuelve**, ya
/// canonicalizada: validar una y lanzar otra seria dejar el agujero abierto por detras.
#[tauri::command]
pub fn install_update(app: AppHandle, path: String) -> Result<(), String> {
    let ruta = ruta_de_instalador_valida(Path::new(&path))?;

    launch_installer(&ruta)?;

    // El instalador necesita que la app no tenga los archivos abiertos. Se sale del todo,
    // no se esconde en la bandeja: `exit` salta el manejador de CloseRequested. Volver a
    // abrirla es cosa del `/R` de `ARGS_SILENCIOSOS`, ya con la versión nueva.
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lee_etiquetas_con_y_sin_v() {
        assert_eq!(parse_tag("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_tag("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_tag("V1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_tag("  v1.2.3  "), Some((1, 2, 3)));
    }

    #[test]
    fn completa_los_componentes_que_faltan() {
        assert_eq!(parse_tag("v1.2"), Some((1, 2, 0)));
        assert_eq!(parse_tag("v1"), Some((1, 0, 0)));
    }

    #[test]
    fn descarta_prelanzamientos_y_metadatos() {
        assert_eq!(parse_tag("v1.2.3-beta"), Some((1, 2, 3)));
        assert_eq!(parse_tag("v1.2.3+build7"), Some((1, 2, 3)));
    }

    #[test]
    fn rechaza_lo_que_no_es_una_version() {
        assert_eq!(parse_tag(""), None);
        assert_eq!(parse_tag("   "), None);
        assert_eq!(parse_tag("v"), None);
        assert_eq!(parse_tag("latest"), None);
        assert_eq!(parse_tag("v1.x.3"), None);
    }

    /// El corazón del asunto: solo se ofrece actualizar hacia adelante.
    #[test]
    fn solo_es_mas_nueva_si_de_verdad_lo_es() {
        assert!(is_newer("v1.2.0", "1.1.9"));
        assert!(is_newer("v2.0.0", "1.99.99"));
        assert!(is_newer("v1.1.1", "1.1.0"));

        assert!(!is_newer("v1.1.0", "1.1.0"), "la misma version no es nueva");
        assert!(!is_newer("v1.0.9", "1.1.0"), "una anterior no es nueva");
    }

    /// Una respuesta rara de GitHub no debe traducirse en "hay actualizacion".
    #[test]
    fn ante_una_etiqueta_ilegible_no_hay_actualizacion() {
        assert!(!is_newer("", "1.0.0"));
        assert!(!is_newer("latest", "1.0.0"));
        assert!(!is_newer("v1.0.0", "no-es-una-version"));
    }

    fn assets_de_ejemplo() -> serde_json::Value {
        serde_json::json!([
            { "name": "ProcessDevKill_1.2.0_x64_en-US.msi",
              "browser_download_url": "https://x/msi", "size": 5000 },
            { "name": "ProcessDevKill_1.2.0_x64_en-US.msi.sha256",
              "browser_download_url": "https://x/msi.sha256", "size": 101 },
            { "name": "ProcessDevKill_1.2.0_x64-setup.exe",
              "browser_download_url": "https://x/setup", "size": 3600 },
            { "name": "ProcessDevKill_1.2.0_x64-setup.exe.sha256",
              "browser_download_url": "https://x/setup.sha256", "size": 101 }
        ])
    }

    #[test]
    fn elige_el_instalador_nsis_y_su_checksum() {
        let (instalador, checksum) = pick_assets(&assets_de_ejemplo());

        let i = instalador.expect("deberia haber elegido el setup.exe");
        assert_eq!(i["browser_download_url"], "https://x/setup");
        // El del MSI no vale: el que se ejecuta es el NSIS.
        assert_eq!(checksum, "https://x/setup.sha256");
    }

    #[test]
    fn ignora_el_msi_aunque_venga_primero() {
        let (instalador, _) = pick_assets(&assets_de_ejemplo());
        let nombre = instalador.unwrap()["name"].as_str().unwrap().to_string();
        assert!(nombre.ends_with("-setup.exe"), "eligio {nombre}");
    }

    #[test]
    fn sin_assets_no_hay_nada_que_descargar() {
        let (instalador, checksum) = pick_assets(&serde_json::json!([]));
        assert!(instalador.is_none());
        assert!(checksum.is_empty());
    }

    #[test]
    fn lee_el_hash_en_los_dos_formatos() {
        let h = "a".repeat(64);
        assert_eq!(hash_from_checksum_file(&h), Some(h.clone()));
        assert_eq!(
            hash_from_checksum_file(&format!("{h}  ProcessDevKill_1.2.0_x64-setup.exe\n")),
            Some(h.clone())
        );
        // Get-FileHash devuelve mayusculas; se comparan en minusculas.
        assert_eq!(hash_from_checksum_file(&h.to_uppercase()), Some(h));
    }

    /// Un .sha256 truncado o con un mensaje de error dentro no puede pasar por hash:
    /// compararlo daria "no coincide", pero por el motivo equivocado.
    #[test]
    fn rechaza_un_checksum_que_no_es_un_hash() {
        assert_eq!(hash_from_checksum_file(""), None);
        assert_eq!(hash_from_checksum_file("404: Not Found"), None);
        assert_eq!(hash_from_checksum_file(&"a".repeat(63)), None);
        assert_eq!(hash_from_checksum_file(&"z".repeat(64)), None);
    }

    #[test]
    fn arma_el_release_desde_el_json_de_github() {
        let json = serde_json::json!({
            "tag_name": "v1.2.0",
            "body": "Novedades",
            "html_url": "https://github.com/x/y/releases/tag/v1.2.0",
            "assets": assets_de_ejemplo(),
        });

        let info = parse_release(&json);

        assert_eq!(info.tag, "v1.2.0");
        assert_eq!(info.version, "1.2.0", "la version va sin la v para la UI");
        assert_eq!(info.notes, "Novedades");
        assert_eq!(info.asset_url, "https://x/setup");
        assert_eq!(info.asset_size, 3600);
        assert_eq!(info.checksum_url, "https://x/setup.sha256");
    }

    /// **Regresion del agujero que encontro la revision del 2026-07-27.**
    ///
    /// La guardia comparaba con `starts_with` sobre la ruta cruda, y `Path::starts_with`
    /// compara componentes literales **sin normalizar**: un `..` por medio la atravesaba y
    /// `install_update` acababa ejecutando cualquier cosa del disco. El comando esta
    /// expuesto al frontend, asi que era justo lo que la guardia decia impedir.
    #[test]
    fn la_guardia_de_rutas_rechaza_un_escape_con_dos_puntos() {
        let dir = carpeta_descargas();
        std::fs::create_dir_all(&dir).unwrap();

        // Un instalador legitimo dentro de la carpeta.
        let dentro = dir.join("ProcessDevKill_9.9.9_x64-setup.exe");
        std::fs::write(&dentro, b"instalador de mentira").unwrap();

        // Y un archivo fuera: lo que un frontend comprometido querria ejecutar.
        let fuera = std::env::temp_dir().join("pdk_test_fuera_de_la_carpeta.exe");
        std::fs::write(&fuera, b"esto no deberia ejecutarse nunca").unwrap();

        // El escape sale de la carpeta permitida y vuelve a %TEMP% por la puerta de atras.
        let escape = dir.join("..").join("pdk_test_fuera_de_la_carpeta.exe");

        // Sin esta asercion el test no probaria nada: deja constancia de que la
        // comparacion ingenua SI aceptaba el escape, que es el fallo que se corrigio.
        assert!(
            escape.starts_with(&dir),
            "la ruta de escape tiene que pasar el starts_with crudo; si no, este test no cubre el fallo"
        );

        assert!(
            ruta_de_instalador_valida(&dentro).is_ok(),
            "un instalador legitimo dentro de la carpeta tiene que valer"
        );
        assert!(
            ruta_de_instalador_valida(&escape).is_err(),
            "un '..' no puede sacar la ruta de la carpeta permitida"
        );
        assert!(
            ruta_de_instalador_valida(&fuera).is_err(),
            "una ruta abiertamente de fuera tampoco"
        );
        assert!(
            ruta_de_instalador_valida(&dir).is_err(),
            "la propia carpeta no es un archivo: no hay nada que ejecutar"
        );

        // La ruta que se devuelve es la canonica, que es la que se ejecuta.
        let validada = ruta_de_instalador_valida(&dentro).unwrap();
        assert!(validada.is_file());
        assert!(!validada.to_string_lossy().contains(".."));

        let _ = std::fs::remove_file(&dentro);
        let _ = std::fs::remove_file(&fuera);
    }

    /// **La guardia que faltaba, encontrada en la revision del 2026-08-18.**
    ///
    /// `download_update` recibe el `ReleaseInfo` entero desde la ventana, asi que la URL del
    /// instalador y la del `.sha256` son entrada del frontend. Sin comprobarlas, quien compusiera
    /// la llamada aportaria **las dos mitades** de la verificacion —el archivo y el hash contra el
    /// que se compara— y esta pasaria siempre, dejando ademas el resultado en la carpeta que
    /// `install_update` tiene en su lista blanca. O sea, ejecucion de lo que quisiera.
    #[test]
    fn solo_se_descarga_de_un_release_de_este_repositorio() {
        let buena = format!(
            "https://github.com/{REPO}/releases/download/v1.3.1/ProcessDevKill_1.3.1_x64-setup.exe"
        );
        assert!(
            url_de_release_valida(&buena).is_ok(),
            "la URL real de un asset tiene que valer: {buena}"
        );
        assert!(url_de_release_valida(&format!("{buena}.sha256")).is_ok());

        // Otro anfitrion, aunque el camino imite al bueno.
        assert!(url_de_release_valida(&format!(
            "https://malo.example/{REPO}/releases/download/v1.3.1/setup.exe"
        ))
        .is_err());

        // Sin cifrar: un intermediario podria cambiar instalador y hash a la vez.
        assert!(url_de_release_valida(&format!(
            "http://github.com/{REPO}/releases/download/v1.3.1/setup.exe"
        ))
        .is_err());

        // Otro repositorio del mismo GitHub.
        assert!(url_de_release_valida(
            "https://github.com/otro/proyecto/releases/download/v1.0.0/setup.exe"
        )
        .is_err());

        // Dentro del repo pero fuera de los assets de un release.
        assert!(url_de_release_valida(&format!(
            "https://github.com/{REPO}/raw/main/algo.exe"
        ))
        .is_err());

        // ⚠️ Los dos que un `starts_with` sobre la cadena si se habria tragado, que es el fallo
        // que ya tuvo la guardia de rutas con `Path::starts_with`. Se comprueban a proposito.
        //
        // El `..` normalizado: el camino acaba siendo /xfiberex/evil.exe.
        assert!(url_de_release_valida(&format!(
            "https://github.com/{REPO}/releases/download/../../../evil.exe"
        ))
        .is_err());
        // El truco del usuario en la autoridad: el anfitrion real es malo.example.
        assert!(url_de_release_valida(&format!(
            "https://github.com@malo.example/{REPO}/releases/download/v1.3.1/setup.exe"
        ))
        .is_err());

        assert!(url_de_release_valida("no soy una url").is_err());
        assert!(url_de_release_valida("").is_err());
    }

    /// Que la comprobacion este **antes de pedir nada**: si se colara despues de la descarga, el
    /// archivo ya estaria escrito en la carpeta desde la que se ejecuta.
    #[tokio::test]
    async fn una_url_ajena_no_llega_ni_a_descargarse() {
        let info = ReleaseInfo {
            tag: "v9.9.9".into(),
            version: "9.9.9".into(),
            notes: String::new(),
            html_url: String::new(),
            asset_url: "https://malo.example/evil-setup.exe".into(),
            asset_name: "evil-setup.exe".into(),
            asset_size: 10,
            checksum_url: "https://malo.example/evil-setup.exe.sha256".into(),
        };

        let mut hubo_progreso = false;
        let error = download_and_verify(&info, |_, _| hubo_progreso = true)
            .await
            .expect_err("una URL ajena no puede descargarse");

        assert!(error.contains("github.com"), "{error}");
        assert!(!hubo_progreso, "no deberia haber empezado ninguna descarga");
        assert!(
            !carpeta_descargas().join("evil-setup.exe").exists(),
            "no puede quedar nada escrito en la carpeta desde la que se ejecuta"
        );
    }

    /// Los tres flags son la actualizacion silenciosa entera: quitar cualquiera de ellos
    /// devuelve al usuario alguna ventana (el asistente con `/S`, la desinstalacion de la
    /// version vieja con `/UPDATE`, o la app sin volver a abrirse con `/R`). No se nota
    /// hasta el siguiente release, y para entonces ya esta publicado.
    #[test]
    fn el_instalador_se_lanza_en_silencio() {
        assert!(ARGS_SILENCIOSOS.contains(&"/S"), "sin /S sale el asistente");
        assert!(
            ARGS_SILENCIOSOS.contains(&"/UPDATE"),
            "sin /UPDATE se ejecuta el desinstalador de la version anterior"
        );
        assert!(
            ARGS_SILENCIOSOS.contains(&"/R"),
            "sin /R la app no vuelve a abrirse tras actualizar"
        );
    }

    /// El nombre del asset viene de la API de GitHub y acaba pegado a una ruta con `join`.
    #[test]
    fn el_nombre_de_la_descarga_no_puede_salirse_de_la_carpeta() {
        assert_eq!(
            nombre_seguro("ProcessDevKill_1.2.0_x64-setup.exe"),
            "ProcessDevKill_1.2.0_x64-setup.exe"
        );

        // Con separadores, solo sobrevive el ultimo componente.
        assert_eq!(nombre_seguro(r"..\..\Windows\System32\evil.exe"), "evil.exe");
        assert_eq!(nombre_seguro("../../evil.exe"), "evil.exe");

        // Y lo que no deja nombre utilizable cae al de por defecto.
        assert_eq!(nombre_seguro(""), "ProcessDevKill-setup.exe");
        assert_eq!(nombre_seguro(".."), "ProcessDevKill-setup.exe");

        // Lo que importa de verdad: pegado a la carpeta, no se sale de ella.
        let dir = carpeta_descargas();
        let destino = dir.join(nombre_seguro(r"..\..\evil.exe"));
        assert_eq!(destino.parent(), Some(dir.as_path()));
    }

    #[test]
    fn el_hash_de_un_archivo_conocido_es_el_esperado() {
        let dir = std::env::temp_dir().join("pdk_test_sha");
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("vacio.txt");
        std::fs::write(&f, b"abc").unwrap();

        // SHA-256 de "abc", un vector de prueba estandar.
        assert_eq!(
            sha256_de_archivo(&f).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );

        let _ = std::fs::remove_file(&f);
    }

    // ── El tope de la descarga ─────────────────────────────────────────────────────────────
    //
    // Todo el testing de este proyecto es local: nada de CI. Aqui el "servidor de mentira" es un
    // `TcpListener` en un hilo, no un contenedor: son treinta lineas, arranca en microsegundos y
    // corre en cualquier equipo con `cargo test` y nada mas. Docker haria falta el dia que se
    // necesite un servicio de verdad (una API, una base de datos), no para escupir bytes.

    /// Servidor de un solo uso que devuelve `cuerpo_total` bytes y cierra.
    ///
    /// **Sin `Content-Length` a proposito.** Una respuesta HTTP/1.1 sin esa cabecera se lee hasta
    /// que el otro lado cierre, y ese es justo el caso peor contra el que protege el tope: el
    /// servidor que no dice cuanto ocupa lo que manda, asi que no hay nada que comparar por
    /// adelantado y solo queda contar lo que va llegando.
    fn servidor_que_escupe(cuerpo_total: usize) -> (String, std::thread::JoinHandle<()>) {
        use std::io::{Read, Write};

        // Puerto 0: lo elige el sistema. Fijar uno haria que dos pruebas en paralelo —o cualquier
        // cosa que ya escuche ahi— se pisaran.
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("no se pudo abrir puerto");
        let puerto = listener.local_addr().unwrap().port();

        let hilo = std::thread::spawn(move || {
            let Ok((mut sock, _)) = listener.accept() else {
                return;
            };

            // **Sin este timeout la prueba se cuelga**, y costo verlo. Cuando el tope corta la
            // descarga, el cliente deja de leer, pero el socket no se cierra al instante: hyper lo
            // suelta cuando el runtime vuelve a moverse, y en un `#[tokio::test]` el runtime solo
            // avanza mientras se hace `await`. Para entonces este hilo ya se quedo bloqueado en
            // `write_all` con los buffers de TCP llenos —512 KB no caben en los ~64 KB del socket—
            // y el `join` de abajo esperaba a un hilo que no iba a volver nunca. Con el timeout,
            // la escritura falla, el hilo sale y el `join` termina.
            let _ = sock.set_write_timeout(Some(std::time::Duration::from_secs(5)));
            // La peticion se lee y se tira: siempre se responde lo mismo.
            let mut buf = [0u8; 1024];
            let _ = sock.read(&mut buf);
            if sock.write_all(b"HTTP/1.1 200 OK\r\n\r\n").is_err() {
                return;
            }

            let trozo = vec![0u8; 16 * 1024];
            let mut escrito = 0;
            while escrito < cuerpo_total {
                let n = trozo.len().min(cuerpo_total - escrito);
                // Cuando el cliente aborta por el tope, este write falla. Es la señal de que la
                // guardia hizo su trabajo, no un fallo de la prueba.
                if sock.write_all(&trozo[..n]).is_err() {
                    return;
                }
                escrito += n;
            }
        });

        (format!("http://127.0.0.1:{puerto}/"), hilo)
    }

    /// La prueba del criterio **negativo** del tope: que no se escriba lo que no debe.
    ///
    /// El tope va por parametro para no tener que mover 100 MB por el loopback ni escribirlos en
    /// el disco de quien ejecute las pruebas. Lo que se verifica es el mecanismo —contar, cortar y
    /// borrar—, que es lo mismo a 64 KB que a 100 MB; el valor de produccion se comprueba aparte.
    #[tokio::test]
    async fn una_descarga_que_se_pasa_del_tope_se_corta_y_no_deja_el_archivo_a_medias() {
        let (url, hilo) = servidor_que_escupe(512 * 1024);
        let destino = std::env::temp_dir().join("pdk-prueba-tope-descarga.bin");
        let _ = std::fs::remove_file(&destino);

        let resp = reqwest::get(&url).await.expect("el servidor local responde");

        let mut ultimo_progreso = 0u64;
        let error = volcar_con_tope(resp, &destino, 0, 64 * 1024, &mut |bajado, _| {
            ultimo_progreso = bajado
        })
        .await
        .expect_err("512 KB con un tope de 64 KB tienen que cortarse");

        assert!(error.contains("tamaño razonable"), "{error}");
        assert!(
            !destino.exists(),
            "el archivo a medias no puede quedarse en el disco: se ejecuta desde esa carpeta"
        );
        assert!(
            ultimo_progreso <= 64 * 1024,
            "no debio informarse de mas progreso que el tope, y se informo de {ultimo_progreso}"
        );

        let _ = hilo.join();
    }

    /// La otra mitad: el tope no puede romper la descarga normal, que es la que corre de verdad
    /// en cada actualizacion.
    #[tokio::test]
    async fn una_descarga_por_debajo_del_tope_llega_entera() {
        let (url, hilo) = servidor_que_escupe(32 * 1024);
        let destino = std::env::temp_dir().join("pdk-prueba-descarga-normal.bin");
        let _ = std::fs::remove_file(&destino);

        let resp = reqwest::get(&url).await.expect("el servidor local responde");

        volcar_con_tope(resp, &destino, 0, MAX_DESCARGA, &mut |_, _| {})
            .await
            .expect("32 KB caben de sobra bajo el tope de produccion");

        assert_eq!(
            std::fs::metadata(&destino).unwrap().len(),
            32 * 1024,
            "tiene que escribirse el cuerpo entero"
        );

        let _ = std::fs::remove_file(&destino);
        let _ = hilo.join();
    }

    /// El tope de produccion, en su propia prueba porque es lo unico que las dos de arriba no
    /// tocan. No se compara con el literal —seria repetir la linea— sino con lo que tiene que
    /// cumplir: margen de sobra sobre el instalador (~4 MB) sin dejar de ser un techo.
    ///
    /// En `const` porque los dos lados son constantes y clippy lo señalo: asi no se comprueba al
    /// ejecutar la prueba sino **al compilar**, y bajar el tope a 4 MB deja de compilar en vez de
    /// fallar un test.
    #[test]
    fn el_tope_de_produccion_deja_margen_al_instalador_sin_dejar_de_ser_un_techo() {
        const {
            assert!(
                MAX_DESCARGA > 20 * 1024 * 1024,
                "muy justo: el instalador ronda los 4 MB y tiene que poder crecer"
            )
        };
        const {
            assert!(
                MAX_DESCARGA < 1024 * 1024 * 1024,
                "un techo de 1 GB ya no protege el %TEMP% de nadie"
            )
        };
    }
}
