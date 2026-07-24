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
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            custom_names: Vec::new(),
            hotkey_enabled: true,
            refresh_ms: 2000,
            theme: Theme::System,
        }
    }
}

impl Settings {
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
            eprintln!("{} esta corrupto ({e}); se usan los valores por defecto", path.display());
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
        let dir = std::env::temp_dir().join(format!("processdevkill-test-{nombre}-{}", now_millis()));
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
        };

        storage.save_settings(&settings).unwrap();
        assert_eq!(storage.load_settings(), settings);
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
        assert_eq!(settings.theme, Theme::System, "el campo nuevo toma su valor por defecto");
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

        storage.append_history(vec![entrada(1), entrada(2)]).unwrap();
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
