import { XIcon } from "lucide-react";
import { useT } from "../i18n";
import { Button } from "@/components/ui/button";

/**
 * La barra de la selección: «3 seleccionados · Cerrar · Quitar selección» (Tier 11, D7).
 *
 * **Flota abajo, encima de la tabla, y no se intercala sobre ella.** Una barra que apareciera entre
 * la cabecera y las filas al marcar la primera casilla las empujaría 40 px hacia abajo, y la
 * siguiente casilla que se iba a marcar ya no estaría bajo el puntero: el mismo problema que el
 * orden congelado resolvió para los refrescos (A5).
 *
 * «Cerrar» va en el rojo tenue y no en el lleno (D5): el rojo lleno es solo para Nuke All, y aquí
 * el diálogo de confirmación sigue delante.
 */
export function SelectionBar({
  count,
  closable,
  onClose,
  onClear,
}: {
  /** Cuántos hay marcados en la lista visible. */
  count: number;
  /** Cuántos de esos se pueden cerrar: los protegidos no cuentan. */
  closable: number;
  onClose: () => void;
  onClear: () => void;
}) {
  const t = useT();

  return (
    <div
      role="region"
      aria-label={t.seleccion.recuento(count)}
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-popover py-1.5 pr-1.5 pl-3 text-sm text-popover-foreground shadow-lg"
    >
      <span className="font-medium whitespace-nowrap tabular-nums" aria-live="polite">
        {t.seleccion.recuento(count)}
      </span>
      <Button
        variant="destructive"
        size="sm"
        className="text-destructive-text"
        disabled={closable === 0}
        // Con solo protegidos marcados no hay nada que cerrar: el botón se apaga, y su nombre sigue
        // hablando de los que hay marcados en vez de decir «los 0 procesos».
        aria-label={t.seleccion.cerrarLabel(closable || count)}
        onClick={onClose}
      >
        {t.seleccion.cerrar}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <XIcon />
        {t.seleccion.quitar}
      </Button>
    </div>
  );
}
