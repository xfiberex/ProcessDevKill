type UsageBarProps = {
  /** Valor real del proceso, ya formateado para mostrar. */
  label: string;
  /** Magnitud de este proceso. */
  value: number;
  /** Mayor valor de la lista visible. */
  max: number;
  color: string;
};

/**
 * Barra proporcional al proceso que mas consume de la lista, no a la capacidad
 * total del equipo: con 32 GB de RAM, un Node de 300 MB daria una barra invisible
 * y la gracia aqui es comparar procesos entre si. El numero de al lado sigue
 * siendo el valor absoluto real.
 */
export function UsageBar({ label, value, max, color }: UsageBarProps) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="tabular-nums">{label}</span>
      <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
