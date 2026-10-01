import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CATALOGOS } from "../i18n";
import { claveProteccion, entradasQueLoProtegen } from "../lib/protect";
import type { ProcessInfo, Settings } from "../types";

const DEFAULT_SETTINGS: Settings = {
  customNames: [],
  // Igual que en Rust: el atajo global viene apagado y, encendido, pide dos pulsaciones. Cierra
  // todo sin confirmar y le quita la combinación a las demás apps; ver `hotkey_enabled`.
  hotkeyEnabled: false,
  hotkey: "ctrlAltK",
  hotkeyDoublePress: true,
  protected: [],
  // Igual que en Rust: cerrar la ventana cierra la app. Esconderla en la bandeja
  // hay que pedirlo, porque si no se acumulan instancias invisibles.
  closeToTray: false,
  refreshMs: 2000,
  theme: "system",
  // Igual que en Rust: ni el Auto-Kill ni el Zombie Finder arrancan encendidos.
  autoKillEnabled: false,
  autoKillMb: 2048,
  zombieEnabled: false,
  zombieMinutes: 10,
  // Igual que en Rust: espanol. El idioma no se detecta del sistema a proposito; el motivo
  // esta escrito en el enum `Language` de storage.rs.
  language: "es",
  // Vacia: el catalogo de fabrica de `services.rs` ya cubre los motores conocidos.
  customServices: [],
  // Apagado: el UAC en cada arranque tiene que pedirlo quien lo quiera.
  runAsAdmin: false,
};

/**
 * Los ajustes: leerlos al arrancar, guardarlos y proteger una fila, que es guardarlos también.
 *
 * Salió de `App.tsx` en T12-15. Devuelve además el catálogo del idioma vigente: los toast y los
 * diálogos se arman en callbacks de `App` y de sus hooks, que están **fuera** del proveedor de
 * idioma y no pueden usar `useT()`.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const t = CATALOGOS[settings.language] ?? CATALOGOS.es;

  useEffect(() => {
    invoke<Settings>("get_settings").then(setSettings).catch(() => {});
  }, []);

  /** Guarda los ajustes y dice si quedaron guardados, para quien tenga algo que anunciar después. */
  async function saveSettings(next: Settings): Promise<boolean> {
    // Se guarda el estado de antes **antes** de pintar el nuevo: si Rust rechaza, la ventana tiene
    // que volver a lo que de verdad esta vigente. Sin esto, la divergencia se queda para siempre y
    // el unico aviso -un toast- se va en segundos: la ventana podria decir 4096 MB mientras el
    // Auto-Kill sigue cerrando a los 2048, que es justo el ajuste que no puede mentir.
    const anterior = settings;
    setSettings(next); // Optimista: la UI responde al instante.
    try {
      setSettings(await invoke<Settings>("save_settings", { settings: next }));
      return true;
    } catch (e) {
      setSettings(anterior);
      toast.error(t.avisos.ajustesNoGuardados, { description: String(e) });
      return false;
    }
  }

  /**
   * Protege una fila desde su menú, o le quita la protección.
   *
   * Pasa por los ajustes y no por un comando propio: la lista vive en `settings.json` junto a los
   * vigilados, y Rust la vuelve a leer en cada cierre. Al guardarlos, Rust reemite la lista y el
   * candado aparece sin esperar al ciclo.
   *
   * El aviso espera a que Rust confirme (T12-08). Antes salía a la vez que se pedía el guardado, y
   * si fallaba quedaban dos avisos contradictorios —«protegido» y «no se pudieron guardar»— con
   * el proceso **sin proteger**: justo el caso en el que no se puede decir que sí.
   */
  async function protegerFila(p: ProcessInfo, proteger: boolean) {
    const clave = claveProteccion(p);
    if (proteger) {
      if (await saveSettings({ ...settings, protected: [...settings.protected, clave] })) {
        toast.success(t.avisos.protegido(clave));
      }
    } else {
      const quitar = entradasQueLoProtegen(p, settings.protected);
      const guardado = await saveSettings({
        ...settings,
        protected: settings.protected.filter((e) => !quitar.includes(e)),
      });
      if (guardado) toast.success(t.avisos.desprotegido(quitar[0] ?? clave));
    }
  }

  return { settings, t, saveSettings, protegerFila };
}
