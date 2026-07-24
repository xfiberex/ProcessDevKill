import { useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import { THEMES } from "../types";
import type { Settings, Theme } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SettingsViewProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
};

const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function SettingsView({ settings, onChange }: SettingsViewProps) {
  const [draft, setDraft] = useState("");

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
          Node, Python y .NET se vigilan siempre. Aqui puedes añadir otros
          ejecutables, como <code className="text-foreground">docker</code>,{" "}
          <code className="text-foreground">go</code> o{" "}
          <code className="text-foreground">php</code>. Se compara el nombre
          exacto, sin la extension.
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
                sin pedir confirmacion
              </strong>
              . Queda registrado en el historial.
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
