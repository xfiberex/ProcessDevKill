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
//! frontend usa el mismo truco con `typeof es` (ver `src/i18n.ts`).
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
    sin_ejecutable: "No se encontro el ejecutable de la app",
    sin_elevacion: "No se pudieron pedir permisos de administrador",
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
    sin_elevacion: "Could not request administrator permission",
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
pub fn cerrar_todos(lang: Language, runtime: &str) -> String {
    match lang {
        Language::Es => format!("Cerrar todos los {runtime}"),
        Language::En => format!("Close all {runtime}"),
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
}
