import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/** Id del texto que dice las teclas de la tabla, para su `aria-describedby`. */
const TECLAS_ID = "tabla-teclas";

/**
 * La columna de Kill cuando la tabla hace scroll horizontal (T14-17): pegada a la derecha, con
 * fondo propio —si no, las columnas que pasan por debajo se verían a través— y una línea que la
 * separa. Solo por debajo de 572 px de cuerpo, que es cuando puede haber scroll; por encima la
 * celda se queda como estaba, con el fondo de su fila.
 */
const KILL_PEGADO =
  "@max-[571px]:sticky @max-[571px]:right-0 @max-[571px]:bg-background @max-[571px]:px-3 @max-[571px]:shadow-[inset_1px_0_0_var(--color-border)]";

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
  /**
   * Supr sobre una fila (T14-14): pide el cierre **con confirmación**. Lo decidió el usuario el
   * 2026-10-05: el botón Kill cierra sin preguntar porque hay que apuntarle; una tecla se pulsa
   * sin mirar.
   */
  onAskKill: (proceso: ProcessInfo) => void;
  onCopy: (text: string, what: string) => void;
  /** Proteger (`true`) o dejar de proteger una fila desde su menú. */
  onProtect: (proceso: ProcessInfo, proteger: boolean) => void;
  /**
   * Avisa de cuándo hay que congelar el orden: con el puntero encima de las filas o con un menú
   * abierto. El orden lo aplica App, que es quien ordena; ver `freezeOrder`.
   */
  onFreezeChange: (congelar: boolean) => void;
  /**
   * Adónde va el foco cuando un cierre deja la tabla sin filas: al buscador (T14-13). Lo pone
   * `App`, que es quien lo tiene; con la tabla desmontada ya no hay fila a la que llevarlo.
   */
  onSinFilas?: () => void;
};

/**
 * Si el foco se ha quedado sin dueño: en `body`, en un elemento que ya no está o en uno apagado.
 *
 * Es lo que pasa cuando sale la fila que lo tenía. Solo entonces se mueve: si el usuario ya lo
 * llevó a otro sitio mientras el proceso se cerraba, ahí se queda.
 */
function focoPerdido(): boolean {
  const activo = document.activeElement;
  if (!activo || activo === document.body) return true;
  if (!activo.isConnected) return true;
  if (activo instanceof HTMLButtonElement && activo.disabled) return true;
  // La fila que sale sigue pintada mientras dura su animación, con el foco dentro.
  return activo.closest("tr[data-saliendo]") !== null;
}

export function ProcessTable({
  processes,
  selected,
  killing,
  sort,
  onSort,
  onToggle,
  onToggleAll,
  onKill,
  onAskKill,
  onCopy,
  onProtect,
  onFreezeChange,
  onSinFilas,
}: ProcessTableProps) {
  const t = useT();
  const tablaRef = useRef<HTMLTableElement>(null);

  /**
   * Devolver el foco tras un cierre (T14-13).
   *
   * Medido: con el foco en un Kill e Intro, la fila salía en 558 ms y el foco quedaba en `body`;
   * volver a la primera fila eran más de veinte tabuladores. Ahora va a la fila que ocupa el sitio
   * de la que salió —o a la anterior, si era la última—; tras un lote, a la primera que quede; y
   * sin filas, al buscador.
   *
   * **Solo tras un cierre pedido desde la ventana**, que es lo único que llena `killing`: uno de
   * la bandeja, del atajo global o del Auto-Kill no pasa por aquí y no mueve nada. Y solo si el
   * foco se ha perdido de verdad (`focoPerdido`).
   */
  const cierre = useRef<{ pids: number[]; indice: number; lote: boolean } | null>(null);
  const sinFilas = useRef(onSinFilas);
  useEffect(() => {
    sinFilas.current = onSinFilas;
  });

  useEffect(() => {
    if (killing.size === 0) return;
    const pids = [...killing];
    cierre.current = {
      pids,
      indice: Math.max(0, processes.findIndex((p) => killing.has(p.pid))),
      lote: pids.length > 1,
    };
    // Solo al empezar un cierre: `processes` cambia con cada refresco y no es el disparador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killing]);

  useEffect(() => {
    const pendiente = cierre.current;
    if (!pendiente || killing.size > 0) return;
    // Mientras alguno siga en la lista, o no se ha cerrado todavía o el cierre falló: se espera.
    if (pendiente.pids.some((pid) => processes.some((p) => p.pid === pid))) return;
    cierre.current = null;
    if (processes.length === 0) return;

    const destino = processes[Math.min(pendiente.indice, processes.length - 1)];
    const primero = processes[0];
    // Un momento después: el diálogo de un lote devuelve el foco a su botón al cerrarse, y ese
    // botón desaparece con la selección. Mirar antes sería ver un foco que aún no se ha perdido.
    const espera = window.setTimeout(() => {
      if (!focoPerdido()) return;
      // A la fila, que es la parada de la tabla desde T14-14; antes iba a su Kill o a su casilla.
      const a = pendiente.lote ? primero : destino;
      tablaRef.current?.querySelector<HTMLElement>(`tr[data-pid="${a.pid}"]`)?.focus();
    }, 250);
    return () => window.clearTimeout(espera);
  }, [processes, killing]);

  // Sin filas la tabla se desmonta —`App` pinta el estado vacío—, y el efecto de arriba ya no
  // corre: el foco se lleva al buscador desde aquí, al salir.
  useEffect(
    () => () => {
      if (!cierre.current) return;
      window.setTimeout(() => {
        if (focoPerdido()) sinFilas.current?.();
      }, 250);
    },
    [],
  );

  // Dos motivos para congelar, por separado: al pasar al menú —que va en un portal, fuera de la
  // tabla— el puntero sale del `<tbody>`, y el orden tiene que seguir quieto mientras el menú viva.
  const [encima, setEncima] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Y un tercero desde T14-14: mientras se recorre con el teclado. Sin esto la fila de debajo
  // cambiaba entre una flecha y la siguiente, con cada refresco. Solo con foco **de teclado**
  // (`:focus-visible`): un clic también deja el foco dentro, y no por eso se quiere la lista quieta.
  const [conTeclado, setConTeclado] = useState(false);
  const congelar = encima || menuAbierto || conTeclado;

  /**
   * **La tabla es una sola parada de tabulador** (T14-14), como la lista del Administrador de
   * tareas. Medido: con 26 procesos, una vuelta de tabulador por la vista eran 74 paradas, 51 de
   * ellas las casillas y los Kill de las filas. Ahora se entra a la fila activa y se sigue con las
   * flechas; la casilla y el Kill salen del tabulador, y siguen ahí para el ratón.
   *
   * La fila activa es la última que tuvo el foco, o la primera si esa ya no está. Revisa la
   * decisión del 2026-07-27, que descartó el `tabIndex` en la fila «por las veinte paradas que
   * añadiría»: esto no añade, quita las dos que cada fila ya tenía.
   */
  const [activa, setActiva] = useState<number | null>(null);
  const pidActivo = processes.some((p) => p.pid === activa) ? activa : (processes[0]?.pid ?? null);

  function alPulsarEnFila(e: KeyboardEvent<HTMLTableRowElement>, p: ProcessInfo) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const enLaFila = e.target === e.currentTarget;

    if (e.key === "Delete") {
      e.preventDefault();
      // Protegida, nada: es lo mismo que hace su Kill, que está apagado.
      if (!p.protected && !killing.has(p.pid)) onAskKill(p);
      return;
    }
    // Solo con el foco en la fila: en la casilla, Espacio ya la marca por su cuenta.
    if (e.key === " " && enLaFila) {
      e.preventDefault();
      onToggle(p.pid);
      return;
    }

    const filas = [...(tablaRef.current?.querySelectorAll<HTMLElement>("tbody tr[data-pid]") ?? [])]
      // La que está saliendo sigue pintada mientras dura su animación.
      .filter((f) => !f.hasAttribute("data-saliendo"));
    const donde = filas.indexOf(e.currentTarget);
    const destino = {
      ArrowDown: filas[donde + 1],
      ArrowUp: filas[donde - 1],
      Home: filas[0],
      End: filas[filas.length - 1],
    }[e.key];
    if (e.key in { ArrowDown: 1, ArrowUp: 1, Home: 1, End: 1 }) {
      // También en los extremos: sin esto la flecha desplazaba la vista entera.
      e.preventDefault();
      destino?.focus();
    }
  }
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
    // Con zoom (Ctrl y +) el hueco de la tabla baja de lo que piden sus columnas fijas, 520 px, y
    // sin mínimo `table-fixed` le quitaba el sitio al nombre —0 px al 125 % en la ventana mínima,
    // medido—, que es lo que identifica la fila. El Tier 11 (E) lo resolvió con un ancho mínimo de
    // 620 px y scroll horizontal, y lo que quedaba detrás del scroll era Kill: la acción para la
    // que se abre la app (T14-17).
    //
    // **Ahora, antes de recortar el nombre o esconder Kill, se van las columnas secundarias**,
    // según el ancho del cuerpo de la vista (`@container`, en `App.tsx`): por debajo de 660 px,
    // «Activo»; por debajo de 572, también «PID». Los dos siguen en el menú de la fila. Con las dos
    // fuera las fijas suman 368, y el mínimo son esas más 100 para el nombre: si ni así cabe —el
    // 150 % y el 200 %—, hay scroll horizontal y **Kill se queda pegado a la derecha**.
    <table
      ref={tablaRef}
      className="w-full min-w-117 table-fixed text-sm"
      aria-describedby={TECLAS_ID}
    >
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
        <col className="w-16 @max-[571px]:hidden" />
        <col className="w-19" />
        <col className="w-22" />
        <col className="w-22 @max-[659px]:hidden" />
        <col className="w-19" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
        <tr>
          {/* scope="col": en una tabla de ocho columnas es lo que hace que un
              lector de pantalla diga "Puerto: 3000" al recorrer celdas, en vez de
              leer numeros sueltos sin saber de que son. */}
          <th scope="col" className="py-2 pl-5">
            {/* Las teclas de la tabla, para quien no las ve: su descripción (`aria-describedby`).
                Aquí dentro porque una tabla no admite un párrafo suelto, y fuera de ella obligaría
                a envolverla. */}
            <span id={TECLAS_ID} className="sr-only">
              {t.tabla.teclas}
            </span>
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              aria-label={t.tabla.seleccionarTodos}
            />
          </th>
          <SortableHeader sortKey="name" sort={sort} onSort={onSort} t={t} junto />
          <SortableHeader sortKey="port" sort={sort} onSort={onSort} t={t} />
          <SortableHeader
            sortKey="pid"
            sort={sort}
            onSort={onSort}
            t={t}
            align="right"
            className="@max-[571px]:hidden"
          />
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
            className="@max-[659px]:hidden"
          />
          <th scope="col" className={`px-5 py-2 ${KILL_PEGADO}`}>
            <span className="sr-only">{t.tabla.acciones}</span>
          </th>
        </tr>
      </thead>

      <tbody
        onPointerEnter={() => setEncima(true)}
        onPointerLeave={() => setEncima(false)}
        onFocus={(e) => setConTeclado(e.target.matches(":focus-visible"))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setConTeclado(false);
        }}
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
                {/* `select-text` (Tier 11, E): el nombre, el script, la carpeta, el PID y los puertos
                    son lo que se copia. **Va en el disparador y no en el `<tbody>`**: el
                    `ContextMenuTrigger` de shadcn pone `select-none` en la fila, y eso gana a lo que
                    herede —medido en vivo: `none` en cada celda con el `select-text` en el tbody—.
                    Su `cn` deja la última clase. */}
                <ContextMenuTrigger
                  className="select-text"
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
                      data-pid={p.pid}
                      tabIndex={p.pid === pidActivo ? 0 : -1}
                      aria-label={t.tabla.filaLabel(p.name, detalle, p.ports, p.pid, p.protected)}
                      aria-keyshortcuts="Delete"
                      onFocus={() => setActiva(p.pid)}
                      onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => alPulsarEnFila(e, p)}
                      // Para `focoPerdido`: Motion deja la fila pintada mientras sale.
                      data-saliendo={isKilling ? "" : undefined}
                      // `scroll-m`: al llegar con las flechas, la fila no se queda debajo de la
                      // cabecera pegada ni de la barra de la selección, que flota abajo.
                      className={`group/fila scroll-mt-10 scroll-mb-20 border-t border-border outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-popup-open:bg-muted/60 ${
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
                      // Fuera del tabulador (T14-14): desde la fila, Espacio la marca.
                      tabIndex={-1}
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

                  {/* `pr-1` y no `px-3`: la columna mide 92 px, y el primer puerto con su «+12»
                      pide 76. El encabezado sigue alineado por la izquierda. */}
                  <td className="py-2 pr-1 pl-3">
                    {p.ports.length === 0 ? (
                      // Sin el /50: al 50 % de opacidad el guion se queda en ~2:1 de
                      // contraste, por debajo del minimo. Es poca informacion, pero
                      // es informacion.
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      // **Una sola línea** (T14-06): el primer puerto y cuántos más hay. Con una
                      // etiqueta por puerto cabía una por línea, y un proceso con seis medía
                      // 156,7 px de alto frente a 52,4: una fila se llevaba el sitio de tres. La
                      // lista entera queda en el `title`, en «Copiar puertos» del menú y, para el
                      // lector de pantalla, en el texto oculto. El buscador mira todos.
                      <span
                        className="flex items-center gap-0.5"
                        title={p.ports.length > 1 ? t.tabla.todosLosPuertos(p.ports) : undefined}
                      >
                        <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs font-semibold tabular-nums">
                          {p.ports[0]}
                        </span>
                        {p.ports.length > 1 && (
                          <>
                            <span
                              aria-hidden
                              className="rounded px-1 py-0.5 font-mono text-xs text-muted-foreground tabular-nums"
                            >
                              +{p.ports.length - 1}
                            </span>
                            <span className="sr-only">, {p.ports.slice(1).join(", ")}</span>
                          </>
                        )}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground @max-[571px]:hidden">
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

                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums @max-[659px]:hidden">
                    {formatUptime(p.runTimeSecs)}
                  </td>

                  <td className={`px-5 py-2 text-right ${KILL_PEGADO}`}>
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
                      data-kill
                      // Fuera del tabulador (T14-14): desde la fila, Supr pide el cierre.
                      tabIndex={-1}
                    >
                      {t.tabla.kill}
                    </Button>
                  </td>
                </ContextMenuTrigger>

                {/* Lo destructivo, **al final** y tras un separador (Tier 11, A6). Estaba el primero:
                    abierto por teclado, la primera flecha caía en «Matar proceso», que cierra sin
                    diálogo, y con el ratón era la entrada que quedaba justo bajo el cursor. */}
                <ContextMenuContent>
                  {/* El PID y el tiempo activo, que con zoom se quedan sin columna (T14-17). */}
                  <ContextMenuGroup>
                    <ContextMenuLabel>
                      {t.tabla.ficha(p.pid, formatUptime(p.runTimeSecs))}
                    </ContextMenuLabel>
                  </ContextMenuGroup>
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
  className = "",
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
  /** Para las columnas que se esconden cuando no caben (T14-17). */
  className?: string;
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
      } ${className}`}
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
