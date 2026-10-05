import type { ReactNode } from "react";

/**
 * La cabecera de las cuatro vistas: título, una línea opcional y las acciones a la derecha.
 *
 * Tier 11, D1. Hasta aquí cada vista tenía la suya: Procesos, una fila de buscador sin título;
 * Servicios, título y un párrafo de tres líneas; Historial, un recuento sin título; Ajustes, nada.
 * Procesos e Historial no tenían `h2`, así que un lector de pantalla que salta por encabezados no
 * encontraba dónde empezaba la vista.
 *
 * **Va fuera del scroll** (ver `ViewBody`): las acciones —Refrescar, Nuke All, Vaciar— tienen que
 * estar a mano también al final de una tabla larga.
 *
 * Los hijos se pintan en la misma fila, a la derecha del título: quien necesite empujarlos al borde
 * lleva `ml-auto`, y el buscador de Procesos, `flex-1`.
 */
export function ViewHeader({
  title,
  description,
  children,
  wrap = false,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /**
   * Deja que los hijos bajen a una segunda fila cuando no caben (T14-18). Solo lo pide Procesos,
   * por su buscador. No va para todas: en Servicios la descripción es un párrafo, y con `wrap`
   * pediría su ancho entero y mandaría las acciones abajo siempre.
   */
  wrap?: boolean;
}) {
  return (
    // Alto mínimo el de Procesos, que lleva el buscador: sin él, Ajustes —solo el título— medía
    // 49 px y el borde de abajo saltaba 8 px al cambiar de vista.
    // `@container/cabecera`: un hijo puede preguntar por el ancho de la cabecera, que con zoom no
    // es el de la ventana.
    <header
      className={`@container/cabecera flex min-h-14.25 shrink-0 items-center gap-x-3 gap-y-2 border-b border-border px-5 py-3 ${wrap ? "flex-wrap" : ""}`}
    >
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold whitespace-nowrap">{title}</h2>
        {description && (
          <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {children}
    </header>
  );
}

/**
 * El cuerpo de una vista: lo único que hace scroll.
 *
 * La cabecera queda fija encima, y las cabeceras `sticky` de las tablas se pegan al borde de
 * este contenedor, que es el que se desplaza.
 */
export function ViewBody({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Para un cuerpo **sin nada enfocable dentro**, como la tabla del Historial: con un nombre, el
   * contenedor entra en el tabulador para poder desplazarlo con las flechas (WCAG 2.1.1; axe,
   * `scrollable-region-focusable`). Hasta D1 no hacía falta porque «Vaciar» vivía dentro del
   * scroll; desde que está en la cabecera, sin esto la tabla no se podía recorrer con teclado.
   */
  label?: string;
}) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${className}`}
      {...(label ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
    >
      {children}
    </div>
  );
}
