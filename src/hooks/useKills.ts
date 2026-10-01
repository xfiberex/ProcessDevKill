import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Catalogo } from "../i18n";
import type { ConfirmRequest } from "../components/ConfirmDialog";
import type { KillOutcome } from "../types";

type UseKillsParams = {
  t: Catalogo;
  /** `false` solo cuando se sabe que la app no corre como administrador: cambia la pista del fallo. */
  elevated: boolean | null;
  /** Abre el diálogo de confirmación, que vive en `App` porque lo comparten todas las vistas. */
  confirmar: (peticion: ConfirmRequest) => void;
  /** Tras un cierre que Rust atendió: la selección ya no tiene sentido. */
  onCerrados: () => void;
};

/**
 * Cerrar procesos desde la ventana: el Kill de una fila, la selección y Nuke All.
 *
 * Salió de `App.tsx` en T12-15. Aquí solo se pide y se cuenta lo que pasó: quién se puede cerrar lo
 * decide Rust, que vuelve a comprobar cada PID (`kill_and_record`).
 */
export function useKills({ t, elevated, confirmar, onCerrados }: UseKillsParams) {
  const [killing, setKilling] = useState<Set<number>>(new Set());

  async function killMany(pids: number[]) {
    if (pids.length === 0) return;
    setKilling(new Set(pids));

    try {
      const outcomes = await invoke<KillOutcome[]>("kill_processes", { pids });
      const failed = outcomes.filter((o) => !o.killed);

      // Sin elevar, el motivo más probable de un fallo es un proceso abierto como administrador.
      const pista = elevated === false ? t.avisos.quizaAdmin : undefined;

      if (failed.length === outcomes.length) {
        // `?.` porque la lista puede venir vacía: Rust contesta eso si no pudo ni mirar los
        // procesos. Sin él, lo que salía en el aviso era un `TypeError` de JavaScript.
        toast.error(failed[0]?.error ?? t.avisos.noSePudoCerrar, {
          description: pista,
        });
      } else if (failed.length > 0) {
        toast.warning(t.avisos.fallosParciales(failed.length, outcomes.length), {
          description: [failed[0].error, pista].filter(Boolean).join(" ") || undefined,
        });
      } else {
        // Los puertos liberados son la razon de ser de la app, asi que si los
        // hay, se dicen. Rust manda ademas una notificacion nativa: esa es para
        // cuando la orden vino de la bandeja o del atajo y no hay ventana
        // delante que ensenar.
        const freed = [...new Set(outcomes.flatMap((o) => o.freedPorts))].sort(
          (a, b) => a - b,
        );
        toast.success(
          outcomes.length === 1
            ? t.avisos.cerradoUno(outcomes[0].name)
            : t.avisos.cerradosVarios(outcomes.length),
          {
            description:
              freed.length === 0 ? undefined : t.avisos.puertosLiberados(freed),
          },
        );
      }

      onCerrados();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setKilling(new Set());
    }
  }

  function askNuke(pids: number[], ambito: string, protegidosFuera: number) {
    confirmar({
      title: t.confirmar.cerrarTitulo(pids.length),
      message: t.confirmar.cerrarMensaje(pids.length, ambito),
      note:
        protegidosFuera > 0 ? t.confirmar.protegidosFuera(protegidosFuera) : undefined,
      confirmLabel: t.confirmar.cerrarBoton(pids.length),
      onConfirm: () => killMany(pids),
    });
  }

  return { killing, killMany, askNuke };
}
