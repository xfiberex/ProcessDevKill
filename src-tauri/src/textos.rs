//! Todo el texto que escribe Rust, en los dos idiomas.
//!
//! Existe porque hay texto de la app que **la ventana no pinta**: el menu de la bandeja, las
//! notificaciones de Windows y los avisos del Auto-Kill. Es ademas lo unico que se ve cuando la
//! app corre escondida en la bandeja, asi que dejarlo en español mientras la ventana habla ingles
//! seria traducir justo la mitad que ya se entendia sin traducir.
//!
//! El catalogo es un `struct` de cadenas estaticas con una constante por idioma, y no un mapa de
//! claves: añadir un rotulo obliga a rellenarlo en `ES` **y** en `EN` o no compila. Un
//! `HashMap<&str, &str>` daria un `None` en tiempo de ejecucion, que es enterarse tarde. El
//! frontend usa el mismo truco con `typeof es` (ver `src/i18n.tsx`).
//!
//! Las frases con numero **no** estan en el struct sino en las funciones de abajo: no se pueden
//! componer por plantilla porque los dos idiomas no ordenan igual. «3 procesos Node cerrados» pone
//! el runtime entre el sustantivo y el participio; «3 Node processes closed» lo pone delante del
//! sustantivo. Una plantilla con huecos daria «3 processes Node closed».

use crate::storage::Language;

/// Rotulos fijos. Uno por idioma, comprobado por el compilador.
pub struct Textos {
    // --- bandeja ---
    pub mostrar: &'static str,
    pub salir: &'static str,
    // --- avisos ---
    /// Lo que dice el atajo global cuando no habia nada que cerrar.
    pub sin_procesos: &'static str,
    // --- errores que acaban en un toast de la ventana ---
    pub estado_corrupto: &'static str,
    pub fallo_desconocido: &'static str,
    pub ajustes_corruptos: &'static str,
    pub sin_acceso_al_sistema: &'static str,
    /// Cuando llega un nombre de servicio que no es de ninguno de los vigilados. No deberia verse
    /// nunca desde la ventana: la lista solo pinta los que pasan la misma comprobacion.
    pub servicio_no_vigilado: &'static str,
    pub sin_ejecutable: &'static str,
    pub sin_elevacion: &'static str,
    /// Al pulsar «Abrir carpeta» del log antes de que la app haya escrito nada.
    pub sin_carpeta_de_log: &'static str,
}

pub const ES: Textos = Textos {
    mostrar: "Mostrar ProcessDevKill",
    salir: "Salir",
    sin_procesos: "No hay procesos de desarrollo activos.",
    estado_corrupto: "Estado del sistema corrupto",
    fallo_desconocido: "Fallo desconocido",
    ajustes_corruptos: "Ajustes corruptos",
    sin_acceso_al_sistema: "No se pudo acceder al estado del sistema",
    servicio_no_vigilado: "Ese servicio no es de desarrollo",
    sin_ejecutable: "No se encontró el ejecutable de la app",
    sin_elevacion: "No se pudieron pedir permisos de administrador",
    sin_carpeta_de_log: "Todavía no hay ninguna carpeta de log.",
};

pub const EN: Textos = Textos {
    mostrar: "Show ProcessDevKill",
    salir: "Quit",
    sin_procesos: "No development processes running.",
    estado_corrupto: "System state is corrupt",
    fallo_desconocido: "Unknown failure",
    ajustes_corruptos: "Settings are corrupt",
    sin_acceso_al_sistema: "Could not read the system state",
    servicio_no_vigilado: "That service is not a development service",
    sin_ejecutable: "Could not find the app executable",
    sin_elevacion: "Could not request administrator rights",
    sin_carpeta_de_log: "There is no log folder yet.",
};

pub fn de(lang: Language) -> &'static Textos {
    match lang {
        Language::Es => &ES,
        Language::En => &EN,
    }
}

/// Entrada del menu de la bandeja que cierra un runtime entero.
///
/// El nombre del runtime no se traduce: «Node», «Python» y «.NET» se llaman igual en los dos
/// idiomas, y traducirlos seria inventarse nombres de productos.
///
/// En inglés lleva el sustantivo (T12-35): «todos los Node» se entiende en español, pero «Close
/// all Node» se queda sin decir qué cierra, y «.NET» a secas todavía menos.
pub fn cerrar_todos(lang: Language, runtime: &str) -> String {
    match lang {
        Language::Es => format!("Cerrar todos los {runtime}"),
        Language::En => format!("Close all {runtime} processes"),
    }
}

/// Aviso de la bandeja cuando ese runtime no tenia ni un proceso vivo.
///
/// Se manda aunque no haya nada que cerrar: la orden salio de un menu que puede pulsarse con la
/// ventana escondida, y sin notificacion el clic no tendria ninguna respuesta.
pub fn ninguno_activo(lang: Language, runtime: &str) -> String {
    match lang {
        Language::Es => format!("No hay procesos {runtime} activos."),
        Language::En => format!("No {runtime} processes running."),
    }
}

/// Frase del recuento de cierres, concordada en numero.
///
/// «1 procesos Node cerrados.» era lo que salia al cerrar uno solo desde la bandeja. El numero
/// cambia la frase entera, no solo el sustantivo: es el mismo descuido que el frontend ya arreglo
/// dos veces —«Se terminaran los 1 procesos» en el Tier 5 y «1 cierre registrados» en el
/// historial—, asi que aqui se resuelve en un sitio con su prueba.
///
/// La firma es **semantica** y no de huecos de texto: hasta el Tier 4 recibia un `que` y una
/// `cola` que el llamante rellenaba con trozos de frase ya escritos en español. Con dos idiomas
/// eso obligaria a que la bandeja supiera decir «con Ctrl+Alt+K» en ingles. Desde el Tier 11 la
/// combinacion se elige en Ajustes, asi que llega como `atajo` y ya no es una constante, que es justo el
/// reparto que este modulo viene a evitar.
pub fn closed_sentence(
    lang: Language,
    killed: usize,
    runtime: Option<&str>,
    atajo: Option<&str>,
) -> String {
    // Cero es plural en los dos idiomas: «0 procesos cerrados», «0 processes closed».
    let plural = killed != 1;

    match lang {
        Language::Es => {
            let procesos = if plural { "procesos" } else { "proceso" };
            let cerrados = if plural { "cerrados" } else { "cerrado" };
            let que = runtime.map(|r| format!(" {r}")).unwrap_or_default();
            let cola = atajo.map(|a| format!(" con {a}")).unwrap_or_default();
            format!("{killed} {procesos}{que} {cerrados}{cola}.")
        }
        Language::En => {
            let procesos = if plural { "processes" } else { "process" };
            let que = runtime.map(|r| format!("{r} ")).unwrap_or_default();
            let cola = atajo.map(|a| format!(" with {a}")).unwrap_or_default();
            format!("{killed} {que}{procesos} closed{cola}.")
        }
    }
}

/// Aviso de la primera pulsacion del atajo, cuando pide dos.
///
/// Dice **cuantos** caerian: «pulsa otra vez para cerrar» a secas no deja decidir, y lo que se
/// decide en esos tres segundos es justo si esos procesos pueden morir.
pub fn atajo_armado(lang: Language, atajo: &str, n: usize) -> String {
    match (lang, n == 1) {
        (Language::Es, true) => {
            format!("Pulsa {atajo} otra vez en 3 s para cerrar 1 proceso de desarrollo.")
        }
        (Language::Es, false) => {
            format!("Pulsa {atajo} otra vez en 3 s para cerrar {n} procesos de desarrollo.")
        }
        (Language::En, true) => {
            format!("Press {atajo} again within 3 s to close 1 development process.")
        }
        (Language::En, false) => {
            format!("Press {atajo} again within 3 s to close {n} development processes.")
        }
    }
}

/// Frase sobre los puertos liberados, o `None` si no se libero ninguno.
///
/// Aparte del envio para que el Auto-Kill pueda pegarla al final de su propio mensaje en vez de
/// soltar dos notificaciones seguidas.
pub fn freed_ports_sentence(lang: Language, ports: &[u16]) -> Option<String> {
    if ports.is_empty() {
        return None;
    }

    let list = ports
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(", ");

    Some(match (lang, ports.len() == 1) {
        (Language::Es, true) => format!("El puerto {list} ha quedado libre."),
        (Language::Es, false) => format!("Los puertos {list} han quedado libres."),
        (Language::En, true) => format!("Port {list} is now free."),
        (Language::En, false) => format!("Ports {list} are now free."),
    })
}

/// Junta el recuento con la frase de los puertos, si hubo alguno.
///
/// **Un solo aviso por accion.** Antes la bandeja y el atajo sacaban dos notificaciones de Windows
/// por un solo clic: la de los puertos que suelta `kill_and_record` y la del recuento al volver.
pub fn con_puertos(lang: Language, recuento: String, ports: &[u16]) -> String {
    match freed_ports_sentence(lang, ports) {
        Some(frase) => format!("{recuento} {frase}"),
        None => recuento,
    }
}

/// Aviso del Auto-Kill cuando solo cae un proceso: dice **cual** y cuanto usaba.
///
/// Un aviso que no lo nombra obliga a abrir el historial para enterarse, que es justo lo que la
/// notificacion venia a evitar.
pub fn auto_kill_uno(lang: Language, name: &str, pid: u32, usaba: &str, limite: &str) -> String {
    match lang {
        Language::Es => format!(
            "{name} (PID {pid}) usaba {usaba}, por encima del límite de {limite}. \
             Cerrado automáticamente."
        ),
        Language::En => format!(
            "{name} (PID {pid}) was using {usaba}, above the {limite} limit. Closed automatically."
        ),
    }
}

/// Aviso del Auto-Kill con varios caidos: resume. Enumerar quince nombres en un toast de Windows
/// no cabe y no se lee.
pub fn auto_kill_varios(lang: Language, cerrados: usize, limite: &str) -> String {
    match lang {
        Language::Es => {
            format!("{cerrados} procesos cerrados automáticamente por pasar de {limite}.")
        }
        Language::En => {
            format!("{cerrados} processes closed automatically for going over {limite}.")
        }
    }
}

// ------------------------------------------------ errores que llegan a la ventana ---
//
// Los módulos devuelven el fallo como un enum sin frase, y aquí se dice (T12-05). Hasta el
// 2026-09-30 cada uno escribía su `String` en español, y con la app en inglés el toast de un Kill
// fallido o el error del actualizador salían en español: verificado en vivo en la re-auditoría.
//
// El detalle entre paréntesis o tras los dos puntos lo da el sistema o `reqwest`, y no se traduce.

/// Por qué no se cerró un proceso. Es la descripción del toast de un Kill fallido.
pub fn fallo_cierre(lang: Language, fallo: &crate::processes::FalloCierre) -> String {
    use crate::processes::FalloCierre as F;

    match (lang, fallo) {
        (Language::Es, F::NoExiste { pid }) => format!("El proceso {pid} ya no existe"),
        (Language::Es, F::NoVigilado { name }) => {
            format!("{name} no es un proceso de desarrollo vigilado")
        }
        (Language::Es, F::Protegido { name, pid }) => format!("{name} (PID {pid}) está protegido"),
        (Language::Es, F::NoSeCerro { name, pid }) => format!("No se pudo cerrar {name} (PID {pid})"),

        (Language::En, F::NoExiste { pid }) => format!("Process {pid} no longer exists"),
        (Language::En, F::NoVigilado { name }) => {
            format!("{name} is not a watched development process")
        }
        (Language::En, F::Protegido { name, pid }) => format!("{name} (PID {pid}) is protected"),
        (Language::En, F::NoSeCerro { name, pid }) => format!("Could not close {name} (PID {pid})"),
    }
}

/// No se pudo guardar un archivo de datos (ajustes, historial).
pub fn no_se_guardo(lang: Language, fallo: &crate::storage::FalloGuardado) -> String {
    let (ruta, detalle) = (fallo.ruta.display(), &fallo.detalle);
    match lang {
        Language::Es => format!("No se pudo guardar {ruta}: {detalle}"),
        Language::En => format!("Could not save {ruta}: {detalle}"),
    }
}

/// Al abrir la carpeta del log desde Ajustes.
pub fn carpeta_no_abierta(lang: Language, detalle: &str) -> String {
    match lang {
        Language::Es => format!("No se pudo abrir la carpeta: {detalle}"),
        Language::En => format!("Could not open the folder: {detalle}"),
    }
}

/// Cualquier fallo del actualizador. Es lo que enseña la tarjeta de Actualizaciones.
pub fn fallo_actualizacion(lang: Language, fallo: &crate::update::Fallo) -> String {
    match lang {
        Language::Es => fallo_actualizacion_es(fallo),
        Language::En => fallo_actualizacion_en(fallo),
    }
}

fn fallo_actualizacion_es(fallo: &crate::update::Fallo) -> String {
    use crate::update::Fallo as F;

    match fallo {
        F::ClienteHttp(d) => format!("No se pudo preparar el cliente HTTP: {d}"),
        F::ConsultaGithub(d) => format!("No se pudo consultar GitHub: {d}"),
        F::GithubRespondio(d) => format!("GitHub respondió {d}"),
        F::RespuestaIlegible(d) => format!("Respuesta de GitHub ilegible: {d}"),
        F::UrlInvalida => "La URL de la descarga no es válida.".into(),
        F::SinHttps => "La descarga tiene que ir por HTTPS.".into(),
        F::NoEsGithub => "La descarga no viene de github.com.".into(),
        F::NoEsDeEsteProyecto => {
            "La descarga no es un asset de un release de este proyecto.".into()
        }
        F::SinDescarga => "No hay ninguna descarga que instalar.".into(),
        F::InstaladorMovido => "El instalador descargado ya no está donde debería.".into(),
        F::RutaNoPermitida => "Ruta de instalador no permitida.".into(),
        F::NoEsArchivo => "La ruta indicada no es un archivo.".into(),
        F::CarpetaNoCreada(d) => format!("No se pudo crear la carpeta de descargas ({d})."),
        F::NoSeAbre(d) => format!("No se pudo abrir el instalador: {d}"),
        F::NoSeLee(d) => format!("No se pudo leer el instalador: {d}"),
        F::NoEsLaVerificada => "Ese no es el instalador que se descargó y verificó.".into(),
        F::CambioTrasDescarga => {
            "El instalador cambió después de descargarlo y se ha borrado. Vuelve a descargarlo."
                .into()
        }
        F::DescargaRespondio(d) => format!("La descarga respondió {d}"),
        F::NoSeEscribe(d) => format!("No se pudo escribir el instalador: {d}"),
        F::Interrumpida(d) => format!("Descarga interrumpida: {d}"),
        F::DemasiadoGrande => "La descarga se pasa del tamaño razonable y se ha cancelado.".into(),
        F::SinInstalador => "Esa versión no publica un instalador descargable.".into(),
        F::SinSha256 => "Esa versión no publica el .sha256 del instalador, así que no se puede \
                         verificar. Descárgala a mano desde la página del release."
            .into(),
        F::ChecksumNoDescargado(d) => format!("No se pudo descargar el checksum: {d}"),
        F::ChecksumIlegible(d) => format!("Checksum ilegible: {d}"),
        F::ChecksumInvalido => "El archivo .sha256 publicado no contiene un hash válido.".into(),
        F::InstaladorNoDescargado(d) => format!("No se pudo descargar el instalador: {d}"),
        F::HashNoCoincide { esperado, real } => format!(
            "El instalador descargado no coincide con el hash publicado y se ha borrado. \
             Esperado {esperado}, obtenido {real}."
        ),
        F::NoSeEjecuta(d) => format!("No se pudo ejecutar el instalador: {d}"),
        F::SinVerificada => "No hay ninguna descarga verificada que instalar.".into(),
    }
}

fn fallo_actualizacion_en(fallo: &crate::update::Fallo) -> String {
    use crate::update::Fallo as F;

    match fallo {
        F::ClienteHttp(d) => format!("Could not set up the HTTP client: {d}"),
        F::ConsultaGithub(d) => format!("Could not reach GitHub: {d}"),
        F::GithubRespondio(d) => format!("GitHub responded with {d}"),
        F::RespuestaIlegible(d) => format!("Unreadable response from GitHub: {d}"),
        F::UrlInvalida => "The download URL is not valid.".into(),
        F::SinHttps => "The download must use HTTPS.".into(),
        F::NoEsGithub => "The download does not come from github.com.".into(),
        F::NoEsDeEsteProyecto => "The download is not an asset of a release of this project.".into(),
        F::SinDescarga => "There is no download to install.".into(),
        F::InstaladorMovido => "The downloaded installer is no longer where it should be.".into(),
        F::RutaNoPermitida => "Installer path not allowed.".into(),
        F::NoEsArchivo => "That path is not a file.".into(),
        F::CarpetaNoCreada(d) => format!("Could not create the download folder ({d})."),
        F::NoSeAbre(d) => format!("Could not open the installer: {d}"),
        F::NoSeLee(d) => format!("Could not read the installer: {d}"),
        F::NoEsLaVerificada => "That is not the installer that was downloaded and verified.".into(),
        F::CambioTrasDescarga => {
            "The installer changed after it was downloaded, so it was deleted. Download it again."
                .into()
        }
        F::DescargaRespondio(d) => format!("The download responded with {d}"),
        F::NoSeEscribe(d) => format!("Could not write the installer: {d}"),
        F::Interrumpida(d) => format!("Download interrupted: {d}"),
        F::DemasiadoGrande => "The download went over a reasonable size and was canceled.".into(),
        F::SinInstalador => "That version does not publish a downloadable installer.".into(),
        F::SinSha256 => "That version does not publish the installer's .sha256, so it cannot be \
                         verified. Download it manually from the release page."
            .into(),
        F::ChecksumNoDescargado(d) => format!("Could not download the checksum: {d}"),
        F::ChecksumIlegible(d) => format!("Unreadable checksum: {d}"),
        F::ChecksumInvalido => "The published .sha256 file does not contain a valid hash.".into(),
        F::InstaladorNoDescargado(d) => format!("Could not download the installer: {d}"),
        F::HashNoCoincide { esperado, real } => format!(
            "The downloaded installer does not match the published hash, so it was deleted. \
             Expected {esperado}, got {real}."
        ),
        F::NoSeEjecuta(d) => format!("Could not run the installer: {d}"),
        F::SinVerificada => "There is no verified download to install.".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Los puertos liberados son la razon de ser de la app: la frase que los anuncia es lo unico
    /// que se lee cuando el cierre vino de la bandeja o del atajo global y no habia ninguna
    /// ventana delante.
    #[test]
    fn la_frase_de_puertos_concuerda_en_singular_y_plural() {
        assert_eq!(freed_ports_sentence(Language::Es, &[]), None);
        assert_eq!(
            freed_ports_sentence(Language::Es, &[3000]).unwrap(),
            "El puerto 3000 ha quedado libre."
        );
        assert_eq!(
            freed_ports_sentence(Language::Es, &[3000, 5173]).unwrap(),
            "Los puertos 3000, 5173 han quedado libres."
        );

        assert_eq!(freed_ports_sentence(Language::En, &[]), None);
        assert_eq!(
            freed_ports_sentence(Language::En, &[3000]).unwrap(),
            "Port 3000 is now free."
        );
        assert_eq!(
            freed_ports_sentence(Language::En, &[3000, 5173]).unwrap(),
            "Ports 3000, 5173 are now free."
        );
    }

    /// El recuento concuerda en numero en los dos idiomas, y **el runtime cambia de sitio**: es la
    /// razon por la que estas frases son codigo y no plantillas con huecos.
    #[test]
    fn el_recuento_concuerda_en_singular_y_en_plural() {
        assert_eq!(
            closed_sentence(Language::Es, 1, Some("Node"), None),
            "1 proceso Node cerrado."
        );
        assert_eq!(
            closed_sentence(Language::Es, 3, Some("Node"), None),
            "3 procesos Node cerrados."
        );
        // Cero tambien es plural en español: «0 procesos cerrados».
        assert_eq!(
            closed_sentence(Language::Es, 0, Some("Python"), None),
            "0 procesos Python cerrados."
        );
        // El atajo global no lleva runtime, pero si cola.
        assert_eq!(
            closed_sentence(Language::Es, 1, None, Some("Ctrl+Alt+K")),
            "1 proceso cerrado con Ctrl+Alt+K."
        );
        assert_eq!(
            closed_sentence(Language::Es, 5, None, Some("Ctrl+Alt+K")),
            "5 procesos cerrados con Ctrl+Alt+K."
        );

        assert_eq!(
            closed_sentence(Language::En, 1, Some("Node"), None),
            "1 Node process closed."
        );
        assert_eq!(
            closed_sentence(Language::En, 3, Some("Node"), None),
            "3 Node processes closed."
        );
        assert_eq!(
            closed_sentence(Language::En, 0, Some("Python"), None),
            "0 Python processes closed."
        );
        assert_eq!(
            closed_sentence(Language::En, 1, None, Some("Ctrl+Alt+K")),
            "1 process closed with Ctrl+Alt+K."
        );
        assert_eq!(
            closed_sentence(Language::En, 5, None, Some("Ctrl+Alt+K")),
            "5 processes closed with Ctrl+Alt+K."
        );
    }

    /// La entrada del menú de la bandeja dice qué cierra, también en inglés (T12-35).
    #[test]
    fn la_entrada_de_la_bandeja_nombra_lo_que_cierra() {
        assert_eq!(cerrar_todos(Language::Es, "Node"), "Cerrar todos los Node");
        assert_eq!(cerrar_todos(Language::En, "Node"), "Close all Node processes");
        assert_eq!(cerrar_todos(Language::En, ".NET"), "Close all .NET processes");
    }

    /// Un solo aviso por accion: el recuento y los puertos van en el mismo mensaje.
    #[test]
    fn el_recuento_y_los_puertos_viajan_juntos() {
        assert_eq!(
            con_puertos(
                Language::Es,
                closed_sentence(Language::Es, 2, Some("Node"), None),
                &[3000, 5173]
            ),
            "2 procesos Node cerrados. Los puertos 3000, 5173 han quedado libres."
        );
        assert_eq!(
            con_puertos(
                Language::En,
                closed_sentence(Language::En, 2, Some("Node"), None),
                &[3000, 5173]
            ),
            "2 Node processes closed. Ports 3000, 5173 are now free."
        );

        // Sin puertos liberados no se pega nada: ni frase vacia ni espacio de mas.
        assert_eq!(
            con_puertos(
                Language::Es,
                closed_sentence(Language::Es, 1, Some("Node"), None),
                &[]
            ),
            "1 proceso Node cerrado."
        );
    }

    /// Ningun rotulo puede quedarse sin traducir de verdad. El compilador obliga a **rellenar** el
    /// campo, no a que diga algo distinto: copiar y pegar el español en `EN` compila igual. Esto
    /// caza justo eso, que es el descuido probable al añadir una entrada nueva.
    ///
    /// Se comparan solo los rotulos que **tienen** que cambiar. Si algun dia hay uno que se
    /// escriba igual en los dos idiomas, se le hace un hueco aqui con su motivo escrito.
    #[test]
    fn ningun_rotulo_se_quedo_en_espanol() {
        let pares = [
            (ES.mostrar, EN.mostrar),
            (ES.salir, EN.salir),
            (ES.sin_procesos, EN.sin_procesos),
            (ES.estado_corrupto, EN.estado_corrupto),
            (ES.fallo_desconocido, EN.fallo_desconocido),
            (ES.ajustes_corruptos, EN.ajustes_corruptos),
            (ES.sin_acceso_al_sistema, EN.sin_acceso_al_sistema),
            (ES.servicio_no_vigilado, EN.servicio_no_vigilado),
            (ES.sin_ejecutable, EN.sin_ejecutable),
            (ES.sin_elevacion, EN.sin_elevacion),
            (ES.sin_carpeta_de_log, EN.sin_carpeta_de_log),
        ];

        for (es, en) in pares {
            assert_ne!(es, en, "«{es}» esta igual en los dos idiomas");
        }
    }

    /// El ingles no puede arrastrar acentos ni la «ñ»: si aparecen, es que quedo texto en español
    /// copiado sin traducir. Cubre tambien las frases compuestas, que el test de arriba no ve.
    #[test]
    fn el_catalogo_ingles_no_tiene_letras_del_espanol() {
        let frases: Vec<String> = vec![
            EN.mostrar.into(),
            EN.salir.into(),
            EN.sin_procesos.into(),
            EN.estado_corrupto.into(),
            EN.fallo_desconocido.into(),
            EN.ajustes_corruptos.into(),
            EN.sin_acceso_al_sistema.into(),
            EN.servicio_no_vigilado.into(),
            EN.sin_ejecutable.into(),
            EN.sin_elevacion.into(),
            EN.sin_carpeta_de_log.into(),
            cerrar_todos(Language::En, "Node"),
            ninguno_activo(Language::En, "Node"),
            closed_sentence(Language::En, 2, Some("Node"), Some("Ctrl+Alt+K")),
            auto_kill_varios(Language::En, 3, "2.0 GB"),
            auto_kill_uno(Language::En, "node.exe", 1, "3.0 GB", "2.0 GB"),
        ];

        for frase in frases {
            assert!(
                !frase.contains(['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡']),
                "«{frase}» tiene letras que el ingles no usa"
            );
        }
    }

    /// Un ejemplo de cada fallo del actualizador. El detalle técnico va en ASCII a propósito: en
    /// la app real lo da Windows, y aquí se mira solo lo que escribe el catálogo.
    fn todos_los_fallos_de_actualizacion() -> Vec<crate::update::Fallo> {
        use crate::update::Fallo as F;
        let d = || "detalle".to_string();
        let todos = vec![
            F::ClienteHttp(d()),
            F::ConsultaGithub(d()),
            F::GithubRespondio(d()),
            F::RespuestaIlegible(d()),
            F::UrlInvalida,
            F::SinHttps,
            F::NoEsGithub,
            F::NoEsDeEsteProyecto,
            F::SinDescarga,
            F::InstaladorMovido,
            F::RutaNoPermitida,
            F::NoEsArchivo,
            F::CarpetaNoCreada(d()),
            F::NoSeAbre(d()),
            F::NoSeLee(d()),
            F::NoEsLaVerificada,
            F::CambioTrasDescarga,
            F::DescargaRespondio(d()),
            F::NoSeEscribe(d()),
            F::Interrumpida(d()),
            F::DemasiadoGrande,
            F::SinInstalador,
            F::SinSha256,
            F::ChecksumNoDescargado(d()),
            F::ChecksumIlegible(d()),
            F::ChecksumInvalido,
            F::InstaladorNoDescargado(d()),
            F::HashNoCoincide {
                esperado: "aa".into(),
                real: "bb".into(),
            },
            F::NoSeEjecuta(d()),
            F::SinVerificada,
        ];

        // Si se añade una variante, este `match` deja de compilar: es lo que obliga a ponerla en
        // la lista de arriba, y con ella en las dos pruebas de abajo.
        for f in &todos {
            match f {
                F::ClienteHttp(_)
                | F::ConsultaGithub(_)
                | F::GithubRespondio(_)
                | F::RespuestaIlegible(_)
                | F::UrlInvalida
                | F::SinHttps
                | F::NoEsGithub
                | F::NoEsDeEsteProyecto
                | F::SinDescarga
                | F::InstaladorMovido
                | F::RutaNoPermitida
                | F::NoEsArchivo
                | F::CarpetaNoCreada(_)
                | F::NoSeAbre(_)
                | F::NoSeLee(_)
                | F::NoEsLaVerificada
                | F::CambioTrasDescarga
                | F::DescargaRespondio(_)
                | F::NoSeEscribe(_)
                | F::Interrumpida(_)
                | F::DemasiadoGrande
                | F::SinInstalador
                | F::SinSha256
                | F::ChecksumNoDescargado(_)
                | F::ChecksumIlegible(_)
                | F::ChecksumInvalido
                | F::InstaladorNoDescargado(_)
                | F::HashNoCoincide { .. }
                | F::NoSeEjecuta(_)
                | F::SinVerificada => {}
            }
        }
        todos
    }

    fn todos_los_fallos_de_cierre() -> Vec<crate::processes::FalloCierre> {
        use crate::processes::FalloCierre as F;
        vec![
            F::NoExiste { pid: 1 },
            F::NoVigilado { name: "cmd.exe".into() },
            F::Protegido { name: "node.exe".into(), pid: 1 },
            F::NoSeCerro { name: "node.exe".into(), pid: 1 },
        ]
    }

    /// T12-05, el criterio: todo error de Rust que llega a la ventana, en inglés de verdad. Es el
    /// fallo que vio la re-auditoría en vivo: con la app en inglés, «El proceso … ya no existe».
    #[test]
    fn los_errores_que_llegan_a_la_ventana_estan_en_ingles() {
        let guardado = crate::storage::FalloGuardado {
            ruta: "C:\\datos\\settings.json".into(),
            detalle: "detalle".into(),
        };
        let mut frases: Vec<String> = todos_los_fallos_de_actualizacion()
            .iter()
            .map(|f| fallo_actualizacion(Language::En, f))
            .collect();
        frases.extend(
            todos_los_fallos_de_cierre()
                .iter()
                .map(|f| fallo_cierre(Language::En, f)),
        );
        frases.push(no_se_guardo(Language::En, &guardado));
        frases.push(carpeta_no_abierta(Language::En, "detalle"));

        for frase in &frases {
            assert!(
                !frase.contains(['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡']),
                "«{frase}» tiene letras que el ingles no usa"
            );
        }
    }

    /// Y la otra mitad: ninguno está copiado igual en los dos idiomas. Sin acentos que delaten,
    /// «Checksum ilegible» pasaría la prueba de arriba siendo español.
    #[test]
    fn ningun_error_dice_lo_mismo_en_los_dos_idiomas() {
        for f in todos_los_fallos_de_actualizacion() {
            assert_ne!(
                fallo_actualizacion(Language::Es, &f),
                fallo_actualizacion(Language::En, &f),
                "{f:?}"
            );
        }
        for f in todos_los_fallos_de_cierre() {
            assert_ne!(fallo_cierre(Language::Es, &f), fallo_cierre(Language::En, &f), "{f:?}");
        }
    }
}
