//! Puertos TCP en escucha, agrupados por PID.
//!
//! **Se le piden a Windows con la tabla que ya viene filtrada por escucha**
//! (`GetExtendedTcpTable` con `TCP_TABLE_OWNER_PID_LISTENER`), y no se mira el estado de cada
//! socket. Hasta el 2026-11-11 se leían todos con el crate `listeners` y se quedaban los que
//! estaban en `Listen`; en la compilación 10.0.26300 de Windows todos llegan con estado `0`, que no
//! es ninguno de la tabla —hasta `Get-NetTCPConnection` falla al leerlo—, y la app no enseñaba ni
//! un puerto. Con esta tabla el filtro lo hace Windows por dentro, y además no trae las conexiones
//! salientes, cuyo puerto efímero no es «el puerto donde corre tu servidor».

use std::collections::HashMap;
use std::mem::{offset_of, size_of};

use serde::Serialize;
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID, MIB_TCPROW_OWNER_PID,
    MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_LISTENER,
};

use crate::logging::CadaTanto;

/// `AF_INET` y `AF_INET6`. Escritos aquí para no pedir la feature de WinSock solo por dos números.
const AF_INET: u32 = 2;
const AF_INET6: u32 = 23;
const ERROR_INSUFFICIENT_BUFFER: u32 = 122;

/// Pide a Windows la tabla de sockets TCP en escucha de una familia, en un búfer de su tamaño.
///
/// La primera llamada, sin búfer, contesta `ERROR_INSUFFICIENT_BUFFER` con el tamaño que hace
/// falta. Entre esa y la siguiente pueden abrirse sockets, y entonces vuelve a no caber: se repite
/// unas pocas veces. El error, si lo hay, es el código de Windows.
fn tabla_en_escucha(familia: u32) -> Result<Vec<u8>, u32> {
    let mut tam: u32 = 0;
    for _ in 0..5 {
        let mut bufer = vec![0u8; tam as usize];
        let destino = (!bufer.is_empty()).then(|| bufer.as_mut_ptr().cast());
        // SAFETY: `destino` apunta a `tam` bytes nuestros, o es `None` para preguntar el tamaño.
        let r = unsafe {
            GetExtendedTcpTable(destino, &mut tam, false, familia, TCP_TABLE_OWNER_PID_LISTENER, 0)
        };
        match r {
            0 => return Ok(bufer),
            ERROR_INSUFFICIENT_BUFFER => continue,
            otro => return Err(otro),
        }
    }
    Err(ERROR_INSUFFICIENT_BUFFER)
}

/// Lee `cuantas` filas de tipo `T` de una tabla de Windows: un `u32` con el recuento y detrás el
/// array, que empieza en `inicio`. Con `read_unaligned` porque el búfer es de bytes.
fn filas<T>(bufer: &[u8], inicio: usize) -> Vec<T> {
    if bufer.len() < 4 {
        return Vec::new();
    }
    let cuantas = u32::from_ne_bytes(bufer[..4].try_into().unwrap()) as usize;
    (0..cuantas)
        .map(|i| inicio + i * size_of::<T>())
        .take_while(|&desde| desde + size_of::<T>() <= bufer.len())
        // SAFETY: el `take_while` asegura que la fila entera cabe en el búfer.
        .map(|desde| unsafe { std::ptr::read_unaligned(bufer.as_ptr().add(desde).cast::<T>()) })
        .collect()
}

/// El puerto de una fila: va en orden de red en los 16 bits bajos de un `u32`.
fn puerto_de(dw_local_port: u32) -> u16 {
    u16::from_be(dw_local_port as u16)
}

/// Los sockets TCP en escucha del equipo, como `(pid, puerto)`, de IPv4 y de IPv6.
///
/// Si una familia falla y la otra no, vale lo que se pudo leer: un equipo sin IPv6 no es un error.
fn sockets_en_escucha() -> Result<Vec<(u32, u16)>, u32> {
    let v4 = tabla_en_escucha(AF_INET).map(|b| {
        filas::<MIB_TCPROW_OWNER_PID>(&b, offset_of!(MIB_TCPTABLE_OWNER_PID, table))
            .into_iter()
            .map(|f| (f.dwOwningPid, puerto_de(f.dwLocalPort)))
            .collect::<Vec<_>>()
    });
    let v6 = tabla_en_escucha(AF_INET6).map(|b| {
        filas::<MIB_TCP6ROW_OWNER_PID>(&b, offset_of!(MIB_TCP6TABLE_OWNER_PID, table))
            .into_iter()
            .map(|f| (f.dwOwningPid, puerto_de(f.dwLocalPort)))
            .collect::<Vec<_>>()
    });
    match (v4, v6) {
        (Err(e), Err(_)) => Err(e),
        (a, b) => Ok(a.unwrap_or_default().into_iter().chain(b.unwrap_or_default()).collect()),
    }
}

/// Quién escucha en un puerto TCP del equipo, esté vigilado o no (T14-34).
///
/// Es la respuesta al vacío de una búsqueda de puerto sin filas: «Ningún proceso coincide» no decía
/// si el puerto estaba libre o lo tenía un programa que la app no vigila (`wslrelay.exe`, Docker,
/// IIS). Solo el nombre del ejecutable y el PID, como en el resto de la app: ni la ruta ni la línea
/// de comandos.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortOwner {
    pub pid: u32,
    pub name: String,
    /// Si añadirlo a los vigilados lo haría salir en la lista: los críticos de Windows no salen
    /// aunque se añadan (`processes::CRITICOS`), y la ventana no ofrece vigilarlos.
    pub watchable: bool,
}

/// La parte pura de [`who_listens`]: entre unos sockets en escucha `(pid, puerto)`, el dueño de
/// `puerto`, con su nombre. Uno que escucha en IPv4 e IPv6 sale dos veces con el mismo PID, así
/// que da igual cuál se tome. Sin nombre —el proceso acaba de morir—, no hay dueño que enseñar.
fn dueno_del_puerto(
    sockets: &[(u32, u16)],
    puerto: u16,
    nombre_de: impl Fn(u32) -> Option<String>,
) -> Option<PortOwner> {
    let pid = sockets.iter().find(|&&(_, p)| p == puerto)?.0;
    let name = nombre_de(pid)?;
    // `classify` con su propio nombre en la lista de vigilados: es «¿saldría si se añadiera?»,
    // con la misma normalización y la misma exclusión de críticos.
    let lower = name.to_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower).to_string();
    let watchable = crate::processes::classify(&name, &[stem]).is_some();
    Some(PortOwner { pid, name, watchable })
}

/// El nombre del ejecutable de un PID, con un `System` de un solo proceso: esto lo pide la ventana
/// de vez en cuando, no el poller, y no merece tocar el `System` compartido ni su candado.
fn nombre_del_proceso(pid: u32) -> Option<String> {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
    let pid = Pid::from_u32(pid);
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, ProcessRefreshKind::nothing());
    sys.process(pid).map(|p| p.name().to_string_lossy().into_owned())
}

/// Quién escucha en `puerto` por TCP; `None` si nadie, o si no se pudieron leer los sockets.
pub fn who_listens(puerto: u16) -> Option<PortOwner> {
    let sockets = sockets_en_escucha().ok()?;
    dueno_del_puerto(&sockets, puerto, nombre_del_proceso)
}

/// El aviso de que no se pudieron leer los puertos, como mucho una vez por minuto. Esta función
/// corre en cada ciclo del poller: si falla una vez, lo normal es que falle en todas.
static AVISO_DE_PUERTOS: CadaTanto = CadaTanto::new(60_000);

/// Mapea PID -> puertos TCP en escucha.
///
/// Un fallo aqui no tumba la lista de procesos: se devuelve el mapa vacio y la UI
/// simplemente no muestra puertos.
pub fn listening_ports() -> HashMap<u32, Vec<u16>> {
    match sockets_en_escucha() {
        Ok(sockets) => agrupar_por_pid(sockets),
        Err(codigo) => {
            if AVISO_DE_PUERTOS.toca(crate::storage::now_millis()) {
                crate::avisar!(
                    "No se pudieron leer los puertos en escucha: error {codigo} de Windows (este aviso sale como mucho una vez por minuto)"
                );
            }
            HashMap::new()
        }
    }
}

/// Junta los puertos de cada PID, ordenados y sin repetir: un servidor que escucha en IPv4 e IPv6
/// aparece dos veces con el mismo puerto.
fn agrupar_por_pid(sockets: Vec<(u32, u16)>) -> HashMap<u32, Vec<u16>> {
    let mut by_pid: HashMap<u32, Vec<u16>> = HashMap::new();
    for (pid, puerto) in sockets {
        by_pid.entry(pid).or_default().push(puerto);
    }
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

    /// La parte pura: el dueño con su nombre, un crítico de Windows que no se ofrece para vigilar,
    /// y nada si el puerto no está o si el proceso ya no tiene nombre (acaba de morir).
    #[test]
    fn el_dueno_lleva_su_nombre_y_los_criticos_no_se_pueden_vigilar() {
        let sockets = [(20, 3000), (4, 80), (99, 8080)];
        let nombre = |pid: u32| match pid {
            20 => Some("wslrelay.exe".to_string()),
            4 => Some("System".to_string()),
            _ => None,
        };

        assert_eq!(
            dueno_del_puerto(&sockets, 3000, nombre),
            Some(PortOwner { pid: 20, name: "wslrelay.exe".into(), watchable: true })
        );
        assert_eq!(dueno_del_puerto(&sockets, 80, nombre).map(|d| d.watchable), Some(false));
        assert_eq!(dueno_del_puerto(&sockets, 5173, nombre), None);
        assert_eq!(dueno_del_puerto(&sockets, 8080, nombre), None);
    }

    #[test]
    fn el_puerto_va_en_orden_de_red_en_los_16_bits_bajos() {
        // 3000 = 0x0BB8, que en orden de red y leído como `u32` en x86 es 0x0000_B80B.
        assert_eq!(puerto_de(0x0000_B80B), 3000);
        assert_eq!(puerto_de(0xFFFF_B80B), 3000, "los 16 bits altos no son del puerto");
    }

    #[test]
    fn agrupa_por_pid_sin_repetir_el_puerto_de_ipv4_e_ipv6() {
        let mapa = agrupar_por_pid(vec![(7, 5173), (7, 3000), (7, 5173), (8, 80)]);
        assert_eq!(mapa[&7], vec![3000, 5173]);
        assert_eq!(mapa[&8], vec![80]);
    }
}

