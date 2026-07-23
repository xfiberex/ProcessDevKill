use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{Manager, State};

/// Runtimes de desarrollo que la app vigila.
#[derive(Serialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Runtime {
    Node,
    Python,
    Dotnet,
}

#[derive(Serialize)]
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

/// `cpu_usage()` suma el uso de todos los nucleos, asi que un proceso saturando
/// 4 hilos devuelve 400. Dividimos para exponer un 0-100 comparable en la UI.
fn logical_cores() -> f32 {
    static CORES: OnceLock<f32> = OnceLock::new();
    *CORES.get_or_init(|| {
        std::thread::available_parallelism()
            .map(|n| n.get() as f32)
            .unwrap_or(1.0)
    })
}

/// Devuelve los procesos de desarrollo activos, del que mas RAM consume al que menos.
///
/// El porcentaje de CPU sale en 0 en la primera llamada: sysinfo necesita dos
/// muestras separadas por `MINIMUM_CPU_UPDATE_INTERVAL` para calcularlo.
#[tauri::command]
fn get_processes(state: State<'_, Mutex<System>>) -> Result<Vec<ProcessInfo>, String> {
    let mut sys = state.lock().map_err(|_| "Estado del sistema corrupto")?;

    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    let cores = logical_cores();
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
    Ok(processes)
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
        .manage(Mutex::new(System::new()))
        .setup(|app| {
            // Primera muestra de CPU al arrancar. Sin ella el porcentaje sale 0 en
            // la lectura inicial de la UI; cuando el webview termina de cargar ya
            // ha pasado de sobra el MINIMUM_CPU_UPDATE_INTERVAL (200 ms).
            if let Ok(mut sys) = app.state::<Mutex<System>>().lock() {
                sys.refresh_processes_specifics(
                    ProcessesToUpdate::All,
                    true,
                    ProcessRefreshKind::nothing().with_cpu().with_memory(),
                );
            }
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
}
