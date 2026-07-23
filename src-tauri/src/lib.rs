use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use sysinfo::{CpuRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;

/// Runtimes de desarrollo que la app vigila.
#[derive(Serialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Runtime {
    Node,
    Python,
    Dotnet,
}

impl Runtime {
    fn label(self) -> &'static str {
        match self {
            Runtime::Node => "Node",
            Runtime::Python => "Python",
            Runtime::Dotnet => ".NET",
        }
    }
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
    /// Puertos TCP en los que el proceso esta escuchando, ordenados.
    ports: Vec<u16>,
}

/// Que paso con cada PID de un intento de cierre en lote.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct KillOutcome {
    pid: u32,
    killed: bool,
    error: Option<String>,
    freed_ports: Vec<u16>,
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

/// Mapea PID -> puertos TCP en escucha.
///
/// Solo interesan los sockets en estado `Listen`: `get_all()` tambien devuelve
/// conexiones salientes establecidas, y el puerto efimero de una peticion HTTP no
/// es "el puerto donde corre tu servidor", que es la pregunta que responde la app.
///
/// Un fallo aqui no tumba la lista de procesos: se devuelve el mapa vacio y la UI
/// simplemente no muestra puertos. En Windows, los sockets de procesos de otros
/// usuarios pueden requerir permisos elevados.
fn listening_ports() -> HashMap<u32, Vec<u16>> {
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
    let mut ports = listening_ports();

    let mut processes: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .filter_map(|p| {
            let name = p.name().to_string_lossy().into_owned();
            let runtime = classify(&name)?;
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

/// Termina un unico proceso vigilado y devuelve los puertos que libera.
fn kill_one(sys: &mut System, pid: u32) -> Result<Vec<u16>, String> {
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

    // Hay que leer los puertos *antes* de matarlo: despues el socket ya no existe.
    let ports = listening_ports().remove(&pid).unwrap_or_default();

    if process.kill() {
        Ok(ports)
    } else {
        Err(format!("No se pudo terminar {name} (PID {pid})"))
    }
}

/// Avisa por notificacion nativa de los puertos que acaban de quedar libres.
///
/// Vive en Rust y no en el frontend porque el menu de la bandeja tambien mata
/// procesos sin que la ventana intervenga (e incluso estando oculta).
fn notify_freed_ports(app: &AppHandle, ports: &[u16]) {
    if ports.is_empty() {
        return;
    }

    let list = ports
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<_>>()
        .join(", ");
    let body = if ports.len() == 1 {
        format!("El puerto {list} ha quedado libre.")
    } else {
        format!("Los puertos {list} han quedado libres.")
    };

    if let Err(e) = app
        .notification()
        .builder()
        .title("ProcessVisor")
        .body(body)
        .show()
    {
        eprintln!("No se pudo mostrar la notificacion: {e}");
    }
}

#[tauri::command]
fn kill_process(
    pid: u32,
    app: AppHandle,
    state: State<'_, Mutex<System>>,
) -> Result<Vec<u16>, String> {
    let freed = {
        let mut sys = state.lock().map_err(|_| "Estado del sistema corrupto")?;
        kill_one(&mut sys, pid)?
    };

    notify_freed_ports(&app, &freed);
    Ok(freed)
}

/// Termina varios procesos y detalla que paso con cada uno.
///
/// Devuelve un resultado por PID en vez de abortar al primer fallo: en un lote es
/// normal que alguno haya muerto solo entre el ultimo refresco y el clic, y eso no
/// deberia impedir matar los demas.
#[tauri::command]
fn kill_processes(
    pids: Vec<u32>,
    app: AppHandle,
    state: State<'_, Mutex<System>>,
) -> Result<Vec<KillOutcome>, String> {
    let outcomes = {
        let mut sys = state.lock().map_err(|_| "Estado del sistema corrupto")?;
        pids.into_iter()
            .map(|pid| match kill_one(&mut sys, pid) {
                Ok(freed_ports) => KillOutcome {
                    pid,
                    killed: true,
                    error: None,
                    freed_ports,
                },
                Err(error) => KillOutcome {
                    pid,
                    killed: false,
                    error: Some(error),
                    freed_ports: Vec::new(),
                },
            })
            .collect::<Vec<_>>()
    };

    // Una sola notificacion para todo el lote, no una por proceso.
    let mut freed: Vec<u16> = outcomes.iter().flat_map(|o| o.freed_ports.clone()).collect();
    freed.sort_unstable();
    freed.dedup();
    notify_freed_ports(&app, &freed);

    Ok(outcomes)
}

/// Trae la ventana principal al frente, restaurandola si estaba oculta o minimizada.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Cierra de golpe todos los procesos de un runtime y avisa de los puertos libres.
///
/// Es la accion del menu de la bandeja, asi que se ejecuta sin que la ventana este
/// necesariamente visible: la notificacion es el unico feedback que recibe el
/// usuario y por eso se emite tambien cuando no se libero ningun puerto.
fn pids_of_runtime(sys: &mut System, runtime: Runtime) -> Vec<u32> {
    collect_processes(sys)
        .into_iter()
        .filter(|p| p.runtime == runtime)
        .map(|p| p.pid)
        .collect()
}

fn kill_all_of(app: &AppHandle, runtime: Runtime) {
    let state = app.state::<Mutex<System>>();
    let Ok(mut sys) = state.lock() else { return };

    let targets = pids_of_runtime(&mut sys, runtime);

    if targets.is_empty() {
        let _ = app
            .notification()
            .builder()
            .title("ProcessVisor")
            .body(format!("No hay procesos {} activos.", runtime.label()))
            .show();
        return;
    }

    let mut freed = Vec::new();
    let mut killed = 0usize;
    for pid in &targets {
        if let Ok(ports) = kill_one(&mut sys, *pid) {
            killed += 1;
            freed.extend(ports);
        }
    }
    drop(sys);

    freed.sort_unstable();
    freed.dedup();

    let body = if freed.is_empty() {
        format!("{killed} procesos {} cerrados.", runtime.label())
    } else {
        format!(
            "{killed} procesos {} cerrados. Puertos libres: {}.",
            runtime.label(),
            freed
                .iter()
                .map(|p| p.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    let _ = app
        .notification()
        .builder()
        .title("ProcessVisor")
        .body(body)
        .show();
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show = MenuItemBuilder::with_id("show", "Mostrar ProcessVisor").build(app)?;
    let kill_node = MenuItemBuilder::with_id("kill_node", "Cerrar todos los Node").build(app)?;
    let kill_python = MenuItemBuilder::with_id("kill_python", "Cerrar todos los Python").build(app)?;
    let kill_dotnet = MenuItemBuilder::with_id("kill_dotnet", "Cerrar todos los .NET").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Salir").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &kill_node,
            &kill_python,
            &kill_dotnet,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ])
        .build()?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ProcessVisor")
        .menu(&menu)
        // Sin esto, el clic izquierdo abre el menu en vez de llegar al handler.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "kill_node" => kill_all_of(app, Runtime::Node),
            "kill_python" => kill_all_of(app, Runtime::Python),
            "kill_dotnet" => kill_all_of(app, Runtime::Dotnet),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Una sola instancia de System para toda la app: crearla en cada llamada
        // obliga a releer todo el arbol de procesos y es notablemente mas lento.
        .manage(Mutex::new(new_system()))
        .setup(|app| {
            build_tray(app.handle())?;

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
        .on_window_event(|window, event| {
            // Cerrar la ventana la esconde en la bandeja en vez de terminar la app;
            // para salir de verdad esta la opcion "Salir" del menu del icono.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_processes,
            kill_process,
            kill_processes
        ])
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
            ports: vec![5173],
        };

        let json = serde_json::to_value(&info).expect("ProcessInfo deberia serializar");
        for clave in [
            "pid",
            "name",
            "runtime",
            "cpu",
            "memoryMb",
            "runTimeSecs",
            "ports",
        ] {
            assert!(json.get(clave).is_some(), "falta la clave '{clave}' en el JSON");
        }
        assert_eq!(json["runtime"], "node");
        assert_eq!(json["ports"][0], 5173);

        let outcome = serde_json::to_value(KillOutcome {
            pid: 42,
            killed: false,
            error: Some("boom".into()),
            freed_ports: vec![3000],
        })
        .expect("KillOutcome deberia serializar");
        for clave in ["pid", "killed", "error", "freedPorts"] {
            assert!(
                outcome.get(clave).is_some(),
                "falta la clave '{clave}' en KillOutcome"
            );
        }
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

    /// El menu de la bandeja ofrece "Cerrar todos los Node/Python/.NET". Si esa
    /// seleccion se equivocara, el usuario mataria procesos que no pidio y sin
    /// ventana abierta para verlo venir, asi que se comprueba que cada runtime
    /// solo devuelve los suyos.
    #[test]
    fn selecciona_solo_los_pids_del_runtime_pedido() {
        let mut sys = new_system();
        let todos = collect_processes(&mut sys);

        for runtime in [Runtime::Node, Runtime::Python, Runtime::Dotnet] {
            let elegidos = pids_of_runtime(&mut sys, runtime);
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
