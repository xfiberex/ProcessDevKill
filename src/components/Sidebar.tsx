import { REFRESH_INTERVALS, RUNTIMES } from "../types";
import type { ProcessInfo, Runtime } from "../types";
import { RUNTIME_ICONS } from "../icons";
import { Button } from "@/components/ui/button";

/** Las tres vistas de la app. Excluyentes: solo se pinta una a la vez. */
export type View = "processes" | "history" | "settings";

/** Filtro por runtime de la tabla, o "all" para no filtrar. */
export type Filter = Runtime | "all";

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
};

export function Sidebar({
  view,
  onViewChange,
  filter,
  onFilterChange,
  processes,
  refreshMs,
  onRefreshMsChange,
}: SidebarProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <h1 className="font-heading text-sm font-semibold tracking-wide">
          ProcessDevKill
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Process Manager</p>
      </div>

      <nav className="flex gap-1 border-b border-sidebar-border p-2">
        {(
          [
            ["processes", "Procesos"],
            ["history", "Historial"],
            ["settings", "Ajustes"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="xs"
            variant={view === id ? "secondary" : "ghost"}
            // `aria-current`, no `aria-pressed`: esto es navegacion entre vistas
            // excluyentes, no un interruptor. Un lector de pantalla dice "vista
            // actual" en vez de "presionado", que es lo que de verdad pasa.
            aria-current={view === id ? "page" : undefined}
            onClick={() => onViewChange(id)}
            // px-1: con el padding por defecto las tres pestañas no caben en
            // los 208 px del sidebar y "Ajustes" se sale por el borde.
            className="min-w-0 flex-1 px-1"
          >
            {label}
          </Button>
        ))}
      </nav>

      {view === "processes" && (
        <nav className="flex flex-col gap-1 p-2">
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
        </nav>
      )}

      <div className="mt-auto border-t border-sidebar-border p-3">
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
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className="justify-start gap-2 px-3"
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
