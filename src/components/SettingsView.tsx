import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { resolveResource } from "@tauri-apps/api/path";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  ExternalLinkIcon,
  FileTextIcon,
  MonitorIcon,
  MoonIcon,
  ScaleIcon,
  ScrollTextIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import type { useUpdater } from "../hooks/useUpdater";
import { AUTO_KILL_MIN_MB, THEMES, ZOMBIE_MIN_MINUTES } from "../types";
import type { Settings, Theme } from "../types";
import { formatMemory } from "../lib/format";
import { Actualizaciones } from "./Actualizaciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SettingsViewProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
  /** Solo se reenvia a `Actualizaciones`; el estado lo pone App (ver ese archivo). */
  updater: ReturnType<typeof useUpdater>;
};

const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function SettingsView({ settings, onChange, updater }: SettingsViewProps) {
  const [draft, setDraft] = useState("");
  const [mbDraft, setMbDraft] = useState(String(settings.autoKillMb));

  // Los ajustes tambien llegan de Rust (carga inicial, o el valor ya corregido si
  // se escribio uno por debajo del minimo): el campo tiene que seguirlos.
  //
  // Se sincroniza **durante el render** comparando con el valor anterior, no con un `useEffect`.
  // Se guarda el valor de antes en vez de comparar contra `mbDraft` porque son cosas distintas:
  // `mbDraft` es lo que hay escrito en el campo, y mientras se teclea difiere del ajuste sin que
  // eso signifique que Rust haya mandado nada. Compararlos pisaria lo tecleado en cada pulsacion.
  const [mbPrevio, setMbPrevio] = useState(settings.autoKillMb);
  if (settings.autoKillMb !== mbPrevio) {
    setMbPrevio(settings.autoKillMb);
    setMbDraft(String(settings.autoKillMb));
  }

  /** Guarda el umbral al salir del campo, con el mismo suelo que aplica Rust. */
  function commitMb() {
    const escrito = Number.parseInt(mbDraft, 10);
    if (!Number.isFinite(escrito)) {
      setMbDraft(String(settings.autoKillMb));
      return;
    }

    const limpio = Math.max(AUTO_KILL_MIN_MB, escrito);
    setMbDraft(String(limpio));
    if (limpio !== settings.autoKillMb) {
      onChange({ ...settings, autoKillMb: limpio });
    }
  }

  const equivalencia =
    settings.autoKillMb >= 1024 ? formatMemory(settings.autoKillMb) : null;

  // La version la da Tauri, que la lee de tauri.conf.json: asi no hay una segunda
  // copia del numero en el frontend que se quede vieja al cortar un release.
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    getVersion()
      .then((v) => setVersion(`v${v}`))
      .catch(() => {});
  }, []);

  // Ruta del log de avisos. La da Rust, que es quien sabe donde cayo `app_data_dir()`; tenerla
  // aqui a mano evita que el usuario tenga que buscarla para poder mandarla en un issue.
  const [logPath, setLogPath] = useState("");
  useEffect(() => {
    invoke<string>("log_path")
      .then(setLogPath)
      .catch(() => {});
  }, []);

  /**
   * Abre la carpeta del log, **pidiendoselo a Rust**.
   *
   * No se usa `openPath` aqui, y no es un capricho: el permiso `opener:allow-open-path` esta
   * acotado a los dos avisos legales (`capabilities/default.json`), asi que desde la ventana este
   * boton fallaria — y arreglarlo por ahi obligaria a ensanchar el permiso a `$APPDATA` entero.
   * Con el comando, la ruta la calcula Rust y la ventana no gana ningun permiso nuevo.
   *
   * Se abre la carpeta y no el archivo porque un `.log` no tiene asociacion en Windows y sacaria
   * el dialogo de "como quieres abrir esto" — el mismo motivo por el que la licencia se empaqueta
   * como `.txt` unas lineas mas abajo. Desde la carpeta se ve ademas el `.1` de la rotacion.
   */
  async function abrirCarpetaDelLog() {
    try {
      await invoke("open_log_dir");
    } catch (e) {
      toast.error("No se pudo abrir la carpeta", { description: String(e) });
    }
  }

  async function copiarRutaDelLog() {
    try {
      await writeText(logPath);
      toast.success("Ruta copiada");
    } catch (e) {
      toast.error("No se pudo copiar la ruta", { description: String(e) });
    }
  }

  /**
   * Abre uno de los archivos legales que el instalador empaqueta.
   *
   * Van como `resources` del bundle, asi que viajan dentro del instalador y no
   * solo en el repositorio: la GPL exige que la licencia acompane al binario, y
   * la OFL-1.1 de la tipografia Geist, que su aviso viaje con la fuente.
   *
   * El de la licencia se empaqueta como `LICENSE.txt` aunque en el repositorio se
   * llame `LICENSE` (lo que espera GitHub): un archivo sin extension no tiene
   * asociacion en Windows y abrirlo saca el dialogo de "como quieres abrir esto".
   */
  async function abrirRecurso(nombre: string) {
    try {
      await openPath(await resolveResource(nombre));
    } catch (e) {
      toast.error(`No se pudo abrir ${nombre}`, { description: String(e) });
    }
  }

  async function abrirRepositorio() {
    try {
      await openUrl("https://github.com/xfiberex/ProcessDevKill");
    } catch (e) {
      toast.error("No se pudo abrir el navegador", { description: String(e) });
    }
  }

  // Mismo criterio que el umbral de arriba, y por el mismo motivo.
  const [minutosDraft, setMinutosDraft] = useState(String(settings.zombieMinutes));
  const [minutosPrevio, setMinutosPrevio] = useState(settings.zombieMinutes);
  if (settings.zombieMinutes !== minutosPrevio) {
    setMinutosPrevio(settings.zombieMinutes);
    setMinutosDraft(String(settings.zombieMinutes));
  }

  /** Mismo criterio que el umbral del Auto-Kill: se guarda al salir del campo. */
  function commitMinutos() {
    const escrito = Number.parseInt(minutosDraft, 10);
    if (!Number.isFinite(escrito)) {
      setMinutosDraft(String(settings.zombieMinutes));
      return;
    }

    const limpio = Math.max(ZOMBIE_MIN_MINUTES, escrito);
    setMinutosDraft(String(limpio));
    if (limpio !== settings.zombieMinutes) {
      onChange({ ...settings, zombieMinutes: limpio });
    }
  }

  function addName() {
    const name = draft.trim();
    if (!name) return;
    // La normalizacion real (minusculas, sin .exe, sin duplicados) la hace Rust,
    // que es quien compara contra los procesos; aqui solo se evita el duplicado
    // evidente para no dar la sensacion de que el boton no hizo nada.
    if (settings.customNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange({ ...settings, customNames: [...settings.customNames, name] });
    setDraft("");
  }

  function removeName(name: string) {
    onChange({
      ...settings,
      customNames: settings.customNames.filter((n) => n !== name),
    });
  }

  return (
    <div className="max-w-2xl space-y-8 px-5 py-6">
      <section>
        <h2 className="font-heading text-sm font-semibold">Apariencia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Con <strong className="font-medium text-foreground">Sistema</strong>, la
          app cambia sola cuando Windows pasa de claro a oscuro.
        </p>

        <div className="mt-3 flex gap-2">
          {THEMES.map(({ value, label }) => {
            const Icon = THEME_ICONS[value];
            return (
              <Button
                key={value}
                variant={settings.theme === value ? "secondary" : "outline"}
                aria-pressed={settings.theme === value}
                onClick={() => onChange({ ...settings, theme: value })}
              >
                <Icon />
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Procesos vigilados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Node, Python y .NET se vigilan siempre. Aquí puedes añadir otros
          ejecutables, como <code className="text-foreground">docker</code>,{" "}
          <code className="text-foreground">go</code> o{" "}
          <code className="text-foreground">php</code>. Se compara el nombre
          exacto, sin la extensión.
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addName();
            }}
            placeholder="nombre del ejecutable"
          />
          <Button variant="outline" onClick={addName}>
            Añadir
          </Button>
        </div>

        {settings.customNames.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {settings.customNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2.5 text-sm"
              >
                <span className="font-mono text-xs">{name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Quitar ${name}`}
                  onClick={() => removeName(name)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Auto-Kill por memoria</h2>
        <div className="mt-3 flex items-start gap-3">
          <Switch
            id="auto-kill"
            checked={settings.autoKillEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...settings, autoKillEnabled: checked })
            }
            className="mt-0.5"
          />
          <label htmlFor="auto-kill" className="cursor-pointer text-sm">
            <span>Cerrar solos los procesos que se pasen de RAM</span>
            <span className="mt-1 block text-muted-foreground">
              Vigila los procesos de la lista y cierra{" "}
              <strong className="font-medium text-foreground">
                sin pedir confirmación
              </strong>{" "}
              el que supere el umbral. Pensado para fugas de memoria y watchers
              desbocados. Avisa por notificación y queda en el historial como{" "}
              <span className="font-medium text-foreground">Auto-Kill</span>.
            </span>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2 pl-11">
          <Input
            id="auto-kill-mb"
            type="number"
            inputMode="numeric"
            min={AUTO_KILL_MIN_MB}
            step={256}
            value={mbDraft}
            // El campo se deja editable aunque el Auto-Kill este apagado: si no,
            // habria que armarlo con el umbral por defecto para poder cambiarlo,
            // y ese rato con 2 GB puede llevarse por delante algo legitimo.
            onChange={(e) => setMbDraft(e.target.value)}
            // Se guarda al salir del campo, no en cada tecla: escribir "2048"
            // pasa por "2", y guardar eso con el Auto-Kill encendido bajaria el
            // umbral al minimo durante un instante, con el vigilante mirando.
            onBlur={commitMb}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            // El texto de al lado va en aria-describedby, que es descripcion y no
            // nombre: sin este aria-label el campo se anuncia sin decir que es.
            aria-label="Umbral de RAM en MB"
            aria-describedby="auto-kill-equivalencia"
            className="w-28 tabular-nums"
          />
          <span
            id="auto-kill-equivalencia"
            className="text-sm text-muted-foreground"
          >
            MB por proceso
            {equivalencia && ` (${equivalencia})`}. Mínimo{" "}
            {AUTO_KILL_MIN_MB} MB.
          </span>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Zombie Finder</h2>
        <div className="mt-3 flex items-start gap-3">
          <Switch
            id="zombie"
            checked={settings.zombieEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...settings, zombieEnabled: checked })
            }
            className="mt-0.5"
          />
          <label htmlFor="zombie" className="cursor-pointer text-sm">
            <span>Resaltar los procesos olvidados</span>
            <span className="mt-1 block text-muted-foreground">
              Marca en la tabla los que llevan un rato sin consumir CPU{" "}
              <strong className="font-medium text-foreground">
                y siguen ocupando un puerto
              </strong>
              : el servidor de la semana pasada que aún tiene cogido el 3000. No
              cierra nada, solo lo señala.
            </span>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2 pl-11">
          <Input
            id="zombie-minutos"
            type="number"
            inputMode="numeric"
            min={ZOMBIE_MIN_MINUTES}
            step={5}
            value={minutosDraft}
            onChange={(e) => setMinutosDraft(e.target.value)}
            onBlur={commitMinutos}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Minutos sin actividad"
            aria-describedby="zombie-explicacion"
            className="w-28 tabular-nums"
          />
          <span id="zombie-explicacion" className="text-sm text-muted-foreground">
            minutos parado. Mínimo {ZOMBIE_MIN_MINUTES}.
          </span>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Actualizaciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La app comprueba al arrancar si hay una versión nueva en GitHub. Es lo{" "}
          <strong className="font-medium text-foreground">único</strong> que
          consulta en la red, y solo descarga si lo confirmas.
        </p>
        <Actualizaciones updater={updater} />
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Acerca de</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ProcessDevKill{version && ` ${version}`} — software libre bajo{" "}
          <strong className="font-medium text-foreground">GPL-3.0</strong>. Los
          componentes de terceros que la app empaqueta, con sus licencias, están
          en los avisos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => abrirRecurso("LICENSE.txt")}>
            <ScaleIcon />
            Licencia
          </Button>
          <Button
            variant="outline"
            onClick={() => abrirRecurso("THIRD-PARTY-NOTICES.txt")}
          >
            <FileTextIcon />
            Avisos de terceros
          </Button>
          <Button variant="ghost" onClick={abrirRepositorio}>
            <ExternalLinkIcon />
            Repositorio
          </Button>
        </div>

        {logPath && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              <strong className="font-medium">Registro de avisos</strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando algo falla por dentro —guardar los ajustes, leer los puertos—, la app lo
              anota aquí. Es un archivo local:{" "}
              <strong className="font-medium text-foreground">
                no se envía a ninguna parte
              </strong>{" "}
              y puedes borrarlo cuando quieras. Si abres un issue, adjuntarlo ayuda.
            </p>
            <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
              {logPath}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={abrirCarpetaDelLog}>
                <ScrollTextIcon />
                Abrir la carpeta
              </Button>
              <Button variant="ghost" onClick={copiarRutaDelLog}>
                Copiar la ruta
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Al cerrar la ventana</h2>
        <div className="mt-3 flex items-start gap-3">
          <Switch
            id="close-to-tray"
            checked={settings.closeToTray}
            onCheckedChange={(checked) =>
              onChange({ ...settings, closeToTray: checked })
            }
            className="mt-0.5"
          />
          <label htmlFor="close-to-tray" className="cursor-pointer text-sm">
            <span>Dejarla en la bandeja en vez de cerrar la app</span>
            <span className="mt-1 block text-muted-foreground">
              Con esto activado, el botón{" "}
              <span className="font-medium text-foreground">✕</span> esconde la
              ventana y ProcessDevKill{" "}
              <strong className="font-medium text-foreground">
                sigue funcionando
              </strong>{" "}
              en segundo plano: el Auto-Kill y el atajo global siguen vigilando. Para
              recuperarla, pulsa su icono en la bandeja; para salir del todo,{" "}
              <span className="font-medium text-foreground">Salir</span> en el menú
              de ese icono.
            </span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">Atajo global</h2>
        <div className="mt-3 flex items-start gap-3">
          <Switch
            id="hotkey"
            checked={settings.hotkeyEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...settings, hotkeyEnabled: checked })
            }
            className="mt-0.5"
          />
          <label htmlFor="hotkey" className="cursor-pointer text-sm">
            <span>
              Activar{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                Ctrl+Alt+K
              </kbd>
            </span>
            <span className="mt-1 block text-muted-foreground">
              Cierra <strong className="font-medium text-foreground">todos</strong>{" "}
              los procesos vigilados al instante, funcione o no la ventana, y{" "}
              <strong className="font-medium text-foreground">
                sin pedir confirmación
              </strong>
              . Queda registrado en el historial.
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
