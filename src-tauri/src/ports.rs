//! Puertos TCP en escucha, agrupados por PID.

use std::collections::HashMap;

use serde::Serialize;

use crate::logging::CadaTanto;

/// Quién escucha en un puerto TCP del equipo, esté vigilado o no (T14-34).
///
/// Es la respuesta al vacío de una búsqueda de puerto sin filas: «Ningún proceso coincide» no decía
/// si el puerto estaba libre o lo tenía un programa que la app no vigila (`wslrelay.exe`, Docker,
/// IIS). Solo el nombre del ejecutable y el PID, como en el resto de la app: ni la ruta ni la línea
/// de comandos, aunque `listeners` las sepa.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortOwner {
    pub pid: u32,
    pub name: String,
    /// Si añadirlo a los vigilados lo haría salir en la lista: los críticos de Windows no salen
    /// aunque se añadan (`processes::CRITICOS`), y la ventana no ofrece vigilarlos.
    pub watchable: bool,
}

/// La parte pura de [`who_listens`]: entre unos sockets `(pid, nombre, puerto, escucha_por_tcp)`,
/// el que escucha en `puerto`. Uno que escucha en IPv4 e IPv6 sale dos veces con el mismo PID, así
/// que da igual cuál se tome.
fn dueno_del_puerto<'a>(
    sockets: impl IntoIterator<Item = (u32, &'a str, u16, bool)>,
    puerto: u16,
) -> Option<PortOwner> {
    sockets
        .into_iter()
        .find(|&(_, _, p, escucha)| escucha && p == puerto)
        .map(|(pid, name, _, _)| PortOwner {
            pid,
            name: name.to_string(),
            // `classify` con su propio nombre en la lista de vigilados: es «¿saldría si se
            // añadiera?», con la misma normalización y la misma exclusión de críticos.
            watchable: {
                let lower = name.to_lowercase();
                let stem = lower.strip_suffix(".exe").unwrap_or(&lower).to_string();
                crate::processes::classify(name, &[stem]).is_some()
            },
        })
}

/// Quién escucha en `puerto` por TCP; `None` si nadie, o si no se pudieron leer los sockets.
///
/// Con el mismo filtro que [`listening_ports`]: solo `Listen`, porque el puerto efímero de una
/// conexión saliente no es «quién tiene el 3000». No se usa `listeners::get_process_by_port`, que
/// no dice si filtra por estado.
pub fn who_listens(puerto: u16) -> Option<PortOwner> {
    let all = listeners::get_all().ok()?;
    dueno_del_puerto(
        all.iter().map(|l| {
            (
                l.process.pid,
                l.process.name.as_str(),
                l.socket.port(),
                l.protocol == listeners::Protocol::TCP && l.state == listeners::SocketState::Listen,
            )
        }),
        puerto,
    )
}

/// El aviso de que no se pudieron leer los puertos, como mucho una vez por minuto. Esta función
/// corre en cada ciclo del poller: si falla una vez, lo normal es que falle en todas.
static AVISO_DE_PUERTOS: CadaTanto = CadaTanto::new(60_000);

/// Mapea PID -> puertos TCP en escucha.
///
/// Solo interesan los sockets en estado `Listen`: `get_all()` tambien devuelve
/// conexiones salientes establecidas, y el puerto efimero de una peticion HTTP no
/// es "el puerto donde corre tu servidor", que es la pregunta que responde la app.
///
/// Un fallo aqui no tumba la lista de procesos: se devuelve el mapa vacio y la UI
/// simplemente no muestra puertos. En Windows, los sockets de procesos de otros
/// usuarios pueden requerir permisos elevados.
pub fn listening_ports() -> HashMap<u32, Vec<u16>> {
    let all = match listeners::get_all() {
        Ok(all) => all,
        Err(e) => {
            if AVISO_DE_PUERTOS.toca(crate::storage::now_millis()) {
                crate::avisar!(
                    "No se pudieron leer los puertos en escucha: {e} (este aviso sale como mucho una vez por minuto)"
                );
            }
            return HashMap::new();
        }
    };

    let mut by_pid: HashMap<u32, Vec<u16>> = HashMap::new();
    for listener in all {
        if listener.protocol != listeners::Protocol::TCP
            || listener.state != listeners::SocketState::Listen
        {
            continue;
        }
        by_pid
            .entry(listener.process.pid)
            .or_default()
            .push(listener.socket.port());
    }

    // Un servidor que escucha en IPv4 e IPv6 aparece dos veces con el mismo puerto.
    for ports in by_pid.values_mut() {
        ports.sort_unstable();
        ports.dedup();
    }
    by_pid
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Abre un socket real y comprueba que aparece asociado a este proceso.
    ///
    /// Ademas verifica el filtro que de verdad importa: el puerto efimero de una
    /// conexion *saliente* no debe contarse. Sin ese filtro, la UI mostraria
    /// numeros aleatorios en vez del puerto donde escucha el servidor.
    #[test]
    fn detecta_puertos_en_escucha_e_ignora_conexiones_salientes() {
        use std::net::{TcpListener, TcpStream};

        let listener = TcpListener::bind("127.0.0.1:0").expect("no se pudo abrir el socket");
        let address = listener.local_addr().unwrap();
        let listen_port = address.port();

        let client = TcpStream::connect(address).expect("no se pudo conectar");
        let _accepted = listener.accept().expect("no se acepto la conexion");
        let ephemeral_port = client.local_addr().unwrap().port();

        let mine = listening_ports()
            .remove(&std::process::id())
            .unwrap_or_default();

        assert!(
            mine.contains(&listen_port),
            "el puerto en escucha {listen_port} no aparece; detectados: {mine:?}"
        );
        assert!(
            !mine.contains(&ephemeral_port),
            "el puerto efimero {ephemeral_port} de una conexion saliente no deberia contarse"
        );
    }

    /// T14-34, con un socket de verdad: el dueño de un puerto en escucha es este proceso, y un
    /// puerto que se acaba de soltar no tiene dueño.
    #[test]
    fn who_listens_da_el_dueno_de_un_puerto_y_nada_si_esta_libre() {
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("no se pudo abrir el socket");
        let puerto = listener.local_addr().unwrap().port();

        let dueno = who_listens(puerto).expect("nadie escucha en un puerto que este proceso tiene abierto");
        assert_eq!(dueno.pid, std::process::id());
        assert!(!dueno.name.is_empty());

        // Otro puerto, abierto y soltado: el criterio negativo.
        let libre = {
            let l = TcpListener::bind("127.0.0.1:0").unwrap();
            l.local_addr().unwrap().port()
        };
        assert_eq!(who_listens(libre), None, "un puerto suelto no puede tener dueño");
    }

    /// La parte pura: una conexión saliente en el mismo puerto no cuenta, y un crítico de Windows
    /// no se ofrece para vigilar.
    #[test]
    fn el_dueno_es_el_que_escucha_y_los_criticos_no_se_pueden_vigilar() {
        let sockets = [
            (10, "chrome.exe", 3000, false),
            (20, "wslrelay.exe", 3000, true),
            (4, "System", 80, true),
        ];

        assert_eq!(
            dueno_del_puerto(sockets, 3000),
            Some(PortOwner { pid: 20, name: "wslrelay.exe".into(), watchable: true })
        );
        assert_eq!(dueno_del_puerto(sockets, 80).map(|d| d.watchable), Some(false));
        assert_eq!(dueno_del_puerto(sockets, 5173), None);
    }
}

