import type { SystemUsage } from "../types";
import { formatMemory } from "../lib/format";

type UsageMeterProps = {
  usage: SystemUsage | null;
  /**
   * Con el auto-refresco en "Off" Rust deja de medir a proposito, porque un
   * porcentaje de CPU es el promedio entre dos muestras y sin ritmo no significa
   * nada. Se dice, en vez de dejar la ultima cifra puesta con pinta de actual.
   */
  pausado: boolean;
};

/**
 * Cuanto se esta comiendo el entorno de desarrollo del total de la maquina.
 *
 * Es el denominador que le falta a la tabla: alli las barras se escalan al proceso
 * que mas consume de la lista (ver `UsageBar`), asi que una barra llena puede ser
 * un proceso gastando el 2 % del equipo. Aqui las dos barras se escalan **al
 * equipo entero**, y por eso cada una lleva dos capas: la tenue es lo que usa la
 * maquina y la solida, la parte que ponen los procesos vigilados.
 */
export function UsageMeter({ usage, pausado }: UsageMeterProps) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <p className="mb-2 text-xs text-muted-foreground">Tu entorno</p>

      {pausado || !usage ? (
        <p className="text-xs text-muted-foreground/70">
          {pausado ? "En pausa" : "Midiendo…"}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Metrica
            label="CPU"
            dev={`${usage.devCpu.toFixed(1)}%`}
            // El techo de la CPU es 100 % y no hace falta decirlo; el de la RAM,
            // en cambio, es el dato que le falta a quien mira.
            equipo={`${usage.cpu.toFixed(0)}%`}
            devPct={usage.devCpu}
            equipoPct={usage.cpu}
            title={`Tus procesos vigilados usan el ${usage.devCpu.toFixed(1)} % de la CPU. El equipo entero, el ${usage.cpu.toFixed(0)} %.`}
          />
          <Metrica
            label="RAM"
            dev={formatMemory(usage.devMemoryMb)}
            equipo={parDeMemoria(usage.usedMemoryMb, usage.totalMemoryMb)}
            devPct={porcentaje(usage.devMemoryMb, usage.totalMemoryMb)}
            equipoPct={porcentaje(usage.usedMemoryMb, usage.totalMemoryMb)}
            title={`Tus procesos vigilados usan ${formatMemory(usage.devMemoryMb)}. El equipo entero, ${formatMemory(usage.usedMemoryMb)} de los ${formatMemory(usage.totalMemoryMb)} instalados.`}
          />
        </div>
      )}
    </div>
  );
}

function porcentaje(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

/**
 * "15.0 / 31.9 GB", no "15.0 GB / 31.9 GB": la unidad repetida no aporta y aqui
 * hay 208 px de ancho. Solo se recorta si las dos cifras caen en la misma unidad;
 * "512 MB / 31.9 GB" tiene que conservar las dos.
 */
export function parDeMemoria(usada: number, total: number): string {
  const u = formatMemory(usada);
  const t = formatMemory(total);
  const unidad = t.slice(t.indexOf(" "));
  return u.endsWith(unidad) ? `${u.slice(0, -unidad.length)} / ${t}` : `${u} / ${t}`;
}

function Metrica({
  label,
  dev,
  equipo,
  devPct,
  equipoPct,
  title,
}: {
  label: string;
  dev: string;
  equipo: string;
  devPct: number;
  equipoPct: number;
  title: string;
}) {
  return (
    <div title={title}>
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{dev}</span>
      </div>

      {/* Las cifras van en texto arriba y abajo: la barra es su equivalente visual
          y no aporta nada a un lector de pantalla, igual que la flecha de
          ordenacion de la tabla. */}
      <div
        className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/35 transition-[width] duration-300"
          style={{ width: `${ancho(equipoPct)}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${ancho(devPct)}%` }}
        />
      </div>

      {/* La cifra del equipo va en su propia linea y **nombrada**.
          Antes iba pegada arriba como "1008 MB de 15.6 GB", y el primero que lo
          vio leyo ese 15,6 como su RAM instalada (tiene 32 GB): era lo que usaba
          la maquina. Ahorrar una linea salio caro. */}
      <div className="mt-1 flex items-baseline justify-between gap-1 text-[11px] text-muted-foreground">
        <span>Equipo</span>
        <span className="tabular-nums">{equipo}</span>
      </div>
    </div>
  );
}

/**
 * La memoria residente de dos procesos cuenta dos veces las paginas que comparten,
 * asi que la suma de los vigilados puede pasarse de lo que dice usar el equipo.
 * El numero se ensena tal cual —es el que reporta el sistema—, pero la barra se
 * recorta para que no se salga del carril.
 */
function ancho(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}
