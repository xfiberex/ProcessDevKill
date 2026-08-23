import {
  BoxIcon,
  ContainerIcon,
  DatabaseIcon,
  GlobeIcon,
  LoaderCircleIcon,
  PlayIcon,
  SettingsIcon,
  SquareIcon,
  Undo2Icon,
} from "lucide-react";
import { SETTABLE_START_TYPES } from "../types";
import type {
  ServiceAction,
  ServiceChange,
  ServiceFamily,
  ServiceInfo,
  ServiceState,
  SettableStartType,
} from "../types";
import { Marcado, useT } from "../i18n";
import type { Catalogo } from "../i18n";
import { formatMemory } from "../lib/format";
import { Button } from "@/components/ui/button";

type ServicesViewProps = {
  /** `null` mientras no ha llegado la primera lectura. Vacío ya es una respuesta. */
  services: ServiceInfo[] | null;
  onRefresh: () => void;
  onIrAAjustes: () => void;
  onAction: (servicio: ServiceInfo, accion: ServiceAction) => void;
  onStartupChange: (servicio: ServiceInfo, tipo: SettableStartType) => void;
  /** Los cambios de arranque que ha hecho la app y siguen puestos. */
  changes: ServiceChange[];
  onUndo: (cambio: ServiceChange) => void;
  /**
   * El nombre del servicio con una accion en curso, o `null`.
   *
   * Uno solo y no un conjunto: entre el UAC y la espera del SCM, cada accion bloquea de todas
   * formas, y permitir dos a la vez seria ofrecer dos ventanas de UAC encimadas.
   */
  busy: string | null;
};

/**
 * Iconos por familia.
 *
 * Genéricos de lucide y no logos dibujados a mano como los de `icons.tsx`: aquí hay siete familias
 * y la que importa es la categoría —«esto es una base de datos»—, no la marca. Dibujar siete
 * logotipos para una columna de 16 px sería trabajo que nadie ve.
 */
const FAMILY_ICONS: Record<ServiceFamily, typeof DatabaseIcon> = {
  sqlServer: DatabaseIcon,
  postgres: DatabaseIcon,
  mySql: DatabaseIcon,
  mongoDb: DatabaseIcon,
  redis: DatabaseIcon,
  docker: ContainerIcon,
  iis: GlobeIcon,
  other: BoxIcon,
};

/**
 * Los servicios de desarrollo del equipo, con arrancar y detener.
 *
 * **Todo el color va al estado**, no a la familia: en un panel de servicios lo que se escanea es qué
 * está corriendo. Por eso los iconos van en gris y la única nota de color es la píldora de estado.
 *
 * Los botones no elevan nada por sí solos: llaman a `control_service`, que relanza la app para esa
 * única acción y vuelve. Cambiar el tipo de arranque —lo único que sobreviviría a un reinicio— sigue
 * fuera, en la fase C.
 */
export function ServicesView({
  services,
  onRefresh,
  onIrAAjustes,
  onAction,
  onStartupChange,
  changes,
  onUndo,
  busy,
}: ServicesViewProps) {
  const t = useT();

  if (services === null) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        {t.servicios.cargando}
      </p>
    );
  }

  return (
    <div>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold">{t.servicios.titulo}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              <Marcado texto={t.servicios.descripcion} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {t.servicios.recuento(services.length)}
            </span>
            <Button variant="outline" onClick={onRefresh}>
              {t.cabecera.refrescar}
            </Button>
          </div>
        </div>
      </div>

      {/*
        La tabla va con `table-fixed` y anchos declarados, y no automática como las otras dos.

        **Sin esto la vista desbordaba a lo ancho y arrastraba la página entera.** La celda del
        nombre lleva dos líneas largas —`MSSQLFDLauncher$SQLEXPRESS` y su nombre visible, que en un
        equipo en español pasa de 45 caracteres— y en una tabla automática eso *empuja* en vez de
        truncar. Con ARRANQUE y ACCIONES encima, pedía unos 980 px cuando en la ventana mínima (900,
        menos 208 de barra lateral) solo hay 692. El contenedor de `App.tsx` solo controla el eje Y,
        así que el sobrante se escapaba al documento: la cabecera, la descripción y **la columna del
        nombre** acababan fuera de pantalla, que es justo lo que identifica cada fila.

        Con los anchos declarados, lo que sobra se trunca —con los dos nombres en el `title`— y el
        nombre corto, que es la clave, se ve siempre. Los cinco anchos fijos suman 540 px: al nombre
        le quedan 152 en la ventana más pequeña y 252 en la de fábrica.
      */}
      {services.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t.servicios.vacio}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            <Marcado texto={t.servicios.vacioDetalle} />
          </p>
          <Button variant="outline" onClick={onIrAAjustes} className="mt-4">
            <SettingsIcon />
            {t.servicios.irAAjustes}
          </Button>
        </div>
      ) : (
        <table className="w-full table-fixed text-sm">
          {/* Mismo motivo que en las otras dos tablas: sin `caption` no dice de qué es. */}
          <caption className="sr-only">{t.servicios.caption}</caption>
          <colgroup>
            {/* Sin ancho: el nombre se queda con lo que sobre, y es lo único que crece. */}
            <col />
            <col className="w-[100px]" />
            {/* 200 sale de medirlo, no de estimarlo: «Automático (retrasado)» ocupa 128,5 px a
                `text-xs` con Geist, mas 21 de flecha, 20 de relleno del control, 2 de borde y 24
                de la celda — 195,5. Con menos, un `select` nativo **no** pone puntos suspensivos:
                corta la palabra a media letra y deja «Automático (retrasa».

                Eran 192 hasta que el relleno derecho subio de 8 a 12 para despegar la flecha del
                borde, asi que **el ancho del control y el de la columna van juntos**. Los 4,5 px
                que sobran son a proposito: la cuenta exacta daba 196 y medio pixel de margen, que
                es lo mismo que no tener ninguno en cuanto cambie la fuente o el zoom. */}
            <col className="w-[200px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[116px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">
                {t.servicios.columnas.servicio}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.servicios.columnas.estado}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.servicios.columnas.arranque}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.servicios.columnas.ram}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.servicios.columnas.puertos}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {/* El rótulo existe para el lector de pantalla; a la vista, una columna
                    de botones titulada «Acciones» solo repite lo que ya se ve. */}
                <span className="sr-only">{t.servicios.columnas.acciones}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <Fila
                key={s.name}
                servicio={s}
                t={t}
                onAction={onAction}
                onStartupChange={onStartupChange}
                trabajando={busy === s.name}
                // Con una accion en curso se apagan **todos** los botones, no solo el suyo: el
                // UAC de la primera todavia esta en pantalla cuando se podria pulsar la segunda.
                bloqueado={busy !== null}
              />
            ))}
          </tbody>
        </table>
      )}

      {changes.length > 0 && (
        <Registro cambios={changes} t={t} onUndo={onUndo} bloqueado={busy !== null} />
      )}
    </div>
  );
}

/**
 * Lo que la app ha cambiado y sigue puesto, con su deshacer.
 *
 * **Es la contrapartida de la única acción de esta app que sobrevive a un reinicio.** Todo lo demás
 * se deshace solo: un proceso cerrado vuelve la próxima vez que se lanza. Un servicio en
 * «Deshabilitado» sigue deshabilitado dentro de tres meses, y para entonces nadie recuerda quién lo
 * puso así. Esta lista es ese recuerdo.
 *
 * Solo se pinta cuando hay algo: una sección vacía titulada «Cambios que ha hecho ProcessDevKill»
 * en un equipo donde no ha hecho ninguno es una pregunta que el usuario no tenía.
 */
function Registro({
  cambios,
  t,
  onUndo,
  bloqueado,
}: {
  cambios: ServiceChange[];
  t: Catalogo;
  onUndo: (cambio: ServiceChange) => void;
  bloqueado: boolean;
}) {
  const a = t.servicios.arranque;

  return (
    <section className="mt-6 border-t border-border px-5 py-4">
      <h3 className="font-heading text-sm font-semibold">{a.registroTitulo}</h3>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        <Marcado texto={a.registroDetalle} />
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {cambios.map((c) => (
          <li
            key={c.name}
            className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs">{c.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {a.registroFila(
                  t.servicios.arranques[c.from],
                  t.servicios.arranques[c.to],
                )}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={bloqueado}
              aria-label={a.deshacerLabel(c.name)}
              onClick={() => onUndo(c)}
            >
              <Undo2Icon />
              {a.deshacer}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fila({
  servicio: s,
  t,
  onAction,
  onStartupChange,
  trabajando,
  bloqueado,
}: {
  servicio: ServiceInfo;
  t: Catalogo;
  onAction: (servicio: ServiceInfo, accion: ServiceAction) => void;
  onStartupChange: (servicio: ServiceInfo, tipo: SettableStartType) => void;
  trabajando: boolean;
  bloqueado: boolean;
}) {
  const Icon = FAMILY_ICONS[s.family];

  return (
    <tr className="border-t border-border hover:bg-muted/60">
      <td className="px-4 py-2">
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {/* Los dos nombres en el `title`: al truncar hay que dejar el texto entero a mano,
              porque un «MSSQLFDLauncher$SQLEX…» no identifica nada. */}
          <span className="min-w-0" title={`${s.name} — ${s.displayName}`}>
            <span className="block truncate font-mono text-xs">{s.name}</span>
            {/* El nombre visible debajo y en gris: es el que el usuario reconoce de
                `services.msc`, pero el que manda —y el que se compara— es el corto. */}
            <span className="block truncate text-xs text-muted-foreground">
              {s.displayName}
            </span>
          </span>
          {/* La familia, solo para el lector de pantalla: a la vista ya la dice el icono
              junto al nombre, que lleva la marca dentro. */}
          <span className="sr-only">{t.servicios.familias[s.family]}</span>
        </span>
      </td>

      <td className="px-3 py-2">
        <Estado estado={s.state} t={t} />
      </td>

      <td className="px-3 py-2">
        <Arranque
          servicio={s}
          t={t}
          onStartupChange={onStartupChange}
          bloqueado={bloqueado || trabajando}
        />
      </td>

      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
        {s.memoryMb === null ? (
          // El guion **con su explicación**, no a secas: que la RAM de un servicio necesite
          // administrador no lo adivina nadie, y sin decirlo parece que la app no sabe leerla.
          <span
            className="cursor-help text-xs text-muted-foreground"
            title={t.servicios.ramDesconocida}
          >
            {/* El motivo, ademas de en el `title`, para el lector de pantalla: un `title` solo
                se descubre pasando el raton, y quien navega con teclado no lo alcanza nunca. */}
            <span className="sr-only">{t.servicios.ramDesconocida}</span>
            <span aria-hidden>—</span>
          </span>
        ) : (
          formatMemory(s.memoryMb)
        )}
      </td>

      <td className="px-3 py-2">
        {s.ports.length === 0 ? (
          <span
            className="cursor-help text-xs text-muted-foreground"
            title={t.servicios.sinPuertos}
          >
            <span className="sr-only">{t.servicios.sinPuertos}</span>
            <span aria-hidden>—</span>
          </span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {s.ports.map((port) => (
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

      <td className="px-4 py-2 text-right">
        <Accion
          servicio={s}
          t={t}
          onAction={onAction}
          trabajando={trabajando}
          bloqueado={bloqueado}
        />
      </td>
    </tr>
  );
}

/**
 * El tipo de arranque, editable.
 *
 * Un `select` nativo y no un menú propio: es una lista corta de valores excluyentes, que es
 * exactamente para lo que existe, y trae gratis el teclado, el lector de pantalla y el
 * comportamiento que el usuario ya conoce de `services.msc`.
 *
 * **Los que la app no pone se pintan como texto**, no como un desplegable deshabilitado: un
 * servicio en `Arranque del sistema` es de un controlador del núcleo, y enseñar ahí un control
 * apagado invita a preguntarse qué hay que hacer para encenderlo. No hay nada que hacer.
 */
function Arranque({
  servicio: s,
  t,
  onStartupChange,
  bloqueado,
}: {
  servicio: ServiceInfo;
  t: Catalogo;
  onStartupChange: (servicio: ServiceInfo, tipo: SettableStartType) => void;
  bloqueado: boolean;
}) {
  const ajustable = (SETTABLE_START_TYPES as string[]).includes(s.startType);
  const arrancaSolo =
    s.startType === "automatic" || s.startType === "automaticDelayed";

  if (!ajustable) {
    return (
      <span
        className="cursor-help text-muted-foreground"
        title={t.servicios.arranque.noAjustable}
      >
        {t.servicios.arranques[s.startType]}
        <span className="sr-only"> — {t.servicios.arranque.noAjustable}</span>
      </span>
    );
  }

  return (
    <select
      // Los mismos tokens que el resto de controles de la casa: sin esto el navegador pinta su
      // anillo de foco blanco por defecto, que no se parece a nada de la app.
      //
      // Y el texto va a `foreground` **siempre**, tambien en Manual y Deshabilitado. Pintarlos en
      // `muted` los hacia parecer deshabilitados sin estarlo; lo que arranca solo se distingue por
      // el peso, que es jerarquia sin robarle contraste a lo demas.
      //
      // `pr-3` y no `pr-2`: la flecha la dibuja el navegador pegada al borde interior del relleno,
      // asi que con 8 px quedaba practicamente tocando el borde del control. Cada pixel de aqui
      // sale del texto, y el texto ya iba justo — por eso la columna subio de 192 a 196.
      className={`h-8 w-full rounded-md border border-input bg-transparent pr-3 pl-2 text-xs text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        arrancaSolo ? "font-medium" : ""
      }`}
      aria-label={t.servicios.arranque.etiqueta(s.name)}
      title={arrancaSolo ? t.servicios.arrancaSolo : undefined}
      disabled={bloqueado}
      value={s.startType}
      onChange={(e) =>
        onStartupChange(s, e.currentTarget.value as SettableStartType)
      }
    >
      {SETTABLE_START_TYPES.map((tipo) => (
        <option key={tipo} value={tipo}>
          {t.servicios.arranques[tipo]}
        </option>
      ))}
    </select>
  );
}

/**
 * El botón de la fila: uno solo, el que toca según el estado.
 *
 * No se pintan Arrancar y Detener a la vez con uno deshabilitado. Un servicio corriendo no se
 * arranca, y enseñar el botón imposible al lado del posible obliga a leer cuál de los dos está
 * apagado antes de pulsar.
 */
function Accion({
  servicio: s,
  t,
  onAction,
  trabajando,
  bloqueado,
}: {
  servicio: ServiceInfo;
  t: Catalogo;
  onAction: (servicio: ServiceInfo, accion: ServiceAction) => void;
  trabajando: boolean;
  bloqueado: boolean;
}) {
  const a = t.servicios.acciones;

  // En transición no se ofrece nada: el servicio ya está haciendo algo, y encargarle lo contrario
  // a mitad de camino es la forma de dejarlo atascado.
  if (s.state === "pending" || trabajando) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
        {a.trabajando}
      </span>
    );
  }

  const corriendo = s.state === "running";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={bloqueado}
      // El nombre accesible lleva el servicio dentro: si no, la tabla es una columna de
      // botones que se llaman todos igual.
      aria-label={corriendo ? a.detenerLabel(s.name) : a.arrancarLabel(s.name)}
      onClick={() => onAction(s, corriendo ? "stop" : "start")}
    >
      {corriendo ? (
        <SquareIcon className="text-destructive" />
      ) : (
        <PlayIcon />
      )}
      {corriendo ? a.detener : a.arrancar}
    </Button>
  );
}

/**
 * La píldora de estado.
 *
 * El punto de color va `aria-hidden` y el estado se lee del texto de al lado: un color no es
 * información para quien no lo ve, y el texto ya lo dice entero.
 */
function Estado({ estado, t }: { estado: ServiceState; t: Catalogo }) {
  const color = {
    running: "bg-emerald-500",
    stopped: "bg-muted-foreground/40",
    pending: "bg-amber-500",
  }[estado];

  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden />
      <span className={estado === "running" ? "" : "text-muted-foreground"}>
        {t.servicios.estados[estado]}
      </span>
    </span>
  );
}
