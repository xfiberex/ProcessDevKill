//! Correr como administrador: saber si se está, y relanzarse elevada cuando se pide.
//!
//! Sin elevar, Windows le niega a la app tres cosas, y ninguna es un fallo suyo:
//! - **la RAM de los servicios**, que corren como `SYSTEM` (ver `services.rs`);
//! - **el script y la carpeta de un proceso lanzado como administrador** —un `npm run dev` desde
//!   una terminal elevada—, porque leer su línea de comandos pide abrir su memoria;
//! - **cerrar ese mismo proceso**: un proceso de integridad media no puede terminar a uno de
//!   integridad alta.
//!
//! La app lo dice en vez de enseñar huecos sin explicar, y deja elegir: reiniciarse elevada una vez,
//! o arrancar siempre así (`Settings::run_as_admin`, **apagado de fábrica**: el UAC en cada
//! arranque tiene que pedirlo quien lo quiera).
//!
//! Esto es distinto de lo de `service_control`: allí se eleva **una acción** —arrancar o detener un
//! servicio— en un proceso hijo que hace una llamada y sale. Aquí se eleva la app entera.

use std::path::PathBuf;

use serde::Serialize;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, WaitForSingleObject,
    PROCESS_SYNCHRONIZE,
};
use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

use crate::services::a_utf16;
use crate::storage::Storage;

/// Marca que lleva la instancia elevada que lanzó otra, seguida del PID de la que la lanzó.
///
/// Sirve para dos cosas. **Esperar a que la otra termine** antes de montar Tauri: si no, el plugin
/// de instancia única de la nueva encuentra a la vieja todavía viva, le pasa el testigo y se cierra
/// —y acto seguido la vieja también—, y no queda ninguna. Y **no volver a relanzarse** si por lo
/// que sea sigue sin estar elevada: sin esta marca, un UAC que eleva a otra cosa sería un bucle.
const ARG_RELANZADA: &str = "--relanzada-elevada";

/// Lo que se espera a que la instancia anterior termine. Sale en milisegundos: cerrar la app es
/// liberar un mutex y una ventana, y si en 10 s no ha terminado es que algo va mal y es mejor
/// arrancar igualmente que quedarse colgado sin ventana.
const ESPERA_PADRE_MS: u32 = 10_000;

/// `HRESULT` de `ERROR_CANCELLED` (1223): el usuario cerró el UAC.
const HR_CANCELADO: u32 = 0x8007_04C7;

/// Si este proceso corre elevado.
///
/// Se pregunta al token (`TokenElevation`) y no a si el usuario es del grupo Administradores: con
/// UAC, un administrador corre sin elevar hasta que lo pide, y es lo elevado lo que Windows mira.
pub fn is_elevated() -> bool {
    let mut token = HANDLE::default();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) }.is_err() {
        return false;
    }

    let mut elevacion = TOKEN_ELEVATION::default();
    let mut largo = 0u32;
    let leido = unsafe {
        GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevacion as *mut TOKEN_ELEVATION as *mut _),
            size_of::<TOKEN_ELEVATION>() as u32,
            &mut largo,
        )
    };
    let _ = unsafe { CloseHandle(token) };

    leido.is_ok() && elevacion.TokenIsElevated != 0
}

/// Qué hacer al arrancar. Separado de `al_arrancar` para poder probarlo sin UAC de por medio.
fn debe_relanzarse(pedido: bool, elevada: bool, ya_relanzada: bool) -> bool {
    pedido && !elevada && !ya_relanzada
}

/// Lo primero de `run()` tras `service_control::intercept`, antes de montar Tauri.
///
/// - Si esta es la instancia elevada que lanzó otra, espera a que aquella termine (ver
///   [`ARG_RELANZADA`]).
/// - Si el usuario pidió arrancar siempre como administrador y no lo está, se relanza elevada y
///   **devuelve `true`: quien llama tiene que salir**. Si el UAC se cierra o falla, sigue sin
///   elevar: la app funciona igual, solo que con los huecos que explica el aviso.
///
/// Va antes de Tauri, y no en `setup`, porque ahí ya se registró la instancia única: la nueva
/// encontraría a esta viva. Por eso lee los ajustes a mano, de la misma carpeta que usará Tauri.
pub fn al_arrancar(identificador: &str) -> bool {
    let padre = pid_del_padre(std::env::args());
    if let Some(pid) = padre {
        esperar_a(pid);
    }

    let pedido = carpeta_de_datos(identificador)
        .map(|dir| Storage::new(dir).load_settings().run_as_admin)
        .unwrap_or(false);

    if !debe_relanzarse(pedido, is_elevated(), padre.is_some()) {
        return false;
    }

    match relanzar_elevada() {
        Ok(()) => true,
        Err(e) => {
            crate::avisar!("No se pudo arrancar como administrador: {e}");
            false
        }
    }
}

/// La carpeta de `app_data_dir` sin tener todavía una app de Tauri: `%APPDATA%\<identificador>`,
/// que es la que resuelve Tauri en Windows.
fn carpeta_de_datos(identificador: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|dir| PathBuf::from(dir).join(identificador))
}

/// El PID que sigue a [`ARG_RELANZADA`], si esta ejecución lo lleva.
fn pid_del_padre(mut args: impl Iterator<Item = String>) -> Option<u32> {
    args.find(|a| a == ARG_RELANZADA)?;
    args.next()?.parse().ok()
}

fn esperar_a(pid: u32) {
    // Si no se puede abrir es que ya no existe, que es lo que se esperaba.
    if let Ok(proceso) = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, pid) } {
        let esperado = unsafe { WaitForSingleObject(proceso, ESPERA_PADRE_MS) };
        if esperado != WAIT_OBJECT_0 {
            crate::avisar!("La instancia anterior ({pid}) no terminó a tiempo; se arranca igual");
        }
        let _ = unsafe { CloseHandle(proceso) };
    }
}

/// Lanza este mismo ejecutable elevado, con la marca y el PID de este proceso. No espera.
fn relanzar_elevada() -> Result<(), ElevacionFallida> {
    let exe = std::env::current_exe().map_err(|e| ElevacionFallida::Error(e.to_string()))?;
    let verbo = a_utf16("runas");
    let archivo = a_utf16(&exe.to_string_lossy());
    let params = a_utf16(&format!("{ARG_RELANZADA} {}", std::process::id()));

    let mut info = SHELLEXECUTEINFOW {
        cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
        // `NOASYNC` porque ni el arranque ni el hilo del comando bombean mensajes: sin él,
        // `ShellExecuteEx` puede volver antes de haber lanzado nada.
        fMask: SEE_MASK_NOASYNC,
        lpVerb: PCWSTR(verbo.as_ptr()),
        lpFile: PCWSTR(archivo.as_ptr()),
        lpParameters: PCWSTR(params.as_ptr()),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };

    unsafe { ShellExecuteExW(&mut info) }.map_err(|e| {
        if e.code().0 as u32 == HR_CANCELADO {
            ElevacionFallida::Cancelada
        } else {
            ElevacionFallida::Error(e.to_string())
        }
    })
}

enum ElevacionFallida {
    Cancelada,
    Error(String),
}

impl std::fmt::Display for ElevacionFallida {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Cancelada => f.write_str("el UAC se cerró sin aprobar"),
            Self::Error(e) => f.write_str(e),
        }
    }
}

/// Lo que contesta `restart_as_admin`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RestartOutcome {
    /// La elevada ya está lanzada y esta se está cerrando.
    Restarting,
    /// El usuario cerró el UAC. No es un error: es una respuesta.
    Cancelled,
}

/// Si la app corre como administrador. Lo pregunta la ventana para decidir si avisa.
#[tauri::command]
pub fn get_elevation() -> bool {
    is_elevated()
}

/// Reinicia la app como administrador: lanza la elevada y, si el UAC se aprueba, sale.
///
/// La nueva espera a que esta termine antes de registrarse como instancia única
/// (ver [`ARG_RELANZADA`]). Si el UAC se cierra, esta sigue como estaba.
///
/// `async` para que corra fuera del hilo principal: `ShellExecuteEx` no vuelve hasta que se
/// contesta el UAC, y en el hilo principal la ventana se quedaría congelada mientras tanto.
#[tauri::command]
pub async fn restart_as_admin(app: tauri::AppHandle) -> Result<RestartOutcome, String> {
    match relanzar_elevada() {
        Ok(()) => {
            // `exit` pide la salida al bucle de eventos y vuelve, así que la respuesta puede
            // llegar a la ventana justo antes de que se cierre.
            app.exit(0);
            Ok(RestartOutcome::Restarting)
        }
        Err(ElevacionFallida::Cancelada) => Ok(RestartOutcome::Cancelled),
        Err(ElevacionFallida::Error(e)) => {
            crate::avisar!("No se pudo reiniciar como administrador: {e}");
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> impl Iterator<Item = String> {
        v.iter().map(|s| s.to_string()).collect::<Vec<_>>().into_iter()
    }

    #[test]
    fn solo_se_relanza_si_se_pidio_y_no_esta_elevada() {
        assert!(debe_relanzarse(true, false, false));
        // Apagado de fábrica: sin pedirlo, nunca.
        assert!(!debe_relanzarse(false, false, false));
        assert!(!debe_relanzarse(true, true, false));
    }

    /// El criterio negativo que importa: una instancia que ya viene de relanzarse no lo intenta
    /// otra vez aunque siga sin elevar. Sin esto, un UAC que devuelve un proceso sin elevar sería
    /// un bucle de ventanas de UAC.
    #[test]
    fn la_relanzada_no_se_relanza_otra_vez() {
        assert!(!debe_relanzarse(true, false, true));
    }

    #[test]
    fn lee_el_pid_de_la_instancia_anterior() {
        assert_eq!(pid_del_padre(args(&["app.exe", ARG_RELANZADA, "4242"])), Some(4242));
        assert_eq!(pid_del_padre(args(&["app.exe"])), None);
        assert_eq!(pid_del_padre(args(&["app.exe", ARG_RELANZADA])), None);
        assert_eq!(pid_del_padre(args(&["app.exe", ARG_RELANZADA, "x"])), None);
    }

    #[test]
    fn la_carpeta_de_datos_es_la_de_tauri() {
        let dir = carpeta_de_datos("com.processdevkill.app").expect("APPDATA existe en Windows");
        assert!(dir.ends_with("com.processdevkill.app"));
        assert_eq!(dir.parent(), std::env::var_os("APPDATA").as_deref().map(std::path::Path::new));
    }
}
