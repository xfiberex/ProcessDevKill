import type { ProcessInfo } from "../types";

/**
 * Lo mismo que `normalize` en storage.rs: minusculas, sin espacios y sin `.exe`. La comparacion de
 * verdad la hace Rust; aqui solo hace falta para saber que entradas quitar al desproteger.
 */
function normalizar(nombre: string): string {
  const lower = nombre.trim().toLowerCase();
  return lower.endsWith(".exe") ? lower.slice(0, -4) : lower;
}

/**
 * Con que nombre se protege una fila desde su menu: la carpeta si la hay, si no el script, y si no
 * el ejecutable.
 *
 * La carpeta primero porque es lo que el usuario quiere decir con «este no»: su proyecto. Proteger
 * por ejecutable desde una fila de `node.exe` salvaria **todos** los Node de golpe, que es una
 * decision demasiado grande para un clic en un menu; quien la quiera, la escribe en Ajustes.
 */
export function claveProteccion(p: ProcessInfo): string {
  return p.project ?? p.script ?? normalizar(p.name);
}

/**
 * Las entradas de la lista que protegen a este proceso, tal como estan escritas.
 *
 * Al desproteger desde la fila se quitan **todas**: si solo se quitara la de la carpeta y quedara
 * la del script, el candado seguiria puesto y el menu pareceria no haber hecho nada.
 */
export function entradasQueLoProtegen(p: ProcessInfo, lista: string[]): string[] {
  const nombres = [normalizar(p.name), p.script, p.project]
    .filter((n): n is string => n !== null)
    .map((n) => n.toLowerCase());
  return lista.filter((entrada) => nombres.includes(normalizar(entrada)));
}
