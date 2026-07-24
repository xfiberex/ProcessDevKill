import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Theme } from "./types";

/** Tema que se esta pintando de verdad: "system" ya resuelto a uno de los dos. */
export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Debe coincidir con la clave que lee el script de index.html. */
const CACHE_KEY = "processdevkill.theme";

const ResolvedThemeContext = createContext<ResolvedTheme>("dark");

/** El tema que se esta pintando ahora mismo. Lo necesita Sonner para sus toasts. */
export function useResolvedTheme(): ResolvedTheme {
  return useContext(ResolvedThemeContext);
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * Aplica la clase `dark` al <html>, que es lo que activa la variante `dark:` de
 * Tailwind y el bloque `.dark` de index.css.
 *
 * Con `theme: "system"` sigue al tema de Windows en vivo: WebView2 reevalua
 * `prefers-color-scheme` cuando cambia el del sistema, sin reiniciar la app.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(theme));

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    const apply = () => {
      const next = resolve(theme);
      document.documentElement.classList.toggle("dark", next === "dark");
      setResolved(next);

      // Copia para el script de index.html, que pinta antes de que Rust haya
      // contestado con los ajustes. No es la fuente de la verdad: si alguien
      // borra el localStorage, el proximo arranque simplemente sigue al sistema.
      try {
        localStorage.setItem(CACHE_KEY, next);
      } catch {
        // Sin cache: solo significa un posible parpadeo al arrancar.
      }
    };

    apply();
    // La suscripcion solo importa con "system", pero mantenerla siempre evita
    // un camino distinto por tema y no cuesta nada.
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return (
    <ResolvedThemeContext.Provider value={resolved}>
      {children}
    </ResolvedThemeContext.Provider>
  );
}
