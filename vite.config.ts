import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Sin `@ts-expect-error`: lo llevaba de la plantilla de create-tauri-app, pero `process` ya está
// tipado aquí y la directiva sobraba. Con `tsc -b` eso deja de ser inocuo — una directiva sin uso
// es error TS2578 — y ahora este archivo sí lo comprueba un tsconfig.
const host = process.env.TAURI_DEV_HOST;

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src");

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // shadcn/ui genera sus componentes importando desde "@/…"; el alias debe estar
  // en los dos sitios: aqui para el bundle y en tsconfig.json para el chequeo de
  // tipos. Si falta en uno de los dos, falla justo el otro.
  resolve: {
    alias: { "@": src },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
