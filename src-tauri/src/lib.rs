use std::sync::Mutex;

use serde::Serialize;
use sysinfo::{CpuRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
use tauri::{Manager, State};

/// Runtimes de desarrollo que la app vigila.
#[derive(Serialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Runtime {
    Node,
    Python,
    Dotnet,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProcessInfo {
    pid: u32,
    name: String,
    runtime: Runtime,
    cpu: f32,
    memory_mb: f64,
    run_time_secs: u64,
}

/// Clasifica un ejecutable por su nombre; `None` si no es un runtime vigilado.
///
/// Compara sin extension y en minusculas para que el mismo codigo sirva en
/// Windows (`node.exe`) y en Unix (`node`). Exige coincidencia exacta o sufijo
/// de version (`python3.11`) para no capturar binarios como `nodemon`.
fn classify(file_name: &str) -> Option<Runtime> {
    let lower = file_name.to_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);

    match stem {
        "node" | "nodejs" => Some(Runtime::Node),
        "dotnet" => Some(Runtime::Dotnet),
        "python" | "pythonw" => Some(Runtime::Python),
        _ => stem
            .strip_prefix("python")
            .filter(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit() || c == '.'))
            .map(|_| Runtime::Python),
    }
}

/// Crea el `System` de la app **con la lista de CPUs poblada**.
///
/// No es opcional: sysinfo calcula el uso de CPU de cada proceso multiplicando
/// por `self.cpus.len()`, asi que con un `System::new()` pelado esa lista queda
/// vacia y `cpu_usage()` devuelve 0 para absolutamente todos los procesos.
/// `CpuRefreshKind::nothing()` enumera los nucleos sin pagar la consulta PDH,
/// que es lenta de abrir la primera vez.
fn new_system() -> System {
    System::new_with_specifics(RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing()))
}

/// Refresca `sys` y devuelve los procesos de desarrollo activos, del que mas RAM
/// consume al que menos.
///
/// Vive separada del comando de Tauri para poder probarla contra el sistema real
/// sin montar una `App`.
fn collect_processes(sys: &mut System) -> Vec<ProcessInfo> {
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    // sysinfo devuelve 100 por nucleo saturado (400 si un proceso ocupa 4 hilos).
    // Dividir entre los nucleos deja un 0-100 con la misma lectura que el
    // Administrador de tareas: porcentaje de la capacidad total del equipo.
    let cores = sys.cpus().len().max(1) as f32;
    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .filter_map(|p| {
            let name = p.name().to_string_lossy().into_owned();
            let runtime = classify(&name)?;

            Some(ProcessInfo {
                pid: p.pid().as_u32(),
                name,
                runtime,
                cpu: p.cpu_usage() / cores,
                memory_mb: p.memory() as f64 / 1_048_576.0,
                run_time_secs: p.run_time(),
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
fn warm_up_cpu(sys: &mut System) {
    for _ in 0..2 {
        collect_processes(sys);
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    }
}

/// Devuelve los procesos de desarrollo activos.
#[tauri::command]
fn get_processes(state: State<'_, Mutex<System>>) -> Result<Vec<ProcessInfo>, String> {
    let mut sys = state.lock().map_err(|_| "Estado del sistema corrupto")?;
    Ok(collect_processes(&mut sys))
}

/// Termina un proceso vigilado.
#[tauri::command]
fn kill_process(pid: u32, state: State<'_, Mutex<System>>) -> Result<(), String> {
    let mut sys = state.lock().map_err(|_| "Estado del sistema corrupto")?;
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
    if classify(&name).is_none() {
        return Err(format!("{name} no es un proceso de desarrollo vigilado"));
    }

    if process.kill() {
        Ok(())
    } else {
        Err(format!("No se pudo terminar {name} (PID {pid})"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Una sola instancia de System para toda la app: crearla en cada llamada
        // obliga a releer todo el arbol de procesos y es notablemente mas lento.
        .manage(Mutex::new(new_system()))
        .setup(|app| {
            // Calentamiento en segundo plano para que la primera lectura de la UI
            // traiga CPU real. En un hilo aparte para no retrasar la ventana: si
            // el frontend pide datos antes de tiempo, se queda esperando el mutex
            // los ~400 ms que dura, que es justo lo que queremos.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Ok(mut sys) = handle.state::<Mutex<System>>().lock() {
                    warm_up_cpu(&mut sys);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_processes, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clasifica_ejecutables_de_windows_y_unix() {
        assert_eq!(classify("node.exe"), Some(Runtime::Node));
        assert_eq!(classify("node"), Some(Runtime::Node));
        assert_eq!(classify("Python.EXE"), Some(Runtime::Python));
        assert_eq!(classify("python3"), Some(Runtime::Python));
        assert_eq!(classify("python3.11"), Some(Runtime::Python));
        assert_eq!(classify("dotnet.exe"), Some(Runtime::Dotnet));
    }

    #[test]
    fn ignora_binarios_que_solo_comparten_prefijo() {
        assert_eq!(classify("nodemon.exe"), None);
        assert_eq!(classify("pythonista"), None);
        assert_eq!(classify("explorer.exe"), None);
        assert_eq!(classify(""), None);
    }

    /// El frontend lee estas claves literalmente. Si alguien renombra un campo en
    /// Rust sin tocar `src/types.ts`, la tabla se llena de `undefined` sin que
    /// falle nada: este test convierte ese silencio en un fallo.
    #[test]
    fn el_json_coincide_con_los_tipos_de_typescript() {
        let info = ProcessInfo {
            pid: 42,
            name: "node.exe".into(),
            runtime: Runtime::Node,
            cpu: 6.25,
            memory_mb: 128.0,
            run_time_secs: 900,
        };

        let json = serde_json::to_value(&info).expect("ProcessInfo deberia serializar");
        for clave in ["pid", "name", "runtime", "cpu", "memoryMb", "runTimeSecs"] {
            assert!(json.get(clave).is_some(), "falta la clave '{clave}' en el JSON");
        }
        assert_eq!(json["runtime"], "node");
    }

    /// Recorre los procesos reales de la maquina. No exige que haya alguno activo
    /// (la maquina de CI puede no tenerlos), pero si los hay valida el contrato
    /// que la UI da por hecho.
    #[test]
    fn lee_procesos_reales_del_sistema() {
        let mut sys = new_system();
        collect_processes(&mut sys); // Primera muestra para que la CPU no salga 0.
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        let processes = collect_processes(&mut sys);

        println!("Encontrados {} procesos de desarrollo:", processes.len());
        for p in &processes {
            println!(
                "  [{:>6}] {:<14} {:>6.1}% CPU  {:>7.0} MB  activo {}s",
                p.pid, p.name, p.cpu, p.memory_mb, p.run_time_secs
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
        warm_up_cpu(&mut sys);
        let processes = collect_processes(&mut sys);

        let busy = processes.iter().find(|p| p.pid == child.id()).cloned();
        let _ = child.kill();
        let _ = child.wait();

        let busy = busy.expect("el proceso node de prueba deberia salir en la lista");
        println!("proceso ocupado: {:.2} % CPU ({} nucleos)", busy.cpu, sys.cpus().len());

        // Un nucleo saturado son 100/nucleos: 6.25 % con 16, 1.6 % con 64. El
        // umbral de 1 % aguanta cualquier equipo razonable sin dar falsos fallos.
        assert!(
            busy.cpu > 1.0,
            "un proceso quemando un nucleo entero reporto {} %",
            busy.cpu
        );
    }
}
