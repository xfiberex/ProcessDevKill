//! Puertos TCP en escucha, agrupados por PID.

use std::collections::HashMap;

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
            eprintln!("No se pudieron leer los puertos en escucha: {e}");
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
}
