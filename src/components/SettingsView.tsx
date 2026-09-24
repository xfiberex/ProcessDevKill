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
  HeartIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  ScaleIcon,
  ScrollTextIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import type { useUpdater } from "../hooks/useUpdater";
import { AUTO_KILL_MIN_MB, HOTKEYS, THEMES, ZOMBIE_MIN_MINUTES } from "../types";
import type { Language, Settings, Theme } from "../types";
import { Marcado, useT } from "../i18n";
import { formatMemory } from "../lib/format";
import { Actualizaciones } from "./Actualizaciones";
import { Segmented } from "./Segmented";
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

/** Los idiomas en el orden en que se ofrecen. El espanol primero: es el original. */
const IDIOMAS: Language[] = ["es", "en"];

export function SettingsView({
  settings,
  onChange,
  updater,
}: SettingsViewProps) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [servicioDraft, setServicioDraft] = useState("");
  const [protegidoDraft, setProtegidoDraft] = useState("");
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
      toast.error(t.avisos.carpetaNoAbierta, { description: String(e) });
    }
  }

  async function copiarRutaDelLog() {
    try {
      await writeText(logPath);
      toast.success(t.avisos.rutaCopiada);
    } catch (e) {
      toast.error(t.avisos.rutaNoCopiada, { description: String(e) });
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
      toast.error(t.avisos.recursoNoAbierto(nombre), {
        description: String(e),
      });
    }
  }

  async function abrirRepositorio() {
    try {
      await openUrl("https://github.com/xfiberex/ProcessDevKill");
    } catch (e) {
      toast.error(t.avisos.navegadorNoAbierto, { description: String(e) });
    }
  }

  /**
   * El mismo destino que el boton de patrocinio de GitHub, que sale de
   * `.github/FUNDING.yml`. **Son dos sitios y no hay nada que los ate**: aquel solo
   * pinta el boton en la pagina del repositorio, y quien instala la app no pasa por
   * ahi. Si cambia el enlace, hay que cambiarlo en los dos.
   */
  async function abrirApoyo() {
    try {
      await openUrl("https://www.paypal.me/RJimenez1820");
    } catch (e) {
      toast.error(t.avisos.navegadorNoAbierto, { description: String(e) });
    }
  }

  // Mismo criterio que el umbral de arriba, y por el mismo motivo.
  const [minutosDraft, setMinutosDraft] = useState(
    String(settings.zombieMinutes),
  );
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
    if (
      settings.customNames.some((n) => n.toLowerCase() === name.toLowerCase())
    ) {
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

  /**
   * Los servicios vigilados, en su propia lista.
   *
   * Aparte de `customNames` y no en la misma: aquello son ejecutables y esto son nombres del SCM.
   * Mezclarlas haría que añadir `docker` para ver el proceso arrastrase también el servicio.
   */
  function addServicio() {
    const nombre = servicioDraft.trim();
    if (!nombre) return;
    if (
      settings.customServices.some(
        (n) => n.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      setServicioDraft("");
      return;
    }
    onChange({
      ...settings,
      customServices: [...settings.customServices, nombre],
    });
    setServicioDraft("");
  }

  function removeServicio(nombre: string) {
    onChange({
      ...settings,
      customServices: settings.customServices.filter((n) => n !== nombre),
    });
  }

  /** Mismo criterio que los vigilados: Rust normaliza, aquí solo se evita el duplicado evidente. */
  function addProtegido() {
    const nombre = protegidoDraft.trim();
    if (!nombre) return;
    if (
      settings.protected.some((n) => n.toLowerCase() === nombre.toLowerCase())
    ) {
      setProtegidoDraft("");
      return;
    }
    onChange({ ...settings, protected: [...settings.protected, nombre] });
    setProtegidoDraft("");
  }

  function removeProtegido(nombre: string) {
    onChange({
      ...settings,
      protected: settings.protected.filter((n) => n !== nombre),
    });
  }

  return (
    <div className="max-w-2xl space-y-8 px-5 py-6">
      {/* El idioma va **el primero de todos**: quien abra la app y no entienda la mitad tiene que
          tropezarse con el selector sin buscarlo, y por eso el titulo va en los dos idiomas a la
          vez. Cambiarlo retraduce tambien el menu de la bandeja y las notificaciones, que las
          escribe Rust: ver `textos.rs`. */}
      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.idioma.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.idioma.descripcion}
        </p>

        <div className="mt-3">
          <Segmented
            label={t.idioma.titulo}
            value={settings.language}
            onChange={(language) => onChange({ ...settings, language })}
            options={IDIOMAS.map((value) => ({
              value,
              label: (
                <>
                  <LanguagesIcon aria-hidden />
                  {t.idioma.nombres[value]}
                </>
              ),
            }))}
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.apariencia.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado texto={t.ajustes.apariencia.descripcion} />
        </p>

        <div className="mt-3">
          <Segmented
            label={t.ajustes.apariencia.titulo}
            value={settings.theme}
            onChange={(theme) => onChange({ ...settings, theme })}
            options={THEMES.map((value) => {
              const Icon = THEME_ICONS[value];
              return {
                value,
                label: (
                  <>
                    <Icon aria-hidden />
                    {t.temas[value]}
                  </>
                ),
              };
            })}
          />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.vigilados.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado texto={t.ajustes.vigilados.descripcion} />
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addName();
            }}
            placeholder={t.ajustes.vigilados.placeholder}
          />
          <Button
            variant="outline"
            onClick={addName}
            aria-label={t.ajustes.vigilados.anadirLabel}
          >
            {t.ajustes.vigilados.anadir}
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
                  aria-label={t.ajustes.vigilados.quitar(name)}
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
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.servicios.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado texto={t.ajustes.servicios.descripcion} />
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            value={servicioDraft}
            onChange={(e) => setServicioDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addServicio();
            }}
            placeholder={t.ajustes.servicios.placeholder}
          />
          <Button
            variant="outline"
            onClick={addServicio}
            aria-label={t.ajustes.servicios.anadirLabel}
          >
            {t.ajustes.servicios.anadir}
          </Button>
        </div>

        {settings.customServices.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {settings.customServices.map((nombre) => (
              <li
                key={nombre}
                className="flex items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2.5 text-sm"
              >
                <span className="font-mono text-xs">{nombre}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t.ajustes.servicios.quitar(nombre)}
                  onClick={() => removeServicio(nombre)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.protegidos.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado texto={t.ajustes.protegidos.descripcion} />
        </p>

        <div className="mt-3 flex gap-2">
          <Input
            value={protegidoDraft}
            onChange={(e) => setProtegidoDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addProtegido();
            }}
            placeholder={t.ajustes.protegidos.placeholder}
            aria-label={t.ajustes.protegidos.titulo}
          />
          <Button
            variant="outline"
            onClick={addProtegido}
            aria-label={t.ajustes.protegidos.anadirLabel}
          >
            {t.ajustes.protegidos.anadir}
          </Button>
        </div>

        {settings.protected.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {settings.protected.map((nombre) => (
              <li
                key={nombre}
                className="flex items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2.5 text-sm"
              >
                <span className="font-mono text-xs">{nombre}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t.ajustes.protegidos.quitar(nombre)}
                  onClick={() => removeProtegido(nombre)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.autoKill.titulo}
        </h2>
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
            <span>{t.ajustes.autoKill.interruptor}</span>
            <span className="mt-1 block text-muted-foreground">
              <Marcado texto={t.ajustes.autoKill.detalle} />
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
            aria-label={t.ajustes.autoKill.campoLabel}
            aria-describedby="auto-kill-equivalencia"
            className="w-28 tabular-nums"
          />
          <span
            id="auto-kill-equivalencia"
            className="text-sm text-muted-foreground"
          >
            {t.ajustes.autoKill.unidad(equivalencia, AUTO_KILL_MIN_MB)}
          </span>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.zombie.titulo}
        </h2>
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
            <span>{t.ajustes.zombie.interruptor}</span>
            <span className="mt-1 block text-muted-foreground">
              <Marcado texto={t.ajustes.zombie.detalle} />
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
            aria-label={t.ajustes.zombie.campoLabel}
            aria-describedby="zombie-explicacion"
            className="w-28 tabular-nums"
          />
          <span
            id="zombie-explicacion"
            className="text-sm text-muted-foreground"
          >
            {t.ajustes.zombie.unidad(ZOMBIE_MIN_MINUTES)}
          </span>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.actualizaciones.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado texto={t.ajustes.actualizaciones.descripcion} />
        </p>
        <Actualizaciones updater={updater} />
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.acercaDe.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <Marcado
            texto={t.ajustes.acercaDe.descripcion(version ? ` ${version}` : "")}
          />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => abrirRecurso("LICENSE.txt")}>
            <ScaleIcon />
            {t.ajustes.acercaDe.licencia}
          </Button>
          <Button
            variant="outline"
            onClick={() => abrirRecurso("THIRD-PARTY-NOTICES.txt")}
          >
            <FileTextIcon />
            {t.ajustes.acercaDe.avisos}
          </Button>
          <Button variant="ghost" onClick={abrirRepositorio}>
            <ExternalLinkIcon />
            {t.ajustes.acercaDe.repositorio}
          </Button>
          {/* El ultimo de la fila y en `ghost`: es una invitacion, no una de las cosas
              que uno viene a hacer a Ajustes. */}
          <Button variant="ghost" onClick={abrirApoyo}>
            <HeartIcon />
            {t.ajustes.acercaDe.apoyar}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.ajustes.acercaDe.apoyarDetalle}
        </p>

        {logPath && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              <strong className="font-medium">
                {t.ajustes.acercaDe.logTitulo}
              </strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <Marcado texto={t.ajustes.acercaDe.logDescripcion} />
            </p>
            <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
              {logPath}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={abrirCarpetaDelLog}>
                <ScrollTextIcon />
                {t.ajustes.acercaDe.abrirCarpeta}
              </Button>
              <Button variant="ghost" onClick={copiarRutaDelLog}>
                {t.ajustes.acercaDe.copiarRuta}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.alCerrar.titulo}
        </h2>
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
            <span>{t.ajustes.alCerrar.interruptor}</span>
            <span className="mt-1 block text-muted-foreground">
              <Marcado texto={t.ajustes.alCerrar.detalle} />
            </span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-sm font-semibold">
          {t.ajustes.atajo.titulo}
        </h2>
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
              {t.ajustes.atajo.activar}{" "}
              {/* El `<kbd>` es estructura, no texto: se queda aqui y el catalogo solo pone
                  la palabra que lo precede. */}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {HOTKEYS.find((h) => h.value === settings.hotkey)?.label ??
                  HOTKEYS[0].label}
              </kbd>
            </span>
            <span className="mt-1 block text-muted-foreground">
              <Marcado texto={t.ajustes.atajo.detalle} />
            </span>
          </label>
        </div>

        {/* La combinacion y la doble pulsacion se pueden tocar con el atajo apagado, igual que el
            umbral del Auto-Kill: asi se deja preparado antes de encenderlo. */}
        <div className="mt-3 pl-11">
          <Segmented
            label={t.ajustes.atajo.combinacion}
            value={settings.hotkey}
            onChange={(hotkey) => onChange({ ...settings, hotkey })}
            options={HOTKEYS}
            itemClassName="font-mono text-xs"
          />
        </div>

        <div className="mt-3 flex items-start gap-3 pl-11">
          <Switch
            id="hotkey-doble"
            checked={settings.hotkeyDoublePress}
            onCheckedChange={(checked) =>
              onChange({ ...settings, hotkeyDoublePress: checked })
            }
            className="mt-0.5"
          />
          <label htmlFor="hotkey-doble" className="cursor-pointer text-sm">
            <span>{t.ajustes.atajo.doble}</span>
            <span className="mt-1 block text-muted-foreground">
              <Marcado texto={t.ajustes.atajo.dobleDetalle} />
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
