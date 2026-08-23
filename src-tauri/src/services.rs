//! Servicios de Windows que son de desarrollo: SQL Server, PostgreSQL, MySQL, Docker…
//!
//! **Este módulo es de solo lectura, y lo sigue siendo con la Fase B ya escrita.** Aquí no se
//! arranca, no se detiene y no se cambia nada: enumerar el catálogo del SCM, leer la configuración
//! de un servicio y preguntar quién depende de quién no piden privilegios. Todo lo que sí los pide
//! vive en `service_control.rs`, aparte y con su elevación puntual.
//!
//! **La separación no es estética.** Mientras las dos únicas cosas que este archivo sabe hacer con
//! el SCM sean `SC_MANAGER_CONNECT` y `SC_MANAGER_ENUMERATE_SERVICE`, un fallo aquí —el poller lo
//! llama, la ventana lo llama, el catálogo tiene cientos de entradas— no puede detener nada.
//! Mezclar las acciones en el mismo módulo que la lista sería perder esa garantía a cambio de nada.
//!
//! Se habla con el SCM por la API (`windows`) y no lanzando `sc.exe` ni PowerShell: un proceso por
//! consulta es lento, y lo que devuelve es texto **localizado** que habría que parsear —el equipo
//! donde se desarrolla esto está en es-DO y `sc query` contesta en español—.

use std::collections::{HashMap, HashSet};

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use windows::core::PCWSTR;
use windows::Win32::System::Services::{
    CloseServiceHandle, EnumDependentServicesW, EnumServicesStatusExW, OpenSCManagerW, OpenServiceW,
    QueryServiceConfig2W, QueryServiceConfigW, QueryServiceStatusEx, ENUM_SERVICE_STATUSW,
    ENUM_SERVICE_STATUS_PROCESSW, QUERY_SERVICE_CONFIGW, SC_ENUM_PROCESS_INFO, SC_MANAGER_CONNECT,
    SC_MANAGER_ENUMERATE_SERVICE, SC_STATUS_PROCESS_INFO, SERVICE_ACTIVE, SERVICE_AUTO_START,
    SERVICE_BOOT_START, SERVICE_CONFIG_DELAYED_AUTO_START_INFO, SERVICE_DELAYED_AUTO_START_INFO,
    SERVICE_DEMAND_START, SERVICE_DISABLED, SERVICE_ENUMERATE_DEPENDENTS, SERVICE_QUERY_CONFIG,
    SERVICE_QUERY_STATUS, SERVICE_RUNNING, SERVICE_STATE_ALL, SERVICE_STATUS_PROCESS,
    SERVICE_STATUS_CURRENT_STATE, SERVICE_STOPPED, SERVICE_SYSTEM_START, SERVICE_WIN32,
};

// ------------------------------------------------------------------- tipos ---

/// A qué se dedica el servicio. Es lo que agrupa y colorea la lista, igual que `Runtime` en la
/// tabla de procesos.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ServiceFamily {
    SqlServer,
    Postgres,
    MySql,
    MongoDb,
    Redis,
    Docker,
    Iis,
    /// Los que añade el usuario por su nombre.
    Other,
}

/// Estado del servicio, reducido a lo que la lista necesita enseñar.
///
/// Windows tiene siete estados; cinco de ellos son transiciones (`StartPending`, `StopPending`,
/// `ContinuePending`, `PausePending`, `Paused`). Pintarlos por separado sería ruido en una lista
/// que se lee de un vistazo: lo único que importa es si está corriendo, parado, o **a medias**.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ServiceState {
    Running,
    Stopped,
    /// En transición. Se enseña aparte porque un servicio atascado en `StopPending` es un problema
    /// real, y decir «parado» cuando todavía no lo está sería mentir.
    Pending,
}

/// Tipo de arranque, tal como lo enseña `services.msc`.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum StartType {
    Boot,
    System,
    Automatic,
    /// `Automático (inicio retrasado)`. Va aparte porque para un servicio de desarrollo es
    /// justamente el ajuste intermedio útil: arranca solo, pero deja de pelearse con el arranque de
    /// Windows.
    AutomaticDelayed,
    Manual,
    Disabled,
    /// No se pudo leer la configuración. Pasa si el servicio no concede `SERVICE_QUERY_CONFIG` al
    /// usuario; se enseña como desconocido en vez de inventar un valor.
    Unknown,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInfo {
    /// El nombre del SCM (`MSSQL$SQLEXPRESS`). **Es la clave**: es lo estable y lo que se compara.
    pub name: String,
    /// El nombre que enseña Windows, ya localizado. Solo para leerlo; nunca para comparar.
    pub display_name: String,
    pub family: ServiceFamily,
    pub state: ServiceState,
    pub start_type: StartType,
    /// PID del proceso del servicio, o 0 si está parado.
    pub pid: u32,
    /// RAM del árbol entero del servicio, o `None` si no se pudo leer. Ver `ram_del_arbol`.
    pub memory_mb: Option<f64>,
    /// Puertos TCP en escucha de todo el árbol. Vacío es normal y no es un fallo: SQL Express viene
    /// con TCP/IP desactivado y no escucha en ninguno.
    pub ports: Vec<u16>,
}

// ------------------------------------------------------------ clasificación ---

/// Cómo se compara un nombre de servicio con un patrón.
///
/// **Nunca hay coincidencia por subcadena, y no es paranoia.** Al explorar esta idea se listaron los
/// servicios del equipo con un `Get-Service | Where-Object { $_.Name -match '…|Redis|…' }` y
/// apareció **`GameInputRedistService`**: «Redist» contiene «Redis». Un panel que ofrece detener
/// servicios no puede colar el mando de una consola en la lista de bases de datos.
#[derive(Clone, Copy)]
enum Patron {
    /// El nombre entero, sin distinguir mayúsculas: `SQLBrowser`.
    Exacto(&'static str),
    /// Instancia con nombre: `MSSQL$SQLEXPRESS`. El `$` es parte del patrón, así que no hay forma
    /// de que case algo que no sea una instancia.
    Instancia(&'static str),
    /// El patrón y **solo dígitos** detrás: `MySQL80` sí, `MySQLRouter` no.
    Numerado(&'static str),
    /// El patrón, que ya termina en separador, y algo detrás: `postgresql-x64-17`.
    ConSufijo(&'static str),
}

impl Patron {
    fn casa(self, nombre: &str) -> bool {
        match self {
            Patron::Exacto(p) => nombre.eq_ignore_ascii_case(p),
            Patron::Instancia(p) => empieza_por(nombre, &format!("{p}$")) .is_some_and(|resto| !resto.is_empty()),
            Patron::Numerado(p) => empieza_por(nombre, p)
                .is_some_and(|resto| !resto.is_empty() && resto.bytes().all(|b| b.is_ascii_digit())),
            Patron::ConSufijo(p) => empieza_por(nombre, p).is_some_and(|resto| !resto.is_empty()),
        }
    }
}

/// Lo que queda de `nombre` tras un prefijo, comparando sin distinguir mayúsculas.
fn empieza_por<'a>(nombre: &'a str, prefijo: &str) -> Option<&'a str> {
    if nombre.len() < prefijo.len() {
        return None;
    }
    let (cabeza, resto) = nombre.split_at(prefijo.len());
    cabeza.eq_ignore_ascii_case(prefijo).then_some(resto)
}

/// El catálogo de fábrica.
///
/// Se escriben los servicios **satélite** de cada motor además del motor en sí —el Browser y el
/// Writer de SQL Server, el lanzador de texto completo, el de telemetría— porque son justo los que
/// nadie sabe que tiene encendidos: en el equipo donde se diseñó esto, `SQLTELEMETRY$SQLEXPRESS`
/// llevaba 53 MB en `Automático` sin que su dueño lo supiera.
const CATALOGO: &[(ServiceFamily, &[Patron])] = &[
    (
        ServiceFamily::SqlServer,
        &[
            Patron::Exacto("MSSQLSERVER"),
            Patron::Exacto("SQLSERVERAGENT"),
            Patron::Exacto("SQLBrowser"),
            Patron::Exacto("SQLWriter"),
            Patron::Exacto("MSSQLFDLauncher"),
            Patron::Exacto("SQLTELEMETRY"),
            Patron::Instancia("MSSQL"),
            Patron::Instancia("SQLAgent"),
            Patron::Instancia("MSSQLFDLauncher"),
            Patron::Instancia("SQLTELEMETRY"),
            Patron::Instancia("MSSQLLaunchpad"),
        ],
    ),
    (
        ServiceFamily::Postgres,
        // El guión del final es lo que hace seguro el prefijo: `postgresql-x64-17`.
        &[Patron::Exacto("postgresql"), Patron::ConSufijo("postgresql-")],
    ),
    (
        ServiceFamily::MySql,
        &[
            Patron::Exacto("MySQL"),
            Patron::Exacto("MariaDB"),
            Patron::Numerado("MySQL"),
            Patron::Numerado("MariaDB"),
        ],
    ),
    (
        ServiceFamily::MongoDb,
        &[Patron::Exacto("MongoDB"), Patron::Numerado("MongoDB")],
    ),
    (
        ServiceFamily::Redis,
        // Solo exacto: es el patrón que casi coló `GameInputRedistService`.
        &[Patron::Exacto("Redis"), Patron::Exacto("Redis-server")],
    ),
    (
        ServiceFamily::Docker,
        &[
            Patron::Exacto("com.docker.service"),
            Patron::Exacto("DockerDesktopVM"),
        ],
    ),
    (
        ServiceFamily::Iis,
        &[
            Patron::Exacto("W3SVC"),
            Patron::Exacto("WAS"),
            Patron::Exacto("IISADMIN"),
        ],
    ),
];

/// Decide si un servicio es de desarrollo, y de qué familia.
///
/// `custom` son los nombres que añade el usuario, y se comparan **exactos**: el mismo criterio que
/// `classify` usa para los ejecutables, y por el mismo motivo — quien escribe «sql» esperando que
/// case algo se lleva una sorpresa menos mala que quien escribe «red» y se encuentra media lista de
/// servicios del sistema en un panel que ofrece detenerlos.
pub fn classify_service(name: &str, custom: &[String]) -> Option<ServiceFamily> {
    for (familia, patrones) in CATALOGO {
        if patrones.iter().any(|p| p.casa(name)) {
            return Some(*familia);
        }
    }

    custom
        .iter()
        .any(|c| c.trim().eq_ignore_ascii_case(name))
        .then_some(ServiceFamily::Other)
}

// -------------------------------------------------------------- lectura SCM ---

/// Cierra un `SC_HANDLE` al salir del ámbito.
///
/// Con un guard y no cerrando a mano porque entre medias hay varios `?` y `continue`: un camino de
/// salida que se olvidara del `CloseServiceHandle` filtraría un handle **por servicio y por
/// refresco**, y esto lo llama el poller cada dos segundos.
pub(crate) struct Handle(pub(crate) windows::Win32::System::Services::SC_HANDLE);

impl Drop for Handle {
    fn drop(&mut self) {
        // Falla solo con un handle inválido, y entonces no hay nada que hacer ni que contar.
        unsafe { let _ = CloseServiceHandle(self.0); }
    }
}

/// Abre el SCM con los derechos que se le pidan, y solo esos.
///
/// Se pasa el derecho a propósito en vez de tener un `SC_MANAGER_ALL_ACCESS` de comodín: quien lea
/// una llamada a esto ve en la propia línea qué puede hacer el handle que sale.
pub(crate) fn abrir_scm(
    derechos: u32,
) -> windows::core::Result<Handle> {
    Ok(Handle(unsafe {
        OpenSCManagerW(PCWSTR::null(), PCWSTR::null(), derechos)?
    }))
}

/// Abre un servicio por su nombre, con los derechos pedidos.
pub(crate) fn abrir_servicio(
    scm: &Handle,
    nombre: &str,
    derechos: u32,
) -> windows::core::Result<Handle> {
    let ancho = a_utf16(nombre);
    Ok(Handle(unsafe {
        OpenServiceW(scm.0, PCWSTR(ancho.as_ptr()), derechos)?
    }))
}

/// Una cadena de Rust como la quiere el SCM: UTF-16 y terminada en cero.
pub(crate) fn a_utf16(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Traduce el estado bruto del SCM a los tres que la lista enseña.
fn estado_de(bruto: SERVICE_STATUS_CURRENT_STATE) -> ServiceState {
    if bruto == SERVICE_RUNNING {
        ServiceState::Running
    } else if bruto == SERVICE_STOPPED {
        ServiceState::Stopped
    } else {
        ServiceState::Pending
    }
}

/// Enumera los servicios del sistema y devuelve solo los de desarrollo, ya con su RAM y sus puertos.
///
/// Ante cualquier fallo del SCM devuelve la lista vacía y lo anota, en vez de propagar: quedarse sin
/// el panel de servicios no puede tumbar la lista de procesos, que es a lo que el usuario vino.
pub fn collect_services(sys: &mut System, custom: &[String]) -> Vec<ServiceInfo> {
    let crudos = match enumerar() {
        Ok(v) => v,
        Err(e) => {
            crate::avisar!("No se pudo enumerar los servicios: {e}");
            return Vec::new();
        }
    };

    let vigilados: Vec<(ServiceCrudo, ServiceFamily)> = crudos
        .into_iter()
        .filter_map(|s| classify_service(&s.name, custom).map(|f| (s, f)))
        .collect();

    if vigilados.is_empty() {
        return Vec::new();
    }

    // El árbol de procesos y la tabla de sockets se leen **una vez para todo el lote**, no por
    // servicio: es el mismo criterio que `kill_many`.
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_memory(),
    );
    let hijos = mapa_de_hijos(sys);
    let puertos = crate::ports::listening_ports();

    let mut lista: Vec<ServiceInfo> = vigilados
        .into_iter()
        .map(|(s, family)| {
            let arbol = if s.pid == 0 { Vec::new() } else { arbol_de(s.pid, &hijos) };

            let memory_mb = ram_del_arbol(sys, &arbol);

            let mut ports: Vec<u16> = arbol
                .iter()
                .filter_map(|pid| puertos.get(pid))
                .flatten()
                .copied()
                .collect();
            ports.sort_unstable();
            ports.dedup();

            ServiceInfo {
                name: s.name,
                display_name: s.display_name,
                family,
                state: s.state,
                start_type: s.start_type,
                pid: s.pid,
                memory_mb,
                ports,
            }
        })
        .collect();

    // Los que están corriendo primero, y dentro de cada grupo por nombre: lo accionable arriba.
    lista.sort_by(|a, b| {
        let orden = |s: &ServiceInfo| match s.state {
            ServiceState::Running => 0,
            ServiceState::Pending => 1,
            ServiceState::Stopped => 2,
        };
        orden(a)
            .cmp(&orden(b))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    lista
}

/// Lo que sale del SCM antes de cruzarlo con los procesos.
struct ServiceCrudo {
    name: String,
    display_name: String,
    state: ServiceState,
    start_type: StartType,
    pid: u32,
}

/// RAM del árbol, o `None` cuando el sistema no deja leerla.
///
/// **La mayoría de los servicios corren con otra cuenta —`LOCAL SERVICE`, `NETWORK SERVICE`,
/// `SYSTEM`— y un proceso sin elevar no puede abrirlos para preguntarles la memoria.** Medido en el
/// equipo de desarrollo: de 327 procesos, 168 contestan; los 53 del propio usuario contestan todos,
/// y los de SQL Server y PostgreSQL, ninguno.
///
/// Por eso esto devuelve `Option` y no un `f64` con cero dentro. Un «0 MB» junto a un SQL Server
/// corriendo es una cifra falsa que el usuario se creería; un «—» dice la verdad, que es que no se
/// sabe. Mismo criterio que el «En pausa» del medidor y que el guion de los procesos sin puerto.
///
/// Un proceso vivo nunca ocupa exactamente 0 bytes, así que una suma de cero solo puede significar
/// que no se pudo leer ninguno.
fn ram_del_arbol(sys: &System, arbol: &[u32]) -> Option<f64> {
    let bytes: u64 = arbol
        .iter()
        .filter_map(|pid| sys.process(Pid::from_u32(*pid)))
        .map(|p| p.memory())
        .sum();

    (bytes > 0).then(|| bytes as f64 / 1_048_576.0)
}

/// PID -> hijos directos, sacado de una sola pasada por los procesos.
fn mapa_de_hijos(sys: &System) -> HashMap<u32, Vec<u32>> {
    let mut mapa: HashMap<u32, Vec<u32>> = HashMap::new();
    for (pid, proc) in sys.processes() {
        if let Some(padre) = proc.parent() {
            mapa.entry(padre.as_u32()).or_default().push(pid.as_u32());
        }
    }
    mapa
}

/// El PID del servicio y todos sus descendientes.
///
/// **Hace falta, y se comprobó en un equipo real**: el SCM dice que `postgresql-x64-17` es el PID
/// del `pg_ctl.exe`, y quien escucha en el puerto es el `postgres.exe` que cuelga de él. Quedarse
/// con el PID del servicio daría 8 MB de RAM y ningún puerto para un servidor que sí tiene los dos.
/// Es el mismo error que ya costó una medición inválida en T4-03 con los procesos de WebView2.
fn arbol_de(raiz: u32, hijos: &HashMap<u32, Vec<u32>>) -> Vec<u32> {
    let mut vistos = HashSet::from([raiz]);
    let mut pendientes = vec![raiz];
    let mut arbol = vec![raiz];

    // Con `vistos` y no recursivo: un ciclo en la tabla de padres —que existe si un PID se recicla
    // entre la lectura y el recorrido— colgaría la app para siempre.
    while let Some(actual) = pendientes.pop() {
        for hijo in hijos.get(&actual).into_iter().flatten() {
            if vistos.insert(*hijo) {
                arbol.push(*hijo);
                pendientes.push(*hijo);
            }
        }
    }
    arbol
}

/// Pide al SCM el catálogo entero de servicios Win32.
fn enumerar() -> windows::core::Result<Vec<ServiceCrudo>> {
    // Solo conectar y enumerar: no se pide `SC_MANAGER_ALL_ACCESS` ni nada que permita modificar.
    // Con estos dos derechos, un usuario normal abre el SCM sin UAC — y este módulo, aunque
    // quisiera, no podría arrancar ni detener nada.
    let scm = abrir_scm(SC_MANAGER_CONNECT | SC_MANAGER_ENUMERATE_SERVICE)?;

    // Primera llamada con el buffer vacío: solo para que diga cuánto necesita.
    let mut bytes = 0u32;
    let mut contados = 0u32;
    let mut reanudar = 0u32;
    let _ = unsafe {
        EnumServicesStatusExW(
            scm.0,
            SC_ENUM_PROCESS_INFO,
            SERVICE_WIN32,
            SERVICE_STATE_ALL,
            None,
            &mut bytes,
            &mut contados,
            Some(&mut reanudar),
            PCWSTR::null(),
        )
    };

    if bytes == 0 {
        return Ok(Vec::new());
    }

    // El buffer se reserva como `Vec` de la propia estructura y no como `Vec<u8>`: el SCM escribe
    // ahí structs, y un `Vec<u8>` no garantiza la alineación que necesitan para leerse sin UB.
    let cabidas = bytes as usize / size_of::<ENUM_SERVICE_STATUS_PROCESSW>() + 1;
    let mut buffer: Vec<ENUM_SERVICE_STATUS_PROCESSW> = Vec::with_capacity(cabidas);
    let bytes_buffer = cabidas * size_of::<ENUM_SERVICE_STATUS_PROCESSW>();

    unsafe {
        let crudo = std::slice::from_raw_parts_mut(buffer.as_mut_ptr().cast::<u8>(), bytes_buffer);
        EnumServicesStatusExW(
            scm.0,
            SC_ENUM_PROCESS_INFO,
            SERVICE_WIN32,
            SERVICE_STATE_ALL,
            Some(crudo),
            &mut bytes,
            &mut contados,
            Some(&mut reanudar),
            PCWSTR::null(),
        )?;
        buffer.set_len(contados as usize);
    }

    let mut salida = Vec::with_capacity(contados as usize);
    for entrada in buffer.iter().take(contados as usize) {
        // Los nombres son punteros **dentro del mismo buffer**, así que se copian a `String` ahora
        // y no después: cuando `buffer` muera, esos punteros no valen nada.
        let name = unsafe { entrada.lpServiceName.to_string() }.unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let display_name = unsafe { entrada.lpDisplayName.to_string() }.unwrap_or_default();

        let state = estado_de(entrada.ServiceStatusProcess.dwCurrentState);

        salida.push(ServiceCrudo {
            start_type: tipo_de_arranque(&scm, &name),
            name,
            display_name,
            state,
            pid: entrada.ServiceStatusProcess.dwProcessId,
        });
    }

    Ok(salida)
}

/// Lee el tipo de arranque de un servicio. `Unknown` si no se puede consultar.
fn tipo_de_arranque(scm: &Handle, nombre: &str) -> StartType {
    let servicio = match abrir_servicio(scm, nombre, SERVICE_QUERY_CONFIG) {
        Ok(h) => h,
        // Sin ruido en el log: hay servicios del sistema que no conceden este derecho a un usuario
        // normal, y es lo esperado, no un fallo del que haya que enterarse.
        Err(_) => return StartType::Unknown,
    };

    let mut bytes = 0u32;
    let _ = unsafe { QueryServiceConfigW(servicio.0, None, 0, &mut bytes) };
    if bytes == 0 {
        return StartType::Unknown;
    }

    // Mismo motivo de alineación que en `enumerar`: `QUERY_SERVICE_CONFIGW` lleva punteros dentro.
    let cabidas = bytes as usize / size_of::<QUERY_SERVICE_CONFIGW>() + 1;
    let mut buffer: Vec<QUERY_SERVICE_CONFIGW> = Vec::with_capacity(cabidas);
    let config = buffer.as_mut_ptr();

    if unsafe {
        QueryServiceConfigW(
            servicio.0,
            Some(config),
            (cabidas * size_of::<QUERY_SERVICE_CONFIGW>()) as u32,
            &mut bytes,
        )
    }
    .is_err()
    {
        return StartType::Unknown;
    }

    let bruto = unsafe { (*config).dwStartType };
    if bruto == SERVICE_BOOT_START {
        StartType::Boot
    } else if bruto == SERVICE_SYSTEM_START {
        StartType::System
    } else if bruto == SERVICE_DEMAND_START {
        StartType::Manual
    } else if bruto == SERVICE_DISABLED {
        StartType::Disabled
    } else if bruto == SERVICE_AUTO_START {
        // `Automático` y `Automático (inicio retrasado)` son el mismo valor aquí: el retraso vive en
        // otra consulta. Sin esta segunda llamada, los dos se pintarían igual, y para un servicio de
        // desarrollo la diferencia es justo la que importa.
        if retrasado(&servicio) {
            StartType::AutomaticDelayed
        } else {
            StartType::Automatic
        }
    } else {
        StartType::Unknown
    }
}

/// Si un servicio `SERVICE_AUTO_START` tiene además el inicio retrasado.
fn retrasado(servicio: &Handle) -> bool {
    let mut bytes = 0u32;
    let mut info = SERVICE_DELAYED_AUTO_START_INFO::default();

    unsafe {
        QueryServiceConfig2W(
            servicio.0,
            SERVICE_CONFIG_DELAYED_AUTO_START_INFO,
            Some(std::slice::from_raw_parts_mut(
                std::ptr::from_mut(&mut info).cast::<u8>(),
                size_of::<SERVICE_DELAYED_AUTO_START_INFO>(),
            )),
            &mut bytes,
        )
        .is_ok()
            && info.fDelayedAutostart.as_bool()
    }
}

// ------------------------------------------- lo que la Fase B necesita, sin privilegios ---

/// El estado de **un** servicio, releído en el momento.
///
/// Existe para no asumir el resultado de una acción. `ControlService` vuelve en cuanto el SCM
/// acepta el encargo, no cuando el servicio ha terminado de pararse: dar por detenido lo que
/// todavía está en `StopPending` sería la clase de mentira que esta app no cuenta. Quien acaba de
/// pedir algo llama a esto hasta que el estado se asienta.
///
/// **Leer no pide privilegios**, así que esto lo hace la app sin elevar, y solo la acción en sí
/// pasa por el UAC.
pub fn read_state(name: &str) -> Option<ServiceState> {
    let scm = abrir_scm(SC_MANAGER_CONNECT).ok()?;
    let servicio = abrir_servicio(&scm, name, SERVICE_QUERY_STATUS).ok()?;

    let mut info = SERVICE_STATUS_PROCESS::default();
    let mut bytes = 0u32;

    unsafe {
        QueryServiceStatusEx(
            servicio.0,
            SC_STATUS_PROCESS_INFO,
            Some(std::slice::from_raw_parts_mut(
                std::ptr::from_mut(&mut info).cast::<u8>(),
                size_of::<SERVICE_STATUS_PROCESS>(),
            )),
            &mut bytes,
        )
        .ok()?;
    }

    Some(estado_de(info.dwCurrentState))
}

/// Un servicio que depende de otro, tal como se le enseña al usuario antes de detener nada.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDependent {
    pub name: String,
    pub display_name: String,
}

/// Los servicios **en marcha** que dependen de `name`.
///
/// Se piden solo los activos (`SERVICE_ACTIVE`) porque son los únicos que cambian el resultado:
/// Windows se niega a detener un servicio mientras algo que cuelga de él siga corriendo, y contesta
/// `ERROR_DEPENDENT_SERVICES_RUNNING` sin haber tocado nada. Los dependientes ya parados no
/// estorban, y listarlos sería asustar con lo que no pasa.
///
/// Que esto se lea **antes** de ofrecer el botón es el punto entero: el usuario ve que detener
/// `MSSQL$SQLEXPRESS` no va a poder ser mientras `SQLAgent$SQLEXPRESS` esté vivo, en vez de
/// enterarse por un error después de haber pasado por un UAC.
pub fn dependents(name: &str) -> Vec<ServiceDependent> {
    let Ok(scm) = abrir_scm(SC_MANAGER_CONNECT) else {
        return Vec::new();
    };
    let Ok(servicio) = abrir_servicio(&scm, name, SERVICE_ENUMERATE_DEPENDENTS) else {
        return Vec::new();
    };

    // Primera llamada en vacío, solo para que diga cuánto sitio hace falta.
    let mut bytes = 0u32;
    let mut contados = 0u32;
    let _ = unsafe {
        EnumDependentServicesW(servicio.0, SERVICE_ACTIVE, None, 0, &mut bytes, &mut contados)
    };

    if bytes == 0 {
        return Vec::new();
    }

    // Mismo motivo de alineación que en `enumerar`: el SCM escribe structs con punteros dentro.
    let cabidas = bytes as usize / size_of::<ENUM_SERVICE_STATUSW>() + 1;
    let mut buffer: Vec<ENUM_SERVICE_STATUSW> = Vec::with_capacity(cabidas);

    let ok = unsafe {
        EnumDependentServicesW(
            servicio.0,
            SERVICE_ACTIVE,
            Some(buffer.as_mut_ptr()),
            (cabidas * size_of::<ENUM_SERVICE_STATUSW>()) as u32,
            &mut bytes,
            &mut contados,
        )
    };
    if ok.is_err() {
        return Vec::new();
    }
    unsafe { buffer.set_len(contados as usize) };

    buffer
        .iter()
        .map(|e| {
            // Los nombres apuntan **dentro del buffer**: se copian ahora, no después.
            let name = unsafe { e.lpServiceName.to_string() }.unwrap_or_default();
            let display_name = unsafe { e.lpDisplayName.to_string() }.unwrap_or_default();
            ServiceDependent { name, display_name }
        })
        .filter(|d| !d.name.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIN_EXTRAS: &[String] = &[];

    /// **La prueba obligatoria de este módulo es la negativa.**
    ///
    /// `GameInputRedistService` no es un invento: apareció al explorar la idea, filtrando los
    /// servicios del equipo con un `-match` que incluía `Redis`. «Redist» contiene «Redis». Un
    /// panel que en la fase B ofrecerá **detener** lo que lista no puede colar el mando de una
    /// consola entre las bases de datos.
    #[test]
    fn no_cuela_servicios_que_solo_se_parecen() {
        assert_eq!(classify_service("GameInputRedistService", SIN_EXTRAS), None);

        // Otros parecidos por subcadena, que es la forma fácil y equivocada de hacer esto.
        for ajeno in [
            "RedistributableService",
            "MySQLRouter",
            "DockerHelperThing",
            "PostgresqlBackupTool",
            "MSSQLSERVERHelper",
            "NotSQLBrowser",
            "W3SVCMonitor",
            "MongoDBCompassUpdater",
        ] {
            assert_eq!(
                classify_service(ajeno, SIN_EXTRAS),
                None,
                "«{ajeno}» no debería contar como servicio de desarrollo"
            );
        }
    }

    /// Y los del sistema, que son los que de verdad no se pueden tocar.
    #[test]
    fn no_cuela_ningun_servicio_del_sistema() {
        for sistema in [
            "Winmgmt", "Spooler", "wuauserv", "Dhcp", "Dnscache", "EventLog", "LanmanServer",
            "RpcSs", "Schedule", "Themes", "AudioSrv", "BITS", "CryptSvc", "TrustedInstaller",
        ] {
            assert_eq!(
                classify_service(sistema, SIN_EXTRAS),
                None,
                "«{sistema}» es del sistema y no puede entrar en la lista"
            );
        }
    }

    /// Los que sí, incluidos los nombres reales del equipo donde se diseñó esto.
    #[test]
    fn reconoce_los_servicios_de_desarrollo() {
        let esperado = [
            ("MSSQL$SQLEXPRESS", ServiceFamily::SqlServer),
            ("MSSQLSERVER", ServiceFamily::SqlServer),
            ("SQLAgent$SQLEXPRESS", ServiceFamily::SqlServer),
            ("SQLBrowser", ServiceFamily::SqlServer),
            ("SQLWriter", ServiceFamily::SqlServer),
            ("MSSQLFDLauncher$SQLEXPRESS", ServiceFamily::SqlServer),
            ("SQLTELEMETRY$SQLEXPRESS", ServiceFamily::SqlServer),
            ("postgresql-x64-17", ServiceFamily::Postgres),
            ("postgresql-x64-18", ServiceFamily::Postgres),
            ("MySQL80", ServiceFamily::MySql),
            ("MySQL", ServiceFamily::MySql),
            ("MongoDB", ServiceFamily::MongoDb),
            ("Redis", ServiceFamily::Redis),
            ("com.docker.service", ServiceFamily::Docker),
            ("W3SVC", ServiceFamily::Iis),
        ];

        for (nombre, familia) in esperado {
            assert_eq!(
                classify_service(nombre, SIN_EXTRAS),
                Some(familia),
                "«{nombre}» debería reconocerse"
            );
        }
    }

    /// El nombre del SCM no distingue mayúsculas, así que la comparación tampoco.
    #[test]
    fn no_distingue_mayusculas() {
        assert_eq!(
            classify_service("mssql$sqlexpress", SIN_EXTRAS),
            Some(ServiceFamily::SqlServer)
        );
        assert_eq!(
            classify_service("POSTGRESQL-X64-17", SIN_EXTRAS),
            Some(ServiceFamily::Postgres)
        );
    }

    /// Lo que añade el usuario entra **exacto**, y nada más.
    #[test]
    fn los_nombres_del_usuario_se_comparan_exactos() {
        let custom = vec!["MiServicioRaro".to_string(), " elastic ".to_string()];

        assert_eq!(
            classify_service("MiServicioRaro", &custom),
            Some(ServiceFamily::Other)
        );
        // Con espacios alrededor en los ajustes: se recortan, como en los procesos vigilados.
        assert_eq!(classify_service("elastic", &custom), Some(ServiceFamily::Other));
        // Pero no por parecido: añadir «elastic» no arrastra todo lo que lo contenga.
        assert_eq!(classify_service("elasticsearch-service-x64", &custom), None);
        assert_eq!(classify_service("MiServicioRaroDeVerdad", &custom), None);
    }

    /// Una instancia sin nombre detrás del `$` no es una instancia.
    #[test]
    fn el_dolar_solo_no_basta() {
        assert_eq!(classify_service("MSSQL$", SIN_EXTRAS), None);
        assert_eq!(classify_service("MSSQL", SIN_EXTRAS), None);
    }

    /// El árbol recoge a los nietos y **no se cuelga con un ciclo**, que es lo que pasaría si la
    /// tabla de padres tuviera un PID reciclado apuntando hacia arriba.
    #[test]
    fn el_arbol_recoge_a_los_descendientes_sin_colgarse() {
        let hijos = HashMap::from([(1, vec![2, 3]), (2, vec![4]), (4, vec![1])]);

        let mut arbol = arbol_de(1, &hijos);
        arbol.sort_unstable();
        assert_eq!(arbol, vec![1, 2, 3, 4]);
    }

    /// La RAM que no se puede leer es `None`, **nunca cero**.
    ///
    /// Un «0 MB» junto a un SQL Server corriendo es una cifra que el usuario se cree, y es falsa.
    /// Este es el caso real: los servicios corren con otra cuenta y un proceso sin elevar no puede
    /// abrirlos para preguntarles la memoria.
    #[test]
    fn la_ram_que_no_se_puede_leer_no_se_inventa() {
        let sys = System::new();

        // Un árbol de PIDs que no existen: nada que sumar, y por tanto nada que decir.
        assert_eq!(ram_del_arbol(&sys, &[u32::MAX, u32::MAX - 1]), None);
        // Un servicio parado no tiene árbol siquiera.
        assert_eq!(ram_del_arbol(&sys, &[]), None);
    }

    /// Un servicio parado no tiene árbol que recorrer.
    #[test]
    fn un_pid_sin_hijos_es_el_solo() {
        assert_eq!(arbol_de(42, &HashMap::new()), vec![42]);
    }

    /// Enseña la lista tal como la vería el usuario, para poder mirarla con los ojos.
    ///
    /// `#[ignore]` y **imprime en vez de afirmar**, con el mismo criterio que las mediciones de
    /// T4-03: lo que hay aquí depende de qué tenga instalado el equipo, así que una aserción sería
    /// una prueba que falla en la máquina de al lado. Se corre a mano:
    ///
    /// ```text
    /// cargo test --lib services::tests::asi_se_ve -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore]
    fn asi_se_ve_la_lista_en_este_equipo() {
        let mut sys = System::new();
        let lista = collect_services(&mut sys, &[]);

        println!("
{} servicios de desarrollo
", lista.len());
        println!(
            "{:<28} {:<9} {:<18} {:>8}  PUERTOS",
            "SERVICIO", "ESTADO", "ARRANQUE", "RAM"
        );
        for s in &lista {
            let puertos = if s.ports.is_empty() {
                "-".to_string()
            } else {
                s.ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(", ")
            };
            let ram = match s.memory_mb {
                Some(mb) => format!("{mb:.0} MB"),
                None => "—".to_string(),
            };
            println!(
                "{:<28} {:<9} {:<18} {:>8}  {}",
                s.name,
                format!("{:?}", s.state),
                format!("{:?}", s.start_type),
                ram,
                puertos
            );
        }
    }

    /// Lee los servicios reales del equipo. No toca ninguno: este módulo, en la fase A, **no sabe**
    /// arrancarlos ni detenerlos.
    #[test]
    fn lee_los_servicios_reales_del_sistema() {
        let crudos = enumerar().expect("el SCM debería dejarse enumerar sin privilegios");

        // Cualquier Windows tiene cientos de servicios; si salen cero, la lectura no funcionó.
        assert!(crudos.len() > 20, "solo {} servicios", crudos.len());
        assert!(
            crudos.iter().all(|s| !s.name.is_empty()),
            "algún servicio salió sin nombre"
        );

        // Y al menos uno tiene que traer su tipo de arranque de verdad: si TODOS salieran
        // `Unknown`, la consulta de configuración estaría rota y la columna se pintaría vacía sin
        // que nada fallara.
        assert!(
            crudos.iter().any(|s| s.start_type != StartType::Unknown),
            "ningún servicio devolvió su tipo de arranque"
        );
    }
}
