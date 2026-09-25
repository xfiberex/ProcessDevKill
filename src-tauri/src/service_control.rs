//! Arrancar y detener servicios: la Fase B del Tier 10.
//!
//! Todo lo que pide administrador vive aquí y **solo** aquí. `services.rs` enumera y lee, y con los
//! derechos que pide al SCM no podría actuar aunque tuviera un fallo; este archivo es el único que
//! sabe elevar, y lo único que sabe hacer elevado son dos verbos sobre un nombre.
//!
//! # Cómo se eleva
//!
//! La app **no se eleva nunca**. Ni al arrancar ni después: sigue instalada en `currentUser`, y su
//! mejor propiedad es que lo peor que puede hacer un fallo suyo es cerrar procesos del usuario.
//! Lo que se hace es relanzar el **mismo ejecutable** con `ShellExecuteExW` y el verbo `runas`,
//! pasándole el verbo y el nombre del servicio. Sale el UAC, ese proceso hijo hace una sola llamada
//! al SCM y muere. Vive elevado unos milisegundos y no tiene ventana, ni IPC, ni estado.
//!
//! Se descartaron las dos alternativas: **elevar la app entera** convierte cada arranque en un UAC
//! y deja la guardia de PIDs como única barrera frente a los procesos del sistema; **un servicio
//! broker** obligaría a instalar `perMachine` y a dejar algo corriendo como SYSTEM para siempre.
//!
//! # La guardia, que es lo que de verdad importa aquí
//!
//! El proceso hijo está elevado y recibe un nombre por línea de comandos. **Vuelve a validar ese
//! nombre él mismo**, y no se fía de que se lo mande su padre: si no lo hiciera, cualquier programa
//! del equipo —sin privilegios, que es lo que suele tener— podría lanzar
//! `processdevkill.exe --service-action stop <lo que sea>` y conseguir que el UAC enseñe el nombre
//! y el icono de **esta** app para detener un servicio del sistema. Un usuario que aprueba un UAC
//! de una app que conoce no está aprobando eso.
//!
//! Por eso el hijo relee `settings.json` de su propia carpeta en vez de aceptar la lista de
//! servicios del usuario por parámetro: un parámetro sería la guardia validándose contra su propia
//! entrada, que no valida nada. Es el mismo criterio que la guardia de PIDs de `kill_process`.
//!
//! # El resultado se lee, no se supone
//!
//! `ControlService` vuelve en cuanto el SCM **acepta el encargo**, no cuando el servicio ha
//! terminado de pararse; un SQL Server puede quedarse en `StopPending` un rato largo. Así que el
//! padre, en cuanto el hijo muere, sondea el estado real —leer no pide privilegios— hasta que se
//! asienta o hasta que se agota la espera, y lo que contesta es lo que vio.

use serde::{Deserialize, Serialize};
use tauri::State;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
use windows::Win32::System::Services::{
    ChangeServiceConfig2W, ChangeServiceConfigW, ControlService, StartServiceW, ENUM_SERVICE_TYPE,
    SC_MANAGER_CONNECT, SERVICE_AUTO_START, SERVICE_CHANGE_CONFIG,
    SERVICE_CONFIG_DELAYED_AUTO_START_INFO, SERVICE_CONTROL_STOP, SERVICE_DELAYED_AUTO_START_INFO,
    SERVICE_DEMAND_START, SERVICE_DISABLED, SERVICE_ERROR, SERVICE_NO_CHANGE, SERVICE_START,
    SERVICE_START_TYPE, SERVICE_STATUS, SERVICE_STOP,
};
use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject};
use windows::Win32::UI::Shell::{
    ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

use crate::services::{self, ServiceDependent, ServiceState, StartType};
use crate::storage::ServiceChange;
use crate::{textos, AppState};

/// El argumento con el que la app se reconoce a sí misma relanzada para actuar.
pub const ARG_ACCION: &str = "--service-action";

/// La carpeta de datos, para que el proceso elevado encuentre `settings.json` sin Tauri montado.
///
/// Tiene que ser el mismo `identifier` de `tauri.conf.json`, del que Tauri deriva `app_data_dir`.
/// Hay una prueba que lee el JSON y lo comprueba, porque si esto se desincroniza el fallo es mudo:
/// el hijo no vería los servicios que el usuario añadió y se negaría a tocarlos, sin decir por qué.
pub const IDENTIFICADOR: &str = "com.processdevkill.app";

/// Cuánto se espera al proceso elevado. El UAC ya se ha aceptado cuando empieza esta cuenta.
const ESPERA_HIJO_MS: u32 = 30_000;

/// Cuánto se sondea el estado antes de contestar «sigue cambiando».
const ESPERA_ESTADO_MS: u64 = 10_000;
const PASO_SONDEO_MS: u64 = 250;

// ------------------------------------------------------ códigos de salida del hijo ---

/// El SCM aceptó el encargo. **No** quiere decir que el servicio ya esté arrancado o parado.
const SALIDA_OK: u32 = 0;
/// Argumentos que no son los que este modo espera.
const SALIDA_USO: u32 = 1;
/// La guardia dijo que no: ese nombre no es de un servicio de desarrollo vigilado.
const SALIDA_NO_VIGILADO: u32 = 2;
/// El SCM se negó. Falta de permisos, servicio inexistente, o el propio servicio rechazándolo.
const SALIDA_RECHAZADO: u32 = 3;
/// `ERROR_DEPENDENT_SERVICES_RUNNING`: hay algo colgando de él que sigue vivo.
const SALIDA_BLOQUEADO: u32 = 4;
/// El tipo de arranque pedido no es uno de los cuatro que esta app pone. Ver `SettableStartType`.
const SALIDA_TIPO_NO_PERMITIDO: u32 = 5;

/// `HRESULT` de `ERROR_DEPENDENT_SERVICES_RUNNING` (1051).
const HR_DEPENDIENTES: u32 = 0x8007_041B;
/// `HRESULT` de `ERROR_SERVICE_ALREADY_RUNNING` (1056).
const HR_YA_CORRIENDO: u32 = 0x8007_0420;
/// `HRESULT` de `ERROR_SERVICE_NOT_ACTIVE` (1062).
const HR_YA_PARADO: u32 = 0x8007_0426;
/// `HRESULT` de `ERROR_CANCELLED` (1223): el usuario cerró el UAC.
const HR_CANCELADO: u32 = 0x8007_04C7;

// -------------------------------------------------------------------------- tipos ---

#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ServiceAction {
    Start,
    Stop,
}

impl ServiceAction {
    /// Cómo se escribe en la línea de comandos del proceso elevado.
    fn verbo(self) -> &'static str {
        match self {
            ServiceAction::Start => "start",
            ServiceAction::Stop => "stop",
        }
    }

    fn de_verbo(s: &str) -> Option<Self> {
        match s {
            "start" => Some(ServiceAction::Start),
            "stop" => Some(ServiceAction::Stop),
            _ => None,
        }
    }

    /// El estado al que se quiere llegar, que es lo que se sondea después.
    fn objetivo(self) -> ServiceState {
        match self {
            ServiceAction::Start => ServiceState::Running,
            ServiceAction::Stop => ServiceState::Stopped,
        }
    }

    /// El derecho **justo** que hace falta sobre el servicio. Ni uno más.
    fn derecho(self) -> u32 {
        match self {
            ServiceAction::Start => SERVICE_START,
            ServiceAction::Stop => SERVICE_STOP,
        }
    }
}

/// Los tipos de arranque que esta app **pone**, que no son todos los que sabe leer.
///
/// Faltan `Boot` y `System` a propósito, y no por descuido: son de controladores que carga el
/// núcleo antes de que exista el escritorio. Ninguna app de gestionar SQL Server tiene nada que
/// hacer ahí, y ofrecerlos sería regalar una forma de dejar un equipo sin arrancar. Falta también
/// `Unknown`, que no es un valor sino la ausencia de uno.
///
/// **Esto se valida dentro del proceso elevado**, igual que el nombre: es el segundo argumento que
/// le llega de fuera.
#[derive(Deserialize, Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum SettableStartType {
    Automatic,
    AutomaticDelayed,
    Manual,
    Disabled,
}

impl SettableStartType {
    fn verbo(self) -> &'static str {
        match self {
            SettableStartType::Automatic => "automatic",
            SettableStartType::AutomaticDelayed => "automatic-delayed",
            SettableStartType::Manual => "manual",
            SettableStartType::Disabled => "disabled",
        }
    }

    fn de_verbo(s: &str) -> Option<Self> {
        match s {
            "automatic" => Some(SettableStartType::Automatic),
            "automatic-delayed" => Some(SettableStartType::AutomaticDelayed),
            "manual" => Some(SettableStartType::Manual),
            "disabled" => Some(SettableStartType::Disabled),
            _ => None,
        }
    }

    /// El mismo valor, en el enum que sabe leer `services.rs`. Sirve para comparar lo que se pidió
    /// con lo que el SCM dice **después**.
    fn como_start_type(self) -> StartType {
        match self {
            SettableStartType::Automatic => StartType::Automatic,
            SettableStartType::AutomaticDelayed => StartType::AutomaticDelayed,
            SettableStartType::Manual => StartType::Manual,
            SettableStartType::Disabled => StartType::Disabled,
        }
    }

    fn valor_scm(self) -> SERVICE_START_TYPE {
        match self {
            SettableStartType::Automatic | SettableStartType::AutomaticDelayed => {
                SERVICE_AUTO_START
            }
            SettableStartType::Manual => SERVICE_DEMAND_START,
            SettableStartType::Disabled => SERVICE_DISABLED,
        }
    }

    fn es_retrasado(self) -> bool {
        self == SettableStartType::AutomaticDelayed
    }
}

/// En qué quedó la acción. Es lo que la ventana convierte en un mensaje.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ServiceOutcome {
    /// Llegó al estado que se pedía, comprobado releyendo el SCM.
    Done,
    /// El SCM aceptó, pero al agotarse la espera el servicio seguía en transición. No es un fallo:
    /// hay servicios que tardan, y decir «hecho» sin que lo esté sería justo lo que no se hace.
    Pending,
    /// El usuario cerró el UAC. Ni error ni aviso: no quiso, y ya está.
    Cancelled,
    /// Windows no lo detiene porque hay dependientes en marcha.
    Blocked,
    /// El SCM se negó por cualquier otro motivo.
    Refused,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServiceActionResult {
    pub outcome: ServiceOutcome,
    /// El estado **real** al terminar, releído del SCM. `None` si no se pudo consultar.
    pub state: Option<ServiceState>,
    /// Quién estaba bloqueando, cuando `outcome` es `Blocked`. Se rellena en ese momento y no
    /// antes, para que el mensaje diga nombres y no «algo depende de él».
    pub blockers: Vec<ServiceDependent>,
}

/// En qué quedó un cambio de tipo de arranque.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStartupResult {
    pub outcome: ServiceOutcome,
    /// El tipo de arranque **releído del SCM** al terminar, no el que se pidió.
    pub start_type: StartType,
}

// ------------------------------------------------------------------- la guardia ---

/// Si este nombre es de un servicio que esta app puede tocar.
///
/// Se comprueba **en los dos lados**: en el comando, para no sacar un UAC por algo que iba a acabar
/// en «no», y dentro del proceso elevado, que es donde de verdad cuenta.
fn vigilado(nombre: &str, custom: &[String]) -> bool {
    // Antes de clasificar, lo que ningún nombre del SCM tiene. Un servicio no puede llamarse con
    // comillas ni con caracteres de control, y el nombre viaja por una línea de comandos.
    if nombre.is_empty()
        || nombre.len() > 255
        || nombre.contains('"')
        || nombre.chars().any(char::is_control)
    {
        return false;
    }

    services::classify_service(nombre, custom).is_some()
}

// ------------------------------------------------ el lado de la app (sin elevar) ---

/// Los servicios en marcha que dependen de este.
///
/// La ventana lo pide **antes** de ofrecer Detener, no después de fallar. Es lectura pura: aquí no
/// hay UAC ni nada que se toque.
#[tauri::command]
pub fn get_service_dependents(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<ServiceDependent>, String> {
    let custom = custom_de(&state);
    if !vigilado(&name, &custom) {
        return Err(textos::de(state.language()).servicio_no_vigilado.to_string());
    }
    Ok(services::dependents(&name))
}

/// Arranca o detiene un servicio, elevando solo para eso.
///
/// `async` por el mismo motivo que `restart_as_admin` (T12-06): en Tauri 2 un comando síncrono
/// corre en el hilo principal, y este espera al UAC, hasta 30 s al hijo elevado y hasta 10 s a que
/// el SCM confirme. Todo ese rato la ventana estaba congelada, sin poder ni moverse.
#[tauri::command(async)]
pub fn control_service(
    state: State<'_, AppState>,
    name: String,
    action: ServiceAction,
) -> Result<ServiceActionResult, String> {
    let lang = state.language();
    let custom = custom_de(&state);

    if !vigilado(&name, &custom) {
        return Err(textos::de(lang).servicio_no_vigilado.to_string());
    }

    let exe = std::env::current_exe()
        .map_err(|_| textos::de(lang).sin_ejecutable.to_string())?;

    let salida = match elevar(&exe, action, &name) {
        Ok(codigo) => codigo,
        Err(Elevacion::Cancelada) => {
            return Ok(ServiceActionResult {
                outcome: ServiceOutcome::Cancelled,
                state: services::read_state(&name),
                blockers: Vec::new(),
            })
        }
        Err(Elevacion::Fallo(e)) => {
            crate::avisar!("No se pudo elevar para {} {name}: {e}", action.verbo());
            return Err(textos::de(lang).sin_elevacion.to_string());
        }
    };

    let outcome = match salida {
        SALIDA_OK => {
            // Y aquí es donde se lee en vez de suponer.
            match esperar_estado(&name, action.objetivo()) {
                Some(estado) if estado == action.objetivo() => ServiceOutcome::Done,
                _ => ServiceOutcome::Pending,
            }
        }
        SALIDA_BLOQUEADO => ServiceOutcome::Blocked,
        _ => ServiceOutcome::Refused,
    };

    Ok(ServiceActionResult {
        outcome,
        state: services::read_state(&name),
        // Los nombres solo cuando hacen falta: preguntarlos siempre sería una consulta al SCM por
        // cada acción para no usarla casi nunca.
        blockers: if outcome == ServiceOutcome::Blocked {
            services::dependents(&name)
        } else {
            Vec::new()
        },
    })
}

/// Cambia el tipo de arranque de un servicio, elevando solo para eso.
///
/// **Es lo primero que esta app hace que sobrevive a un reinicio y vive fuera de su propio
/// `settings.json`.** El Auto-Kill mata un proceso y este vuelve la próxima vez que se lanza; un
/// servicio en `Deshabilitado` sigue deshabilitado dentro de tres meses, cuando ya nadie recuerda
/// que lo hizo la app. De ahí las dos reglas que no se negocian:
///
/// - **La app registra lo que cambió**, para poder deshacerlo. Lo hace aquí, y solo cuando el SCM
///   confirma que el cambio cuajó: anotar un cambio que no ocurrió sería ofrecer deshacer nada.
/// - **Nunca lo hace sola.** No hay, ni habrá, un «Auto-Kill de servicios»: este comando solo
///   existe colgando de un clic con su confirmación delante.
///
/// `async` por lo mismo que [`control_service`]: espera al UAC y al hijo elevado.
#[tauri::command(async)]
pub fn set_service_startup(
    state: State<'_, AppState>,
    name: String,
    // El nombre visible viaja desde la ventana, que ya lo tiene de la lista. Solo se guarda para
    // enseñarlo en el registro de deshacer; nada se decide con él —lo que manda es `name`—.
    display_name: String,
    start_type: SettableStartType,
) -> Result<ServiceStartupResult, String> {
    let lang = state.language();
    let custom = custom_de(&state);

    if !vigilado(&name, &custom) {
        return Err(textos::de(lang).servicio_no_vigilado.to_string());
    }

    let exe = std::env::current_exe().map_err(|_| textos::de(lang).sin_ejecutable.to_string())?;
    let antes = services::read_start_type(&name);

    let salida = match elevar_con(
        &exe,
        &format!(
            "{ARG_ACCION} startup \"{name}\" {}",
            start_type.verbo()
        ),
    ) {
        Ok(codigo) => codigo,
        Err(Elevacion::Cancelada) => {
            return Ok(ServiceStartupResult {
                outcome: ServiceOutcome::Cancelled,
                start_type: antes,
            })
        }
        Err(Elevacion::Fallo(e)) => {
            crate::avisar!("No se pudo elevar para cambiar el arranque de {name}: {e}");
            return Err(textos::de(lang).sin_elevacion.to_string());
        }
    };

    // Y aquí, igual que en arrancar y detener: se relee en vez de suponer. Cambiar la
    // configuración es sincrono, asi que no hace falta sondear — pero sí comprobar.
    let despues = services::read_start_type(&name);

    if salida != SALIDA_OK || despues != start_type.como_start_type() {
        return Ok(ServiceStartupResult {
            outcome: ServiceOutcome::Refused,
            start_type: despues,
        });
    }

    if let Err(e) = state
        .storage
        .record_service_change(&name, &display_name, antes, despues)
    {
        // El cambio sí se hizo; lo que falló es poder deshacerlo desde aquí. Se avisa en el log y
        // no se miente diciendo que la accion fallo.
        crate::avisar!("No se pudo registrar el cambio de arranque de {name}: {e}");
    }

    Ok(ServiceStartupResult {
        outcome: ServiceOutcome::Done,
        start_type: despues,
    })
}

/// Los cambios de arranque que ha hecho **esta app**, para poder deshacerlos.
#[tauri::command]
pub fn get_service_changes(state: State<'_, AppState>) -> Vec<ServiceChange> {
    state.storage.load_service_changes()
}

/// Copia los servicios vigilados y suelta el candado enseguida, como el resto de la casa.
fn custom_de(state: &State<'_, AppState>) -> Vec<String> {
    state
        .settings
        .lock()
        .map(|s| s.custom_services.clone())
        .unwrap_or_default()
}

enum Elevacion {
    /// El usuario cerró el UAC.
    Cancelada,
    /// Ya traducido a texto: lo unico que se hace con esto es escribirlo en el log.
    Fallo(String),
}

/// Relanza este mismo ejecutable elevado para arrancar o detener.
fn elevar(exe: &std::path::Path, action: ServiceAction, nombre: &str) -> Result<u32, Elevacion> {
    // El nombre entre comillas: los del SCM no las llevan —la guardia lo garantiza— pero sí pueden
    // llevar espacios, y sin comillas se partiría en dos argumentos.
    elevar_con(exe, &format!("{ARG_ACCION} {} \"{nombre}\"", action.verbo()))
}

/// Relanza este mismo ejecutable elevado con estos argumentos y espera a que termine, devolviendo
/// su código de salida.
fn elevar_con(exe: &std::path::Path, argumentos: &str) -> Result<u32, Elevacion> {
    let verbo = services::a_utf16("runas");
    let archivo = services::a_utf16(&exe.to_string_lossy());
    let params = services::a_utf16(argumentos);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
        // `NOCLOSEPROCESS` para quedarse el handle y poder leer el código de salida; sin él no hay
        // forma de enterarse de en qué quedó. `NOASYNC` porque este hilo no bombea mensajes.
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
        lpVerb: PCWSTR(verbo.as_ptr()),
        lpFile: PCWSTR(archivo.as_ptr()),
        lpParameters: PCWSTR(params.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };

    unsafe { ShellExecuteExW(&mut info) }.map_err(|e| {
        if e.code().0 as u32 == HR_CANCELADO {
            Elevacion::Cancelada
        } else {
            Elevacion::Fallo(e.to_string())
        }
    })?;

    // `SEE_MASK_NOCLOSEPROCESS` deberia haberlo dejado, pero si no hay handle no hay forma de saber
    // en que quedo la accion, y suponer que fue bien es justo lo que esta fase no hace.
    if info.hProcess.is_invalid() {
        return Err(Elevacion::Fallo(
            "ShellExecuteEx no devolvio handle del proceso".to_string(),
        ));
    }

    let esperado = unsafe { WaitForSingleObject(info.hProcess, ESPERA_HIJO_MS) };
    let mut codigo = SALIDA_RECHAZADO;
    if esperado == WAIT_OBJECT_0 {
        let _ = unsafe { GetExitCodeProcess(info.hProcess, &mut codigo) };
    }
    let _ = unsafe { CloseHandle(info.hProcess) };

    Ok(codigo)
}

/// Sondea el estado hasta que llega al objetivo o hasta que se acaba la paciencia.
///
/// Sondeo y no espera de evento porque el SCM no ofrece ninguno: `services.msc` hace exactamente
/// esto. El paso es de 250 ms —lo bastante fino para que un servicio rápido conteste «hecho» sin
/// que se note, y lo bastante grueso para no freír el SCM durante diez segundos—.
fn esperar_estado(nombre: &str, objetivo: ServiceState) -> Option<ServiceState> {
    let hasta = std::time::Instant::now() + std::time::Duration::from_millis(ESPERA_ESTADO_MS);
    let mut ultimo = services::read_state(nombre);

    while std::time::Instant::now() < hasta {
        if ultimo == Some(objetivo) {
            return ultimo;
        }
        std::thread::sleep(std::time::Duration::from_millis(PASO_SONDEO_MS));
        ultimo = services::read_state(nombre);
    }
    ultimo
}

// ---------------------------------------------- el lado elevado (el proceso hijo) ---

/// Si esta ejecución es la del proceso elevado, hace su trabajo y devuelve el código de salida.
///
/// Se llama **lo primero** de `run()`, antes de montar Tauri: este proceso no abre ventana, no
/// registra el atajo global, no toca la bandeja y no es la «segunda instancia» de nadie. Entra,
/// hace una llamada al SCM y sale.
pub fn intercept() -> Option<u32> {
    let mut args = std::env::args();
    let _exe = args.next();

    if args.next().as_deref() != Some(ARG_ACCION) {
        return None;
    }

    let Some(verbo) = args.next() else {
        return Some(SALIDA_USO);
    };
    let Some(nombre) = args.next() else {
        return Some(SALIDA_USO);
    };
    // El tercer argumento solo lo lleva `startup`. Se lee antes de mirar el verbo para poder exigir
    // que **no** sobre nada detrás, sea cual sea la forma.
    let tercero = args.next();
    if args.next().is_some() {
        return Some(SALIDA_USO);
    }

    // **La guardia que cuenta.** Este proceso está elevado; el nombre viene de fuera.
    if !vigilado(&nombre, &custom_desde_disco()) {
        return Some(SALIDA_NO_VIGILADO);
    }

    if verbo == "startup" {
        // Y el tipo también viene de fuera, así que también se valida aquí: `de_verbo` solo conoce
        // los cuatro que esta app pone, de modo que `boot` y `system` no tienen por dónde entrar.
        let Some(tipo) = tercero.as_deref().and_then(SettableStartType::de_verbo) else {
            return Some(SALIDA_TIPO_NO_PERMITIDO);
        };
        return Some(ejecutar_arranque(&nombre, tipo));
    }

    if tercero.is_some() {
        return Some(SALIDA_USO);
    }
    let Some(action) = ServiceAction::de_verbo(&verbo) else {
        return Some(SALIDA_USO);
    };

    Some(ejecutar(action, &nombre))
}

/// Cambiar el tipo de arranque, ya elevado. La otra cosa que esta app hace con privilegios.
fn ejecutar_arranque(nombre: &str, tipo: SettableStartType) -> u32 {
    let Ok(scm) = services::abrir_scm(SC_MANAGER_CONNECT) else {
        return SALIDA_RECHAZADO;
    };
    let Ok(servicio) = services::abrir_servicio(&scm, nombre, SERVICE_CHANGE_CONFIG) else {
        return SALIDA_RECHAZADO;
    };

    // `SERVICE_NO_CHANGE` en todo lo demás: esta app cambia el tipo de arranque y **nada más**. Ni
    // la ruta del binario, ni la cuenta con la que corre, ni las dependencias.
    let cambiado = unsafe {
        ChangeServiceConfigW(
            servicio.0,
            ENUM_SERVICE_TYPE(SERVICE_NO_CHANGE),
            tipo.valor_scm(),
            SERVICE_ERROR(SERVICE_NO_CHANGE),
            PCWSTR::null(),
            PCWSTR::null(),
            None,
            PCWSTR::null(),
            PCWSTR::null(),
            PCWSTR::null(),
            PCWSTR::null(),
        )
    };
    if cambiado.is_err() {
        return SALIDA_RECHAZADO;
    }

    // **La segunda llamada no es opcional, y es la trampa de esta fase.**
    //
    // `Automático` y `Automático (inicio retrasado)` son el mismo `SERVICE_AUTO_START`: el retraso
    // vive en otra estructura. Sin esto, pasar un servicio de retrasado a automático normal no
    // cambiaría nada visible —el SCM seguiría diciendo «retrasado»— y la app reportaría un cambio
    // que no ocurrió. Por eso se escribe **siempre**, también cuando toca ponerlo en `false`.
    let mut retraso = SERVICE_DELAYED_AUTO_START_INFO {
        fDelayedAutostart: tipo.es_retrasado().into(),
    };
    let ajustado = unsafe {
        ChangeServiceConfig2W(
            servicio.0,
            SERVICE_CONFIG_DELAYED_AUTO_START_INFO,
            Some(std::ptr::from_mut(&mut retraso).cast()),
        )
    };

    // Un servicio `Deshabilitado` o `Manual` no admite la marca de retraso, y Windows contesta que
    // no. Es lo esperado y no invalida el cambio de arriba, que sí se hizo.
    if ajustado.is_err() && matches!(tipo, SettableStartType::Automatic | SettableStartType::AutomaticDelayed) {
        return SALIDA_RECHAZADO;
    }

    SALIDA_OK
}

/// Los servicios que el usuario añadió, leídos del disco por el propio proceso elevado.
///
/// **No se reciben por parámetro a propósito.** Ver la guardia, arriba: una lista de permitidos que
/// llega en la misma línea de comandos que el nombre a validar no permite nada.
fn custom_desde_disco() -> Vec<String> {
    let Ok(appdata) = std::env::var("APPDATA") else {
        return Vec::new();
    };
    let ruta = std::path::Path::new(&appdata)
        .join(IDENTIFICADOR)
        .join("settings.json");

    let Ok(texto) = std::fs::read_to_string(ruta) else {
        return Vec::new();
    };
    // Como `Value` y no como `Settings`: aquí solo interesa un campo, y un `settings.json` de una
    // versión distinta no puede dejar sin acción a los servicios de fábrica por no deserializar.
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&texto) else {
        return Vec::new();
    };

    json.get("customServices")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// La única cosa que esta app hace con privilegios: un verbo, un servicio.
fn ejecutar(action: ServiceAction, nombre: &str) -> u32 {
    // `SC_MANAGER_CONNECT` y nada más: el derecho para actuar se pide sobre el servicio concreto,
    // no sobre el gestor. Este handle no sirve para recorrer el catálogo ni para crear nada.
    let Ok(scm) = services::abrir_scm(SC_MANAGER_CONNECT) else {
        return SALIDA_RECHAZADO;
    };
    let Ok(servicio) = services::abrir_servicio(&scm, nombre, action.derecho()) else {
        return SALIDA_RECHAZADO;
    };

    let resultado = unsafe {
        match action {
            ServiceAction::Start => StartServiceW(servicio.0, None),
            ServiceAction::Stop => {
                let mut estado = SERVICE_STATUS::default();
                ControlService(servicio.0, SERVICE_CONTROL_STOP, &mut estado)
            }
        }
    };

    match resultado {
        Ok(()) => SALIDA_OK,
        Err(e) => match e.code().0 as u32 {
            HR_DEPENDIENTES => SALIDA_BLOQUEADO,
            // Ya estaba como se pedía. Es el resultado que el usuario quería, no un error: pasa
            // cuando alguien pulsa dos veces, o cuando el panel enseña un estado de hace un rato.
            HR_YA_CORRIENDO | HR_YA_PARADO => SALIDA_OK,
            _ => SALIDA_RECHAZADO,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **La prueba obligatoria de esta fase: qué NO puede tocar.**
    ///
    /// El proceso elevado recibe un nombre por línea de comandos, y esta es la función que decide
    /// si actúa. Si dejara pasar cualquiera de estos, la app sería un «eleva y detén lo que
    /// quieras» con el UAC enseñando su propio nombre para dar confianza.
    #[test]
    fn la_guardia_no_deja_tocar_nada_del_sistema() {
        let sin_custom: Vec<String> = Vec::new();

        for prohibido in [
            "WinDefend",
            "wuauserv",
            "Dnscache",
            "LanmanServer",
            "TrustedInstaller",
            "EventLog",
            "RpcSs",
            // El que ya coló una vez por parecido: «Redist» contiene «Redis».
            "GameInputRedistService",
            // Parecidos a los de fábrica, que es por donde se cuela lo que se cuela.
            "MSSQLSERVER2",
            "postgresqlmalo",
            "MySQLRouter",
            "RedisEvil",
            "com.docker.service.evil",
        ] {
            assert!(
                !vigilado(prohibido, &sin_custom),
                "{prohibido} no es un servicio de desarrollo y la guardia lo dejó pasar"
            );
        }
    }

    /// Lo que sí, para que la prueba de arriba no pase por estar todo prohibido.
    #[test]
    fn la_guardia_deja_pasar_los_de_desarrollo() {
        let sin_custom: Vec<String> = Vec::new();

        for permitido in [
            "MSSQLSERVER",
            "MSSQL$SQLEXPRESS",
            "SQLBrowser",
            "postgresql-x64-17",
            "MySQL80",
            "MongoDB",
            "Redis",
            "com.docker.service",
            "W3SVC",
        ] {
            assert!(vigilado(permitido, &sin_custom), "{permitido} deberia pasar");
        }
    }

    /// Un nombre que el usuario añadió pasa, y **exacto**: ni un prefijo ni un parecido.
    #[test]
    fn lo_que_anade_el_usuario_entra_exacto_y_no_arrastra_parecidos() {
        let custom = vec!["MiMotor".to_string()];

        assert!(vigilado("MiMotor", &custom));
        assert!(vigilado("mimotor", &custom), "no distingue mayusculas");
        assert!(!vigilado("MiMotorDelSistema", &custom));
        assert!(!vigilado("MiMoto", &custom));
    }

    /// Nombres que no son nombres. Se filtran antes de clasificar porque el nombre acaba en una
    /// línea de comandos entrecomillada.
    #[test]
    fn la_guardia_rechaza_lo_que_no_es_un_nombre_de_servicio() {
        let custom = vec!["MiMotor".to_string()];

        assert!(!vigilado("", &custom));
        assert!(!vigilado("MiMotor\" & shutdown", &custom));
        assert!(!vigilado("MiMotor\nWinDefend", &custom));
        assert!(!vigilado(&"a".repeat(300), &custom));
    }

    /// `intercept` solo se activa con su argumento. Cualquier otra invocación es la app normal.
    #[test]
    fn intercept_no_se_activa_sin_su_argumento() {
        // Las pruebas corren con los argumentos de cargo, que no son los del modo elevado.
        assert_eq!(intercept(), None);
    }

    #[test]
    fn los_verbos_van_y_vuelven_igual() {
        for accion in [ServiceAction::Start, ServiceAction::Stop] {
            assert_eq!(ServiceAction::de_verbo(accion.verbo()), Some(accion));
        }
        assert_eq!(ServiceAction::de_verbo("delete"), None);
        assert_eq!(ServiceAction::de_verbo("STOP"), None);
    }

    /// Cada verbo pide **su** derecho sobre el servicio, no un permiso de barra libre.
    #[test]
    fn cada_verbo_pide_solo_su_derecho() {
        assert_eq!(ServiceAction::Start.derecho(), SERVICE_START);
        assert_eq!(ServiceAction::Stop.derecho(), SERVICE_STOP);
    }

    /// **La segunda prueba obligatoria de esta fase: los tipos que la app NO pone.**
    ///
    /// `Boot` y `System` son de controladores que carga el núcleo antes de que exista el
    /// escritorio. Si el proceso elevado los aceptara, un nombre de servicio vigilado más un tipo
    /// mal elegido serían una forma de dejar un equipo sin arrancar.
    #[test]
    fn el_arranque_no_admite_los_tipos_del_nucleo() {
        for prohibido in [
            "boot",
            "system",
            "unknown",
            "Boot",
            "SERVICE_BOOT_START",
            "0",
            "",
        ] {
            assert_eq!(
                SettableStartType::de_verbo(prohibido),
                None,
                "«{prohibido}» no deberia poder pedirse"
            );
        }
    }

    #[test]
    fn los_cuatro_arranques_van_y_vuelven_igual() {
        for tipo in [
            SettableStartType::Automatic,
            SettableStartType::AutomaticDelayed,
            SettableStartType::Manual,
            SettableStartType::Disabled,
        ] {
            assert_eq!(SettableStartType::de_verbo(tipo.verbo()), Some(tipo));
        }
    }

    /// Los dos automáticos comparten el valor del SCM: lo que los distingue es la segunda llamada.
    /// Si esto dejara de ser cierto, `ejecutar_arranque` estaría escribiendo el retraso sobre un
    /// tipo que ya no lo lleva.
    #[test]
    fn los_dos_automaticos_son_el_mismo_valor_para_el_scm() {
        assert_eq!(
            SettableStartType::Automatic.valor_scm(),
            SettableStartType::AutomaticDelayed.valor_scm()
        );
        assert!(!SettableStartType::Automatic.es_retrasado());
        assert!(SettableStartType::AutomaticDelayed.es_retrasado());
    }

    /// Cada tipo ajustable tiene su gemelo en el enum que se lee del SCM, y son distintos entre sí.
    /// Es lo que permite comparar lo pedido con lo que quedó.
    #[test]
    fn cada_tipo_ajustable_se_compara_con_lo_que_lee_el_scm() {
        let leidos: Vec<StartType> = [
            SettableStartType::Automatic,
            SettableStartType::AutomaticDelayed,
            SettableStartType::Manual,
            SettableStartType::Disabled,
        ]
        .iter()
        .map(|t| t.como_start_type())
        .collect();

        assert_eq!(leidos.len(), 4);
        for (i, a) in leidos.iter().enumerate() {
            for b in leidos.iter().skip(i + 1) {
                assert_ne!(a, b, "dos tipos ajustables se leen igual");
            }
        }
    }

    /// Si esto se desincroniza de `tauri.conf.json`, el proceso elevado busca `settings.json` donde
    /// no está: no vería los servicios que el usuario añadió y se negaría a tocarlos, sin decir por
    /// qué. Es un fallo mudo, y por eso lo comprueba una prueba.
    #[test]
    fn el_identificador_es_el_de_tauri_conf() {
        let conf = std::fs::read_to_string("tauri.conf.json").expect("leer tauri.conf.json");
        let json: serde_json::Value = serde_json::from_str(&conf).expect("tauri.conf.json valido");

        assert_eq!(json["identifier"].as_str(), Some(IDENTIFICADOR));
    }
}
