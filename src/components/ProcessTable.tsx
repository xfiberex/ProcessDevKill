import { AnimatePresence, motion } from "motion/react";
import { CopyIcon, GhostIcon, SkullIcon } from "lucide-react";
import { RUNTIME_ICONS } from "../icons";
import { RUNTIMES } from "../types";
import type { ProcessInfo } from "../types";
import { formatMemory, formatUptime } from "../lib/format";
import { UsageBar } from "./UsageBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type ProcessTableProps = {
  processes: ProcessInfo[];
  selected: Set<number>;
  killing: Set<number>;
  onToggle: (pid: number) => void;
  onToggleAll: () => void;
  onKill: (pid: number) => void;
  onCopy: (text: string, what: string) => void;
};

export function ProcessTable({
  processes,
  selected,
  killing,
  onToggle,
  onToggleAll,
  onKill,
  onCopy,
}: ProcessTableProps) {
  // Referencias para las barras: el proceso que mas consume marca el 100 %.
  const maxCpu = Math.max(...processes.map((p) => p.cpu), 0.001);
  const maxMemory = Math.max(...processes.map((p) => p.memoryMb), 1);

  const allSelected =
    processes.length > 0 && processes.every((p) => selected.has(p.pid));

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-background text-xs tracking-wide text-muted-foreground uppercase">
        <tr>
          {/* scope="col": en una tabla de ocho columnas es lo que hace que un
              lector de pantalla diga "Puerto: 3000" al recorrer celdas, en vez de
              leer numeros sueltos sin saber de que son. */}
          <th scope="col" className="w-9 py-2 pl-5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              aria-label="Seleccionar todos"
            />
          </th>
          <th scope="col" className="px-3 py-2 text-left font-medium">
            Proceso
          </th>
          <th scope="col" className="px-3 py-2 text-left font-medium">
            Puerto
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            PID
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            CPU
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            RAM
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Activo
          </th>
          <th scope="col" className="px-5 py-2">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>

      <tbody>
        <AnimatePresence initial={false}>
          {processes.map((p) => {
            const Icon = RUNTIME_ICONS[p.runtime];
            const { color, label } = RUNTIMES[p.runtime];
            const isKilling = killing.has(p.pid);

            return (
              // ContextMenu (Base UI) no pinta ningun elemento propio, asi que
              // puede envolver una fila sin romper el <tbody>; el trigger es la
              // <tr> de siempre, via `render`.
              <ContextMenu key={p.pid}>
                <ContextMenuTrigger
                  render={
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isKilling ? 0.4 : 1 }}
                      exit={{
                        opacity: 0,
                        x: -24,
                        backgroundColor: "rgba(220,38,38,0.25)",
                      }}
                      transition={{ duration: 0.18 }}
                      // El zombi se tiñe de ambar en toda la fila: la insignia
                      // sola se pierde en una tabla de veinte lineas.
                      className={`border-t border-border data-popup-open:bg-muted/60 ${
                        p.zombie
                          ? "bg-amber-500/8 hover:bg-amber-500/15"
                          : "hover:bg-muted/60"
                      }`}
                    />
                  }
                >
                  <td className="py-2 pl-5">
                    <Checkbox
                      checked={selected.has(p.pid)}
                      onCheckedChange={() => onToggle(p.pid)}
                      aria-label={`Seleccionar PID ${p.pid}`}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0" style={{ color }} />
                      <span className="truncate">{p.name}</span>
                      <span className="sr-only">{label}</span>
                      {p.zombie && (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                          title={`Sin actividad desde hace ${formatUptime(p.idleSecs)}, y sigue ocupando ${p.ports.length === 1 ? "el puerto" : "los puertos"} ${p.ports.join(", ")}`}
                        >
                          <GhostIcon className="size-3.5" aria-hidden />
                          Zombi
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {p.ports.length === 0 ? (
                      // Sin el /50: al 50 % de opacidad el guion se queda en ~2:1 de
                      // contraste, por debajo del minimo. Es poca informacion, pero
                      // es informacion.
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {p.ports.map((port) => (
                          <span
                            key={port}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums"
                          >
                            {port}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {p.pid}
                  </td>

                  <td className="px-3 py-2">
                    <UsageBar
                      label={`${p.cpu.toFixed(1)}%`}
                      value={p.cpu}
                      max={maxCpu}
                      color={color}
                    />
                  </td>

                  <td className="px-3 py-2">
                    <UsageBar
                      label={formatMemory(p.memoryMb)}
                      value={p.memoryMb}
                      max={maxMemory}
                      color={color}
                    />
                  </td>

                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {formatUptime(p.runTimeSecs)}
                  </td>

                  <td className="px-5 py-2 text-right">
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => onKill(p.pid)}
                      disabled={isKilling}
                      // Sin esto hay veinte botones que se anuncian "Kill" a secas,
                      // sin decir cual mata cada uno. El checkbox de la misma fila ya
                      // se nombraba bien; para el boton que cierra un proceso es
                      // justo la etiqueta que no se puede fallar.
                      aria-label={`Cerrar ${p.name}, PID ${p.pid}`}
                    >
                      Kill
                    </Button>
                  </td>
                </ContextMenuTrigger>

                <ContextMenuContent>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => onKill(p.pid)}
                  >
                    <SkullIcon />
                    Matar proceso
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => onCopy(String(p.pid), `PID ${p.pid}`)}
                  >
                    <CopyIcon />
                    Copiar PID
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onCopy(p.name, p.name)}
                  >
                    <CopyIcon />
                    Copiar nombre
                  </ContextMenuItem>
                  {p.ports.length > 0 && (
                    <ContextMenuItem
                      onClick={() =>
                        onCopy(
                          p.ports.join(", "),
                          p.ports.length === 1
                            ? `puerto ${p.ports[0]}`
                            : `puertos ${p.ports.join(", ")}`,
                        )
                      }
                    >
                      <CopyIcon />
                      {p.ports.length === 1 ? "Copiar puerto" : "Copiar puertos"}
                    </ContextMenuItem>
                  )}
                  {p.ports.length > 0 && (
                    <ContextMenuItem
                      onClick={() =>
                        onCopy(
                          `http://localhost:${p.ports[0]}`,
                          `http://localhost:${p.ports[0]}`,
                        )
                      }
                    >
                      <CopyIcon />
                      Copiar http://localhost:{p.ports[0]}
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </AnimatePresence>
      </tbody>
    </table>
  );
}
