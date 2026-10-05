import { toast as sonner } from "sonner";
import type { ExternalToast } from "sonner";

/**
 * Los avisos de la app: los de `sonner`, con la duración que le toca a cada clase (T14-15).
 *
 * **Un error o una advertencia se queda hasta que se cierra.** Medido en la auditoría: «No se
 * pudieron guardar los ajustes» trae 150 caracteres —la ruta del archivo y el error de Windows— y
 * se iba a los 4,3 s, sin botón y sin dejar rastro en la ventana. No daba tiempo a leerlo (WCAG
 * 2.2.1). Los de éxito y los informativos siguen yéndose solos: «bun.exe cerrado» no pide nada.
 *
 * Sonner no deja poner la duración por clase en el `Toaster`, solo una para todos; por eso el
 * reparto está aquí y **todo el código importa `toast` de este archivo, no de `sonner`**:
 * `avisos.test.ts` falla si alguien se lo salta. Quien llama puede seguir pasando su `duration`.
 */
const SE_QUEDA: ExternalToast = { duration: Infinity, closeButton: true };

type Mensaje = Parameters<typeof sonner.error>[0];

export const toast = {
  success: (mensaje: Mensaje, opciones?: ExternalToast) => sonner.success(mensaje, opciones),
  info: (mensaje: Mensaje, opciones?: ExternalToast) => sonner.info(mensaje, opciones),
  warning: (mensaje: Mensaje, opciones?: ExternalToast) =>
    sonner.warning(mensaje, { ...SE_QUEDA, ...opciones }),
  error: (mensaje: Mensaje, opciones?: ExternalToast) =>
    sonner.error(mensaje, { ...SE_QUEDA, ...opciones }),
  dismiss: sonner.dismiss,
};
