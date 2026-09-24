import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  GhostIcon,
  LockIcon,
  LockOpenIcon,
  SkullIcon,
} from "lucide-react";
import { RUNTIME_ICONS } from "../icons";
import { RUNTIME_COLORS } from "../types";
import type { ProcessInfo } from "../types";
import { useT } from "../i18n";
import type { Catalogo } from "../i18n";
import { formatMemory, formatUptime } from "../lib/format";
import { claveProteccion } from "../lib/protect";
import type { Sort, SortKey } from "../lib/sort";
import { UsageBar } from "./UsageBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/**
 * Un núcleo, en porcentaje del equipo: el suelo de la escala de la barra de CPU (ver `maxCpu`).
 *
 * `hardwareConcurrency` son los procesadores lógicos, los mismos que cuenta sysinfo para repartir
 * la CPU de cada proceso (`cpu_usage() / cores` en processes.rs). Sin él —no pasa en WebView2—,
 * se suponen 8.
 */
const CPU_UN_NUCLEO = 100 / (navigator.hardwareConcurrency || 8);

type ProcessTableProps = {
  /** Ya filtrada **y ordenada**: aqui solo se pinta lo que llega. */
  processes: ProcessInfo[];
  selected: Set<number>;
  killing: Set<number>;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onToggle: (pid: number) => void;
  onToggleAll: () => void;
  onKill: (pid: number) => void;
  onCopy: (text: string, what: string) => void;
  /** Proteger (`true`) o dejar de proteger una fila desde su menú. */
  onProtect: (proceso: ProcessInfo, proteger: boolean) => void;
  /**
   * Avisa de cuándo hay que congelar el orden: con el puntero encima de las filas o con un menú
   * abierto. El orden lo aplica App, que es quien ordena; ver `freezeOrder`.
   */
  onFreezeChange: (congelar: boolean) => void;
};

export function ProcessTable({
  processes,
  selected,
  killing,
  sort,
  onSort,
  onToggle,
  onToggleAll,
  onKill,
  onCopy,
  onProtect,
  onFreezeChange,
}: ProcessTableProps) {
  const t = useT();

  // Dos motivos para congelar, por separado: al pasar al menú —que va en un portal, fuera de la
  // tabla— el puntero sale del `<tbody>`, y el orden tiene que seguir quieto mientras el menú viva.
  const [encima, setEncima] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const congelar = encima || menuAbierto;
  useEffect(() => {
    onFreezeChange(congelar);
  }, [congelar, onFreezeChange]);

  // Referencias para las barras: el proceso que mas consume marca el 100 %.
  //
  // La CPU, con un suelo de **un núcleo entero** (Tier 11, D6). Sin él, en reposo el mayor era un
  // proceso al 2,5 % y salía con la barra llena, como si estuviera ardiendo. Un núcleo y no una
  // cifra fija porque `cpu` es sobre el equipo entero: en 16 hilos, un Node que satura el suyo da
  // 6,25 %, y esa sí es una barra llena. La RAM no lleva suelo: la decisión del 2026-07-23 se
  // razonó para ella, y comparar entre sí lo que ocupa sigue siendo lo útil.
  const maxCpu = Math.max(...processes.map((p) => p.cpu), CPU_UN_NUCLEO);
  const maxMemory = Math.max(...processes.map((p) => p.memoryMb), 1);

  const allSelected =
    processes.length > 0 && processes.every((p) => selected.has(p.pid));

  return (
    <table className="w-full table-fixed text-sm">
      {/* Sin esto la tabla se anuncia como "tabla, 8 columnas" y nada mas. `sr-only` porque el
          titulo ya esta a la vista en la cabecera: es informacion que le falta al lector de
          pantalla, no a la ventana. */}
      <caption className="sr-only">{t.tabla.caption}</caption>
      {/*
        Anchos fijos, como en Servicios desde la v1.5.1 (Tier 11, C1). En una tabla automática,
        medido: las columnas se movían **hasta 13 px** entre refrescos —cada cifra nueva recalcula
        todas—, a 900 px la tabla pedía 743 donde había 677, y un nombre largo como
        `Microsoft.CodeAnalysis.LanguageServer.exe` no se truncaba: empujaba Activo y Kill fuera de
        la ventana.

        Cada ancho sale de medir lo que pide la columna en la app, en español —el idioma con los
        rótulos más largos—, con la flecha de orden visible y el relleno: Puerto lo marca su
        encabezado (91), PID un PID de 6 cifras, CPU y RAM su cifra más larga sobre la barra
        (ver `UsageBar`) y Activo su encabezado (87). Suman 520: al nombre le quedan 157 px en
        la ventana mínima y 257 en la de fábrica, y es la única columna que crece.
      */}
      <colgroup>
        <col className="w-9" />
        <col />
        <col className="w-23" />
        <col className="w-16" />
        <col className="w-19" />
        <col className="w-22" />
        <col className="w-22" />
        <col className="w-19" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
        <tr>
          {/* scope="col": en una tabla de ocho columnas es lo que hace que un
              lector de pantalla diga "Puerto: 3000" al recorrer celdas, en vez de
              leer numeros sueltos sin saber de que son. */}
          <th scope="col" className="py-2 pl-5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              aria-label={t.tabla.seleccionarTodos}
            />
          </th>
          <SortableHeader sortKey="name" sort={sort} onSort={onSort} t={t} junto />
          <SortableHeader sortKey="port" sort={sort} onSort={onSort} t={t} />
          <SortableHeader sortKey="pid" sort={sort} onSort={onSort} t={t} align="right" />
          <SortableHeader sortKey="cpu" sort={sort} onSort={onSort} t={t} align="right" />
          <SortableHeader
            sortKey="memoryMb"
            sort={sort}
            onSort={onSort}
            t={t}
            align="right"
          />
          <SortableHeader
            sortKey="runTimeSecs"
            sort={sort}
            onSort={onSort}
            t={t}
            align="right"
          />
          <th scope="col" className="px-5 py-2">
            <span className="sr-only">{t.tabla.acciones}</span>
          </th>
        </tr>
      </thead>

      <tbody
        onPointerEnter={() => setEncima(true)}
        onPointerLeave={() => setEncima(false)}
      >
        <AnimatePresence initial={false}>
          {processes.map((p) => {
            const Icon = RUNTIME_ICONS[p.runtime];
            const color = RUNTIME_COLORS[p.runtime];
            const label = t.runtimes[p.runtime];
            const isKilling = killing.has(p.pid);
            // Script y carpeta, en gris debajo del nombre: con 13 de 15 filas llamadas
            // `node.exe`, es lo único que dice cuál es cuál. Mismo patrón que Servicios.
            const detalle = [p.script, p.project].filter(Boolean).join(" · ");
            const clave = claveProteccion(p);
            const seleccionada = selected.has(p.pid);

            return (
              // ContextMenu (Base UI) no pinta ningun elemento propio, asi que
              // puede envolver una fila sin romper el <tbody>; el trigger es la
              // <tr> de siempre, via `render`.
              <ContextMenu key={p.pid} onOpenChange={setMenuAbierto}>
                <ContextMenuTrigger
                  render={
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isKilling ? 0.4 : 1 }}
                      exit={{
                        opacity: 0,
                        x: -24,
                        backgroundColor: "rgba(220,38,38,0.25)",
                      }}
                      transition={{ duration: 0.18 }}
                      // El zombi se tiñe de ambar en toda la fila: la insignia
                      // sola se pierde en una tabla de veinte lineas.
                      //
                      // La seleccionada lleva fondo (Tier 11, D7), por encima del ámbar: con
                      // la casilla sola, de 16 px en el borde, no se veía qué filas iban a caer.
                      // `group/fila` es para el Kill, que se tiñe con la fila (D5).
                      data-selected={seleccionada ? "" : undefined}
                      className={`group/fila border-t border-border data-popup-open:bg-muted/60 ${
                        seleccionada
                          ? "bg-muted hover:bg-muted"
                          : p.zombie
                            ? "bg-amber-500/8 hover:bg-amber-500/15"
                            : "hover:bg-muted/60"
                      }`}
                    />
                  }
                >
                  {/* La barra de acento, en la celda y no en la fila: el `box-shadow` de un
                      `<tr>` no lo pinta Chromium con `border-collapse`. Mismo acento que la vista
                      activa del sidebar (B4), para que «elegido» se vea igual en toda la app. */}
                  <td
                    className={`py-2 pl-5 ${
                      seleccionada ? "shadow-[inset_3px_0_0_var(--color-foreground)]" : ""
                    }`}
                  >
                    <Checkbox
                      checked={seleccionada}
                      onCheckedChange={() => onToggle(p.pid)}
                      aria-label={t.tabla.seleccionarPid(p.pid)}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" style={{ color }} />
                      {/* `min-w-0` para que el flex le deje encoger y `truncate` recorte: la
                          columna ya tiene el ancho que le deja la tabla fija (C1). Hasta entonces
                          llevaba un tope de 128 px, porque en una tabla automática `truncate` no
                          recortaba, empujaba. El texto entero queda en el `title`. */}
                      <span className="min-w-0" title={detalle || undefined}>
                        <span className="block truncate">{p.name}</span>
                        {detalle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {detalle}
                          </span>
                        )}
                      </span>
                      <span className="sr-only">{label}</span>
                      {p.protected && (
                        <span
                          className="flex shrink-0 items-center text-muted-foreground"
                          title={t.tabla.protegidoTitulo}
                        >
                          <LockIcon className="size-3.5" aria-hidden />
                          <span className="sr-only">{t.tabla.protegido}</span>
                        </span>
                      )}
                      {p.zombie && (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                          title={t.tabla.zombiTitulo(
                            formatUptime(p.idleSecs),
                            p.ports,
                          )}
                        >
                          <GhostIcon className="size-3.5" aria-hidden />
                          {t.tabla.zombi}
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {p.ports.length === 0 ? (
                      // Sin el /50: al 50 % de opacidad el guion se queda en ~2:1 de
                      // contraste, por debajo del minimo. Es poca informacion, pero
                      // es informacion.
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {p.ports.map((port) => (
                          <span
                            key={port}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums"
                          >
                            {port}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {p.pid}
                  </td>

                  <td className="px-3 py-2">
                    <UsageBar
                      label={`${p.cpu.toFixed(1)}%`}
                      value={p.cpu}
                      max={maxCpu}
                      color={color}
                      // «0.0%» en gris (D6): en reposo casi todas las filas lo dicen, y en el
                      // blanco de las cifras con carga competía con ellas.
                      apagada={p.cpu < 0.05}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <UsageBar
                      label={formatMemory(p.memoryMb)}
                      value={p.memoryMb}
                      max={maxMemory}
                      color={color}
                    />
                  </td>

                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {formatUptime(p.runTimeSecs)}
                  </td>

                  <td className="px-5 py-2 text-right">
                    {/* Neutro, y rojo solo con la fila bajo el puntero o con el foco dentro (Tier 11,
                        D5). Un botón rojo por fila eran veinte manchas rojas compitiendo con los
                        puertos, que son lo que se viene a mirar; el rojo lleno queda para Nuke All.
                        Revisa la decisión del 2026-07-24, que pedía rojo para «la acción
                        destructiva principal»: esa es Nuke All, no cada Kill. */}
                    <Button
                      size="xs"
                      variant="outline"
                      // El borde, también con `dark:`: el `dark:border-control` del outline gana
                      // por especificidad a un `group-hover` sin tema (medido en vivo).
                      className="text-muted-foreground group-focus-within/fila:border-destructive/40 group-focus-within/fila:text-destructive-text group-hover/fila:border-destructive/40 group-hover/fila:text-destructive-text hover:bg-destructive/10 hover:text-destructive-text dark:group-focus-within/fila:border-destructive/50 dark:group-hover/fila:border-destructive/50 dark:hover:bg-destructive/20"
                      onClick={() => onKill(p.pid)}
                      // Protegido: el botón se queda a la vista pero apagado, con el motivo en el
                      // `title`. Quitarlo dejaría un hueco en la columna que se leería como un fallo.
                      disabled={isKilling || p.protected}
                      title={p.protected ? t.tabla.protegidoTitulo : undefined}
                      // Sin esto hay veinte botones que se anuncian "Kill" a secas,
                      // sin decir cual mata cada uno. El checkbox de la misma fila ya
                      // se nombraba bien; para el boton que cierra un proceso es
                      // justo la etiqueta que no se puede fallar.
                      aria-label={t.tabla.killLabel(p.name, p.pid)}
                    >
                      {t.tabla.kill}
                    </Button>
                  </td>
                </ContextMenuTrigger>

                {/* Lo destructivo, **al final** y tras un separador (Tier 11, A6). Estaba el primero:
                    abierto por teclado, la primera flecha caía en «Matar proceso», que cierra sin
                    diálogo, y con el ratón era la entrada que quedaba justo bajo el cursor. */}
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => onCopy(String(p.pid), `PID ${p.pid}`)}
                  >
                    <CopyIcon />
                    {t.tabla.copiarPid}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCopy(p.name, p.name)}
                  >
                    <CopyIcon />
                    {t.tabla.copiarNombre}
                  </ContextMenuItem>
                  {p.ports.length > 0 && (
                    <ContextMenuItem
                      onClick={() =>
                        onCopy(p.ports.join(", "), t.tabla.quePuertos(p.ports))
                      }
                    >
                      <CopyIcon />
                      {t.tabla.copiarPuertos(p.ports.length)}
                    </ContextMenuItem>
                  )}
                  {p.ports.length > 0 && (
                    <ContextMenuItem
                      onClick={() =>
                        onCopy(
                          `http://localhost:${p.ports[0]}`,
                          `http://localhost:${p.ports[0]}`,
                        )
                      }
                    >
                      <CopyIcon />
                      {t.tabla.copiarUrl(`http://localhost:${p.ports[0]}`)}
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  {p.protected ? (
                    <ContextMenuItem onClick={() => onProtect(p, false)}>
                      <LockOpenIcon />
                      {t.tabla.desproteger(clave)}
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem onClick={() => onProtect(p, true)}>
                      <LockIcon />
                      {t.tabla.proteger(clave)}
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    disabled={p.protected}
                    onClick={() => onKill(p.pid)}
                  >
                    <SkullIcon />
                    {t.tabla.cerrarProceso}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </AnimatePresence>
      </tbody>
    </table>
  );
}

/**
 * Encabezado que ordena al pulsarlo.
 *
 * El estado va en `aria-sort` sobre el `<th>`, que es lo que un lector de pantalla
 * anuncia al entrar en la columna ("ordenado de forma descendente"); la flecha es
 * su equivalente visual y va `aria-hidden` para no leerla dos veces.
 */
function SortableHeader({
  sortKey,
  sort,
  onSort,
  t,
  align = "left",
  junto,
}: {
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  /** El catalogo llega por prop: son seis instancias por render y no hace falta que cada
   *  una vuelva a pedir el contexto. */
  t: Catalogo;
  align?: "left" | "right";
  /**
   * La columna pegada a la casilla de «Seleccionar todos» (Tier 11, B3).
   *
   * La casilla mide 16 px y WCAG 2.5.8 la admite así solo si un círculo de 24 px centrado en ella
   * no pisa otro objetivo, y el botón de «Proceso» empezaba justo en su borde. Aquí el hueco pasa
   * de dentro del botón a la celda: 8 px de celda y 4 de botón en vez de 12 de botón. El texto se
   * queda donde estaba y el botón empieza 8 px más allá, fuera del círculo.
   */
  junto?: boolean;
}) {
  const activa = sort.key === sortKey;
  const ascendente = sort.dir === "asc";
  const Flecha = ascendente ? ArrowUpIcon : ArrowDownIcon;

  return (
    <th
      scope="col"
      aria-sort={activa ? (ascendente ? "ascending" : "descending") : "none"}
      className={`py-0 font-medium ${align === "right" ? "text-right" : "text-left"} ${
        junto ? "pl-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        // `group` para que la flecha fantasma de las columnas inactivas aparezca
        // al pasar por encima: sin ninguna pista, que la tabla se ordena no lo
        // descubre nadie. Con focus-visible sale tambien navegando con teclado.
        // En las columnas alineadas a la derecha, la flecha va a la **izquierda** del rótulo
        // (Tier 11, C2): a la derecha, su hueco —invisible mientras la columna no ordena— dejaba el
        // rótulo 18 px a la izquierda de sus cifras. `flex-row-reverse` con `justify-start` la
        // pone delante y pega el rótulo al borde derecho, al mismo relleno que las celdas.
        className={`group flex w-full cursor-pointer items-center justify-start gap-1 pr-3 ${junto ? "pl-1" : "pl-3"} py-2 tracking-wide uppercase transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
          align === "right" ? "flex-row-reverse" : ""
        } ${activa ? "text-foreground" : ""}`}
      >
        {t.columnas[sortKey]}
        {activa ? (
          <Flecha className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronsUpDownIcon
            className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
            aria-hidden
          />
        )}
      </button>
    </th>
  );
}
