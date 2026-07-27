//! Lectura y cierre de los procesos de desarrollo vigilados.

use std::collections::HashMap;

use serde::Serialize;
use sysinfo::{CpuRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

use crate::ports::listening_ports;

/// Runtimes que la app vigila. `Other` agrupa los nombres que añade el usuario.
#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Runtime {
    Node,
    Python,
    Dotnet,
    Other,
}

impl Runtime {
    pub fn label(self) -> &'static str {
        match self {
            Runtime::Node => "Node",
            Runtime::Python => "Python",
            Runtime::Dotnet => ".NET",
            Runtime::Other => "otros",
        }
    }

    /// Los que tienen accion propia en el menu de la bandeja. El menu los nombra
    /// uno a uno (cada uno con su etiqueta), asi que fuera de los tests nadie
    /// recorre la lista; de ahi el `cfg(test)`.
    #[cfg(test)]
    pub const BUILT_INS: [Runtime; 3] = [Runtime::Node, Runtime::Python, Runtime::Dotnet];
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub runtime: Runtime,
    pub cpu: f32,
    pub memory_mb: f64,
    pub run_time_secs: u64,
    /// Puertos TCP en los que el proceso esta escuchando, ordenados.
    pub ports: Vec<u16>,
    /// Segundos que lleva seguidos sin actividad de CPU. 0 si acaba de moverse o
    /// si el Zombie Finder esta apagado.
    pub idle_secs: u64,
    /// Ocioso desde hace mas del tiempo configurado y **ademas** ocupando un
    /// puerto. Lo decide Rust y la UI solo lo pinta.
    pub zombie: bool,
}

/// Que paso con cada PID de un intento de cierre en lote.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KillOutcome {
    pub pid: u32,
    pub killed: bool,
    pub error: Option<String>,
    pub freed_ports: Vec<u16>,
    /// Nombre del ejecutable, para poder registrarlo en el historial.
    pub name: String,
}

/// Clasifica un ejecutable por su nombre; `None` si no esta vigilado.
///
/// Compara sin extension y en minusculas para que el mismo codigo sirva en
/// Windows (`node.exe`) y en Unix (`node`). Para los runtimes integrados exige
/// coincidencia exacta o sufijo de version (`python3.11`), de forma que binarios
/// como `nodemon` no cuenten como Node.
///
/// `custom` son los nombres que añade el usuario, ya normalizados; ahi la
/// comparacion es exacta porque el usuario escribe el nombre que quiere vigilar.
pub fn classify(file_name: &str, custom: &[String]) -> Option<Runtime> {
    let lower = file_name.to_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);

    let built_in = match stem {
        "node" | "nodejs" => Some(Runtime::Node),
        "dotnet" => Some(Runtime::Dotnet),
        "python" | "pythonw" => Some(Runtime::Python),
        _ => stem
            .strip_prefix("python")
            .filter(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit() || c == '.'))
            .map(|_| Runtime::Python),
    };
    if built_in.is_some() {
        return built_in;
    }

    custom
        .iter()
        .any(|name| name == stem)
        .then_some(Runtime::Other)
}

/// Crea el `System` de la app **con la lista de CPUs poblada**.
///
/// No es opcional: sysinfo calcula el uso de CPU de cada proceso multiplicando
/// por `self.cpus.len()`, asi que con un `System::new()` pelado esa lista queda
/// vacia y `cpu_usage()` devuelve 0 para absolutamente todos los procesos.
/// `CpuRefreshKind::nothing()` enumera los nucleos sin pagar la consulta PDH,
/// que es lenta de abrir la primera vez.
pub fn new_system() -> System {
    System::new_with_specifics(RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing()))
}

/// Refresca `sys` y devuelve los procesos vigilados, del que mas RAM consume al
/// que menos.
pub fn collect_processes(sys: &mut System, custom: &[String]) -> Vec<ProcessInfo> {
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    // sysinfo devuelve 100 por nucleo saturado (400 si un proceso ocupa 4 hilos).
    // Dividir entre los nucleos deja un 0-100 con la misma lectura que el
    // Administrador de tareas: porcentaje de la capacidad total del equipo.
    let cores = sys.cpus().len().max(1) as f32;
    let mut ports = listening_ports();

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .filter_map(|p| {
            let name = p.name().to_string_lossy().into_owned();
            let runtime = classify(&name, custom)?;
            let pid = p.pid().as_u32();

            Some(ProcessInfo {
                pid,
                name,
                runtime,
                cpu: p.cpu_usage() / cores,
                memory_mb: p.memory() as f64 / 1_048_576.0,
                run_time_secs: p.run_time(),
                ports: ports.remove(&pid).unwrap_or_default(),
                // Los rellena `ZombieWatch`, que es quien tiene memoria de los
                // refrescos anteriores; aqui cada lectura es una foto sin pasado.
                idle_secs: 0,
                zombie: false,
            })
        })
        .collect();

    processes.sort_by(|a, b| b.memory_mb.total_cmp(&a.memory_mb));
    processes
}

/// Toma las muestras previas que sysinfo necesita para que `cpu_usage()` sea real.
///
/// Hacen falta **tres** lecturas de un proceso, no dos: en la primera sysinfo sale
/// por un early-return sin guardar lineas base, y la segunda las compara contra
/// cero, devolviendo valores ridiculos (medido: 0.0004 % para un proceso que
/// saturaba un nucleo entero). Solo la tercera da el porcentaje correcto.
///
/// Esto solo cubre los procesos vivos al arrancar. Uno que aparezca despues
/// mostrara 0 % durante sus dos primeros refrescos y se corregira solo.
pub fn warm_up_cpu(sys: &mut System, custom: &[String]) {
    for _ in 0..2 {
        collect_processes(sys, custom);
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}

/// Los procesos de la lista que se pasan del umbral de RAM, en MB.
///
/// Funcion aparte, y pura, a proposito: es la que decide a quien mata el Auto-Kill
/// sin preguntar a nadie. Un `>=` de mas aqui cerraria procesos que estan justo en
/// el limite, asi que conviene poder probarla sin montar una `App` ni el sistema.
/// La comparacion es **estricta**: el umbral hay que superarlo, no alcanzarlo.
pub fn over_memory_limit(list: &[ProcessInfo], limit_mb: u64) -> Vec<&ProcessInfo> {
    list.iter()
        .filter(|p| p.memory_mb > limit_mb as f64)
        .collect()
}

/// Por debajo de este porcentaje se considera que un proceso no esta haciendo
/// nada. No se compara contra 0 exacto: un servidor parado sigue despertando por
/// sus temporizadores y el recolector de basura, y marca decimas sueltas.
pub const ZOMBIE_CPU_MAX: f32 = 0.5;

/// Memoria de los refrescos anteriores para saber cuanto lleva parado cada proceso.
///
/// Hace falta porque `collect_processes` devuelve una foto sin pasado: con una sola
/// lectura no hay forma de distinguir el proceso que lleva diez minutos muerto de
/// aburrimiento del que acaba de terminar una compilacion.
#[derive(Default)]
pub struct ZombieWatch {
    /// PID -> epoch en ms en que empezo la racha sin CPU.
    idle_since: HashMap<u32, u64>,
}

impl ZombieWatch {
    /// Actualiza el seguimiento con la lista recien leida y marca los zombis.
    ///
    /// `minutes` a `None` apaga la funcion: se olvida lo seguido hasta ahora, de
    /// modo que al reactivarla las rachas empiezan de cero. Es lo honesto, porque
    /// mientras estuvo apagada nadie miraba.
    ///
    /// Un proceso solo es zombi si ademas **ocupa algun puerto**: sin esa
    /// condicion casi cualquier proceso de desarrollo en reposo marca 0 % de CPU y
    /// la tabla entera acabaria resaltada, que es lo mismo que no resaltar nada.
    pub fn track(&mut self, list: &mut [ProcessInfo], now_ms: u64, minutes: Option<u64>) {
        // Se parte siempre de "no es zombi". La marca es un dato calculado, no
        // acumulado: si la lista llega con una marca de la pasada anterior y el
        // proceso ya se ha movido, dejarla puesta seria mentir.
        for p in list.iter_mut() {
            p.idle_secs = 0;
            p.zombie = false;
        }

        let Some(minutes) = minutes else {
            self.idle_since.clear();
            return;
        };

        // Olvidar los PIDs que ya no estan, o el mapa creceria sin fin en una app
        // que vive en la bandeja durante dias.
        let vivos: Vec<u32> = list.iter().map(|p| p.pid).collect();
        self.idle_since.retain(|pid, _| vivos.contains(pid));

        let umbral_secs = minutes.saturating_mul(60);

        for p in list.iter_mut() {
            if p.cpu > ZOMBIE_CPU_MAX {
                // Se ha movido: la racha se rompe.
                self.idle_since.remove(&p.pid);
                continue;
            }

            let desde = *self.idle_since.entry(p.pid).or_insert(now_ms);
            p.idle_secs = now_ms.saturating_sub(desde) / 1000;
            p.zombie = p.idle_secs >= umbral_secs && !p.ports.is_empty();
        }
    }
}

pub fn pids_of_runtime(sys: &mut System, custom: &[String], runtime: Runtime) -> Vec<u32> {
    collect_processes(sys, custom)
        .into_iter()
        .filter(|p| p.runtime == runtime)
        .map(|p| p.pid)
        .collect()
}

/// Termina varios procesos vigilados y cuenta que paso con cada uno.
///
/// **La tabla de sockets se lee una sola vez para todo el lote.** Antes cada
/// `kill_one` la enumeraba por su cuenta, asi que un "Nuke All" de quince procesos
/// recorria todos los sockets del sistema quince veces. Leerlos antes de matar
/// sigue siendo obligatorio —despues el socket ya no existe—, lo que sobraba era
/// repetir la lectura.
///
/// De paso queda mas correcto: la foto de puertos se toma con todos los procesos
/// del lote todavia vivos, en vez de irse degradando conforme caen.
pub fn kill_many(sys: &mut System, custom: &[String], pids: Vec<u32>) -> Vec<KillOutcome> {
    let mut ports = listening_ports();

    pids.into_iter()
        .map(|pid| match kill_one(sys, custom, pid, &mut ports) {
            Ok((name, freed_ports)) => KillOutcome {
                pid,
                killed: true,
                error: None,
                freed_ports,
                name,
            },
            Err(error) => KillOutcome {
                pid,
                killed: false,
                error: Some(error),
                freed_ports: Vec::new(),
                name: String::new(),
            },
        })
        .collect()
}

/// Termina un unico proceso vigilado. Devuelve su nombre y los puertos liberados.
///
/// `ports` es el mapa PID -> puertos ya leido por [`kill_many`]; se saca de el la
/// entrada de este PID. Recibirlo en vez de leerlo aqui es lo que evita enumerar
/// los sockets una vez por proceso.
fn kill_one(
    sys: &mut System,
    custom: &[String],
    pid: u32,
    ports: &mut HashMap<u32, Vec<u16>>,
) -> Result<(String, Vec<u16>), String> {
    let target = Pid::from_u32(pid);

    // Releer solo este PID antes de matarlo: si el sistema lo reciclo desde el
    // ultimo refresco, el nombre ya no coincidira y la guardia de abajo corta.
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[target]),
        true,
        ProcessRefreshKind::nothing(),
    );

    let process = sys
        .process(target)
        .ok_or_else(|| format!("El proceso {pid} ya no existe"))?;
    let name = process.name().to_string_lossy().into_owned();

    // El frontend solo deberia enviar PIDs de la lista, pero un comando de Tauri
    // acepta cualquier entrada: sin esta guardia seria un "mata lo que quieras".
    if classify(&name, custom).is_none() {
        return Err(format!("{name} no es un proceso de desarrollo vigilado"));
    }

    // Los puertos ya venian leidos de antes de empezar el lote, que es cuando
    // habia que leerlos: una vez muerto el proceso, su socket ya no existe.
    let freed = ports.remove(&pid).unwrap_or_default();

    if process.kill() {
        Ok((name, freed))
    } else {
        Err(format!("No se pudo terminar {name} (PID {pid})"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIN_EXTRAS: &[String] = &[];

    #[test]
    fn clasifica_ejecutables_de_windows_y_unix() {
        assert_eq!(classify("node.exe", SIN_EXTRAS), Some(Runtime::Node));
        assert_eq!(classify("node", SIN_EXTRAS), Some(Runtime::Node));
        assert_eq!(classify("Python.EXE", SIN_EXTRAS), Some(Runtime::Python));
        assert_eq!(classify("python3", SIN_EXTRAS), Some(Runtime::Python));
        assert_eq!(classify("python3.11", SIN_EXTRAS), Some(Runtime::Python));
        assert_eq!(classify("dotnet.exe", SIN_EXTRAS), Some(Runtime::Dotnet));
    }

    #[test]
    fn ignora_binarios_que_solo_comparten_prefijo() {
        assert_eq!(classify("nodemon.exe", SIN_EXTRAS), None);
        assert_eq!(classify("pythonista", SIN_EXTRAS), None);
        assert_eq!(classify("explorer.exe", SIN_EXTRAS), None);
        assert_eq!(classify("", SIN_EXTRAS), None);
    }

    #[test]
    fn reconoce_los_nombres_que_añade_el_usuario() {
        let custom = vec!["docker".to_string(), "go".to_string()];

        assert_eq!(classify("docker.exe", &custom), Some(Runtime::Other));
        assert_eq!(classify("GO.EXE", &custom), Some(Runtime::Other));
        // Los integrados mandan sobre la lista del usuario.
        assert_eq!(classify("node.exe", &custom), Some(Runtime::Node));
        // Exacto, no por prefijo: "golang" no es "go".
        assert_eq!(classify("golang.exe", &custom), None);
        assert_eq!(classify("dockerd.exe", &custom), None);
    }

    /// El menu de la bandeja ofrece "Cerrar todos los Node/Python/.NET". Si esa
    /// seleccion se equivocara, el usuario mataria procesos que no pidio y sin
    /// ventana abierta para verlo venir, asi que se comprueba que cada runtime
    /// solo devuelve los suyos.
    ///
    /// ⚠️ **Se comprueba el criterio negativo —que no cuele un PID ajeno— y no que
    /// los conteos cuadren.** La version anterior tomaba dos fotos del sistema y
    /// exigia que fueran identicas, cosa que en una maquina de desarrollo no se
    /// sostiene: los procesos van y vienen entre una lectura y la siguiente. Fallo
    /// de verdad (15 contra 13) en cuanto otro test empezo a lanzar servidores node
    /// en paralelo, y ya era fragil antes por el node de
    /// `reporta_cpu_de_un_proceso_ocupado`. Lo que importa aqui es a quien NO se
    /// mata, que es ademas la regla de la casa para todo lo que cierra procesos.
    #[test]
    fn selecciona_solo_los_pids_del_runtime_pedido() {
        let mut sys = new_system();

        for runtime in Runtime::BUILT_INS {
            let elegidos = pids_of_runtime(&mut sys, SIN_EXTRAS, runtime);
            // Foto inmediatamente posterior con la que contrastar.
            let ahora = collect_processes(&mut sys, SIN_EXTRAS);

            for pid in &elegidos {
                match ahora.iter().find(|p| p.pid == *pid) {
                    Some(p) => assert_eq!(
                        p.runtime,
                        runtime,
                        "{} incluyo el PID {pid}, que es de {}",
                        runtime.label(),
                        p.runtime.label()
                    ),
                    // Murio entre las dos lecturas. No demuestra nada malo: lo que
                    // no puede pasar es devolver un PID vivo de otro runtime.
                    None => continue,
                }
            }
        }
    }

    /// El Auto-Kill cierra sin confirmacion, asi que su criterio se prueba con
    /// numeros exactos: quien esta justo en el umbral **no** muere, y quien no
    /// llega tampoco. Un `>=` por descuido aqui cerraria procesos sanos.
    #[test]
    fn el_auto_kill_solo_elige_a_quien_pasa_del_umbral() {
        fn falso(pid: u32, memory_mb: f64) -> ProcessInfo {
            ProcessInfo {
                pid,
                name: "node.exe".into(),
                runtime: Runtime::Node,
                cpu: 0.0,
                memory_mb,
                run_time_secs: 0,
                ports: Vec::new(),
                idle_secs: 0,
                zombie: false,
            }
        }

        let lista = vec![
            falso(1, 2048.5), // pasado
            falso(2, 2048.0), // justo en el limite
            falso(3, 300.0),  // muy por debajo
            falso(4, 9000.0), // pasadisimo
        ];

        let elegidos: Vec<u32> = over_memory_limit(&lista, 2048)
            .iter()
            .map(|p| p.pid)
            .collect();
        assert_eq!(elegidos, vec![1, 4]);

        // Sin nadie por encima, no se toca a nadie.
        assert!(over_memory_limit(&lista, 16_384).is_empty());
    }

    /// Proceso de mentira para los tests del Zombie Finder.
    fn parado(pid: u32, cpu: f32, ports: Vec<u16>) -> ProcessInfo {
        ProcessInfo {
            pid,
            name: "node.exe".into(),
            runtime: Runtime::Node,
            cpu,
            memory_mb: 300.0,
            run_time_secs: 3600,
            ports,
            idle_secs: 0,
            zombie: false,
        }
    }

    const MINUTO: u64 = 60_000;

    #[test]
    fn marca_zombi_solo_tras_el_tiempo_configurado() {
        let mut watch = ZombieWatch::default();
        let mut lista = vec![parado(1, 0.0, vec![3000])];

        watch.track(&mut lista, 0, Some(10));
        assert_eq!(lista[0].idle_secs, 0);
        assert!(!lista[0].zombie, "acaba de empezar la racha");

        watch.track(&mut lista, 9 * MINUTO, Some(10));
        assert_eq!(lista[0].idle_secs, 540);
        assert!(!lista[0].zombie, "aun no llega al umbral");

        watch.track(&mut lista, 10 * MINUTO, Some(10));
        assert!(lista[0].zombie, "10 minutos parado y con el puerto ocupado");
    }

    #[test]
    fn moverse_rompe_la_racha() {
        let mut watch = ZombieWatch::default();
        let mut lista = vec![parado(1, 0.0, vec![3000])];

        watch.track(&mut lista, 0, Some(5));
        watch.track(&mut lista, 10 * MINUTO, Some(5));
        assert!(lista[0].zombie);

        // Vuelve a trabajar: deja de ser zombi al instante.
        lista[0].cpu = 12.0;
        watch.track(&mut lista, 11 * MINUTO, Some(5));
        assert!(!lista[0].zombie);

        // Y cuando se para otra vez, la cuenta arranca de cero.
        lista[0].cpu = 0.0;
        watch.track(&mut lista, 12 * MINUTO, Some(5));
        assert_eq!(lista[0].idle_secs, 0);
        assert!(!lista[0].zombie);
    }

    /// Sin esta condicion la funcion no sirve de nada: casi todo proceso de
    /// desarrollo en reposo marca 0 % de CPU, asi que la tabla entera saldria
    /// resaltada y el aviso dejaria de significar algo.
    #[test]
    fn un_proceso_parado_sin_puerto_no_es_zombi() {
        let mut watch = ZombieWatch::default();
        let mut lista = vec![parado(1, 0.0, vec![])];

        watch.track(&mut lista, 0, Some(1));
        watch.track(&mut lista, 60 * MINUTO, Some(1));

        assert_eq!(lista[0].idle_secs, 3600, "el tiempo si se cuenta");
        assert!(!lista[0].zombie, "pero sin puerto no molesta a nadie");
    }

    #[test]
    fn apagado_no_marca_nada_y_olvida_las_rachas() {
        let mut watch = ZombieWatch::default();
        let mut lista = vec![parado(1, 0.0, vec![3000])];

        watch.track(&mut lista, 0, Some(5));
        watch.track(&mut lista, 30 * MINUTO, None);
        assert!(!lista[0].zombie);
        assert_eq!(lista[0].idle_secs, 0);

        // Al reactivarlo, la racha empieza de nuevo: mientras estuvo apagado no
        // habia nadie mirando y contar ese rato seria inventarselo.
        watch.track(&mut lista, 31 * MINUTO, Some(5));
        assert_eq!(lista[0].idle_secs, 0);
    }

    /// La app vive dias en la bandeja: si el seguimiento no soltara los PIDs
    /// muertos, el mapa creceria sin fin y un PID reciclado por Windows heredaria
    /// la racha del proceso anterior.
    #[test]
    fn olvida_los_pids_que_desaparecen() {
        let mut watch = ZombieWatch::default();
        let mut lista = vec![parado(1, 0.0, vec![3000])];
        watch.track(&mut lista, 0, Some(5));

        let mut sin_el = vec![parado(2, 0.0, vec![4000])];
        watch.track(&mut sin_el, 10 * MINUTO, Some(5));

        // El 1 vuelve (mismo PID, proceso nuevo): no debe heredar nada.
        let mut vuelve = vec![parado(1, 0.0, vec![3000])];
        watch.track(&mut vuelve, 20 * MINUTO, Some(5));
        assert_eq!(vuelve[0].idle_secs, 0);
        assert!(!vuelve[0].zombie);
    }

    /// El riesgo de leer los puertos una sola vez por lote es **cruzarlos**: que el
    /// puerto de un proceso acabe apuntado en el resultado de otro, o que se pierda.
    /// Y eso no se ve en la UI —el numero sale igual de plausible—, solo en el
    /// historial, cuando ya no hay forma de saber que era verdad.
    ///
    /// Se prueba con dos servidores de verdad, cada uno en su puerto, matados en el
    /// mismo lote. Los lanza el propio test y solo mata esos dos.
    #[test]
    fn un_lote_no_cruza_los_puertos_de_cada_proceso() {
        const A: u16 = 45871;
        const B: u16 = 45872;

        fn servidor(puerto: u16) -> Option<std::process::Child> {
            std::process::Command::new("node")
                .arg("-e")
                .arg(format!("require('net').createServer().listen({puerto})"))
                .spawn()
                .ok()
        }

        let (Some(mut uno), Some(mut dos)) = (servidor(A), servidor(B)) else {
            println!("sin node instalado: no hay nada que comprobar");
            return;
        };
        let (pid_uno, pid_dos) = (uno.id(), dos.id());

        // Esperar a que los dos esten escuchando de verdad.
        let mut listos = false;
        for _ in 0..50 {
            let mapa = listening_ports();
            if mapa.get(&pid_uno).is_some_and(|p| p.contains(&A))
                && mapa.get(&pid_dos).is_some_and(|p| p.contains(&B))
            {
                listos = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        if !listos {
            // Puertos ocupados u otro estorbo del entorno: se limpia y se sale sin
            // dar un fallo que no es del codigo.
            let _ = uno.kill();
            let _ = dos.kill();
            let _ = uno.wait();
            let _ = dos.wait();
            println!("los servidores de prueba no llegaron a escuchar; se omite");
            return;
        }

        let mut sys = new_system();
        let outcomes = kill_many(&mut sys, SIN_EXTRAS, vec![pid_uno, pid_dos]);

        // Recoger a los hijos pase lo que pase, antes de cualquier asercion.
        let _ = uno.wait();
        let _ = dos.wait();

        assert_eq!(outcomes.len(), 2);
        let de = |pid: u32| {
            outcomes
                .iter()
                .find(|o| o.pid == pid)
                .unwrap_or_else(|| panic!("falta el resultado del PID {pid}"))
        };

        assert!(de(pid_uno).killed, "no se pudo cerrar el primero");
        assert!(de(pid_dos).killed, "no se pudo cerrar el segundo");

        // Cada uno con SU puerto, y sin el del otro: es lo que se romperia al
        // compartir el mapa entre las dos llamadas.
        assert!(
            de(pid_uno).freed_ports.contains(&A),
            "el primero deberia liberar el {A}, y trajo {:?}",
            de(pid_uno).freed_ports
        );
        assert!(
            !de(pid_uno).freed_ports.contains(&B),
            "el primero se quedo con el puerto del segundo"
        );
        assert!(
            de(pid_dos).freed_ports.contains(&B),
            "el segundo deberia liberar el {B}, y trajo {:?}",
            de(pid_dos).freed_ports
        );
        assert!(
            !de(pid_dos).freed_ports.contains(&A),
            "el segundo se quedo con el puerto del primero"
        );
    }

    #[test]
    fn lee_procesos_reales_del_sistema() {
        let mut sys = new_system();
        warm_up_cpu(&mut sys, SIN_EXTRAS);
        let processes = collect_processes(&mut sys, SIN_EXTRAS);

        println!("Encontrados {} procesos de desarrollo:", processes.len());
        for p in &processes {
            println!(
                "  [{:>6}] {:<14} {:>6.1}% CPU  {:>7.0} MB  puertos {:?}",
                p.pid, p.name, p.cpu, p.memory_mb, p.ports
            );
        }

        for p in &processes {
            assert!(p.pid > 0, "PID invalido");
            assert!(!p.name.is_empty(), "nombre vacio");
            assert!(p.memory_mb > 0.0, "{} sin memoria residente", p.name);
            assert!(
                p.cpu >= 0.0 && p.cpu <= 100.0,
                "CPU fuera de rango: {}",
                p.cpu
            );
        }

        for pair in processes.windows(2) {
            assert!(
                pair[0].memory_mb >= pair[1].memory_mb,
                "la lista no viene ordenada por memoria descendente"
            );
        }
    }

    /// Regresion de un bug real: con `System::new()` la lista de CPUs queda vacia,
    /// sysinfo multiplica por 0 nucleos y **todos** los procesos reportan 0 % de
    /// CPU. Los tests anteriores no lo cazaban porque los procesos de la maquina
    /// estaban ociosos y 0 % era una respuesta plausible.
    #[test]
    fn reporta_cpu_de_un_proceso_ocupado() {
        let mut child = match std::process::Command::new("node")
            .arg("-e")
            .arg("const fin=Date.now()+4000;let a=0;while(Date.now()<fin){a+=Math.sqrt(a)}")
            .spawn()
        {
            Ok(child) => child,
            Err(_) => return, // Sin node instalado no hay nada que comprobar.
        };

        let mut sys = new_system();
        warm_up_cpu(&mut sys, SIN_EXTRAS);
        let processes = collect_processes(&mut sys, SIN_EXTRAS);

        let busy = processes.iter().find(|p| p.pid == child.id()).cloned();
        let _ = child.kill();
        let _ = child.wait();

        let busy = busy.expect("el proceso node de prueba deberia salir en la lista");
        println!(
            "proceso ocupado: {:.2} % CPU ({} nucleos)",
            busy.cpu,
            sys.cpus().len()
        );

        // Un nucleo saturado son 100/nucleos: 6.25 % con 16, 1.6 % con 64. El
        // umbral de 1 % aguanta cualquier equipo razonable sin dar falsos fallos.
        assert!(
            busy.cpu > 1.0,
            "un proceso quemando un nucleo entero reporto {} %",
            busy.cpu
        );
    }
}
