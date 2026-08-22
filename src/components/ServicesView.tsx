import {
  BoxIcon,
  ContainerIcon,
  DatabaseIcon,
  GlobeIcon,
  SettingsIcon,
} from "lucide-react";
import type { ServiceFamily, ServiceInfo, ServiceState } from "../types";
import { Marcado, useT } from "../i18n";
import type { Catalogo } from "../i18n";
import { formatMemory } from "../lib/format";
import { Button } from "@/components/ui/button";

type ServicesViewProps = {
  /** `null` mientras no ha llegado la primera lectura. Vacío ya es una respuesta. */
  services: ServiceInfo[] | null;
  onRefresh: () => void;
  onIrAAjustes: () => void;
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
 * Los servicios de desarrollo del equipo.
 *
 * **Solo lectura, y se dice arriba del todo.** Un panel que enseña servicios invita a pulsar algo;
 * si todavía no hay nada que pulsar, hay que explicarlo antes de que el usuario lo busque. Arrancar
 * y detener llegan en la fase B del Tier 10, con elevación puntual, y cambiar el tipo de arranque en
 * la C.
 *
 * **Todo el color va al estado**, no a la familia: en un panel de servicios lo que se escanea es qué
 * está corriendo. Por eso los iconos van en gris y la única nota de color es la píldora de estado.
 */
export function ServicesView({ services, onRefresh, onIrAAjustes }: ServicesViewProps) {
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
        <table className="w-full text-sm">
          {/* Mismo motivo que en las otras dos tablas: sin `caption` no dice de qué es. */}
          <caption className="sr-only">{t.servicios.caption}</caption>
          <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-medium">
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
              <th scope="col" className="px-5 py-2 text-left font-medium">
                {t.servicios.columnas.puertos}
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <Fila key={s.name} servicio={s} t={t} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Fila({ servicio: s, t }: { servicio: ServiceInfo; t: Catalogo }) {
  const Icon = FAMILY_ICONS[s.family];
  const arrancaSolo = s.startType === "automatic" || s.startType === "automaticDelayed";

  return (
    <tr className="border-t border-border hover:bg-muted/60">
      <td className="px-5 py-2">
        <span className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
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
        <span
          className={arrancaSolo ? "font-medium" : "text-muted-foreground"}
          title={arrancaSolo ? t.servicios.arrancaSolo : undefined}
        >
          {t.servicios.arranques[s.startType]}
        </span>
      </td>

      <td className="px-3 py-2 text-right tabular-nums">
        {s.memoryMb === null ? (
          // El guion **con su explicación**, no a secas: que la RAM de un servicio necesite
          // administrador no lo adivina nadie, y sin decirlo parece que la app no sabe leerla.
          <span
            className="cursor-help text-xs text-muted-foreground"
            title={t.servicios.ramDesconocida}
          >
            —
          </span>
        ) : (
          formatMemory(s.memoryMb)
        )}
      </td>

      <td className="px-5 py-2">
        {s.ports.length === 0 ? (
          <span
            className="cursor-help text-xs text-muted-foreground"
            title={t.servicios.sinPuertos}
          >
            —
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
    </tr>
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
