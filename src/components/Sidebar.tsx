import { useState } from "react";
import {
  ChevronRightIcon,
  HistoryIcon,
  ListIcon,
  ServerIcon,
  SettingsIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { REFRESH_INTERVALS, RUNTIME_COLORS } from "../types";
import type { ProcessInfo, Runtime, SystemUsage } from "../types";
import { useT } from "../i18n";
import { RUNTIME_ICONS } from "../icons";
import { UsageMeter } from "./UsageMeter";
import { Segmented } from "./Segmented";
import { Button } from "@/components/ui/button";

/** Las cuatro vistas de la app. Excluyentes: solo se pinta una a la vez. */
export type View = "processes" | "services" | "history" | "settings";

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
  /** Si la app corre como administrador; `null` mientras no se sabe. Con `false`, sale el aviso. */
  elevated: boolean | null;
  /** Lleva a la sección de Ajustes que explica el aviso y deja reiniciar elevada. */
  onVerAdmin: () => void;
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
  elevated,
  onVerAdmin,
}: SidebarProps) {
  const t = useT();

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
      {/*
        En una ventana baja (`short:`, ≤ 600 px de alto) el sidebar se compacta: sin subtítulo, y
        el medidor sin su título ni las cifras del equipo, que siguen en el `title` de cada métrica
        y para el lector de pantalla. Tier 11, C3: a 480 px, el alto mínimo que se promete, pedía
        582 con los filtros desplegados y el auto-refresco quedaba fuera **sin scroll que lo
        alcanzara**. Compactado pide unos 480. Por si un idioma o un tamaño de letra lo pasa, la
        navegación hace scroll: lo que no puede quedar fuera es el auto-refresco.
      */}
      <div className="shrink-0 border-b border-sidebar-border px-4 py-4 short:py-3">
        <h1 className="font-heading text-sm font-semibold tracking-wide">
          ProcessDevKill
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground short:hidden">
          {t.sidebar.subtitulo}
        </p>
      </div>

      {/* En vertical, y no tres pestañas en fila: con 208 px de ancho no cabian
          sin recortarles el padding, y asi los filtros por runtime pasan a colgar
          de "Procesos" en vez de flotar debajo sin decir de que dependen. */}
      <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-2">
        <NavItem
          icon={ListIcon}
          label={t.sidebar.procesos}
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
              label={t.sidebar.todos}
              count={processes.length}
              active={filter === "all"}
              onClick={() => onFilterChange("all")}
            />
            {(Object.keys(RUNTIME_COLORS) as Runtime[]).map((runtime) => (
              <FilterButton
                key={runtime}
                label={t.runtimes[runtime]}
                runtime={runtime}
                count={processes.filter((p) => p.runtime === runtime).length}
                active={filter === runtime}
                onClick={() => onFilterChange(runtime)}
              />
            ))}
          </div>
        )}

        {/* Justo debajo de Procesos, y antes que Historial: las dos de arriba responden la misma
            pregunta -quien ocupa mi puerto- para las dos mitades del equipo, la que lanza el
            usuario y la que lanza Windows. */}
        <NavItem
          icon={ServerIcon}
          label={t.sidebar.servicios}
          active={view === "services"}
          onClick={() => onViewChange("services")}
        />
        <NavItem
          icon={HistoryIcon}
          label={t.sidebar.historial}
          active={view === "history"}
          onClick={() => onViewChange("history")}
        />
        <NavItem
          icon={SettingsIcon}
          label={t.sidebar.ajustes}
          active={view === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </nav>

      {/* Abajo del todo, pegado al auto-refresco: los dos hablan del pulso de la
          app, y el medidor depende de que ese pulso este encendido. */}
      <div className="mt-auto shrink-0">
        {elevated === false && <AvisoSinAdmin onClick={onVerAdmin} />}
        <UsageMeter usage={usage} pausado={refreshMs === 0} />
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3 short:py-2">
        <p className="mb-2 text-xs text-muted-foreground short:mb-1.5">
          {t.sidebar.autoRefresco}
        </p>
        <Segmented
          label={t.sidebar.autoRefresco}
          value={refreshMs}
          onChange={onRefreshMsChange}
          options={REFRESH_INTERVALS.map(({ label, ms }) => ({ value: ms, label }))}
          fill
          compact
        />
      </div>
    </aside>
  );
}

/**
 * El aviso de que la app corre sin permisos de administrador.
 *
 * Va en el hueco entre la navegación y el medidor, que a 680 px de alto —el de fábrica— quedaba
 * vacío, y pegado al medidor porque habla de lo mismo: lo que la app puede medir. Es un botón que
 * lleva a Ajustes, donde está la explicación entera, el reinicio elevado y el ajuste para arrancar
 * siempre así; aquí solo cabe qué falta.
 *
 * **Cabe en el hueco, no lo agranda.** Con los filtros desplegados el sidebar pide 582 px sin el
 * aviso, así que a 680 —el alto de fábrica— quedan 98: el aviso entero mide unos 84. Por debajo va
 * por escalones, para que la navegación no tenga que hacer scroll: de 620 a 679 px de alto, solo
 * el título (el detalle pasa a `sr-only`); por debajo de 620, nada, que el sidebar ya va justo
 * (Tier 11, C3) y lo que no puede quedar fuera es el auto-refresco. El aviso sigue en Ajustes.
 * La primera versión, con el icono sangrando el texto, medía 116 px y hacía scroll a 680: medido.
 */
function AvisoSinAdmin({ onClick }: { onClick: () => void }) {
  const t = useT();
  const a = t.sidebar.sinAdmin;

  return (
    <div className="px-2 pb-2 [@media(max-height:619px)]:hidden">
      <button
        type="button"
        onClick={onClick}
        className="block w-full cursor-pointer rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-left text-xs transition-colors hover:bg-amber-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldAlertIcon
            className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden
          />
          {a.titulo}
        </span>
        <span className="mt-0.5 block text-muted-foreground [@media(max-height:679px)]:sr-only">
          {a.detalle}
        </span>
        <span className="sr-only">{a.destino}</span>
      </button>
    </div>
  );
}

/**
 * Cómo se marca lo activo en el sidebar: barra de acento a la izquierda y seminegrita.
 *
 * Tier 11, B4. Solo con el fondo de `secondary`, la vista activa se separaba del resto por
 * **1,03:1** en claro (1,21:1 en oscuro) y con el mismo peso de letra: había que adivinarla. La
 * barra va en `foreground`, que contrasta de sobra con el sidebar en los dos temas.
 *
 * **La barra es un elemento, no un `::before`** (Tier 11, E). Con el pseudoelemento, axe no sabía
 * de qué color era el fondo del recuento del filtro activo y lo dejaba como contraste por revisar.
 */
const MARCA_ACTIVA = "font-semibold";

function BarraActiva() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-foreground"
    />
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
      className={`relative justify-start gap-2 px-2 ${active ? MARCA_ACTIVA : ""}`}
    >
      {active && <BarraActiva />}
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
      className={`relative justify-start gap-2 px-2 ${active ? MARCA_ACTIVA : ""}`}
    >
      {active && <BarraActiva />}
      {Icon ? (
        <Icon
          className="size-4 shrink-0"
          style={{ color: RUNTIME_COLORS[runtime!] }}
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
