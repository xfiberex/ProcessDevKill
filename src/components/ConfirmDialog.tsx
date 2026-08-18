import { useRef, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
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
  message: string;
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
 */
export function ConfirmDialog({ request, onCancel }: ConfirmDialogProps) {
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
        >
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <TriangleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{shown.title}</AlertDialogTitle>
            <AlertDialogDescription>{shown.message}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              ref={confirmRef}
              variant="destructive"
              // Rojo solido, como el boton que abre el dialogo: el `destructive`
              // de shadcn es un rojo tenue pensado para acciones secundarias.
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
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
