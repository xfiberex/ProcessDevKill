//! Lectura y cierre de los procesos de desarrollo vigilados.

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

    /// Los que tienen accion propia en el menu de la bandeja.
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

pub fn pids_of_runtime(sys: &mut System, custom: &[String], runtime: Runtime) -> Vec<u32> {
    collect_processes(sys, custom)
        .into_iter()
        .filter(|p| p.runtime == runtime)
        .map(|p| p.pid)
        .collect()
}

/// Termina un unico proceso vigilado. Devuelve su nombre y los puertos liberados.
pub fn kill_one(sys: &mut System, custom: &[String], pid: u32) -> Result<(String, Vec<u16>), String> {
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

    // Hay que leer los puertos *antes* de matarlo: despues el socket ya no existe.
    let ports = listening_ports().remove(&pid).unwrap_or_default();

    if process.kill() {
        Ok((name, ports))
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
    #[test]
    fn selecciona_solo_los_pids_del_runtime_pedido() {
        let mut sys = new_system();
        let todos = collect_processes(&mut sys, SIN_EXTRAS);

        for runtime in Runtime::BUILT_INS {
            let elegidos = pids_of_runtime(&mut sys, SIN_EXTRAS, runtime);
            let esperados: Vec<u32> = todos
                .iter()
                .filter(|p| p.runtime == runtime)
                .map(|p| p.pid)
                .collect();

            assert_eq!(
                elegidos.len(),
                esperados.len(),
                "{} devolvio {} PIDs y se esperaban {}",
                runtime.label(),
                elegidos.len(),
                esperados.len()
            );
            for pid in &elegidos {
                assert!(
                    esperados.contains(pid),
                    "{} incluyo el PID {pid}, que no es suyo",
                    runtime.label()
                );
            }
        }
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
            assert!(p.cpu >= 0.0 && p.cpu <= 100.0, "CPU fuera de rango: {}", p.cpu);
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
