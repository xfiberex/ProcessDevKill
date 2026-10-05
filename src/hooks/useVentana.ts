import { useEffect, useRef } from "react";

/**
 * Lo que la ventana le quita al navegador que lleva dentro (T14-02).
 *
 * La app corre en un WebView, y un WebView es un navegador: trae su menú de clic derecho —«Atrás ·
 * Actualizar · Guardar como · Imprimir», en el idioma de Windows y no en el de la app— y sus
 * teclas. Medido en la auditoría: «Actualizar» recarga la ventana entera, y con ella se van la
 * búsqueda, el filtro, el orden, la selección y la vista, y vuelve a salir la consulta a GitHub del
 * arranque. Nada de eso es de una app de escritorio.
 *
 * - **El clic derecho** se cancela en toda la ventana salvo en un campo de texto, donde copiar y
 *   pegar sí hacen falta. El menú de una fila es de la app y no pasa por aquí: Base UI ya cancela
 *   el suyo.
 * - **F5 y Ctrl+R** refrescan lo que se está mirando, que es lo que hacen en el Administrador de
 *   tareas, en vez de recargar la página.
 * - **Ctrl+F** lleva al buscador (Tier 11, E): había 12 paradas de tabulador antes de llegar a él,
 *   y la búsqueda en la página de WebView2 no encontraría nada útil, porque la lista ya se filtra.
 * - **Ctrl+P, Ctrl+G, F3, F7 y Ctrl+U** no hacen nada: imprimir, buscar siguiente, el cursor de
 *   texto y el código fuente de la página.
 *
 * Las funciones se leen de una `ref` para registrar los oyentes **una vez**: `onRefrescar` cambia
 * con la vista, y volver a registrar en cada cambio no aporta nada.
 */
export function useVentana(acciones: { onBuscar: () => void; onRefrescar: () => void }) {
  const actuales = useRef(acciones);
  useEffect(() => {
    actuales.current = acciones;
  });

  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.altKey) return;
      const tecla = e.key.toLowerCase();

      if (e.ctrlKey && !e.shiftKey && tecla === "f") {
        e.preventDefault();
        actuales.current.onBuscar();
        return;
      }
      // Con Mayús también: Ctrl+Mayús+R y Mayús+F5 son la recarga «sin caché» del navegador.
      if (tecla === "f5" || (e.ctrlKey && tecla === "r")) {
        e.preventDefault();
        // Una tecla mantenida repite el evento: un refresco por pulsación, no treinta por segundo.
        if (!e.repeat) actuales.current.onRefrescar();
        return;
      }
      if (tecla === "f3" || tecla === "f7" || (e.ctrlKey && ["p", "g", "u"].includes(tecla))) {
        e.preventDefault();
      }
    }

    function alClicDerecho(e: MouseEvent) {
      if (!esCampoDeTexto(e.target)) e.preventDefault();
    }

    window.addEventListener("keydown", alPulsar);
    window.addEventListener("contextmenu", alClicDerecho);
    return () => {
      window.removeEventListener("keydown", alPulsar);
      window.removeEventListener("contextmenu", alClicDerecho);
    };
  }, []);
}

/** Donde el menú del navegador sí hace falta: es el que trae cortar, copiar y pegar. */
function esCampoDeTexto(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  if (destino.isContentEditable || destino instanceof HTMLTextAreaElement) return true;
  // Una casilla o un botón también son `input`, y ahí no hay nada que pegar.
  return (
    destino instanceof HTMLInputElement &&
    ["text", "search", "number", "url", "email", "password", "tel"].includes(destino.type)
  );
}
