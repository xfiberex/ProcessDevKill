import { useCallback, useEffect, useState } from "react";
import { MARCA_DEL_MENU } from "../components/ViewHeader";

/**
 * El sidebar en una ventana estrecha: cerrado de fábrica, lo abre el ☰ de la cabecera y flota
 * encima de la vista (T14-37). Fuera de ese ancho el estado no cambia nada: el sidebar está fijo.
 *
 * Lo que hace con el foco es lo que pide T14-13: **lo que hace desaparecer el elemento que tiene
 * el foco lo devuelve a algún sitio**. Al abrir, a la vista elegida del sidebar; al cerrar, si el
 * foco se quedaba dentro del sidebar —que deja de pintarse— o se ha perdido, al ☰. Tras pintar, con
 * `requestAnimationFrame`, porque hasta entonces el sidebar sigue como estaba.
 */
export function useMenuLateral() {
  const [abierto, setAbierto] = useState(false);

  const abrir = useCallback(() => {
    setAbierto(true);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#sidebar [aria-current="page"]')?.focus(),
    );
  }, []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    requestAnimationFrame(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body || activo.closest("#sidebar")) {
        document.querySelector<HTMLElement>(`[${MARCA_DEL_MENU}]`)?.focus();
      }
    });
  }, []);

  // Escape lo cierra mientras está abierto, y solo si la ventana es estrecha: fuera de ese ancho el
  // sidebar está fijo y Escape es de quien tenga el foco (el buscador lo usa para borrar).
  useEffect(() => {
    if (!abierto) return;
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape" && window.matchMedia("(max-width: 639px)").matches) {
        e.preventDefault();
        cerrar();
      }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, cerrar]);

  /** Tras elegir algo en el sidebar abierto —una vista, un filtro, una sección—, se cierra. */
  const trasElegir = useCallback(() => {
    if (abierto) cerrar();
  }, [abierto, cerrar]);

  return { abierto, abrir, cerrar, trasElegir };
}
