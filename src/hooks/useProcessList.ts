import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { DEFAULT_SORT, FIRST_DIR, freezeOrder, sortProcesses } from "../lib/sort";
import type { SortKey } from "../lib/sort";
import { PROCESSES_UPDATED } from "../types";
import type { ProcessInfo } from "../types";
import type { Filter } from "../components/Sidebar";

/**
 * La lista de procesos y todo lo que decide qué se ve de ella: filtro, búsqueda, orden y selección.
 *
 * Salió de `App.tsx` en T12-15. Vive por encima de la tabla y no dentro porque la tabla se
 * desmonta al filtrar a cero y al cambiar de vista; dentro, la elección del usuario se perdería
 * cada vez que pasa por Historial y vuelve.
 */
export function useProcessList() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  /** El orden congelado mientras el puntero está sobre la tabla o hay un menú abierto. */
  const [ordenCongelado, setOrdenCongelado] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  const refresh = useCallback(async () => {
    try {
      applyList(await invoke<ProcessInfo[]>("get_processes"));
    } catch (e) {
      toast.error(String(e));
    }
  }, [applyList]);

  useEffect(() => {
    // `refresh` es async: el estado se toca despues de un `await`, no en el cuerpo del efecto. La
    // regla no distingue la llamada sincrona de la funcion de lo que esa funcion hace luego.
    // Pedirle datos a Rust al montar es exactamente para lo que sirve un efecto, y aqui no hay
    // render en cascada que evitar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

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

  const selectedVisible = useMemo(
    () => visible.filter((p) => selected.has(p.pid)),
    [visible, selected],
  );

  // Lo que de verdad caería en cada lote: los protegidos se quedan fuera aquí, para que el botón y
  // el diálogo cuenten lo mismo que va a pasar. Rust los rechazaría igual; esto es para no mentir.
  const cerrablesSeleccionados = selectedVisible.filter((p) => !p.protected);
  const cerrablesVisibles = visible.filter((p) => !p.protected);
  /** Si lo que se ve es una parte de la lista: con filtro de runtime o con búsqueda. */
  const filtrada = filter !== "all" || query !== "";

  /** Repetir la columna activa invierte; cambiar de columna estrena su direccion. */
  function ordenarPor(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );
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

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  function quitarFiltro() {
    setQuery("");
    setFilter("all");
  }

  return {
    processes,
    refresh,
    filter,
    setFilter,
    query,
    setQuery,
    filtrada,
    quitarFiltro,
    sort,
    ordenarPor,
    alCongelar,
    visible,
    ordenados,
    selected,
    selectedVisible,
    cerrablesSeleccionados,
    cerrablesVisibles,
    toggle,
    toggleAll,
    clearSelection,
  };
}
