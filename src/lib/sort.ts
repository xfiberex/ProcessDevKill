import type { ProcessInfo } from "../types";

/**
 * Ordenacion de la tabla de procesos.
 *
 * Funcion pura y en su propio archivo por lo mismo que `collect_processes` esta
 * separada de `get_processes` en Rust: lo que hay que probar aqui —el desempate
 * estable— no se ve mirando el DOM, solo comparando dos listas seguidas.
 */

export type SortKey = "name" | "port" | "pid" | "cpu" | "memoryMb" | "runTimeSecs";
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };

/** El orden con el que Rust manda la lista: RAM descendente. */
export const DEFAULT_SORT: Sort = { key: "memoryMb", dir: "desc" };

/**
 * Direccion con la que se estrena cada columna al pulsarla por primera vez.
 *
 * Las numericas empiezan **descendentes** porque lo que se busca al pulsar "CPU"
 * es quien se esta comiendo la maquina, no quien gasta menos. El nombre y el
 * puerto empiezan ascendentes, que es como se leen.
 */
export const FIRST_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  port: "asc",
  pid: "asc",
  cpu: "desc",
  memoryMb: "desc",
  runTimeSecs: "desc",
};

/** Etiqueta visible de cada columna ordenable, en el orden de la tabla. */
export const SORT_LABELS: Record<SortKey, string> = {
  name: "Proceso",
  port: "Puerto",
  pid: "PID",
  cpu: "CPU",
  memoryMb: "RAM",
  runTimeSecs: "Activo",
};

/** Un proceso puede escuchar en varios puertos; manda el mas bajo. */
function valor(p: ProcessInfo, key: SortKey): number | string {
  if (key === "port") {
    return p.ports.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...p.ports);
  }
  return p[key];
}

export function sortProcesses(processes: ProcessInfo[], { key, dir }: Sort): ProcessInfo[] {
  const signo = dir === "asc" ? 1 : -1;

  return [...processes].sort((a, b) => {
    const va = valor(a, key);
    const vb = valor(b, key);

    // Los que no ocupan ningun puerto se van **siempre** al final, tambien en
    // descendente. Al reves, ordenar por puerto ascendente empezaria por veinte
    // guiones y habria que bajar hasta el final para ver el 3000, que es justo
    // lo que se venia a buscar.
    if (key === "port" && (va === Number.POSITIVE_INFINITY || vb === Number.POSITIVE_INFINITY)) {
      if (va === vb) return a.pid - b.pid;
      return va === Number.POSITIVE_INFINITY ? 1 : -1;
    }

    const cmp =
      typeof va === "string"
        ? va.localeCompare(vb as string)
        : (va as number) - (vb as number);

    if (cmp !== 0) return cmp * signo;

    // ⚠️ Desempate por PID, y **sin invertirlo** con la direccion: es lo que
    // impide que las filas bailen. Rust reenvia la lista cada dos segundos ya
    // ordenada por RAM, y la RAM fluctua, asi que el orden de partida cambia
    // entre refrescos. Ordenando por CPU —donde media tabla marca 0,0 %— eso se
    // traduce en filas saltando de sitio solas cada dos segundos.
    return a.pid - b.pid;
  });
}
