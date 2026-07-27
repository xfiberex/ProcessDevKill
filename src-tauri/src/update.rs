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

/// Descarga el instalador, informa del progreso y **lo verifica antes de devolverlo**.
///
/// El `File` se cierra antes de calcular el hash: con el descriptor todavía abierto, la
/// lectura para verificar podría chocar con nuestra propia escritura.
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

    {
        use futures_util::StreamExt;
        use std::io::Write;

        let resp = http
            .get(&info.asset_url)
            .send()
            .await
            .map_err(|e| format!("No se pudo descargar el instalador: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("La descarga respondió {}", resp.status()));
        }

        let total = resp.content_length().unwrap_or(info.asset_size);
        let mut archivo = std::fs::File::create(&destino)
            .map_err(|e| format!("No se pudo escribir en {destino:?}: {e}"))?;

        let mut bajado: u64 = 0;
        let mut stream = resp.bytes_stream();
        while let Some(trozo) = stream.next().await {
            let trozo = trozo.map_err(|e| format!("Descarga interrumpida: {e}"))?;
            archivo
                .write_all(&trozo)
                .map_err(|e| format!("No se pudo escribir el instalador: {e}"))?;
            bajado += trozo.len() as u64;
            progreso(bajado, total);
        }
        archivo
            .flush()
            .map_err(|e| format!("No se pudo cerrar el instalador: {e}"))?;
    } // aquí se cierra el archivo, antes de verificarlo

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

/// Lanza el instalador descargado. El NSIS en modo `currentUser` no pide UAC.
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
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo ejecutar el instalador: {e}"))
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
}
