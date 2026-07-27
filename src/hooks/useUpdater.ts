import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UPDATE_PROGRESS } from "../types";
import type { ReleaseInfo } from "../types";

/**
 * Estado de la comprobacion de actualizaciones.
 *
 * Se distingue "al-dia" de "reposo" a proposito: tras pulsar el boton hay que poder
 * decir "ya tienes la ultima", y sin ese estado el boton se quedaria igual que antes
 * de pulsarlo y pareceria que no ha hecho nada.
 */
export type UpdateState =
  | { fase: "reposo" }
  | { fase: "buscando" }
  | { fase: "al-dia" }
  | { fase: "disponible"; version: string; notas: string | null }
  | { fase: "descargando"; porcentaje: number | null }
  | { fase: "instalando" }
  | { fase: "error"; mensaje: string };

/**
 * Actualizaciones vía GitHub Releases, verificadas con SHA-256.
 *
 * Todo el trabajo real —consultar la API, descargar, comprobar el hash y ejecutar el
 * instalador— vive en Rust (`src-tauri/src/update.rs`); aqui solo se orquesta y se pinta.
 *
 * **Que garantiza la verificacion.** El instalador se compara contra el `.sha256` que
 * publica el mismo release antes de ejecutarlo, y si no coincide se borra. Eso detecta
 * una descarga corrupta o manipulada en transito, pero no demuestra quien publico el
 * archivo: el hash viaja por el mismo sitio. Es el compromiso de un proyecto sin
 * certificado de firma de codigo, y esta dicho tal cual en el README.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ fase: "reposo" });

  // La version encontrada, para no repetir la consulta al pulsar "Instalar".
  const pendiente = useRef<ReleaseInfo | null>(null);

  /**
   * Busca una version nueva.
   *
   * `silencioso` es para la comprobacion del arranque: ahi un fallo de red es lo normal
   * (equipo sin conexion, VPN levantandose) y no debe pintar un error en la cara del
   * usuario nada mas abrir la app. Devuelve la version encontrada, si la hay, para que
   * quien llame decida como avisar.
   */
  const buscar = useCallback(async (silencioso = false) => {
    if (!silencioso) setState({ fase: "buscando" });

    try {
      const release = await invoke<ReleaseInfo | null>("check_update");
      pendiente.current = release;

      if (!release) {
        if (!silencioso) setState({ fase: "al-dia" });
        return null;
      }

      setState({
        fase: "disponible",
        version: release.version,
        notas: release.notes || null,
      });
      return release.version;
    } catch (e) {
      if (!silencioso) setState({ fase: "error", mensaje: String(e) });
      return null;
    }
  }, []);

  /**
   * Descarga lo encontrado, lo verifica y lo instala.
   *
   * Rust rechaza y borra el archivo si el hash no coincide, asi que llegar a
   * `install_update` significa que la descarga ya se comprobo. La app se cierra sola
   * para que el instalador pueda reemplazar sus archivos.
   */
  const instalar = useCallback(async () => {
    const release = pendiente.current;
    if (!release) return;

    setState({ fase: "descargando", porcentaje: null });

    // La suscripcion se suelta siempre, tambien si la descarga falla: si no, cada
    // intento dejaria un oyente mas contando bytes de una descarga que ya no existe.
    let unlisten: (() => void) | null = null;

    try {
      unlisten = await listen<[number, number]>(UPDATE_PROGRESS, (evento) => {
        const [bajado, total] = evento.payload;
        setState({
          fase: "descargando",
          // Sin Content-Length no se puede calcular: se enseña una barra
          // indeterminada en vez de inventarse un porcentaje.
          porcentaje: total > 0 ? Math.min(100, Math.round((bajado / total) * 100)) : null,
        });
      });

      const ruta = await invoke<string>("download_update", { release });

      setState({ fase: "instalando" });
      await invoke("install_update", { path: ruta });
    } catch (e) {
      setState({ fase: "error", mensaje: String(e) });
    } finally {
      unlisten?.();
    }
  }, []);

  return { state, buscar, instalar };
}
