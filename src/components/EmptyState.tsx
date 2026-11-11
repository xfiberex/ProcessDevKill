import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EyeIcon, FilterXIcon, SettingsIcon } from "lucide-react";
import { Marcado, useT } from "../i18n";
import type { PortOwner } from "../types";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  /** `true` cuando no hay ni un proceso, `false` cuando los hay pero el filtro no deja pasar ninguno. */
  sinProcesos: boolean;
  onIrAAjustes: () => void;
  /** Quita la búsqueda y el filtro de runtime: la salida del «ningún proceso coincide». */
  onQuitarFiltro?: () => void;
  /** Lo escrito en el buscador: si es un puerto, se pregunta quién lo tiene (T14-34). */
  query?: string;
  /** Si un PID está en la lista sin filtrar: entonces lo esconde el filtro, no la vigilancia. */
  enLaLista?: (pid: number) => boolean;
  /** Añade un ejecutable a los vigilados. */
  onVigilar?: (nombre: string) => void;
};

/** El puerto que se busca, si lo escrito es uno: de 1 a 65535 y solo cifras. */
function puertoBuscado(query: string | undefined): number | null {
  const q = query?.trim() ?? "";
  if (!/^\d{1,5}$/.test(q)) return null;
  const n = Number(q);
  return n >= 1 && n <= 65535 ? n : null;
}

/**
 * Quién tiene el puerto que se busca, preguntado a Rust (T14-34).
 *
 * `null` mientras no se sabe o si nadie lo tiene, **y se trata igual**: con Windows informando mal
 * del estado de los sockets (visto en la compilación 26300, 2026-11-11), Rust no distingue «libre»
 * de «no se pudo leer». Por eso el vacío solo dice algo cuando hay un dueño, y nunca que el puerto
 * está libre.
 */
function useDuenoDelPuerto(puerto: number | null): PortOwner | null {
  const [dueno, setDueno] = useState<{ puerto: number; quien: PortOwner | null } | null>(null);

  useEffect(() => {
    if (puerto === null) return;
    let vigente = true;
    invoke<PortOwner | null>("who_listens", { port: puerto })
      .then((quien) => {
        if (vigente) setDueno({ puerto, quien: quien ?? null });
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [puerto]);

  // La respuesta de otra búsqueda no vale para esta: se escribe «30», «300», «3000»…
  return dueno && dueno.puerto === puerto ? dueno.quien : null;
}

/**
 * Lo que se ve cuando la tabla no tiene filas.
 *
 * Son dos situaciones que se parecen en pantalla y no tienen nada que ver: no
 * haber encontrado nada, y no estar buscando lo correcto. La primera es lo
 * primero que ve alguien que acaba de instalar la app, y decir solo "no hay
 * procesos" la deja en un callejon sin salida: Node, Python, .NET, Java, Deno
 * y Bun se vigilan siempre, pero quien trabaje con Go, Docker o PHP no vera nunca nada hasta que
 * los añada, y eso no se adivina.
 */
export function EmptyState({
  sinProcesos,
  onIrAAjustes,
  onQuitarFiltro,
  query,
  enLaLista,
  onVigilar,
}: EmptyStateProps) {
  const t = useT();
  const puerto = puertoBuscado(query);
  const dueno = useDuenoDelPuerto(sinProcesos ? null : puerto);
  const escondido = dueno !== null && (enLaLista?.(dueno.pid) ?? false);

  // Con la salida a mano (Tier 11, E): sin ella, el vacío obligaba a buscar qué filtro estaba
  // puesto —la búsqueda arriba o un runtime en el sidebar— y quitarlo cada uno en su sitio.
  //
  // Y si lo buscado es un puerto que alguien tiene, quién (T14-34): era el callejón sin salida del
  // camino de rescate, el «3000 ocupado» por un programa que la app no vigila.
  if (!sinProcesos) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t.vacio.sinCoincidencias}</p>
        {dueno && puerto !== null && (
          <p className="mx-auto mt-2 max-w-md text-sm" role="status">
            {escondido
              ? t.vacio.puertoFueraDelFiltro(puerto, dueno.name, dueno.pid)
              : t.vacio.puertoNoVigilado(puerto, dueno.name, dueno.pid)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {dueno && !escondido && dueno.watchable && onVigilar && (
            <Button variant="outline" onClick={() => onVigilar(dueno.name)}>
              <EyeIcon />
              {t.vacio.vigilar(dueno.name)}
            </Button>
          )}
          {onQuitarFiltro && (
            <Button variant="outline" onClick={onQuitarFiltro}>
              <FilterXIcon />
              {t.vacio.quitarFiltro}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-muted-foreground">{t.vacio.sinProcesos}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        <Marcado texto={t.vacio.sugerencia} />
      </p>
      <Button variant="outline" onClick={onIrAAjustes} className="mt-4">
        <SettingsIcon />
        {t.vacio.boton}
      </Button>
    </div>
  );
}
