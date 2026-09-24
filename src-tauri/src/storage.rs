//! Ajustes e historial persistidos en disco.
//!
//! Todo error de lectura degrada a los valores por defecto en vez de propagarse:
//! un JSON corrupto o un disco lleno no deberian impedir que la app arranque y
//! liste procesos, que es lo que el usuario vino a hacer.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Cuantos cierres se conservan. Sin tope, el archivo crece sin fin.
pub const HISTORY_LIMIT: usize = 200;

/// Suelo del umbral del Auto-Kill, en MB.
///
/// No es un capricho de validacion: el Auto-Kill mata **sin preguntar**. Con un
/// umbral de, por ejemplo, 50 MB, cualquier proceso vigilado lo supera y el
/// siguiente ciclo se lleva por delante el entorno de desarrollo entero. 256 MB
/// esta por encima de lo que consume un Node en reposo, asi que un despiste
/// escribiendo el numero no se convierte en un "matalo todo".
pub const MIN_AUTO_KILL_MB: u64 = 256;

/// Minimo del Zombie Finder, en minutos. Aqui no hay riesgo de matar nada —solo
/// resalta filas—, pero con 0 marcaria como zombi cualquier proceso quieto nada
/// mas verlo y el aviso no distinguiria nada.
pub const MIN_ZOMBIE_MINUTES: u64 = 1;

/// Idioma de la interfaz y de los avisos.
///
/// **No se detecta del sistema, y es deliberado.** Detectarlo pediria otra dependencia
/// (`sys-locale`, o el plugin `os` de Tauri) para algo que se elige una vez, y el proyecto se
/// publica primero para hispanohablantes. El selector de Ajustes se rotula **«Idioma / Language»**
/// justo para que lo encuentre quien abra la app y no entienda la otra mitad.
///
/// El idioma llega hasta Rust —y no se queda en el frontend— porque hay texto que la ventana no
/// pinta: el menu de la bandeja y las notificaciones de Windows, que ademas son lo unico que se ve
/// cuando la app corre sin ventana.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    Es,
    En,
}

/// Preferencia de apariencia. `System` sigue al tema de Windows.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// Combinacion del atajo global. Una lista cerrada y no una tecla libre: grabar cualquier
/// combinacion pediria un capturador de teclas y validar choques con el sistema, para algo que se
/// elige una vez. Las dos alternativas estan elegidas por no chocar con los IDE de uso comun.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Hotkey {
    /// La de siempre. En los IDE de JetBrains es *Commit and Push*: ver `hotkey_enabled`.
    #[default]
    CtrlAltK,
    CtrlAltShiftK,
    CtrlAltF12,
}

impl Hotkey {
    /// Como se escribe en la UI y en las notificaciones. No se traduce: son nombres de teclas.
    pub fn label(self) -> &'static str {
        match self {
            Hotkey::CtrlAltK => "Ctrl+Alt+K",
            Hotkey::CtrlAltShiftK => "Ctrl+Alt+Shift+K",
            Hotkey::CtrlAltF12 => "Ctrl+Alt+F12",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Settings {
    /// Nombres extra a vigilar ademas de node/python/dotnet (ej. "docker", "go").
    pub custom_names: Vec<String>,
    /// Si el atajo global esta activo.
    ///
    /// **Apagado de fabrica desde la v1.6.0** (Tier 11, A1). Cierra todos los vigilados sin
    /// confirmar y, al ser global, se lo quita a todas las apps: en los IDE de JetBrains
    /// Ctrl+Alt+K es *Commit and Push*, y quien lo pulsara ahi cerraba sus servidores sin que el
    /// IDE llegara a recibir la tecla. El Auto-Kill nace apagado por matar sin preguntar; esto,
    /// por lo mismo. Solo cambia para quien no tenga el campo guardado.
    pub hotkey_enabled: bool,
    /// Que combinacion dispara el atajo.
    pub hotkey: Hotkey,
    /// Si el atajo pide **dos pulsaciones** seguidas para disparar. La primera solo avisa.
    ///
    /// Encendido de fabrica, y eso si alcanza a quien ya tenia el atajo activo: su
    /// `settings.json` no trae el campo. Ver `hotkey::decidir`.
    pub hotkey_double_press: bool,
    /// Procesos que nada de la app cierra: ni Nuke All, ni la bandeja, ni el atajo, ni el
    /// Auto-Kill. Cada entrada se compara exacta con el ejecutable, el script o la carpeta del
    /// proceso (ver `processes::is_protected`).
    pub protected: Vec<String>,
    /// Si cerrar la ventana la esconde en la bandeja en vez de terminar la app.
    ///
    /// **Apagado por defecto**: el boton X de Windows cierra, y que una app siga
    /// viva e invisible despues de pulsarlo tiene que pedirlo el usuario. Hasta el
    /// Tier 7.4 esto era el comportamiento fijo, y lo que provocaba era que se
    /// acumularan instancias: uno cree que cerro la app, la vuelve a abrir, y
    /// termina con cuatro iconos en la bandeja.
    pub close_to_tray: bool,
    /// Intervalo del refresco automatico en ms; 0 lo pausa.
    pub refresh_ms: u64,
    /// Apariencia de la ventana. Se guarda aqui, y no en el `localStorage` del
    /// webview, para que viva junto al resto de ajustes en un archivo que el
    /// usuario puede ver, copiar entre equipos o borrar.
    pub theme: Theme,
    /// Si el Auto-Kill vigila la RAM. **Apagado por defecto**: es la unica
    /// funcion de la app que mata procesos sin que nadie se lo pida.
    pub auto_kill_enabled: bool,
    /// Umbral del Auto-Kill en MB. Solo cuenta con `auto_kill_enabled`.
    pub auto_kill_mb: u64,
    /// Si se resaltan los procesos parados que siguen ocupando un puerto.
    /// Apagado por defecto: la app no decide sola que es basura del usuario.
    pub zombie_enabled: bool,
    /// Minutos sin CPU que hacen falta para considerar zombi a un proceso.
    pub zombie_minutes: u64,
    /// Idioma de la interfaz, de la bandeja y de las notificaciones.
    pub language: Language,
    /// Servicios de Windows extra que vigilar, ademas del catalogo de fabrica de `services.rs`.
    ///
    /// Lista **aparte** de `custom_names` y no la misma: aquello son ejecutables y esto son
    /// nombres del SCM. Mezclarlas haria que añadir `docker` para ver el proceso arrastrase
    /// tambien el servicio, y al reves.
    pub custom_services: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            custom_names: Vec::new(),
            // Apagado: ver el comentario del campo.
            hotkey_enabled: false,
            hotkey: Hotkey::default(),
            hotkey_double_press: true,
            protected: Vec::new(),
            // Cerrar cierra. Ver el comentario del campo: esconderse en la bandeja
            // sin pedirlo es lo que hacia que se acumularan instancias.
            close_to_tray: false,
            refresh_ms: 2000,
            theme: Theme::System,
            auto_kill_enabled: false,
            // 2 GB: un Node que llega ahi casi siempre tiene una fuga o un watcher
            // desbocado. Es el ejemplo que daba el roadmap.
            auto_kill_mb: 2048,
            zombie_enabled: false,
            // 10 minutos: por debajo de eso todavia puede ser un servidor esperando
            // a que alguien recargue el navegador.
            zombie_minutes: 10,
            // Espanol por defecto: `#[serde(default)]` en el struct hace que un settings.json de
            // una version anterior -que no tiene el campo- se lea sin perder nada y caiga aqui.
            language: Language::default(),
            // Vacia: el catalogo de fabrica ya cubre SQL Server, PostgreSQL, MySQL, Mongo, Redis,
            // Docker e IIS. Esto es para lo que no esta ahi.
            custom_services: Vec::new(),
        }
    }
}

impl Settings {
    /// Umbral efectivo del Auto-Kill, nunca por debajo de [`MIN_AUTO_KILL_MB`].
    ///
    /// Se aplica aqui y no solo al guardar porque `settings.json` es un archivo
    /// que el usuario puede editar a mano: el suelo tiene que valer tambien para
    /// lo que se lee del disco.
    pub fn auto_kill_limit_mb(&self) -> u64 {
        self.auto_kill_mb.max(MIN_AUTO_KILL_MB)
    }

    /// Minutos efectivos del Zombie Finder, nunca por debajo de
    /// [`MIN_ZOMBIE_MINUTES`]. Con 0 se marcaria zombi todo lo que este quieto en
    /// el primer refresco, que no distingue nada.
    pub fn zombie_after_minutes(&self) -> u64 {
        self.zombie_minutes.max(MIN_ZOMBIE_MINUTES)
    }

    /// Normaliza los nombres introducidos por el usuario: minusculas, sin `.exe`,
    /// sin espacios ni duplicados. Asi `classify` puede comparar directamente.
    pub fn normalized_names(&self) -> Vec<String> {
        normalize(&self.custom_names)
    }

    /// Los protegidos, con la misma normalizacion: `is_protected` compara directamente.
    pub fn normalized_protected(&self) -> Vec<String> {
        normalize(&self.protected)
    }
}

/// Minusculas, sin `.exe`, sin espacios ni duplicados.
fn normalize(lista: &[String]) -> Vec<String> {
    let mut names: Vec<String> = lista
        .iter()
        .map(|n| {
            let lower = n.trim().to_lowercase();
            lower.strip_suffix(".exe").unwrap_or(&lower).to_string()
        })
        .filter(|n| !n.is_empty())
        .collect();
    names.sort();
    names.dedup();
    names
}

/// De donde salio la orden de cerrar un proceso.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum KillSource {
    /// Desde la ventana de la app.
    Window,
    /// Desde el menu del icono de la bandeja.
    Tray,
    /// Desde el atajo de teclado global.
    Hotkey,
    /// Cerrado solo por el Auto-Kill al pasarse de RAM.
    Auto,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub pid: u32,
    pub name: String,
    pub freed_ports: Vec<u16>,
    /// Epoch en milisegundos. Se guarda crudo y lo formatea el frontend, que
    /// conoce la zona horaria y el idioma del usuario.
    pub killed_at: u64,
    pub source: KillSource,
}

/// Un cambio de tipo de arranque hecho **por esta app**, para poder deshacerlo.
///
/// Es el único rastro que ProcessDevKill deja fuera de su propia carpeta: un servicio en
/// `Deshabilitado` sigue deshabilitado dentro de tres meses, cuando ya nadie recuerda que lo hizo
/// la app. Por eso se anota, con el mismo criterio que el historial de cierres.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceChange {
    pub name: String,
    pub display_name: String,
    /// A lo que estaba puesto **antes de que la app lo tocara por primera vez**. Ver
    /// `record_service_change`: esto no se pisa en cambios posteriores, porque es justo el valor al
    /// que sirve volver.
    pub from: crate::services::StartType,
    /// A lo que está puesto ahora por decisión de la app.
    pub to: crate::services::StartType,
    /// Epoch en milisegundos del último cambio. Lo formatea el frontend, que sabe la zona y el
    /// idioma del usuario.
    pub changed_at: u64,
}

pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub struct Storage {
    dir: PathBuf,
}

impl Storage {
    pub fn new(dir: PathBuf) -> Self {
        if let Err(e) = fs::create_dir_all(&dir) {
            crate::avisar!("No se pudo crear {}: {e}", dir.display());
        }
        Self { dir }
    }

    fn settings_file(&self) -> PathBuf {
        self.dir.join("settings.json")
    }

    fn history_file(&self) -> PathBuf {
        self.dir.join("history.json")
    }

    fn service_changes_file(&self) -> PathBuf {
        self.dir.join("service-changes.json")
    }

    fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &Path) -> T {
        let Ok(raw) = fs::read_to_string(path) else {
            return T::default(); // Todavia no existe: primera ejecucion.
        };
        serde_json::from_str(&raw).unwrap_or_else(|e| {
            crate::avisar!(
                "{} esta corrupto ({e}); se usan los valores por defecto",
                path.display()
            );
            T::default()
        })
    }

    /// Escribe el JSON **sin dejar nunca el archivo bueno a medias**.
    ///
    /// `fs::write` trunca el archivo destino y luego lo rellena, así que un corte de corriente,
    /// un cierre forzado o un disco lleno en ese hueco dejan un JSON incompleto. La app no se
    /// caería —`read_json` lo detecta— pero **volvería a los valores de fábrica en silencio**, y
    /// con eso se van los nombres vigilados, el umbral del Auto-Kill y hasta 200 entradas de
    /// historial. El usuario no se entera hasta que echa algo en falta.
    ///
    /// Se escribe en un archivo aparte y se renombra encima, que es una operación atómica: o está
    /// el contenido viejo entero, o el nuevo entero. Nunca medio archivo.
    ///
    /// ⚠️ **Sin borrar el destino antes, y eso importa.** La primera versión de esto lo borraba,
    /// dando por hecho que en Windows `fs::rename` falla si el destino existe. **Es falso**: el
    /// `rename` de Rust usa `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING` y reemplaza sin
    /// quejarse. Lo destapó la prueba de abajo, que siguió pasando al quitar el borrado — o sea
    /// que el borrado no defendía de nada y **abría justo el hueco que esto venía a cerrar**: un
    /// instante en el que ya no está el archivo viejo y todavía no está el nuevo. Comprobado
    /// midiéndolo, no leyéndolo.
    fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;

        let temporal = path.with_extension("json.tmp");
        fs::write(&temporal, json)
            .map_err(|e| format!("No se pudo escribir {}: {e}", temporal.display()))?;

        fs::rename(&temporal, path).map_err(|e| {
            // Si el renombrado falla, el temporal se queda por ahí y confunde: se limpia.
            let _ = fs::remove_file(&temporal);
            format!("No se pudo guardar {}: {e}", path.display())
        })
    }

    pub fn load_settings(&self) -> Settings {
        Self::read_json(&self.settings_file())
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<(), String> {
        Self::write_json(&self.settings_file(), settings)
    }

    pub fn load_history(&self) -> Vec<HistoryEntry> {
        Self::read_json(&self.history_file())
    }

    /// Añade entradas al principio (lo mas reciente primero) y recorta al tope.
    pub fn append_history(&self, entries: Vec<HistoryEntry>) -> Result<(), String> {
        if entries.is_empty() {
            return Ok(());
        }
        let mut history = self.load_history();
        for entry in entries.into_iter().rev() {
            history.insert(0, entry);
        }
        history.truncate(HISTORY_LIMIT);
        Self::write_json(&self.history_file(), &history)
    }

    pub fn clear_history(&self) -> Result<(), String> {
        Self::write_json(&self.history_file(), &Vec::<HistoryEntry>::new())
    }

    pub fn load_service_changes(&self) -> Vec<ServiceChange> {
        Self::read_json(&self.service_changes_file())
    }

    /// Anota que la app cambió el arranque de un servicio, de forma que se pueda deshacer.
    ///
    /// Dos decisiones que hacen que este registro sea util en vez de un diario:
    ///
    /// 1. **`from` no se pisa nunca.** Si el usuario pasa un servicio de `Manual` a `Deshabilitado`
    ///    y luego a `Automático`, lo que sirve para deshacer sigue siendo `Manual`, que es como
    ///    estaba antes de que esta app entrara. Un registro que guardara cada paso obligaría a
    ///    deshacer tres veces para volver al principio.
    /// 2. **La entrada se borra al volver al original.** Si el nuevo valor es el `from`, ya no hay
    ///    nada que deshacer, y dejarla ahí diciendo «cambiado de Manual a Manual» sería ruido que
    ///    el usuario tendría que interpretar. Deshacer y volver a ponerlo son el mismo camino.
    pub fn record_service_change(
        &self,
        name: &str,
        display_name: &str,
        antes: crate::services::StartType,
        ahora: crate::services::StartType,
    ) -> Result<(), String> {
        let mut cambios = self.load_service_changes();
        let existente = cambios.iter().position(|c| c.name == name);

        // El original es el de la primera vez; si no habia entrada, el de ahora mismo.
        let original = existente.map_or(antes, |i| cambios[i].from);

        if original == ahora {
            if let Some(i) = existente {
                cambios.remove(i);
                return Self::write_json(&self.service_changes_file(), &cambios);
            }
            // Nunca se toco y sigue igual: no hay nada que anotar.
            return Ok(());
        }

        let entrada = ServiceChange {
            name: name.to_string(),
            display_name: display_name.to_string(),
            from: original,
            to: ahora,
            changed_at: now_millis(),
        };

        match existente {
            Some(i) => cambios[i] = entrada,
            None => cambios.insert(0, entrada),
        }
        Self::write_json(&self.service_changes_file(), &cambios)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_storage(nombre: &str) -> Storage {
        let dir =
            std::env::temp_dir().join(format!("processdevkill-test-{nombre}-{}", now_millis()));
        Storage::new(dir)
    }

    #[test]
    fn normaliza_los_nombres_que_escribe_el_usuario() {
        let settings = Settings {
            custom_names: vec![
                "  Docker.EXE ".into(),
                "docker".into(), // duplicado tras normalizar
                "GO".into(),
                "   ".into(), // vacio, se descarta
            ],
            ..Settings::default()
        };

        assert_eq!(settings.normalized_names(), vec!["docker", "go"]);
    }

    /// La escritura pasa por un temporal y un renombrado, para no dejar nunca el archivo bueno a
    /// medias. Eso mete dos formas nuevas de romperlo, y las dos se prueban aqui: que el
    /// renombrado **sobre un archivo que ya existe** funcione, y que no quede ningun `.tmp`
    /// olvidado en la carpeta de datos del usuario, junto a sus ajustes.
    ///
    /// ⚠️ **Esta prueba ya se gano el sueldo el 2026-08-18.** La primera version de `write_json`
    /// borraba el destino antes de renombrar, creyendo que en Windows `fs::rename` falla si
    /// existe. Se quito el borrado para ver fallar la prueba y **siguio pasando**: el `rename` de
    /// Rust reemplaza igual. O sea que el borrado no defendia de nada y encima abria un instante
    /// sin ningun archivo bueno en disco. Se quito.
    #[test]
    fn guardar_encima_de_lo_guardado_funciona_y_no_deja_temporales() {
        let storage = temp_storage("atomico");
        let temporal = storage.settings_file().with_extension("json.tmp");

        // Primera escritura: el destino todavia no existe.
        storage.save_settings(&Settings::default()).unwrap();
        assert_eq!(storage.load_settings(), Settings::default());

        // Segunda: el destino YA existe, que es donde falla el renombrado en Windows.
        let otros = Settings {
            refresh_ms: 5000,
            custom_names: vec!["go".into()],
            ..Settings::default()
        };
        storage
            .save_settings(&otros)
            .expect("reemplazar un settings.json que ya existe tiene que funcionar");

        assert_eq!(
            storage.load_settings(),
            otros,
            "se guardo el contenido nuevo, no el viejo"
        );
        assert!(
            !temporal.exists(),
            "quedo un {} suelto en la carpeta de datos del usuario",
            temporal.display()
        );
    }

    #[test]
    fn un_archivo_corrupto_no_tumba_la_app() {
        let storage = temp_storage("corrupto");
        fs::write(storage.settings_file(), "{ esto no es json").unwrap();

        assert_eq!(storage.load_settings(), Settings::default());
        assert!(storage.load_history().is_empty());
    }

    #[test]
    fn guarda_y_recupera_ajustes() {
        let storage = temp_storage("ajustes");
        let settings = Settings {
            custom_names: vec!["php".into()],
            // Encendido y no el de fabrica, por el mismo motivo que el idioma de abajo.
            hotkey_enabled: true,
            hotkey: Hotkey::CtrlAltF12,
            hotkey_double_press: false,
            protected: vec!["mi-api".into()],
            close_to_tray: true,
            refresh_ms: 5000,
            theme: Theme::Dark,
            auto_kill_enabled: true,
            auto_kill_mb: 4096,
            zombie_enabled: true,
            zombie_minutes: 30,
            // Ingles y no el valor por defecto: si el campo no viajara al disco, la prueba pasaria
            // igual comparando dos veces el mismo `Language::Es`.
            language: Language::En,
            // No vacia, por el mismo motivo que el idioma: una lista vacia sobreviviria al viaje
            // aunque el campo no llegara a escribirse.
            custom_services: vec!["elasticsearch-service-x64".into()],
        };

        storage.save_settings(&settings).unwrap();
        assert_eq!(storage.load_settings(), settings);
    }

    /// El umbral no se valida solo al guardarlo desde la UI: `settings.json` es un
    /// archivo de texto que el usuario puede editar. Con un 1 escrito a mano y el
    /// Auto-Kill encendido, el siguiente ciclo se llevaria por delante todos los
    /// procesos vigilados.
    #[test]
    fn el_umbral_del_auto_kill_tiene_suelo() {
        let bajo = Settings {
            auto_kill_mb: 1,
            ..Settings::default()
        };
        assert_eq!(bajo.auto_kill_limit_mb(), MIN_AUTO_KILL_MB);

        let normal = Settings {
            auto_kill_mb: 4096,
            ..Settings::default()
        };
        assert_eq!(normal.auto_kill_limit_mb(), 4096);
    }

    #[test]
    fn el_tiempo_del_zombie_finder_tiene_suelo() {
        let cero = Settings {
            zombie_minutes: 0,
            ..Settings::default()
        };
        assert_eq!(cero.zombie_after_minutes(), MIN_ZOMBIE_MINUTES);

        let normal = Settings {
            zombie_minutes: 45,
            ..Settings::default()
        };
        assert_eq!(normal.zombie_after_minutes(), 45);
    }

    /// Un `settings.json` escrito por una version anterior no tiene `theme`. Sin
    /// `#[serde(default)]` en el struct, serde lo daria por corrupto y tiraria
    /// TODOS los ajustes del usuario (nombres vigilados incluidos) al añadir un
    /// campo nuevo.
    #[test]
    fn los_ajustes_de_una_version_anterior_siguen_valiendo() {
        let storage = temp_storage("migracion");
        fs::write(
            storage.settings_file(),
            r#"{"customNames":["php"],"hotkeyEnabled":false,"refreshMs":5000}"#,
        )
        .unwrap();

        let settings = storage.load_settings();
        assert_eq!(settings.custom_names, vec!["php".to_string()]);
        assert!(!settings.hotkey_enabled);
        assert_eq!(
            settings.theme,
            Theme::System,
            "el campo nuevo toma su valor por defecto"
        );
        assert!(
            !settings.auto_kill_enabled,
            "actualizar la app JAMAS debe encender solo el Auto-Kill"
        );
        assert!(!settings.zombie_enabled, "ni el Zombie Finder");
        assert!(
            !settings.close_to_tray,
            "cerrar la ventana cierra la app mientras nadie diga lo contrario"
        );
    }

    /// El valor de fabrica de `close_to_tray` no es una preferencia estetica.
    ///
    /// Con `true`, pulsar la X deja la app viva e invisible; quien no lo espere la
    /// da por cerrada, la vuelve a abrir y acumula instancias. Paso de verdad: el
    /// usuario reporto cuatro iconos de bandeja a la vez. Si alguien cambia este
    /// valor por descuido, que falle aqui.
    #[test]
    fn cerrar_la_ventana_cierra_la_app_de_fabrica() {
        assert!(!Settings::default().close_to_tray);
    }

    /// El atajo global cierra todo sin confirmar y le roba la combinacion a cualquier app que la
    /// use. Encendido de fabrica, Ctrl+Alt+K cerraba los servidores de quien lo pulsaba en un IDE
    /// de JetBrains para hacer *Commit and Push*. Si alguien lo vuelve a encender por descuido,
    /// que falle aqui.
    #[test]
    fn el_atajo_global_viene_apagado_y_pide_dos_pulsaciones() {
        let fabrica = Settings::default();
        assert!(!fabrica.hotkey_enabled);
        assert!(fabrica.hotkey_double_press);
        assert!(fabrica.protected.is_empty());
    }

    /// Quien actualiza con el atajo ya encendido lo conserva —su archivo trae `hotkeyEnabled`—,
    /// pero **si** le llega la doble pulsacion, porque ese campo no lo trae. Es la mitad de la
    /// correccion que alcanza a los usuarios que ya estaban expuestos.
    #[test]
    fn quien_ya_tenia_el_atajo_lo_conserva_con_doble_pulsacion() {
        let storage = temp_storage("atajo-heredado");
        fs::write(
            storage.settings_file(),
            r#"{"customNames":[],"hotkeyEnabled":true,"refreshMs":2000}"#,
        )
        .unwrap();

        let settings = storage.load_settings();
        assert!(settings.hotkey_enabled, "no se le apaga lo que tenia");
        assert_eq!(settings.hotkey, Hotkey::CtrlAltK, "ni se le cambia la combinacion");
        assert!(settings.hotkey_double_press);
    }

    #[test]
    fn los_protegidos_se_normalizan_como_los_vigilados() {
        let settings = Settings {
            protected: vec![" Mi-API ".into(), "mi-api".into(), "Node.EXE".into(), "".into()],
            ..Settings::default()
        };
        assert_eq!(settings.normalized_protected(), vec!["mi-api", "node"]);
    }

    #[test]
    fn el_historial_va_del_mas_reciente_al_mas_antiguo_y_tiene_tope() {
        let storage = temp_storage("historial");
        let entrada = |pid: u32| HistoryEntry {
            pid,
            name: "node.exe".into(),
            freed_ports: vec![],
            killed_at: now_millis(),
            source: KillSource::Window,
        };

        storage
            .append_history(vec![entrada(1), entrada(2)])
            .unwrap();
        storage.append_history(vec![entrada(3)]).unwrap();

        let history = storage.load_history();
        assert_eq!(
            history.iter().map(|h| h.pid).collect::<Vec<_>>(),
            vec![3, 1, 2],
            "lo ultimo cerrado debe quedar arriba"
        );

        storage
            .append_history((0..HISTORY_LIMIT as u32 + 50).map(entrada).collect())
            .unwrap();
        assert_eq!(storage.load_history().len(), HISTORY_LIMIT);

        storage.clear_history().unwrap();
        assert!(storage.load_history().is_empty());
    }

    // ------------------------------- el registro de deshacer de la fase C -------------------

    use crate::services::StartType;

    /// **Lo que hace util a este registro y no un diario.**
    ///
    /// Si el usuario pasa un servicio de `Manual` a `Deshabilitado` y luego a `Automatico`, lo que
    /// sirve para deshacer sigue siendo `Manual`: como estaba antes de que esta app entrara.
    /// Guardando cada paso haria falta deshacer tres veces para volver al principio, y el usuario
    /// tendria que llevar la cuenta.
    #[test]
    fn el_registro_guarda_el_original_y_no_lo_pisa() {
        let storage = temp_storage("cambios-original");

        storage
            .record_service_change("MySQL80", "MySQL80", StartType::Manual, StartType::Disabled)
            .unwrap();
        storage
            .record_service_change(
                "MySQL80",
                "MySQL80",
                StartType::Disabled,
                StartType::Automatic,
            )
            .unwrap();

        let cambios = storage.load_service_changes();
        assert_eq!(cambios.len(), 1, "un servicio, una entrada");
        assert_eq!(cambios[0].from, StartType::Manual, "el original aguanta");
        assert_eq!(cambios[0].to, StartType::Automatic);
    }

    /// Al volver al valor original ya no hay nada que deshacer, y la entrada se va.
    ///
    /// Dejarla ahi diciendo «cambiado de Manual a Manual» seria ruido que el usuario tendria que
    /// interpretar. Asi, deshacer y volver a ponerlo son el mismo camino.
    #[test]
    fn la_entrada_desaparece_al_volver_al_original() {
        let storage = temp_storage("cambios-deshacer");

        storage
            .record_service_change("MySQL80", "MySQL80", StartType::Manual, StartType::Disabled)
            .unwrap();
        assert_eq!(storage.load_service_changes().len(), 1);

        storage
            .record_service_change("MySQL80", "MySQL80", StartType::Disabled, StartType::Manual)
            .unwrap();
        assert!(
            storage.load_service_changes().is_empty(),
            "deshecho del todo, no queda rastro que ofrecer"
        );
    }

    /// Un servicio que nunca se toco y sigue igual no genera entrada. Sin esto, el registro se
    /// llenaria de lineas que no ofrecen deshacer nada.
    #[test]
    fn no_anota_lo_que_no_cambia() {
        let storage = temp_storage("cambios-sin-cambio");

        storage
            .record_service_change("SQLBrowser", "SQL Server Browser", StartType::Disabled, StartType::Disabled)
            .unwrap();

        assert!(storage.load_service_changes().is_empty());
    }

    /// Cada servicio lleva la suya, y el ultimo tocado queda arriba.
    #[test]
    fn cada_servicio_tiene_su_entrada() {
        let storage = temp_storage("cambios-varios");

        storage
            .record_service_change("MySQL80", "MySQL80", StartType::Manual, StartType::Disabled)
            .unwrap();
        storage
            .record_service_change(
                "postgresql-x64-17",
                "PostgreSQL 17",
                StartType::Automatic,
                StartType::Manual,
            )
            .unwrap();

        let cambios = storage.load_service_changes();
        assert_eq!(cambios.len(), 2);
        assert_eq!(cambios[0].name, "postgresql-x64-17", "lo ultimo, arriba");
    }
}
