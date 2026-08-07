import { useState } from "react";
import { ChevronRightIcon, HistoryIcon, ListIcon, SettingsIcon } from "lucide-react";
import { REFRESH_INTERVALS, RUNTIMES } from "../types";
import type { ProcessInfo, Runtime, SystemUsage } from "../types";
import { RUNTIME_ICONS } from "../icons";
import { UsageMeter } from "./UsageMeter";
import { Button } from "@/components/ui/button";

/** Las tres vistas de la app. Excluyentes: solo se pinta una a la vez. */
export type View = "processes" | "history" | "settings";

/** Filtro por runtime de la tabla, o "all" para no filtrar. */
export type Filter = Runtime | "all";

/** Id de la lista de filtros, para que `aria-controls` apunte a algo real. */
const FILTROS_ID = "filtros-runtime";

type SidebarProps = {
  view: View;
  onViewChange: (view: View) => void;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  /**
   * La lista **sin filtrar**: los contadores de cada runtime tienen que contar
   * sobre el total, no sobre lo que ya dejo pasar el filtro. Con la lista filtrada,
   * pulsar "Node" pondria los demas a cero.
   */
  processes: ProcessInfo[];
  refreshMs: number;
  onRefreshMsChange: (ms: number) => void;
  /** Ultima medida que empujo Rust, o `null` si todavia no ha llegado ninguna. */
  usage: SystemUsage | null;
};

export function Sidebar({
  view,
  onViewChange,
  filter,
  onFilterChange,
  processes,
  refreshMs,
  onRefreshMsChange,
  usage,
}: SidebarProps) {
  /**
   * Si los filtros estan desplegados bajo "Procesos".
   *
   * El estado vive aqui, al reves que el del orden de la tabla: el sidebar **no
   * se desmonta nunca**, asi que no hay riesgo de perder la eleccion del usuario
   * al cambiar de vista. Subirlo a App seria pasarle a App un detalle que solo
   * le importa a este componente.
   */
  const [abierto, setAbierto] = useState(true);

  // Los filtros solo tienen sentido con la tabla delante: filtrar lo que no se
  // esta mirando no ordena nada. Por eso "desplegado" es la conjuncion de las dos
  // cosas, y es lo que se anuncia en aria-expanded.
  const desplegado = view === "processes" && abierto;

  function pulsarProcesos() {
    // Desde otra vista, lo que se pide es ir a Procesos; el pliegue se respeta tal
    // como lo dejo el usuario. Ya estando ahi, el mismo boton pliega y despliega.
    if (view !== "processes") {
      onViewChange("processes");
      return;
    }
    setAbierto((v) => !v);
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <h1 className="font-heading text-sm font-semibold tracking-wide">
          ProcessDevKill
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Process Manager</p>
      </div>

      {/* En vertical, y no tres pestañas en fila: con 208 px de ancho no cabian
          sin recortarles el padding, y asi los filtros por runtime pasan a colgar
          de "Procesos" en vez de flotar debajo sin decir de que dependen. */}
      <nav className="flex flex-col gap-0.5 p-2">
        <NavItem
          icon={ListIcon}
          label="Procesos"
          active={view === "processes"}
          onClick={pulsarProcesos}
          expandido={desplegado}
          controla={FILTROS_ID}
          // El total solo se enseña con los filtros plegados: desplegados lo dice
          // "Todos", y repetirlo dos lineas seguidas sobra.
          count={desplegado ? undefined : processes.length}
        />

        {desplegado && (
          <div
            id={FILTROS_ID}
            // La guia vertical es lo que hace que se lean como hijos de "Procesos"
            // y no como otra lista suelta.
            className="ml-3.75 flex flex-col gap-0.5 border-l border-sidebar-border pl-2"
          >
            <FilterButton
              label="Todos"
              count={processes.length}
              active={filter === "all"}
              onClick={() => onFilterChange("all")}
            />
            {(Object.keys(RUNTIMES) as Runtime[]).map((runtime) => (
              <FilterButton
                key={runtime}
                label={RUNTIMES[runtime].label}
                runtime={runtime}
                count={processes.filter((p) => p.runtime === runtime).length}
                active={filter === runtime}
                onClick={() => onFilterChange(runtime)}
              />
            ))}
          </div>
        )}

        <NavItem
          icon={HistoryIcon}
          label="Historial"
          active={view === "history"}
          onClick={() => onViewChange("history")}
        />
        <NavItem
          icon={SettingsIcon}
          label="Ajustes"
          active={view === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </nav>

      {/* Abajo del todo, pegado al auto-refresco: los dos hablan del pulso de la
          app, y el medidor depende de que ese pulso este encendido. */}
      <div className="mt-auto">
        <UsageMeter usage={usage} pausado={refreshMs === 0} />
      </div>

      <div className="border-t border-sidebar-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">Auto-refresco</p>
        <div className="flex gap-1">
          {REFRESH_INTERVALS.map(({ label, ms }) => (
            <Button
              key={label}
              size="xs"
              variant={refreshMs === ms ? "secondary" : "ghost"}
              aria-pressed={refreshMs === ms}
              onClick={() => onRefreshMsChange(ms)}
              className="flex-1"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * Una de las tres vistas.
 *
 * `aria-current="page"` y no `aria-pressed`: son vistas excluyentes, o sea
 * navegacion y no un interruptor. Un lector de pantalla dice "vista actual".
 */
function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  count,
  expandido,
  controla,
}: {
  icon: typeof ListIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  /** Solo lo pasa "Procesos", que ademas de navegar pliega sus filtros. */
  expandido?: boolean;
  controla?: string;
}) {
  const esDesplegable = expandido !== undefined;

  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      aria-current={active ? "page" : undefined}
      aria-expanded={esDesplegable ? expandido : undefined}
      // Apuntar a un id que no existe seria peor que no apuntar a nada: solo se
      // pone cuando la lista esta pintada de verdad.
      aria-controls={esDesplegable && expandido ? controla : undefined}
      onClick={onClick}
      className="justify-start gap-2 px-2"
    >
      {esDesplegable ? (
        <ChevronRightIcon
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
            expandido ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      ) : (
        // Hueco del ancho del chevron: sin el, los iconos de Historial y Ajustes
        // no alinean con el de Procesos y la lista se ve torcida.
        <span className="size-3.5 shrink-0" />
      )}
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </Button>
  );
}

function FilterButton({
  label,
  count,
  active,
  runtime,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  runtime?: Runtime;
  onClick: () => void;
}) {
  const Icon = runtime ? RUNTIME_ICONS[runtime] : null;

  return (
    <Button
      size="xs"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className="justify-start gap-2 px-2"
    >
      {Icon ? (
        <Icon
          className="size-4 shrink-0"
          style={{ color: RUNTIMES[runtime!].color }}
        />
      ) : (
        // Hueco del mismo tamano que el icono: sin el, "Todos" no alinea su
        // texto con el resto de la lista.
        <span className="size-4 shrink-0" />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Button>
  );
}
