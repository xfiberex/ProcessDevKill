import { describe, expect, it } from "vitest";
import { componer, licenciaAdmitida, normalizar } from "./avisos-de-terceros.mjs";

/**
 * El generador de `THIRD-PARTY-NOTICES.txt` (T12-30).
 *
 * Lo que aquí se prueba es lo que decide: qué licencias deja pasar y qué escribe. Que el archivo
 * del repositorio esté al día lo comprueba `--comprobar`, en el corte y en la CI, porque necesita
 * `cargo metadata` y `node_modules`.
 */

describe("licenciaAdmitida", () => {
  it("admite las licencias sueltas que el proyecto ya había revisado", () => {
    for (const l of ["MIT", "Apache-2.0", "MPL-2.0", "Unicode-3.0", "OFL-1.1", "0BSD"]) {
      expect(licenciaAdmitida(l), l).toBe(true);
    }
  });

  /** El criterio negativo: es la única puerta entre una licencia nueva y el instalador. */
  it("se para ante una que no ha revisado nadie", () => {
    for (const l of ["GPL-2.0-only", "AGPL-3.0", "SSPL-1.0", "LGPL-2.1-or-later", "Propietaria", ""]) {
      expect(licenciaAdmitida(l), l).toBe(false);
    }
    expect(licenciaAdmitida(undefined)).toBe(false);
  });

  it("con OR basta una alternativa admitida", () => {
    expect(licenciaAdmitida("MIT OR Apache-2.0")).toBe(true);
    expect(licenciaAdmitida("MIT OR Apache-2.0 OR LGPL-2.1-or-later")).toBe(true);
    expect(licenciaAdmitida("GPL-2.0-only OR MIT")).toBe(true);
    expect(licenciaAdmitida("GPL-2.0-only OR AGPL-3.0")).toBe(false);
  });

  it("con AND hacen falta todas", () => {
    expect(licenciaAdmitida("Apache-2.0 AND ISC")).toBe(true);
    expect(licenciaAdmitida("MIT AND GPL-2.0-only")).toBe(false);
    expect(licenciaAdmitida("GPL-2.0-only AND MIT")).toBe(false);
  });

  it("lee los paréntesis, la barra de Cargo y la cláusula WITH", () => {
    expect(licenciaAdmitida("MIT/Apache-2.0")).toBe(true);
    expect(licenciaAdmitida("Apache-2.0 / MIT")).toBe(true);
    expect(licenciaAdmitida("(MIT OR Apache-2.0) AND Unicode-3.0")).toBe(true);
    expect(licenciaAdmitida("(MIT OR GPL-2.0-only) AND AGPL-3.0")).toBe(false);
    expect(licenciaAdmitida("Apache-2.0 WITH LLVM-exception")).toBe(true);
    expect(licenciaAdmitida("GPL-2.0-only WITH Classpath-exception-2.0")).toBe(false);
    // La expresión real más larga del árbol, la de `aws-lc-sys`.
    expect(
      licenciaAdmitida(
        "ISC AND (Apache-2.0 OR ISC) AND Apache-2.0 AND MIT AND BSD-3-Clause AND (Apache-2.0 OR ISC OR MIT) AND (Apache-2.0 OR ISC OR MIT-0)",
      ),
    ).toBe(true);
  });

  it("no da por buena una expresión mal escrita", () => {
    for (const l of ["MIT OR", "(MIT", "MIT Apache-2.0", "AND MIT", "MIT WITH"]) {
      expect(licenciaAdmitida(l), l).toBe(false);
    }
  });
});

describe("normalizar", () => {
  it("quita lo que cambia de un equipo a otro y no dice nada", () => {
    expect(normalizar(String.fromCharCode(0xfeff) + "\r\n\r\nCopyright (c) Alguien  \r\n\r\nTexto\t\r\n\r\n")).toBe(
      "Copyright (c) Alguien\n\nTexto",
    );
  });

  it("no toca el texto de la licencia", () => {
    const mit = "Copyright (c) 2020 Alguien\n\n  Permission is hereby granted…";
    expect(normalizar(mit)).toBe(mit);
  });
});

describe("el archivo que se compone", () => {
  const MIT_A = "MIT License\n\nCopyright (c) Ana";
  const MIT_B = "MIT License\n\nCopyright (c) Blas";
  const componente = (nombre, extra = {}) => ({
    nombre,
    version: "1.0.0",
    licencia: "MIT",
    autores: "",
    origen: `https://example.com/${nombre}`,
    avisos: [{ archivo: "LICENSE", texto: MIT_A }],
    ...extra,
  });

  const datos = () => ({
    npm: [componente("react"), componente("tailwindcss", { soloCss: true })],
    rust: [
      componente("serde", { directa: true, avisos: [{ archivo: "LICENSE-MIT", texto: MIT_B }] }),
      componente("sin-archivo", { avisos: [], autores: "Carla", licencia: "BSD-3-Clause" }),
      componente("cssparser", { licencia: "MPL-2.0" }),
    ],
    skills: "Los packs de skills.\n",
  });

  it("reproduce el aviso de copyright de cada componente", () => {
    const texto = componer(datos());

    expect(texto).toContain("Copyright (c) Ana");
    expect(texto).toContain("Copyright (c) Blas");
    expect(texto).toContain("Lo trae serde 1.0.0 (LICENSE-MIT)");
  });

  it("escribe una sola vez el texto que traen varios, y dice quiénes", () => {
    const texto = componer(datos());

    expect(texto.split(MIT_A)).toHaveLength(2);
    expect(texto).toContain("Lo traen 3 componentes: cssparser 1.0.0 (LICENSE); react 1.0.0 (LICENSE);");
  });

  it("dice cuáles no publican archivo, con lo que sí declaran", () => {
    const texto = componer(datos());

    expect(texto).toContain("1 componente declara su licencia y no publica ningún archivo");
    expect(texto).toMatch(/sin-archivo 1\.0\.0\n {8}Licencia: BSD-3-Clause\n {8}Autores: Carla/);
  });

  it("marca las dependencias directas y cuenta lo que hay", () => {
    const texto = componer(datos());

    expect(texto).toContain("2 componentes de npm y 3 crates de Rust");
    expect(texto).toMatch(/\* serde {2,}1\.0\.0/);
    expect(texto).toContain("Nota sobre la MPL-2.0 (cssparser)");
  });

  /** `--comprobar` compara byte a byte: con lo mismo tiene que salir lo mismo, sin fecha ni rutas. */
  it("con los mismos datos sale lo mismo", () => {
    const uno = componer(datos());

    expect(componer(datos())).toBe(uno);
    expect(uno).not.toMatch(/\d{4}-\d{2}-\d{2}T|[A-Z]:\\/);
    expect(uno.endsWith("\n")).toBe(true);
    expect(uno).not.toMatch(/[ \t]\n/);
  });
});
