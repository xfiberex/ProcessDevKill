import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sonner = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: sonner }));

import { toast } from "./avisos";

/** T14-15: qué avisos se van solos y cuáles esperan a que se cierren. */
describe("la duración de los avisos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un error y una advertencia se quedan, con su botón de cerrar", () => {
    toast.error("No se pudieron guardar los ajustes", { description: "C:\\ruta" });
    toast.warning("2 de 3 no se pudieron cerrar");

    expect(sonner.error).toHaveBeenCalledWith("No se pudieron guardar los ajustes", {
      duration: Infinity,
      closeButton: true,
      description: "C:\\ruta",
    });
    expect(sonner.warning).toHaveBeenCalledWith("2 de 3 no se pudieron cerrar", {
      duration: Infinity,
      closeButton: true,
    });
  });

  it("los de éxito y los informativos se van solos", () => {
    toast.success("bun.exe cerrado");
    toast.info("MySQL80 está cambiando de estado");

    expect(sonner.success).toHaveBeenCalledWith("bun.exe cerrado", undefined);
    expect(sonner.info).toHaveBeenCalledWith("MySQL80 está cambiando de estado", undefined);
  });

  it("quien llama puede poner su duración", () => {
    toast.error("x", { duration: 8000 });

    expect(sonner.error).toHaveBeenCalledWith("x", { duration: 8000, closeButton: true });
  });

  /**
   * El reparto solo vale si nadie llama a `sonner` por su cuenta: un `toast.error` importado de
   * la librería volvería a irse a los cuatro segundos sin que nada lo dijera.
   */
  it("nadie importa `toast` de sonner salvo este módulo y el `Toaster`", () => {
    const SRC = path.resolve(__dirname, "..");
    const PERMITIDOS = [path.join("lib", "avisos.ts"), path.join("components", "ui", "sonner.tsx")];

    function fuentes(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) return fuentes(ruta);
        return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [ruta] : [];
      });
    }

    const infractores = fuentes(SRC)
      .filter((f) => !PERMITIDOS.includes(path.relative(SRC, f)))
      .filter((f) => /from\s+["']sonner["']/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f));

    expect(infractores).toEqual([]);
  });
});
