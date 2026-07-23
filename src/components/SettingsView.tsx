import { useState } from "react";
import type { Settings } from "../types";

type SettingsViewProps = {
  settings: Settings;
  onChange: (settings: Settings) => void;
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
        <h2 className="text-sm font-semibold">Procesos vigilados</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Node, Python y .NET se vigilan siempre. Aqui puedes añadir otros
          ejecutables, como <code className="text-neutral-400">docker</code>,{" "}
          <code className="text-neutral-400">go</code> o{" "}
          <code className="text-neutral-400">php</code>. Se compara el nombre
          exacto, sin la extension.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addName();
            }}
            placeholder="nombre del ejecutable"
            className="min-w-0 flex-1 rounded-md border border-border-subtle bg-black/20 px-3 py-1.5 text-sm placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            onClick={addName}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-neutral-200 transition hover:bg-white/5"
          >
            Añadir
          </button>
        </div>

        {settings.customNames.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {settings.customNames.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 rounded-md bg-white/10 py-1 pr-1 pl-2.5 text-sm"
              >
                <span className="font-mono text-xs">{name}</span>
                <button
                  onClick={() => removeName(name)}
                  aria-label={`Quitar ${name}`}
                  className="rounded px-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Atajo global</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={settings.hotkeyEnabled}
            onChange={(e) =>
              onChange({ ...settings, hotkeyEnabled: e.target.checked })
            }
            className="mt-0.5 size-3.5 accent-red-500"
          />
          <span className="text-sm">
            <span className="text-neutral-200">
              Activar <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">Ctrl+Alt+K</kbd>
            </span>
            <span className="mt-1 block text-neutral-500">
              Cierra <strong className="text-neutral-400">todos</strong> los
              procesos vigilados al instante, funcione o no la ventana, y{" "}
              <strong className="text-neutral-400">sin pedir confirmacion</strong>.
              Queda registrado en el historial.
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
