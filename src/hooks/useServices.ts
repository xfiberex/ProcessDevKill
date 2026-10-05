import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/lib/avisos";
import type { Catalogo } from "../i18n";
import type { ConfirmRequest } from "../components/ConfirmDialog";
import { SETTABLE_START_TYPES } from "../types";
import type {
  ServiceAction,
  ServiceActionResult,
  ServiceChange,
  ServiceDependent,
  ServiceInfo,
  ServiceStartupResult,
  SettableStartType,
} from "../types";

/**
 * Los servicios de desarrollo: leerlos, arrancarlos, detenerlos, cambiar su arranque y deshacerlo.
 *
 * Salió de `App.tsx` en T12-15: eran doscientas líneas que no tocaban nada de la lista de procesos.
 * `confirmar` abre el diálogo de `App`, que comparten todas las vistas.
 */
export function useServices(t: Catalogo, confirmar: (peticion: ConfirmRequest) => void) {
  // `null` hasta la primera lectura, para no enseñar «no hay servicios» mientras se leen.
  const [services, setServices] = useState<ServiceInfo[] | null>(null);
  /** El servicio con una accion en curso. Apaga los botones de toda la tabla mientras dura. */
  const [busy, setBusy] = useState<string | null>(null);
  /** Los cambios de arranque que ha hecho la app y siguen puestos en Windows. */
  const [changes, setChanges] = useState<ServiceChange[]>([]);

  /**
   * Los servicios, **a petición**.
   *
   * No los empuja el poller como a los procesos: un servicio cambia de estado dos veces al día, y
   * releer el catálogo entero del SCM cada dos segundos le sumaría al ciclo un recorrido de
   * cientos de servicios para no enterarse de nada. Ver `get_services` en commands.rs.
   *
   * `t` está en las dependencias desde T12-15. Antes quedaba fuera para que el efecto que lee al
   * entrar en la vista no se relanzara al cambiar de idioma, y el precio era que el aviso de
   * fallo salía **siempre en español**, con el catálogo del primer render. Relanzarlo no cuesta
   * nada: ese efecto solo lee con la vista de Servicios abierta, y el idioma se cambia en Ajustes.
   */
  const loadServices = useCallback(async () => {
    try {
      setServices(await invoke<ServiceInfo[]>("get_services"));
    } catch (e) {
      // Lista vacía y no `null`: con `null` la vista se quedaría diciendo «leyendo…» para siempre.
      setServices([]);
      toast.error(t.avisos.serviciosNoLeidos, { description: String(e) });
    }
  }, [t]);

  const loadChanges = useCallback(async () => {
    try {
      setChanges(await invoke<ServiceChange[]>("get_service_changes"));
    } catch {
      // Quedarse sin el registro no puede tumbar la vista: lo que se pierde es poder deshacer
      // desde aqui, y eso se ve solo —la seccion no aparece—.
    }
  }, []);

  /** Lo que se lee al entrar en la vista: la lista y el registro de lo que la app ha cambiado. */
  const load = useCallback(() => {
    loadServices();
    loadChanges();
  }, [loadServices, loadChanges]);

  /**
   * Arranca o detiene un servicio, y **cuenta lo que de verdad pasó**.
   *
   * Rust eleva solo para esa acción y, en cuanto el proceso elevado muere, relee el estado del SCM
   * en vez de suponerlo: por eso hay un `pending` que no es ni éxito ni fallo, sino un servicio que
   * todavía está en ello. Ver `control_service` en service_control.rs.
   */
  const ejecutarAccion = useCallback(
    async (servicio: ServiceInfo, accion: ServiceAction) => {
      const a = t.servicios.acciones;
      setBusy(servicio.name);

      try {
        const r = await invoke<ServiceActionResult>("control_service", {
          name: servicio.name,
          action: accion,
        });

        if (r.outcome === "done") {
          toast.success(
            accion === "start"
              ? a.arrancado(servicio.name)
              : a.detenido(servicio.name),
          );
        } else if (r.outcome === "pending") {
          toast.info(a.enTransicion(servicio.name));
        } else if (r.outcome === "blocked") {
          toast.error(
            a.bloqueado(
              servicio.name,
              r.blockers.map((b) => b.name),
            ),
          );
        } else if (r.outcome === "refused") {
          toast.error(a.rechazado(servicio.name));
        }
        // `cancelled` no dice nada: el usuario cerró el UAC, que es una respuesta, no un fallo.
      } catch (e) {
        toast.error(String(e));
      } finally {
        setBusy(null);
      }

      // Pase lo que pase, la lista se relee: si la acción quedó a medias, el estado que se enseñe
      // tiene que ser el del SCM y no el que había antes de intentarlo.
      loadServices();
    },
    [loadServices, t],
  );

  /**
   * Lo que pasa al pulsar el botón de una fila.
   *
   * **Detener se confirma; arrancar no.** Arrancar un servicio no rompe nada y se deshace
   * deteniéndolo; detener corta lo que esté usándolo en ese momento, y en esta app todo lo que
   * corta algo pasa por el mismo diálogo.
   *
   * Las dependencias se consultan **antes** de abrir el diálogo. Windows se niega a detener un
   * servicio con dependientes vivos y no toca nada; descubrirlo después de haber aprobado un UAC
   * sería la peor forma de enterarse.
   */
  const pedirAccion = useCallback(
    async (servicio: ServiceInfo, accion: ServiceAction) => {
      if (accion === "start") {
        ejecutarAccion(servicio, "start");
        return;
      }

      const a = t.servicios.acciones;
      let dependientes: ServiceDependent[] = [];
      try {
        dependientes = await invoke<ServiceDependent[]>(
          "get_service_dependents",
          { name: servicio.name },
        );
      } catch {
        // Sin la lista se sigue: lo peor que pasa es que Windows lo rechace y se diga entonces.
      }

      confirmar({
        title: a.detenerTitulo(servicio.name),
        name: servicio.name,
        message:
          dependientes.length > 0
            ? a.dependientes(dependientes.map((d) => d.name))
            : a.detenerMensaje(servicio.name),
        note: dependientes.length > 0 ? undefined : a.pideAdmin,
        confirmLabel: a.detenerBoton,
        onConfirm: () => ejecutarAccion(servicio, "stop"),
      });
    },
    [ejecutarAccion, confirmar, t],
  );

  /**
   * Cambia el tipo de arranque de un servicio, **siempre con su confirmación delante**.
   *
   * Es la única acción de esta app cuyo efecto sobrevive a un reinicio y vive en Windows, no en su
   * `settings.json`. Por eso el diálogo dice a qué pasa y avisa de que no se deshace solo. Deshacer
   * entra por aquí también: es el mismo cambio en el otro sentido, y merece el mismo aviso.
   */
  const cambiarArranque = useCallback(
    (servicio: ServiceInfo, tipo: SettableStartType, deshaciendo = false) => {
      const a = t.servicios.arranque;
      // Deshacer no deja entrada en el registro: la quita. Prometer lo contrario seria enseñar al
      // usuario a no leer los avisos.
      const aviso = deshaciendo ? a.avisoDeshacer : a.aviso;

      confirmar({
        title: a.titulo(servicio.name),
        name: servicio.name,
        message: a.mensaje(
          servicio.name,
          t.servicios.arranques[servicio.startType],
          t.servicios.arranques[tipo],
        ),
        warning: aviso,
        note: t.servicios.acciones.pideAdmin,
        // En rojo solo si lo deja deshabilitado, que es lo que puede romper algo que dependa de
        // él. «Manual → Automático» es un cambio, no un peligro, y pintarlo igual que cerrar
        // procesos enseña a no mirar el color (Tier 11, C4).
        tone: tipo === "disabled" ? "danger" : "change",
        confirmLabel: a.boton,
        onConfirm: async () => {
          setBusy(servicio.name);
          try {
            const r = await invoke<ServiceStartupResult>("set_service_startup", {
              name: servicio.name,
              displayName: servicio.displayName,
              startType: tipo,
            });

            if (r.outcome === "done") {
              toast.success(
                a.hecho(servicio.name, t.servicios.arranques[r.startType]),
              );
            } else if (r.outcome === "refused") {
              toast.error(a.rechazado(servicio.name));
            }
            // `cancelled` no dice nada: cerrar el UAC es una respuesta.
          } catch (e) {
            toast.error(String(e));
          } finally {
            setBusy(null);
          }

          load();
        },
      });
    },
    [load, confirmar, t],
  );

  /**
   * Devuelve un servicio a como estaba antes de que la app lo tocara.
   *
   * Reusa `cambiarArranque` en vez de tener su propio camino: deshacer no es una operación
   * distinta, es el mismo cambio hacia el otro lado, y merece el mismo aviso. Cuando el valor
   * vuelve al original, Rust borra la entrada del registro y la sección se va sola.
   */
  const deshacerCambio = useCallback(
    (cambio: ServiceChange) => {
      // `from` sale del disco, así que se comprueba que siga siendo uno de los cuatro que la app
      // pone. Un registro escrito a mano no puede colar aquí un `boot`.
      if (!SETTABLE_START_TYPES.includes(cambio.from as SettableStartType)) {
        return;
      }
      const servicio = services?.find((s) => s.name === cambio.name);
      if (!servicio) return;

      cambiarArranque(servicio, cambio.from as SettableStartType, true);
    },
    [cambiarArranque, services],
  );

  return {
    services,
    busy,
    changes,
    load,
    refresh: loadServices,
    pedirAccion,
    cambiarArranque,
    deshacerCambio,
  };
}
