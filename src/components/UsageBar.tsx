type UsageBarProps = {
  /** Valor real del proceso, ya formateado para mostrar. */
  label: string;
  /** Magnitud de este proceso. */
  value: number;
  /** Mayor valor de la lista visible. */
  max: number;
  color: string;
  /** La cifra en gris: para el «0.0%» de un proceso en reposo (Tier 11, D6). */
  apagada?: boolean;
};

/**
 * Barra proporcional al proceso que mas consume de la lista, no a la capacidad
 * total del equipo: con 32 GB de RAM, un Node de 300 MB daria una barra invisible
 * y la gracia aqui es comparar procesos entre si. El numero de encima sigue
 * siendo el valor absoluto real.
 *
 * **La barra va debajo de la cifra, no al lado** (Tier 11, C1). Al lado, las columnas de CPU y RAM
 * pedían 111 y 131 px, y con la tabla en `table-fixed` a la ventana mínima (677 px de tabla) al
 * nombre del proceso le quedaban 65: medido. Debajo caben en 76 y 88, y la fila no crece: la
 * segunda línea del nombre —script y carpeta— ya ocupaba ese alto.
 *
 * `whitespace-nowrap` en la cifra: en una columna estrecha, «126 MB» partía en dos líneas.
 */
export function UsageBar({ label, value, max, color, apagada = false }: UsageBarProps) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`whitespace-nowrap tabular-nums ${apagada ? "text-muted-foreground" : ""}`}
      >
        {label}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
