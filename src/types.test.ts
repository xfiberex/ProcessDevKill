import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUTO_KILL_MIN_MB,
  PROCESSES_UPDATED,
  SYSTEM_USAGE,
  ZOMBIE_MIN_MINUTES,
} from "./types";
import type {
  Language,
  ServiceFamily,
  ServiceInfo,
  ServiceState,
  StartType,
  SystemUsage,
} from "./types";

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

  it("escucha el mismo evento del medidor que emite lib.rs", () => {
    const rust = leerRust("lib.rs");
    const m = rust.match(/const SYSTEM_USAGE:\s*&str\s*=\s*"([^"]+)"/);
    expect(m, "no se encontro SYSTEM_USAGE en lib.rs").not.toBeNull();
    expect(SYSTEM_USAGE).toBe(m![1]);
  });

  /**
   * El medidor no tiene ningun comando detras: si Rust renombra un campo, aqui
   * llega `undefined` y la barra se pinta a cero **sin romper nada**. Un campo de
   * menos en el struct pasaria igual de callado. Por eso se comparan los nombres.
   */
  it("mantiene los campos de SystemUsage que serializa processes.rs", () => {
    const rust = leerRust("processes.rs");
    const bloque = rust.match(/pub struct SystemUsage\s*\{([^}]+)\}/);
    expect(bloque, "no se encontro el struct SystemUsage").not.toBeNull();

    // El struct va con rename_all = "camelCase": lo que viaja en el JSON son los
    // nombres convertidos, que es lo que declara types.ts.
    const campos = [...bloque![1].matchAll(/^\s*pub (\w+):/gm)].map((m) =>
      m[1].replace(/_(\w)/g, (_, letra: string) => letra.toUpperCase()),
    );

    // TypeScript obliga a que esta muestra este completa; el test compara que sea
    // la misma lista que la de Rust.
    const muestra: SystemUsage = {
      cpu: 0,
      devCpu: 0,
      usedMemoryMb: 0,
      totalMemoryMb: 0,
      devMemoryMb: 0,
    };

    expect(campos.sort()).toEqual(Object.keys(muestra).sort());
  });

  /**
   * El idioma es el unico ajuste que **los dos lados** interpretan: la ventana elige su catalogo
   * con el, y Rust elige el suyo para el menu de la bandeja y las notificaciones. Si Rust ganara
   * una variante y aqui no, el JSON traeria un valor que el frontend no sabe leer y la ventana
   * caeria al español sin decir nada.
   */
  it("cubre los mismos idiomas que el enum Language de storage.rs", () => {
    const rust = leerRust("storage.rs");
    const bloque = rust.match(/pub enum Language\s*\{([^}]+)\}/);
    expect(bloque, "no se encontro el enum Language").not.toBeNull();
    const variantes = [...bloque![1].matchAll(/^\s*([A-Z]\w+)/gm)].map((v) =>
      v[1].toLowerCase(),
    );

    // TypeScript obliga a que esta lista este completa; el test compara que sea la de Rust.
    const delFrontend: Language[] = ["es", "en"];
    expect(variantes.sort()).toEqual([...delFrontend].sort());
  });

  /**
   * Los tres enums del panel de servicios. Aqui el riesgo es el mismo que con `SystemUsage`: no hay
   * nada que falle si Rust gana una variante y el frontend no la conoce — llegaria una cadena que
   * ningun `Record` tiene, y la celda se pintaria vacia sin decir nada.
   *
   * Los enums van con `rename_all = "camelCase"`, asi que lo que viaja en el JSON son los nombres
   * convertidos: `SqlServer` sale como `sqlServer`.
   */
  it("cubre las mismas familias, estados y arranques que services.rs", () => {
    const rust = leerRust("services.rs");

    const variantes = (nombre: string) => {
      const bloque = rust.match(new RegExp(`pub enum ${nombre}\\s*\\{([^}]+)\\}`));
      expect(bloque, `no se encontro el enum ${nombre}`).not.toBeNull();
      return [...bloque![1].matchAll(/^\s*([A-Z]\w+),/gm)]
        .map((v) => v[1].charAt(0).toLowerCase() + v[1].slice(1))
        .sort();
    };

    // TypeScript obliga a que estas listas esten completas; el test compara que sean las de Rust.
    const familias: ServiceFamily[] = [
      "sqlServer",
      "postgres",
      "mySql",
      "mongoDb",
      "redis",
      "docker",
      "iis",
      "other",
    ];
    const estados: ServiceState[] = ["running", "stopped", "pending"];
    const arranques: StartType[] = [
      "boot",
      "system",
      "automatic",
      "automaticDelayed",
      "manual",
      "disabled",
      "unknown",
    ];

    expect(variantes("ServiceFamily")).toEqual([...familias].sort());
    expect(variantes("ServiceState")).toEqual([...estados].sort());
    expect(variantes("StartType")).toEqual([...arranques].sort());
  });

  /**
   * `memoryMb` es `Option<f64>` en Rust y tiene que ser anulable aqui. Si se declarara `number`,
   * TypeScript dejaria escribir `mb.toFixed(0)` sobre un `null` y la vista reventaria en el primer
   * servicio del sistema — que son casi todos.
   */
  it("mantiene anulable la RAM del servicio, como el Option de Rust", () => {
    const rust = leerRust("services.rs");
    expect(rust).toMatch(/pub memory_mb:\s*Option<f64>/);

    const muestra: ServiceInfo["memoryMb"] = null;
    expect(muestra).toBeNull();
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
