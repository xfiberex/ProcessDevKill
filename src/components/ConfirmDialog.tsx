import { useRef, useState } from "react";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Marcado, useT } from "../i18n";
import type { Rico } from "../i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmRequest = {
  title: string;
  /**
   * El nombre que sale en el título, para que no se parta: «postgresql-x64-17» se cortaba por el
   * guion y quedaba «postgresql-» en una línea y «x64-17» en la otra (Tier 11, C4).
   */
  name?: string;
  /** Lo que va a pasar. Con marcas: ver `Rico`. */
  message: Rico;
  /** Lo que no se puede pasar por alto, en un recuadro aparte del mensaje. */
  warning?: Rico;
  /** Un apunte al final, en letra pequeña: p. ej., que habrá un aviso de administrador. */
  note?: string;
  /**
   * `danger` —rojo— para lo que destruye algo o corta a alguien, que es el caso de casi todo; es
   * el valor por defecto. `change` —neutro— para lo que solo cambia algo y se puede devolver, como
   * pasar un servicio de «Manual» a «Automático»: todo en rojo, el rojo deja de avisar.
   */
  tone?: "danger" | "change";
  confirmLabel: string;
  onConfirm: () => void;
};

type ConfirmDialogProps = {
  request: ConfirmRequest | null;
  onCancel: () => void;
};

/**
 * Confirmacion de las acciones que matan procesos.
 *
 * Desde el Tier 5 se apoya en el AlertDialog de shadcn/ui (Base UI): suyos son el
 * modal, el cierre con Escape, el foco atrapado dentro del dialogo y los roles de
 * accesibilidad. Lo unico que se le lleva la contraria es a que boton recibe el
 * foco al abrir.
 *
 * Desde el Tier 11 (C4) el cuerpo tiene partes: mensaje, aviso y nota. El de cambiar el arranque
 * de un servicio metía 285 caracteres seguidos en 384 px, y el aviso que lo hace distinto —«Este
 * cambio sobrevive al reinicio»— perdía la negrita, porque el mensaje era texto plano.
 */
export function ConfirmDialog({ request, onCancel }: ConfirmDialogProps) {
  const t = useT();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // El contenido sobrevive a que `request` vuelva a null para que la animacion de
  // cierre tenga algo que pintar; si se desmontara de golpe, el dialogo
  // desapareceria a saltos.
  //
  // Se ajusta **durante el render**, no en un `useEffect`. Es el patron que React documenta para
  // el estado que se deriva de una prop: el efecto pintaba primero el contenido viejo y solo
  // despues el nuevo, un render de mas por cada apertura del dialogo. Poner el `setShown` aqui
  // hace que React repita el render antes de tocar el DOM, asi que ese paso intermedio no llega a
  // verse. La guardia `request !== shown` es obligatoria: sin ella es un bucle infinito.
  const [shown, setShown] = useState<ConfirmRequest | null>(request);
  if (request && request !== shown) setShown(request);

  const peligro = shown?.tone !== "change";

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {shown && (
        <AlertDialogContent
          // Base UI enfocaria "Cancelar". Aqui el foco arranca en el boton
          // destructivo, como en los Tiers 2-4: se llega a este dialogo a
          // proposito y asi se confirma con Enter sin tocar el raton. Escape
          // sigue cancelando, que es la salida que de verdad importa.
          initialFocus={confirmRef}
          // 448 px y no los 384 de shadcn: con mensaje, aviso y nota, en 384 era un párrafo largo.
          // Lleva la misma variante `data-[size=default]` que la regla de fábrica: con otra, esa
          // gana por especificidad y el ancho no cambia.
          className="data-[size=default]:sm:max-w-md"
        >
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                peligro
                  ? "bg-destructive/10 text-destructive-text"
                  : "bg-muted text-foreground"
              }
            >
              {peligro ? <TriangleAlertIcon /> : <InfoIcon />}
            </AlertDialogMedia>
            <AlertDialogTitle>
              <Titulo texto={shown.title} nombre={shown.name} />
            </AlertDialogTitle>
            {/* Un `div` y no el `p` de fábrica: dentro van el recuadro del aviso y la nota, y
                todo tiene que seguir siendo la descripción del diálogo, que es lo que un lector de
                pantalla lee al abrirlo. */}
            <AlertDialogDescription
              render={<div />}
              className="flex flex-col gap-3 text-pretty"
            >
              <p>
                <Marcado texto={shown.message} />
              </p>
              {/* En el gris de la descripción, no en `foreground`: con todo el recuadro en blanco, la
                  negrita —`font-medium` en `foreground`, ver `Marcado`— no se distinguía del resto,
                  y lo que se quiere que se lea primero es justo esa frase. */}
              {shown.warning && (
                <p
                  className={`rounded-lg border px-3 py-2 ${
                    peligro
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/60"
                  }`}
                >
                  <Marcado texto={shown.warning} />
                </p>
              )}
              {shown.note && <p className="text-xs">{shown.note}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t.confirmar.cancelar}</AlertDialogCancel>
            <AlertDialogAction
              ref={confirmRef}
              variant={peligro ? "destructive" : "default"}
              // Rojo solido, como el boton que abre el dialogo: el `destructive`
              // de shadcn es un rojo tenue pensado para acciones secundarias.
              className={
                peligro
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => {
                shown.onConfirm();
                onCancel();
              }}
            >
              {shown.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}

/**
 * El título con el nombre en un bloque que no se parte por sus guiones.
 *
 * `inline-block` hace que, si no cabe al final de la línea, el nombre **entero** baje a la
 * siguiente. Con `max-w-full` y `wrap-anywhere` solo se parte si ni solo en una línea cabe, que
 * con nombres de servicio no pasa, pero un nombre de 80 caracteres no puede sacar el diálogo de la
 * ventana.
 */
function Titulo({ texto, nombre }: { texto: string; nombre?: string }) {
  const i = nombre ? texto.indexOf(nombre) : -1;
  if (!nombre || i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <span className="inline-block max-w-full wrap-anywhere">{nombre}</span>
      {texto.slice(i + nombre.length)}
    </>
  );
}
