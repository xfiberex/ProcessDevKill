import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUTO_KILL_MIN_MB, PROCESSES_UPDATED, ZOMBIE_MIN_MINUTES } from "./types";

const raiz = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src-tauri",
  "src",
);
const leerRust = (archivo: string) =>
  readFileSync(path.join(raiz, archivo), "utf8");

/**
 * types.ts se declara "espejo" de los tipos de Rust, pero nada obliga a que lo
 * siga siendo: cambiar una constante en storage.rs y olvidarse de aqui no rompe
 * ni el build ni `cargo test`. Estas pruebas leen el fuente de Rust y comparan.
 *
 * Son las unicas del frontend que tocan disco; si algun dia se mueve el modulo,
 * fallan pidiendo que se actualice la ruta, que es exactamente lo que se quiere.
 */
describe("el contrato con Rust", () => {
  it("mantiene el suelo del Auto-Kill que impone storage.rs", () => {
    const rust = leerRust("storage.rs");
    const m = rust.match(/pub const MIN_AUTO_KILL_MB:\s*u64\s*=\s*(\d+)/);
    expect(m, "no se encontro MIN_AUTO_KILL_MB en storage.rs").not.toBeNull();
    expect(AUTO_KILL_MIN_MB).toBe(Number(m![1]));
  });

  it("mantiene el minimo de minutos del Zombie Finder", () => {
    const rust = leerRust("storage.rs");
    const m = rust.match(/pub const MIN_ZOMBIE_MINUTES:\s*u64\s*=\s*(\d+)/);
    expect(m, "no se encontro MIN_ZOMBIE_MINUTES en storage.rs").not.toBeNull();
    expect(ZOMBIE_MIN_MINUTES).toBe(Number(m![1]));
  });

  it("escucha el mismo evento que emite lib.rs", () => {
    const rust = leerRust("lib.rs");
    const m = rust.match(/const PROCESSES_UPDATED:\s*&str\s*=\s*"([^"]+)"/);
    expect(m, "no se encontro PROCESSES_UPDATED en lib.rs").not.toBeNull();
    expect(PROCESSES_UPDATED).toBe(m![1]);
  });

  it("cubre los cuatro origenes de KillSource", () => {
    const rust = leerRust("storage.rs");
    // El enum va con rename_all = "lowercase": los nombres de las variantes en
    // minusculas son los que viajan en el JSON.
    const bloque = rust.match(/pub enum KillSource\s*\{([^}]+)\}/);
    expect(bloque, "no se encontro el enum KillSource").not.toBeNull();
    const variantes = [...bloque![1].matchAll(/^\s*([A-Z]\w+)/gm)].map((v) =>
      v[1].toLowerCase(),
    );
    expect(variantes.sort()).toEqual(["auto", "hotkey", "tray", "window"]);
  });
});
