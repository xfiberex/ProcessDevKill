import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export type OpcionSegmentada<T extends string | number> = {
  value: T;
  label: ReactNode;
};

/**
 * Un control segmentado: varias opciones excluyentes, una elegida.
 *
 * Existe por el Tier 11 (B4). Tema, Idioma y Auto-refresco eran botones sueltos con `aria-pressed`,
 * y lo elegido se separaba de lo demás por **1,03:1** en claro —el mismo peso de letra, un fondo
 * casi igual— y en Idioma y Tema lo no elegido llevaba borde y parecía más marcado que lo
 * elegido. Aquí lo elegido lleva fondo, borde a 3:1 y seminegrita, que es distinto por tres lados
 * y no solo por el color.
 *
 * Y es un `radiogroup` de verdad, que el Tier 7.4b había dejado anotado: un solo tabulador para
 * el grupo y las flechas para moverse, como en cualquier grupo de opciones de Windows. Las flechas
 * **eligen** al moverse, que es lo que hace un grupo de radios; por eso solo va en ajustes que se
 * cambian y se deshacen sin coste, nunca en algo que cierre o que dure más allá de la app.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  fill = false,
  compact = false,
  itemClassName = "",
}: {
  options: OpcionSegmentada<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre del grupo para el lector de pantalla. */
  label: string;
  /** Que las opciones repartan el ancho disponible, como en el sidebar. */
  fill?: boolean;
  compact?: boolean;
  itemClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const elegido = options.findIndex((o) => o.value === value);

  function mover(e: KeyboardEvent, desde: number) {
    const ultimo = options.length - 1;
    const destino = {
      ArrowRight: desde === ultimo ? 0 : desde + 1,
      ArrowDown: desde === ultimo ? 0 : desde + 1,
      ArrowLeft: desde === 0 ? ultimo : desde - 1,
      ArrowUp: desde === 0 ? ultimo : desde - 1,
      Home: 0,
      End: ultimo,
    }[e.key];
    if (destino === undefined) return;

    e.preventDefault();
    onChange(options[destino].value);
    refs.current[destino]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${fill ? "flex" : "inline-flex"} gap-0.5 rounded-lg bg-muted p-0.5`}
    >
      {options.map((o, i) => {
        const activo = i === elegido;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={activo}
            // Un solo tabulador para el grupo: el de lo elegido, o el primero si no hay nada.
            tabIndex={activo || (elegido === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => mover(e, i)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 ${
              compact ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm"
            } ${fill ? "flex-1" : ""} ${
              activo
                ? "bg-background font-semibold text-foreground shadow-sm ring-1 ring-control"
                : "font-medium text-muted-foreground hover:text-foreground"
            } ${itemClassName}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
