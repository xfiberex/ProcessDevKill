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
