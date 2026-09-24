import { describe, expect, it } from "vitest";
import { claveProteccion, entradasQueLoProtegen } from "./protect";
import { proceso } from "../test/tauri-mock";

describe("con qué nombre se protege una fila", () => {
  it("por la carpeta, si se pudo leer", () => {
    expect(claveProteccion(proceso({ pid: 1, script: "vite", project: "mi-web" }))).toBe(
      "mi-web",
    );
  });

  it("si no, por el script, y si no, por el ejecutable sin .exe", () => {
    expect(claveProteccion(proceso({ pid: 1, script: "vite" }))).toBe("vite");
    expect(claveProteccion(proceso({ pid: 1, name: "Node.EXE" }))).toBe("node");
  });
});

describe("qué entradas quitar al desproteger", () => {
  /**
   * Se quitan **todas** las que lo protegen: si quedara la del script después de quitar la de la
   * carpeta, el candado seguiría puesto y el menú parecería no haber hecho nada.
   */
  it("todas las que lo cubren, y ninguna de otro proceso", () => {
    const p = proceso({ pid: 1, name: "node.exe", script: "vite", project: "mi-web" });
    expect(entradasQueLoProtegen(p, ["Mi-Web", "vite", "api", "node.exe"])).toEqual([
      "Mi-Web",
      "vite",
      "node.exe",
    ]);
  });
});
