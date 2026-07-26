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

/// Preferencia de apariencia. `System` sigue al tema de Windows.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Settings {
    /// Nombres extra a vigilar ademas de node/python/dotnet (ej. "docker", "go").
    pub custom_names: Vec<String>,
    /// Si el atajo global Ctrl+Alt+K esta activo.
    pub hotkey_enabled: bool,
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
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            custom_names: Vec::new(),
            hotkey_enabled: true,
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
        let mut names: Vec<String> = self
            .custom_names
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
            eprintln!("No se pudo crear {}: {e}", dir.display());
        }
        Self { dir }
    }

    fn settings_file(&self) -> PathBuf {
        self.dir.join("settings.json")
    }

    fn history_file(&self) -> PathBuf {
        self.dir.join("history.json")
    }

    fn read_json<T: Default + for<'de> Deserialize<'de>>(path: &Path) -> T {
        let Ok(raw) = fs::read_to_string(path) else {
            return T::default(); // Todavia no existe: primera ejecucion.
        };
        serde_json::from_str(&raw).unwrap_or_else(|e| {
            eprintln!(
                "{} esta corrupto ({e}); se usan los valores por defecto",
                path.display()
            );
            T::default()
        })
    }

    fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| format!("No se pudo escribir {}: {e}", path.display()))
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
            hotkey_enabled: false,
            refresh_ms: 5000,
            theme: Theme::Dark,
            auto_kill_enabled: true,
            auto_kill_mb: 4096,
            zombie_enabled: true,
            zombie_minutes: 30,
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
}
