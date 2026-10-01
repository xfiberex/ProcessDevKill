import type { RefObject } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { useT } from "../i18n";
import { REFRESH_INTERVALS } from "../types";
import { ViewHeader } from "./ViewHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Rojo solido para la accion principal destructiva.
 *
 * El `variant="destructive"` de este estilo de shadcn es un rojo tenue sobre
 * fondo claro, pensado para acciones secundarias. Para el boton que cierra TODA
 * la lista de golpe hace falta que se vea que quema.
 */
const SOLID_DESTRUCTIVE =
  "shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90";

type ProcessesHeaderProps = {
  /** El buscador lo enfoca `App` con Ctrl+F, desde cualquier vista. */
  buscadorRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  /** Cuántos procesos se ven, tras el filtro y la búsqueda. */
  visibles: number;
  /** De los visibles, cuántos caerían con Nuke All: los protegidos no cuentan. */
  cerrables: number;
  /** Si lo que se ve es una parte de la lista. Cambia el rótulo de Nuke All. */
  filtrada: boolean;
  /** Con una selección, Nuke All se aparta: la acción pasa a la barra de abajo. */
  haySeleccion: boolean;
  refreshMs: number;
  onRefresh: () => void;
  onNuke: () => void;
};

/**
 * La cabecera de la vista de Procesos: buscador, recuento, Refrescar y Nuke All.
 *
 * Salió de `App.tsx` en T12-15. El estado sigue arriba —búsqueda, selección y orden los comparten
 * la cabecera, la tabla y la barra de la selección—; aquí solo se pinta.
 */
export function ProcessesHeader({
  buscadorRef,
  query,
  onQueryChange,
  visibles,
  cerrables,
  filtrada,
  haySeleccion,
  refreshMs,
  onRefresh,
  onNuke,
}: ProcessesHeaderProps) {
  const t = useT();

  return (
    <ViewHeader title={t.sidebar.procesos}>
      <div className="relative min-w-0 flex-1">
        <Input
          ref={buscadorRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          // Escape borra lo escrito, como en el buscador del Explorador de Windows.
          onKeyDown={(e) => {
            if (e.key === "Escape" && query !== "") {
              e.preventDefault();
              onQueryChange("");
            }
          }}
          placeholder={t.cabecera.buscarPlaceholder}
          // El placeholder desaparece en cuanto se escribe, asi que no vale como nombre
          // accesible (WCAG 3.3.2): con texto dentro, el campo se anunciaba sin decir que es.
          aria-label={t.cabecera.buscarLabel}
          aria-keyshortcuts="Control+F"
          className="pr-12"
        />
        {/* Vacío, la pista del atajo; con texto, la × para borrarlo (Tier 11, E). Ocupan el
            mismo sitio porque nunca hacen falta a la vez. */}
        {query === "" ? (
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1 font-mono text-xs text-muted-foreground"
          >
            Ctrl F
          </kbd>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.cabecera.borrarBusqueda}
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => {
              onQueryChange("");
              buscadorRef.current?.focus();
            }}
          >
            <XIcon />
          </Button>
        )}
      </div>

      {/* Una región viva, porque el número cambia al filtrar sin que nada lo anuncie.
          `polite` y no `assertive`: interesa que se diga, no que interrumpa.

          **La frase va en texto `sr-only`, no en un `aria-label`** (Tier 11, B6). Hasta
          entonces llevaba `aria-label` sobre un `<span>` sin rol, y eso no nombra nada:
          axe lo marcaba y los lectores lo ignoraban, así que se anunciaba «15» a secas. Se
          lee la frase y el número visible queda oculto para no decirlo dos veces. */}
      <span
        className="shrink-0 text-sm text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        <span aria-hidden>{visibles}</span>
        <span className="sr-only">{t.cabecera.enLaLista(visibles)}</span>
      </span>

      {/* Con el auto-refresco puesto, Refrescar casi no hace falta: queda como icono, con el
          motivo en el `title`. En «Off» es la única forma de ver datos nuevos, y va con su
          texto (Tier 11, E). */}
      {refreshMs > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          aria-label={t.cabecera.refrescar}
          title={t.cabecera.refrescarTitulo(
            REFRESH_INTERVALS.find((i) => i.ms === refreshMs)?.label ??
              `${refreshMs / 1000}s`,
          )}
          className="shrink-0"
        >
          <RefreshCwIcon />
        </Button>
      ) : (
        <Button variant="outline" onClick={onRefresh} className="shrink-0">
          <RefreshCwIcon />
          {t.cabecera.refrescar}
        </Button>
      )}

      {/* Con una selección, Nuke All se aparta y la acción pasa a la barra de abajo: una
          sola acción destructiva a la vista, la que corresponde a lo que se está haciendo.
          `invisible` y no quitarlo: conserva el hueco y el buscador no salta al marcar la
          primera casilla. `visibility: hidden` lo saca también del tabulador y del lector.

          Con un filtro o una búsqueda, **el rótulo lo dice** (D3): «Nuke All» cerraba la
          lista filtrada, no todo, y eso solo se sabía abriendo el diálogo. */}
      <Button
        variant="destructive"
        className={`${SOLID_DESTRUCTIVE} ${haySeleccion ? "invisible" : ""}`}
        disabled={cerrables === 0}
        aria-label={filtrada ? t.cabecera.nukeFiltradosLabel(cerrables) : undefined}
        onClick={onNuke}
      >
        {filtrada ? t.cabecera.nukeFiltrados : t.cabecera.nukeAll}
      </Button>
    </ViewHeader>
  );
}
