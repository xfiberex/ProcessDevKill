import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { HistoryEntry } from "../types";
import { useT } from "../i18n";
import type { Catalogo } from "../i18n";
import { formatRelative, formatTimestamp } from "../lib/format";
import { agruparEnTandas, puertosDeTanda } from "../lib/history";
import type { Tanda } from "../lib/history";
import { ViewBody, ViewHeader } from "./ViewHeader";
import { Button } from "@/components/ui/button";

type HistoryViewProps = {
  entries: HistoryEntry[];
  onClear: () => void;
};

/**
 * Cada cuánto se recalcula «hace N minutos». Un minuto es la unidad más fina que se enseña pasados
 * los primeros 45 segundos, así que ir más deprisa solo repintaría lo mismo.
 */
const TICK_MS = 60_000;

export function HistoryView({ entries, onClear }: HistoryViewProps) {
  const t = useT();
  const [ahora, setAhora] = useState(() => Date.now());
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  // Con la vista abierta un rato, «hace 2 minutos» se queda viejo: se recalcula cada minuto.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  function alternar(key: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // La frase entera del recuento cambia de número, no solo el sustantivo: singularizar "cierre" y
  // dejar "registrados" daba "1 cierre registrados". Es el mismo descuido que el "Se terminaran los
  // 1 procesos" del Tier 5. Por eso el recuento es una funcion del catalogo y no una plantilla.
  const cabecera = (
    <ViewHeader
      title={t.sidebar.historial}
      description={entries.length > 0 ? t.historial.recuento(entries.length) : undefined}
    >
      {entries.length > 0 && (
        <Button variant="outline" onClick={onClear} className="ml-auto shrink-0">
          {t.historial.vaciar}
        </Button>
      )}
    </ViewHeader>
  );

  if (entries.length === 0) {
    return (
      <>
        {cabecera}
        <ViewBody>
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t.historial.vacio}
          </p>
        </ViewBody>
      </>
    );
  }

  return (
    <>
      {cabecera}
      <ViewBody label={t.historial.caption}>
        <table className="w-full text-sm">
          {/* Mismo motivo que en ProcessTable: sin `caption` la tabla no dice de que es. */}
          <caption className="sr-only">{t.historial.caption}</caption>
          <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-medium">
                {t.historial.cuando}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.historial.proceso}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.historial.pid}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {t.historial.puertosLiberados}
              </th>
              <th scope="col" className="px-5 py-2 text-right font-medium">
                {t.historial.origen}
              </th>
            </tr>
          </thead>
          {/* `select-text`: el nombre, el PID y los puertos de un cierre son lo que se copia para
              buscarlo después (Tier 11, E). El `user-select: none` global de `index.css` es para
              que la ventana no se seleccione entera al arrastrar, no para esto. */}
          <tbody className="select-text">
            {agruparEnTandas(entries).map((tanda) =>
              tanda.entries.length === 1 ? (
                <Fila
                  key={tanda.key}
                  entrada={tanda.entries[0]}
                  cuando={<Cuando millis={tanda.killedAt} ahora={ahora} t={t} />}
                  origen={t.origenes[tanda.source]}
                />
              ) : (
                <FilasDeTanda
                  key={tanda.key}
                  tanda={tanda}
                  abierta={abiertas.has(tanda.key)}
                  onAlternar={() => alternar(tanda.key)}
                  ahora={ahora}
                  t={t}
                />
              ),
            )}
          </tbody>
        </table>
      </ViewBody>
    </>
  );
}

/**
 * La hora relativa, con la absoluta a mano: en el `title` para quien pasa el ratón y en el
 * `dateTime` para quien la necesite exacta.
 */
function Cuando({ millis, ahora, t }: { millis: number; ahora: number; t: Catalogo }) {
  return (
    <time dateTime={new Date(millis).toISOString()} title={formatTimestamp(millis)}>
      {formatRelative(millis, ahora, t.historial.locale)}
    </time>
  );
}

function Puertos({ lista }: { lista: number[] }) {
  if (lista.length === 0) {
    // Mismo criterio que en ProcessTable: el /50 dejaba el guion por debajo del contraste minimo.
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {lista.map((port) => (
        <span
          key={port}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums"
        >
          {port}
        </span>
      ))}
    </span>
  );
}

/** Un proceso cerrado. Suelto, o dentro de una tanda abierta (`dentro`), sin repetir hora ni origen. */
function Fila({
  entrada,
  cuando,
  origen,
  dentro = false,
}: {
  entrada: HistoryEntry;
  cuando?: ReactNode;
  origen?: string;
  dentro?: boolean;
}) {
  return (
    <tr className={dentro ? "bg-muted/30" : "border-t border-border"}>
      <td className="px-5 py-2 text-muted-foreground tabular-nums">{cuando}</td>
      <td className={`truncate py-2 pr-3 ${dentro ? "pl-10" : "pl-3"}`}>{entrada.name}</td>
      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
        {entrada.pid}
      </td>
      <td className="px-3 py-2">
        <Puertos lista={entrada.freedPorts} />
      </td>
      <td className="px-5 py-2 text-right text-xs text-muted-foreground">{origen}</td>
    </tr>
  );
}

/**
 * Una tanda de varios: una fila con el recuento y lo que liberó entre todos, que se despliega.
 *
 * Plegada por defecto: lo que se busca en el historial es **cuándo** pasó algo y **qué puertos**
 * soltó, y eso ya lo dice la fila de la tanda. El detalle de quince `node.exe` casi iguales se pide.
 */
function FilasDeTanda({
  tanda,
  abierta,
  onAlternar,
  ahora,
  t,
}: {
  tanda: Tanda;
  abierta: boolean;
  onAlternar: () => void;
  ahora: number;
  t: Catalogo;
}) {
  // «node.exe ×8 · dotnet.exe ×4»: de qué era la tanda, sin tener que abrirla.
  const cuenta = new Map<string, number>();
  for (const e of tanda.entries) cuenta.set(e.name, (cuenta.get(e.name) ?? 0) + 1);
  const resumen = [...cuenta].map(([nombre, n]) => (n > 1 ? `${nombre} ×${n}` : nombre)).join(" · ");

  return (
    <Fragment>
      <tr className="border-t border-border">
        <td className="px-5 py-2 text-muted-foreground tabular-nums">
          <Cuando millis={tanda.killedAt} ahora={ahora} t={t} />
        </td>
        <td className="px-3 py-1.5">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierta}
            // Nombre entero y en un `aria-label`: con el «cerrados a la vez» en un `sr-only` aparte,
            // el nombre calculado pegaba las palabras («3 procesoscerrados»). Empieza por el texto
            // visible, que es lo que se dice para pulsarlo por voz (WCAG 2.5.3).
            aria-label={`${t.historial.tanda(tanda.entries.length)} ${t.historial.tandaSr}: ${resumen}`}
            className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronRightIcon
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                abierta ? "rotate-90" : ""
              }`}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block font-medium">
                {t.historial.tanda(tanda.entries.length)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{resumen}</span>
            </span>
          </button>
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2">
          <Puertos lista={puertosDeTanda(tanda)} />
        </td>
        <td className="px-5 py-2 text-right text-xs text-muted-foreground">
          {t.origenes[tanda.source]}
        </td>
      </tr>
      {abierta &&
        tanda.entries.map((e, i) => (
          <Fila key={`${e.pid}-${i}`} entrada={e} dentro />
        ))}
    </Fragment>
  );
}
