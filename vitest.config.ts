import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src");

/**
 * Configuracion propia, separada de vite.config.ts a proposito.
 *
 * La de Vite trae lo de Tauri: puerto fijo 1420 con `strictPort`, el watcher que
 * ignora src-tauri y el plugin de Tailwind. Nada de eso sirve aqui y el puerto
 * fijo daria guerra si las pruebas corren con `tauri dev` abierto. El alias `@`
 * si hace falta: los componentes de shadcn importan desde "@/components/ui/…".
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": src } },
  test: {
    // Base UI y Testing Library necesitan DOM; los polyfills que jsdom no trae
    // (matchMedia, ResizeObserver) los pone src/test/setup.ts.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,

    /**
     * Lo que NO cuenta como codigo propio.
     *
     * Sin esto el porcentaje mide dos cosas que no son de nadie: `src/test/**` son los dobles de
     * Tauri —su codigo sin ejecutar son ramas de simulacion que ninguna prueba pidio— y
     * `src/components/ui/**` lo genera el CLI de shadcn (`context-menu.tsx` marcaba un 33 %).
     * Colandose en el denominador, la cifra infravalora la cobertura real y de paso invita a
     * escribir pruebas de codigo generado para subir un numero.
     */
    coverage: {
      exclude: [
        "src/test/**",
        "src/components/ui/**",
        "**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
});
