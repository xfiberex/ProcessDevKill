/**
 * Como se pintan los numeros que llegan de Rust.
 *
 * Estaban en `types.ts`, que se declara **espejo** de los tipos de Rust y tiene un
 * test (`types.test.ts`) que lee el fuente de Rust para comprobarlo. Cuanto mas
 * contenido no-espejo arrastraba ese archivo, menos claro quedaba que el contrato
 * es solo con los tipos.
 *
 * Archivo propio y no `lib/utils.ts`: ese lo genera el CLI de shadcn con `cn`
 * dentro, y volver a pasar `shadcn init` lo reescribe.
 */

export function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** Mismo criterio que `format_mb` en `src-tauri/src/auto_kill.rs`, que redacta la
 *  notificacion del Auto-Kill: dos formatos distintos para la misma cifra dejan al
 *  usuario sin saber cual creerse. */
export function formatMemory(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

/** Rust guarda epoch en ms; el formato lo pone aqui la configuracion del equipo. */
export function formatTimestamp(millis: number): string {
  return new Date(millis).toLocaleString();
}

/**
 * «hace 5 minutos», «ayer», «hace 3 días»: la hora del historial dicha como se recuerda (Tier 11, E).
 *
 * La marca absoluta seguía en cada fila —«16/9/2026, 7:12:43 p. m.»—, y para saber si algo pasó
 * hace un rato o la semana pasada había que hacer la cuenta. La absoluta no se pierde: va en el
 * `title` y en el `dateTime` del `<time>`.
 *
 * Los días se cuentan **por calendario**, no por horas: algo de anoche a las 23:00 visto a las
 * 9:00 es «ayer», aunque solo hayan pasado 10 horas; por debajo de un día natural manda la hora. A
 * partir de una semana, la fecha: «hace 23 días» ya no se recuerda mejor que «2 sept».
 */
export function formatRelative(millis: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const segundos = Math.round((now - millis) / 1000);
  if (segundos < 45) return rtf.format(0, "second");

  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return rtf.format(-minutos, "minute");

  const dias = diasNaturalesEntre(millis, now);
  if (dias === 0) return rtf.format(-Math.round(minutos / 60), "hour");
  if (dias < 7) return rtf.format(-dias, "day");

  const fecha = new Date(millis);
  return fecha.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    // El año solo si no es el de ahora: «2 sept» basta dentro del mismo año.
    ...(fecha.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Cuántas medianoches hay entre dos instantes, en la hora local. */
function diasNaturalesEntre(antes: number, despues: number): number {
  const medianoche = (ms: number) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  // `round` y no `floor`: con un cambio de hora en medio, un día natural mide 23 o 25 horas.
  return Math.round((medianoche(despues) - medianoche(antes)) / 86_400_000);
}
