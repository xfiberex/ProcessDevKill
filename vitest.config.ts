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
  },
});
