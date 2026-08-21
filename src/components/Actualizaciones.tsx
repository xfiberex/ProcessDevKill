import {
  CheckIcon,
  DownloadIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { useUpdater } from "../hooks/useUpdater";
import { Button } from "@/components/ui/button";

type ActualizacionesProps = {
  /**
   * El estado del actualizador vive en `App`, no aqui ni en `SettingsView`.
   *
   * `useUpdater` guarda en una ref la actualizacion encontrada para no repetir la
   * consulta al pulsar "Instalar". Si el hook viviera en esta vista, cambiar a
   * Procesos y volver la perderia, y el aviso del arranque —que sale con Ajustes
   * sin montar— no tendria donde apuntarse lo que encontro.
   */
  updater: ReturnType<typeof useUpdater>;
};

/**
 * Buscar e instalar actualizaciones.
 *
 * Descargar y reiniciar **no puede pasar sin que el usuario lo pida**: el boton de
 * instalar solo aparece con una version encontrada y nunca se dispara solo.
 */
export function Actualizaciones({ updater }: ActualizacionesProps) {
  const { state, buscar, instalar } = updater;

  const ocupado =
    state.fase === "buscando" ||
    state.fase === "descargando" ||
    state.fase === "instalando";

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => buscar()} disabled={ocupado}>
          <RefreshCwIcon className={state.fase === "buscando" ? "animate-spin" : ""} />
          Buscar actualizaciones
        </Button>

        {state.fase === "al-dia" && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-500" />
            Ya tienes la última versión.
          </span>
        )}

        {state.fase === "error" && (
          <span className="flex items-start gap-1.5 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            No se pudo comprobar: {state.mensaje}
          </span>
        )}
      </div>

      {state.fase === "disponible" && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm">
            Hay una versión nueva:{" "}
            <strong className="font-medium">v{state.version}</strong>
          </p>
          {state.notas && (
            <p className="mt-1 max-h-32 overflow-y-auto text-sm whitespace-pre-line text-muted-foreground">
              {state.notas}
            </p>
          )}
          <Button className="mt-3" onClick={instalar}>
            <DownloadIcon />
            Descargar e instalar
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Se instala en silencio: la app se cierra, se actualiza y vuelve a abrirse
            sola. No hay que responder a ninguna ventana.
          </p>
        </div>
      )}

      {state.fase === "descargando" && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm">
            Descargando…
            {state.porcentaje !== null && ` ${state.porcentaje} %`}
          </p>
          {/* `progressbar` en el contenedor, no en la barra interior: el rol va en el elemento que
              representa el control entero, y la de dentro es solo el relleno. Sin `aria-valuenow`
              —cuando el servidor no manda Content-Length y no hay porcentaje— queda como barra
              indeterminada, que es exactamente lo que es. */}
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progreso de la descarga"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.porcentaje ?? undefined}
          >
            <div
              className={`h-full bg-primary transition-[width] ${
                // Sin Content-Length no hay porcentaje: barra al 100 % y a media
                // opacidad, para que se vea que avanza sin mentir con un numero.
                state.porcentaje === null ? "w-full opacity-50" : ""
              }`}
              style={
                state.porcentaje === null
                  ? undefined
                  : { width: `${state.porcentaje}%` }
              }
            />
          </div>
        </div>
      )}

      {state.fase === "instalando" && (
        <p className="text-sm text-muted-foreground">Instalando y reiniciando…</p>
      )}
    </div>
  );
}
