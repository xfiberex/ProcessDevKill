import { useCallback, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { PROCESSES_UPDATED, SETTABLE_START_TYPES, SYSTEM_USAGE } from "./types";
import type {
  HistoryEntry,
  KillOutcome,
  ProcessInfo,
  ServiceAction,
  ServiceActionResult,
  ServiceChange,
  ServiceDependent,
  ServiceInfo,
  ServiceStartupResult,
  Settings,
  SettableStartType,
  SystemUsage,
} from "./types";
import { ThemeProvider } from "./theme";
import { CATALOGOS, I18nProvider } from "./i18n";
import { DEFAULT_SORT, FIRST_DIR, freezeOrder, sortProcesses } from "./lib/sort";
import { claveProteccion, entradasQueLoProtegen } from "./lib/protect";
import type { SortKey } from "./lib/sort";
import { useUpdater } from "./hooks/useUpdater";
import { EmptyState } from "./components/EmptyState";
import { ProcessTable } from "./components/ProcessTable";
import { HistoryView } from "./components/HistoryView";
import { ServicesView } from "./components/ServicesView";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import type { Filter, View } from "./components/Sidebar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ConfirmRequest } from "./components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

/**
 * Rojo solido para la accion principal destructiva.
 *
 * El `variant="destructive"` de este estilo de shadcn es un rojo tenue sobre
 * fondo claro, pensado para acciones secundarias (el "Kill" de cada fila). Para
 * el boton que cierra TODA la lista de golpe hace falta que se vea que quema.
 */
const SOLID_DESTRUCTIVE =
  "shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90";

const DEFAULT_SETTINGS: Settings = {
  customNames: [],
  // Igual que en Rust: el atajo global viene apagado y, encendido, pide dos pulsaciones. Cierra
  // todo sin confirmar y le quita la combinación a las demás apps; ver `hotkey_enabled`.
  hotkeyEnabled: false,
  hotkey: "ctrlAltK",
  hotkeyDoublePress: true,
  protected: [],
  // Igual que en Rust: cerrar la ventana cierra la app. Esconderla en la bandeja
  // hay que pedirlo, porque si no se acumulan instancias invisibles.
  closeToTray: false,
  refreshMs: 2000,
  theme: "system",
  // Igual que en Rust: ni el Auto-Kill ni el Zombie Finder arrancan encendidos.
  autoKillEnabled: false,
  autoKillMb: 2048,
  zombieEnabled: false,
  zombieMinutes: 10,
  // Igual que en Rust: espanol. El idioma no se detecta del sistema a proposito; el motivo
  // esta escrito en el enum `Language` de storage.rs.
  language: "es",
  // Vacia: el catalogo de fabrica de `services.rs` ya cubre los motores conocidos.
  customServices: [],
};

export default function App() {
  const [view, setView] = useState<View>("processes");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // `null` hasta la primera lectura, para no enseñar «no hay servicios» mientras se leen.
  const [services, setServices] = useState<ServiceInfo[] | null>(null);
  /** El servicio con una accion en curso. Apaga los botones de toda la tabla mientras dura. */
  const [servicioOcupado, setServicioOcupado] = useState<string | null>(null);
  /** Los cambios de arranque que ha hecho la app y siguen puestos en Windows. */
  const [serviceChanges, setServiceChanges] = useState<ServiceChange[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // El orden vive aqui y no en la tabla porque la tabla se desmonta al filtrar a
  // cero y al cambiar de vista; dentro, la eleccion del usuario se perderia cada
  // vez que pasa por Historial y vuelve.
  const [sort, setSort] = useState(DEFAULT_SORT);
  /** El orden congelado mientras el puntero está sobre la tabla o hay un menú abierto. */
  const [ordenCongelado, setOrdenCongelado] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [killing, setKilling] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [usage, setUsage] = useState<SystemUsage | null>(null);
  const updater = useUpdater();

  // El catalogo se lee aqui ademas de proveerlo mas abajo: los toast y los dialogos se arman en
  // callbacks de este componente, que estan **fuera** del proveedor y no pueden usar `useT()`.
  const t = CATALOGOS[settings.language] ?? CATALOGOS.es;

  const applyList = useCallback((list: ProcessInfo[]) => {
    setProcesses(list);

    // Un PID seleccionado que ya no existe seguiria contando para "matar
    // seleccionados"; se poda contra la lista recien llegada.
    const alive = new Set(list.map((p) => p.pid));
    setSelected((prev) => {
      const next = new Set([...prev].filter((pid) => alive.has(pid)));
      return next.size === prev.size ? prev : next;
    });
  }, []);

  // Rust empuja la lista; la ventana ya no hace polling. El comando solo se usa
  // para la carga inicial y el boton de refresco manual.
  useEffect(() => {
    const pending = listen<ProcessInfo[]>(PROCESSES_UPDATED, (event) =>
      applyList(event.payload),
    );
    return () => {
      pending.then((unlisten) => unlisten());
    };
  }, [applyList]);

  /**
   * El medidor del sidebar, por su propio evento.
   *
   * No viaja con la lista porque no se publica desde los mismos sitios: la lista
   * la reemiten tambien los cierres y el refresco manual, y el medidor solo sale
   * del hilo del poller, que es el unico que corre a un ritmo conocido. Ver
   * `medir` en poller.rs.
   */
  useEffect(() => {
    const pending = listen<SystemUsage>(SYSTEM_USAGE, (event) =>
      setUsage(event.payload),
    );
    return () => {
      pending.then((unlisten) => unlisten());
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyList(await invoke<ProcessInfo[]>("get_processes"));
    } catch (e) {
      toast.error(String(e));
    }
  }, [applyList]);

  /**
   * Los servicios, **a petición**.
   *
   * No los empuja el poller como a los procesos: un servicio cambia de estado dos veces al día, y
   * releer el catálogo entero del SCM cada dos segundos le sumaría al ciclo un recorrido de
   * cientos de servicios para no enterarse de nada. Ver `get_services` en lib.rs.
   */
  const loadServices = useCallback(async () => {
    try {
      setServices(await invoke<ServiceInfo[]>("get_services"));
    } catch (e) {
      // Lista vacía y no `null`: con `null` la vista se quedaría diciendo «leyendo…» para siempre.
      setServices([]);
      toast.error(t.avisos.serviciosNoLeidos, { description: String(e) });
    }
    // `t` fuera de las dependencias a propósito, como en el efecto del actualizador: esta función
    // la usan efectos que no deben relanzarse al cambiar de idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setServicioOcupado(servicio.name);

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
        setServicioOcupado(null);
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

      setConfirm({
        title: a.detenerTitulo(servicio.name),
        message:
          dependientes.length > 0
            ? a.dependientes(dependientes.map((d) => d.name))
            : `${a.detenerMensaje(servicio.name)} ${a.pideAdmin}`,
        confirmLabel: a.detenerBoton,
        onConfirm: () => ejecutarAccion(servicio, "stop"),
      });
    },
    [ejecutarAccion, t],
  );

  const loadServiceChanges = useCallback(async () => {
    try {
      setServiceChanges(await invoke<ServiceChange[]>("get_service_changes"));
    } catch {
      // Quedarse sin el registro no puede tumbar la vista: lo que se pierde es poder deshacer
      // desde aqui, y eso se ve solo —la seccion no aparece—.
    }
  }, []);

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

      setConfirm({
        title: a.titulo(servicio.name),
        message: `${a.mensaje(
          servicio.name,
          t.servicios.arranques[servicio.startType],
          t.servicios.arranques[tipo],
        )} ${aviso.replace(/\*\*/g, "")} ${t.servicios.acciones.pideAdmin}`,
        confirmLabel: a.boton,
        onConfirm: async () => {
          setServicioOcupado(servicio.name);
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
            setServicioOcupado(null);
          }

          loadServices();
          loadServiceChanges();
        },
      });
    },
    [loadServices, loadServiceChanges, t],
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

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await invoke<HistoryEntry[]>("get_history"));
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  useEffect(() => {
    // `refresh` es async: el estado se toca despues de un `await`, no en el cuerpo del efecto. La
    // regla no distingue la llamada sincrona de la funcion de lo que esa funcion hace luego.
    // Pedirle datos a Rust al montar es exactamente para lo que sirve un efecto, y aqui no hay
    // render en cascada que evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    invoke<Settings>("get_settings").then(setSettings).catch(() => {});
  }, [refresh]);

  // El historial cambia al matar procesos desde cualquier sitio, asi que se
  // recarga al entrar en la vista en vez de mantenerlo sincronizado siempre.
  useEffect(() => {
    // Mismo caso que arriba: `loadHistory` es async y el `setHistory` cae despues del `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  // Igual que el historial: se leen al entrar en la vista en vez de mantenerlos sincronizados.
  useEffect(() => {
    if (view !== "services") return;
    // Mismo caso que el historial: `loadServices` es async y su setState cae despues del await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadServices();
    loadServiceChanges();
  }, [view, loadServices, loadServiceChanges]);

  /**
   * Comprobacion de actualizaciones al arrancar, en silencio.
   *
   * En silencio porque un fallo aqui es de lo mas normal —equipo sin red, VPN
   * levantandose— y no merece un error en la cara nada mas abrir la app. Si hay
   * version nueva se avisa con un toast que lleva a Ajustes, donde esta el boton
   * de instalar: descargar y reiniciar no puede pasar sin que el usuario lo pida.
   */
  const { buscar: buscarActualizacion } = updater;
  useEffect(() => {
    let cancelado = false;

    buscarActualizacion(true).then((version) => {
      if (cancelado || !version) return;
      toast.info(t.avisos.hayVersion(version), {
        description: t.avisos.hayVersionComo,
        action: {
          label: t.avisos.irAAjustes,
          onClick: () => setView("settings"),
        },
        duration: 12_000,
      });
    });

    return () => {
      cancelado = true;
    };
    // `t` queda fuera de las dependencias a proposito: este efecto tiene que correr **una vez**,
    // al arrancar. Incluirlo relanzaria la comprobacion de actualizaciones cada vez que se cambia
    // de idioma, que es una consulta de red por un ajuste que no tiene nada que ver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarActualizacion]);

  async function saveSettings(next: Settings) {
    // Se guarda el estado de antes **antes** de pintar el nuevo: si Rust rechaza, la ventana tiene
    // que volver a lo que de verdad esta vigente. Sin esto, la divergencia se queda para siempre y
    // el unico aviso -un toast- se va en segundos: la ventana podria decir 4096 MB mientras el
    // Auto-Kill sigue cerrando a los 2048, que es justo el ajuste que no puede mentir.
    const anterior = settings;
    setSettings(next); // Optimista: la UI responde al instante.
    try {
      setSettings(await invoke<Settings>("save_settings", { settings: next }));
    } catch (e) {
      setSettings(anterior);
      toast.error(t.avisos.ajustesNoGuardados, { description: String(e) });
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return processes.filter((p) => {
      if (filter !== "all" && p.runtime !== filter) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        // La segunda línea de la fila también se busca: es lo que distingue a trece `node.exe`.
        (p.script?.toLowerCase().includes(needle) ?? false) ||
        (p.project?.toLowerCase().includes(needle) ?? false) ||
        String(p.pid).includes(needle) ||
        p.ports.some((port) => String(port).includes(needle))
      );
    });
  }, [processes, filter, query]);

  const ordenados = useMemo(() => {
    const vivos = sortProcesses(visible, sort);
    return ordenCongelado ? freezeOrder(vivos, ordenCongelado) : vivos;
  }, [visible, sort, ordenCongelado]);

  /**
   * Congela el orden con el que se ve la tabla **ahora**, o lo suelta.
   *
   * Se guarda la foto de lo que hay en pantalla, no la de la lista de Rust: lo que no puede moverse
   * es lo que el usuario tiene delante. Si ya estaba congelado, se deja la foto que había.
   */
  const alCongelar = useCallback(
    (congelar: boolean) => {
      setOrdenCongelado((prev) =>
        congelar ? (prev ?? ordenados.map((p) => p.pid)) : null,
      );
    },
    [ordenados],
  );

  /**
   * Protege una fila desde su menú, o le quita la protección.
   *
   * Pasa por los ajustes y no por un comando propio: la lista vive en `settings.json` junto a los
   * vigilados, y Rust la vuelve a leer en cada cierre. Al guardarlos, Rust reemite la lista y el
   * candado aparece sin esperar al ciclo.
   */
  function protegerFila(p: ProcessInfo, proteger: boolean) {
    const clave = claveProteccion(p);
    if (proteger) {
      saveSettings({ ...settings, protected: [...settings.protected, clave] });
      toast.success(t.avisos.protegido(clave));
    } else {
      const quitar = entradasQueLoProtegen(p, settings.protected);
      saveSettings({
        ...settings,
        protected: settings.protected.filter((e) => !quitar.includes(e)),
      });
      toast.success(t.avisos.desprotegido(quitar[0] ?? clave));
    }
  }

  const selectedVisible = useMemo(
    () => visible.filter((p) => selected.has(p.pid)),
    [visible, selected],
  );

  // Lo que de verdad caería en cada lote: los protegidos se quedan fuera aquí, para que el botón y
  // el diálogo cuenten lo mismo que va a pasar. Rust los rechazaría igual; esto es para no mentir.
  const cerrablesSeleccionados = selectedVisible.filter((p) => !p.protected);
  const cerrablesVisibles = visible.filter((p) => !p.protected);

  /** Repetir la columna activa invierte; cambiar de columna estrena su direccion. */
  function ordenarPor(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );
  }

  async function killMany(pids: number[]) {
    if (pids.length === 0) return;
    setKilling(new Set(pids));

    try {
      const outcomes = await invoke<KillOutcome[]>("kill_processes", { pids });
      const failed = outcomes.filter((o) => !o.killed);

      if (failed.length === outcomes.length) {
        toast.error(failed[0].error ?? t.avisos.noSePudoTerminar);
      } else if (failed.length > 0) {
        toast.warning(t.avisos.fallosParciales(failed.length, outcomes.length), {
          description: failed[0].error ?? undefined,
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

      setSelected(new Set());
    } catch (e) {
      toast.error(String(e));
    } finally {
      setKilling(new Set());
    }
  }

  /**
   * Copia al portapapeles desde el menu contextual de una fila.
   *
   * Via el plugin de Tauri y no `navigator.clipboard`: la API web exige que el
   * documento tenga el foco y lanza NotAllowedError si no lo tiene, cosa que
   * pasa justo cuando la ventana acaba de recuperarse de la bandeja.
   */
  async function copyToClipboard(text: string, what: string) {
    try {
      await writeText(text);
      toast.success(t.avisos.copiado(what));
    } catch (e) {
      toast.error(t.avisos.noSePudoCopiar(String(e)));
    }
  }

  function toggle(pid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(pid)) next.add(pid);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = visible.every((p) => selected.has(p.pid));
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.pid)));
  }

  function askNuke(pids: number[], ambito: string, protegidosFuera: number) {
    setConfirm({
      title: t.confirmar.cerrarTitulo(pids.length),
      message:
        protegidosFuera > 0
          ? `${t.confirmar.cerrarMensaje(pids.length, ambito)} ${t.confirmar.protegidosFuera(protegidosFuera)}`
          : t.confirmar.cerrarMensaje(pids.length, ambito),
      confirmLabel: t.confirmar.cerrarBoton(pids.length),
      onConfirm: () => killMany(pids),
    });
  }

  return (
    /*
     * `reducedMotion="user"` respeta el interruptor de "Efectos de animación" de Windows, que
     * WebView2 traslada a `prefers-reduced-motion`. Motion desactiva entonces las animaciones de
     * transformación —el desplazamiento de las filas al salir— y deja las de opacidad, que no
     * provocan vértigo. Va aquí arriba y no en cada animación porque es una preferencia del
     * usuario, no una decisión de cada componente.
     *
     * Las transiciones de las barras son CSS y Motion no las gobierna: esas las apaga la regla de
     * `index.css`. Las dos hacen falta.
     */
    <MotionConfig reducedMotion="user">
    {/* Por dentro del tema y por fuera de todo lo demas: el idioma lo necesita hasta el
        `ConfirmDialog`, que se pinta al final del arbol. */}
    <I18nProvider language={settings.language}>
    <ThemeProvider theme={settings.theme}>
      <div className="flex h-full">
        <Sidebar
          view={view}
          onViewChange={setView}
          filter={filter}
          onFilterChange={setFilter}
          processes={processes}
          refreshMs={settings.refreshMs}
          onRefreshMsChange={(ms) => saveSettings({ ...settings, refreshMs: ms })}
          usage={usage}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {view === "processes" && (
            <header className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.cabecera.buscarPlaceholder}
                // El placeholder desaparece en cuanto se escribe, asi que no vale como nombre
                // accesible (WCAG 3.3.2): con texto dentro, el campo se anunciaba sin decir que es.
                aria-label={t.cabecera.buscarLabel}
                className="min-w-0 flex-1"
              />

              {/* Sin el aria-label esto es un numero suelto leido en voz alta, y ademas cambia al
                  filtrar sin que nada lo anuncie. `polite` y no `assertive`: interesa que se diga,
                  no que interrumpa lo que se estuviera leyendo. */}
              <span
                className="shrink-0 text-sm text-muted-foreground tabular-nums"
                aria-label={t.cabecera.enLaLista(visible.length)}
                aria-live="polite"
              >
                {visible.length}
              </span>

              <Button variant="outline" onClick={refresh} className="shrink-0">
                {t.cabecera.refrescar}
              </Button>

              {selectedVisible.length > 0 ? (
                <Button
                  variant="destructive"
                  className={SOLID_DESTRUCTIVE}
                  disabled={cerrablesSeleccionados.length === 0}
                  onClick={() =>
                    askNuke(
                      cerrablesSeleccionados.map((p) => p.pid),
                      t.confirmar.ambitoSeleccionados(cerrablesSeleccionados.length),
                      selectedVisible.length - cerrablesSeleccionados.length,
                    )
                  }
                >
                  {t.cabecera.matar(cerrablesSeleccionados.length)}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className={SOLID_DESTRUCTIVE}
                  disabled={cerrablesVisibles.length === 0}
                  onClick={() =>
                    askNuke(
                      cerrablesVisibles.map((p) => p.pid),
                      filter === "all" && !query
                        ? t.confirmar.ambitoTodos
                        : t.confirmar.ambitoFiltrados,
                      visible.length - cerrablesVisibles.length,
                    )
                  }
                >
                  {t.cabecera.nukeAll}
                </Button>
              )}
            </header>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "settings" && (
              <SettingsView
                settings={settings}
                onChange={saveSettings}
                updater={updater}
              />
            )}

            {view === "services" && (
              <ServicesView
                services={services}
                onRefresh={loadServices}
                onIrAAjustes={() => setView("settings")}
                onAction={pedirAccion}
                onStartupChange={cambiarArranque}
                changes={serviceChanges}
                onUndo={deshacerCambio}
                busy={servicioOcupado}
              />
            )}

            {view === "history" && (
              <HistoryView
                entries={history}
                onClear={() =>
                  setConfirm({
                    title: t.confirmar.vaciarTitulo,
                    message: t.confirmar.vaciarMensaje,
                    confirmLabel: t.confirmar.vaciarBoton,
                    onConfirm: async () => {
                      // El unico `invoke` del frontend que estaba sin `try`: si la escritura
                      // fallaba, saltaba una promesa rechazada sin gestionar y el dialogo se
                      // cerraba como si hubiera funcionado. El historial seguia entero en disco y
                      // en pantalla, sin que nada lo dijera.
                      try {
                        await invoke("clear_history");
                        loadHistory();
                      } catch (e) {
                        toast.error(t.avisos.historialNoVaciado, {
                          description: String(e),
                        });
                      }
                    },
                  })
                }
              />
            )}

            {view === "processes" &&
              (ordenados.length === 0 ? (
                <EmptyState
                  sinProcesos={processes.length === 0}
                  onIrAAjustes={() => setView("settings")}
                />
              ) : (
                <ProcessTable
                  processes={ordenados}
                  selected={selected}
                  killing={killing}
                  sort={sort}
                  onSort={ordenarPor}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onKill={(pid) => killMany([pid])}
                  onCopy={copyToClipboard}
                  onProtect={protegerFila}
                  onFreezeChange={alCongelar}
                />
              ))}
          </div>
        </main>

        <ConfirmDialog request={confirm} onCancel={() => setConfirm(null)} />
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
    </I18nProvider>
    </MotionConfig>
  );
}
