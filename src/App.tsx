import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "@/lib/avisos";
import { SYSTEM_USAGE } from "./types";
import type { HistoryEntry, SystemUsage } from "./types";
import { ThemeProvider } from "./theme";
import { I18nProvider } from "./i18n";
import { useKills } from "./hooks/useKills";
import { useProcessList } from "./hooks/useProcessList";
import { useServices } from "./hooks/useServices";
import { useSettings } from "./hooks/useSettings";
import { useUpdater } from "./hooks/useUpdater";
import { useVentana } from "./hooks/useVentana";
import { EmptyState } from "./components/EmptyState";
import { ProcessTable } from "./components/ProcessTable";
import { ProcessesHeader } from "./components/ProcessesHeader";
import { HistoryView } from "./components/HistoryView";
import { ServicesView } from "./components/ServicesView";
import { SettingsView } from "./components/SettingsView";
import type { DestinoDeAjustes } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import type { View } from "./components/Sidebar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SelectionBar } from "./components/SelectionBar";
import { ViewBody } from "./components/ViewHeader";
import type { ConfirmRequest } from "./components/ConfirmDialog";
import { Toaster } from "@/components/ui/sonner";

/**
 * La ventana entera: qué vista se ve, y lo que comparten todas —el diálogo de confirmación, los
 * avisos, el idioma y el tema—.
 *
 * **Lo que tiene estado propio vive en su hook** (T12-15): los ajustes en `useSettings`, la lista
 * con su filtro, orden y selección en `useProcessList`, los cierres en `useKills`, los servicios en
 * `useServices` y el actualizador en `useUpdater`. Este archivo los une y pinta. Cuando vuelva a
 * pasar de ~450 líneas, se parte otra vez: la regla está en CLAUDE.md.
 */
export default function App() {
  const [view, setView] = useState<View>("processes");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  /**
   * Si la app corre como administrador. `null` mientras no se sabe: el aviso solo sale con un
   * `false` explícito, para no enseñarlo de más en el instante que tarda Rust en contestar.
   */
  const [elevated, setElevated] = useState<boolean | null>(null);
  /**
   * Un aviso lleva a la sección de Ajustes que lo explica, no al principio: el de administrador del
   * sidebar y el de versión nueva, que dejaba «Descargar e instalar» a tres pantallas (T14-12).
   */
  const [irA, setIrA] = useState<DestinoDeAjustes | null>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  /** Pide enfocar el buscador en cuanto esté pintado: puede que haya que cambiar de vista antes. */
  const [enfocarBuscador, setEnfocarBuscador] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [usage, setUsage] = useState<SystemUsage | null>(null);

  // `t` sale de aquí además de proveerlo más abajo: los toast y los diálogos se arman en
  // callbacks de este componente y de sus hooks, que están **fuera** del proveedor y no pueden
  // usar `useT()`.
  const { settings, cargados, t, saveSettings, protegerFila } = useSettings();
  const lista = useProcessList();
  const { killing, killMany, askNuke } = useKills({
    t,
    elevated,
    confirmar: setConfirm,
    onCerrados: lista.clearSelection,
  });
  const servicios = useServices(t, setConfirm);
  const updater = useUpdater();

  useEffect(() => {
    if (!enfocarBuscador || view !== "processes") return;
    buscadorRef.current?.focus();
    buscadorRef.current?.select();
    // Consumida la petición en el mismo efecto que la cumple: es un aviso de un solo uso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnfocarBuscador(false);
  }, [enfocarBuscador, view]);

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

  useEffect(() => {
    // Una vez: la elevación no cambia mientras la app vive. Para cambiarla hay que reiniciarla.
    invoke<boolean>("get_elevation").then(setElevated).catch(() => {});
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await invoke<HistoryEntry[]>("get_history"));
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  // El historial cambia al matar procesos desde cualquier sitio, asi que se
  // recarga al entrar en la vista en vez de mantenerlo sincronizado siempre.
  useEffect(() => {
    // `loadHistory` es async: el estado se toca despues de un `await`, no en el cuerpo del efecto.
    // La regla no distingue la llamada sincrona de la funcion de lo que esa funcion hace luego.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

  // Igual que el historial: se leen al entrar en la vista en vez de mantenerlos sincronizados.
  const { load: cargarServicios } = servicios;
  useEffect(() => {
    if (view === "services") cargarServicios();
  }, [view, cargarServicios]);

  // Ctrl+F lleva al buscador desde cualquier vista, y F5 refresca lo que se mira en vez de
  // recargar la ventana: en Ajustes no hay nada que releer, y se queda con la lista.
  useVentana({
    onBuscar: () => {
      setView("processes");
      setEnfocarBuscador(true);
    },
    onRefrescar: () => {
      if (view === "services") servicios.refresh();
      else if (view === "history") loadHistory();
      else lista.refresh();
    },
  });

  /**
   * Comprobacion de actualizaciones al arrancar, en silencio.
   *
   * En silencio porque un fallo aqui es de lo mas normal —equipo sin red, VPN
   * levantandose— y no merece un error en la cara nada mas abrir la app. Si hay
   * version nueva se avisa con un toast que lleva a Ajustes, donde esta el boton
   * de instalar: descargar y reiniciar no puede pasar sin que el usuario lo pida.
   *
   * **Espera a que los ajustes estén leídos**, y no consulta si ahí pone que no (T12-31). Antes
   * salía al montar, con los ajustes de fábrica todavía: la petición ya estaba en camino cuando
   * llegaba el «no» del usuario.
   */
  const { buscar: buscarActualizacion } = updater;
  useEffect(() => {
    if (!cargados || !settings.checkUpdatesOnStart) return;
    let cancelado = false;

    buscarActualizacion(true).then((version) => {
      if (cancelado || !version) return;
      toast.info(t.avisos.hayVersion(version), {
        description: t.avisos.hayVersionComo,
        action: {
          label: t.avisos.irAAjustes,
          onClick: () => {
            setIrA("actualizaciones");
            setView("settings");
          },
        },
        duration: 12_000,
      });
    });

    return () => {
      cancelado = true;
    };
    // `t` queda fuera de las dependencias a proposito: este efecto tiene que correr **una vez**,
    // al arrancar. Incluirlo relanzaria la comprobacion de actualizaciones cada vez que se cambia
    // de idioma, que es una consulta de red por un ajuste que no tiene nada que ver. Y el ajuste
    // tampoco está, por lo mismo: encenderlo más tarde no es arrancar, y para buscar en ese
    // momento ya está el botón de al lado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarActualizacion, cargados]);

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

  async function restartAsAdmin() {
    try {
      // Si se aprueba el UAC, Rust lanza la elevada y cierra esta: no hay nada más que hacer. Si
      // se cierra, contesta `cancelled`, que no merece aviso: es una respuesta.
      await invoke("restart_as_admin");
    } catch (e) {
      toast.error(t.ajustes.administrador.noSePudo, { description: String(e) });
    }
  }

  function pedirVaciarHistorial() {
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
    });
  }

  const { visible, selectedVisible, cerrablesSeleccionados, cerrablesVisibles } = lista;

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
          filter={lista.filter}
          onFilterChange={lista.setFilter}
          processes={lista.processes}
          showAllFilters={settings.showAllFilters}
          refreshMs={settings.refreshMs}
          onRefreshMsChange={(ms) => saveSettings({ ...settings, refreshMs: ms })}
          usage={usage}
          elevated={elevated}
          onVerAdmin={() => {
            setIrA("admin");
            setView("settings");
          }}
          hayVersionNueva={updater.state.fase === "disponible"}
        />

        {/* `relative` por la barra de la selección, que flota abajo sin empujar las filas. */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Cada vista pinta su cabecera y su cuerpo con scroll (Tier 11, D1; ver `ViewHeader`).
              La de Procesos va aparte porque su estado —búsqueda, selección, orden— lo comparten
              la cabecera, la tabla y la barra de la selección. */}
          {view === "processes" && (
            <ProcessesHeader
              buscadorRef={buscadorRef}
              query={lista.query}
              onQueryChange={lista.setQuery}
              visibles={visible.length}
              cerrables={cerrablesVisibles.length}
              filtrada={lista.filtrada}
              haySeleccion={selectedVisible.length > 0}
              refreshMs={settings.refreshMs}
              onRefresh={lista.refresh}
              onNuke={() =>
                askNuke(
                  cerrablesVisibles.map((p) => p.pid),
                  lista.filtrada ? t.confirmar.ambitoFiltrados : t.confirmar.ambitoTodos,
                  visible.length - cerrablesVisibles.length,
                )
              }
            />
          )}

            {view === "settings" && (
              <SettingsView
                settings={settings}
                onChange={saveSettings}
                updater={updater}
                elevated={elevated}
                onRestartAsAdmin={restartAsAdmin}
                irA={irA}
                onIdo={() => setIrA(null)}
              />
            )}

            {view === "services" && (
              <ServicesView
                services={servicios.services}
                onRefresh={servicios.refresh}
                onIrAAjustes={() => setView("settings")}
                onAction={servicios.pedirAccion}
                onStartupChange={servicios.cambiarArranque}
                changes={servicios.changes}
                onUndo={servicios.deshacerCambio}
                busy={servicios.busy}
                elevated={elevated}
              />
            )}

            {view === "history" && (
              <HistoryView entries={history} onClear={pedirVaciarHistorial} />
            )}

            {view === "processes" && (
              // Siempre con 80 px de sitio debajo (Tier 11, E): lo que flota abajo —la barra de la
              // selección y los avisos, que abajo a la derecha caen **sobre la columna Kill**
              // (medido: 356×54 px a 24 del borde)— tapaba la última fila, y sin ese hueco no
              // había forma de subirla por encima.
              <ViewBody className="pb-20">
              {lista.ordenados.length === 0 ? (
                <EmptyState
                  sinProcesos={lista.processes.length === 0}
                  onIrAAjustes={() => setView("settings")}
                  onQuitarFiltro={lista.quitarFiltro}
                />
              ) : (
                <ProcessTable
                  processes={lista.ordenados}
                  selected={lista.selected}
                  killing={killing}
                  sort={lista.sort}
                  onSort={lista.ordenarPor}
                  onToggle={lista.toggle}
                  onToggleAll={lista.toggleAll}
                  onKill={(pid) => killMany([pid])}
                  onCopy={copyToClipboard}
                  onProtect={protegerFila}
                  onFreezeChange={lista.alCongelar}
                />
              )}
              </ViewBody>
            )}

          {view === "processes" && selectedVisible.length > 0 && (
            <SelectionBar
              count={selectedVisible.length}
              closable={cerrablesSeleccionados.length}
              onClose={() =>
                askNuke(
                  cerrablesSeleccionados.map((p) => p.pid),
                  t.confirmar.ambitoSeleccionados(cerrablesSeleccionados.length),
                  selectedVisible.length - cerrablesSeleccionados.length,
                )
              }
              onClear={lista.clearSelection}
            />
          )}
        </main>

        <ConfirmDialog request={confirm} onCancel={() => setConfirm(null)} />
        <Toaster position="bottom-right" />
      </div>
    </ThemeProvider>
    </I18nProvider>
    </MotionConfig>
  );
}
