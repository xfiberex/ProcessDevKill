import { SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  /** `true` cuando no hay ni un proceso, `false` cuando los hay pero el filtro no deja pasar ninguno. */
  sinProcesos: boolean;
  onIrAAjustes: () => void;
};

/**
 * Lo que se ve cuando la tabla no tiene filas.
 *
 * Son dos situaciones que se parecen en pantalla y no tienen nada que ver: no
 * haber encontrado nada, y no estar buscando lo correcto. La primera es lo
 * primero que ve alguien que acaba de instalar la app, y decir solo "no hay
 * procesos" la deja en un callejon sin salida: Node, Python y .NET se vigilan
 * siempre, pero quien trabaje con Go, Docker o PHP no vera nunca nada hasta que
 * los añada, y eso no se adivina.
 */
export function EmptyState({ sinProcesos, onIrAAjustes }: EmptyStateProps) {
  if (!sinProcesos) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Ningún proceso coincide con el filtro.
      </p>
    );
  }

  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        No hay procesos de desarrollo activos.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Node, Python y .NET se vigilan siempre. Si trabajas con otros —
        <code className="text-foreground">docker</code>,{" "}
        <code className="text-foreground">go</code>,{" "}
        <code className="text-foreground">php</code>—, añádelos en Ajustes.
      </p>
      <Button variant="outline" onClick={onIrAAjustes} className="mt-4">
        <SettingsIcon />
        Añadir procesos vigilados
      </Button>
    </div>
  );
}
