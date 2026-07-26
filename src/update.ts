import { useCallback, useRef, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Estado de la comprobacion de actualizaciones.
 *
 * Se distingue "al-dia" de "reposo" a proposito: tras pulsar el boton hay que
 * poder decir "ya tienes la ultima", y sin ese estado el boton se quedaria igual
 * que antes de pulsarlo y pareceria que no ha hecho nada.
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
 * Envuelve al plugin de actualizacion de Tauri.
 *
 * El modelo de confianza no es el `.sha256` que se publica con cada instalador:
 * el plugin verifica una firma **minisign** contra la clave publica que va
 * compilada dentro del binario (`plugins.updater.pubkey` de tauri.conf.json).
 * Un `latest.json` manipulado no basta para instalar nada: sin la firma privada
 * correspondiente, la descarga se rechaza antes de ejecutarse.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ fase: "reposo" });

  // La actualizacion encontrada, para no repetir el check al pulsar "Instalar".
  const pendiente = useRef<Update | null>(null);

  /**
   * Busca una version nueva.
   *
   * `silencioso` es para la comprobacion del arranque: ahi un fallo de red es lo
   * normal (equipo sin conexion, VPN levantandose) y no debe pintar un error en
   * la cara del usuario nada mas abrir la app. Devuelve la version encontrada,
   * si la hay, para que quien llame decida como avisar.
   */
  const buscar = useCallback(async (silencioso = false) => {
    if (!silencioso) setState({ fase: "buscando" });

    try {
      const update = await check();
      pendiente.current = update;

      if (!update) {
        if (!silencioso) setState({ fase: "al-dia" });
        return null;
      }

      setState({
        fase: "disponible",
        version: update.version,
        notas: update.body ?? null,
      });
      return update.version;
    } catch (e) {
      if (!silencioso) setState({ fase: "error", mensaje: String(e) });
      return null;
    }
  }, []);

  /**
   * Descarga e instala lo encontrado, y reinicia.
   *
   * En Windows el instalador NSIS necesita que la app este cerrada, asi que el
   * propio plugin la termina; `relaunch()` cubre el caso de que no lo haga. Si
   * la app ya murio, esta linea sencillamente no llega a ejecutarse.
   */
  const instalar = useCallback(async () => {
    const update = pendiente.current;
    if (!update) return;

    setState({ fase: "descargando", porcentaje: null });

    try {
      let total = 0;
      let bajado = 0;

      await update.downloadAndInstall((evento) => {
        switch (evento.event) {
          case "Started":
            total = evento.data.contentLength ?? 0;
            setState({ fase: "descargando", porcentaje: total ? 0 : null });
            break;
          case "Progress":
            bajado += evento.data.chunkLength;
            setState({
              fase: "descargando",
              // Sin Content-Length no se puede calcular: se enseña una barra
              // indeterminada en vez de inventarse un porcentaje.
              porcentaje: total ? Math.min(100, Math.round((bajado / total) * 100)) : null,
            });
            break;
          case "Finished":
            setState({ fase: "instalando" });
            break;
        }
      });

      await relaunch();
    } catch (e) {
      setState({ fase: "error", mensaje: String(e) });
    }
  }, []);

  return { state, buscar, instalar };
}
