import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { contraste, leerPng } from "./auditoria-ui.mjs";

/**
 * Lo que el guion de la auditoría calcula por su cuenta (T14-01).
 *
 * El guion entero solo se puede probar lanzándolo. Pero dos piezas suyas deciden si una tarea del
 * Tier 14 está hecha —«encendido frente a apagado llega a 3:1»—, y esas sí se prueban aquí: leer
 * el color de un píxel de una captura y calcular el contraste entre dos.
 */

/** Un PNG de verdad, de 8 bits, con el filtro que se pida en cada fila. */
function png(ancho, alto, canales, pixel, filtro = 0) {
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    // El CRC no se comprueba al leer: cuatro ceros bastan.
    return Buffer.concat([largo, Buffer.from(tipo, "latin1"), datos, Buffer.alloc(4)]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8;
  cabecera[9] = canales === 4 ? 6 : 2;

  const fila = ancho * canales;
  const crudo = Buffer.alloc((fila + 1) * alto);
  const real = Buffer.alloc(fila * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const color = pixel(x, y);
      for (let c = 0; c < canales; c++) real[y * fila + x * canales + c] = color[c] ?? 255;
    }
  }
  for (let y = 0; y < alto; y++) {
    crudo[y * (fila + 1)] = filtro;
    for (let i = 0; i < fila; i++) {
      const izq = i >= canales ? real[y * fila + i - canales] : 0;
      const arr = y > 0 ? real[(y - 1) * fila + i] : 0;
      const diag = y > 0 && i >= canales ? real[(y - 1) * fila + i - canales] : 0;
      let pred = 0;
      if (filtro === 1) pred = izq;
      if (filtro === 2) pred = arr;
      if (filtro === 3) pred = (izq + arr) >> 1;
      if (filtro === 4) {
        const p = izq + arr - diag;
        const [pa, pb, pc] = [Math.abs(p - izq), Math.abs(p - arr), Math.abs(p - diag)];
        pred = pa <= pb && pa <= pc ? izq : pb <= pc ? arr : diag;
      }
      crudo[y * (fila + 1) + 1 + i] = (real[y * fila + i] - pred) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", cabecera),
    trozo("IDAT", zlib.deflateSync(crudo)),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

describe("leerPng", () => {
  const colores = (x, y) => [(x * 40) % 256, (y * 70) % 256, (x * y * 13) % 256];

  it("devuelve el color de cada píxel, con cualquiera de los cinco filtros", () => {
    for (const filtro of [0, 1, 2, 3, 4]) {
      for (const canales of [3, 4]) {
        const imagen = leerPng(png(7, 5, canales, colores, filtro));
        expect([imagen.ancho, imagen.alto]).toEqual([7, 5]);
        for (const [x, y] of [[0, 0], [6, 0], [3, 2], [0, 4], [6, 4]]) {
          expect(imagen.en(x, y), `filtro ${filtro}, ${canales} canales, (${x}, ${y})`).toEqual(colores(x, y));
        }
      }
    }
  });

  it("redondea la coordenada, y fuera de la imagen no inventa un color", () => {
    const imagen = leerPng(png(4, 4, 3, colores));

    expect(imagen.en(1.4, 2.6)).toEqual(colores(1, 3));
    expect(imagen.en(-1, 0)).toBeNull();
    expect(imagen.en(4, 0)).toBeNull();
    expect(imagen.en(0, 4)).toBeNull();
  });

  it("se niega con algo que no es un PNG", () => {
    expect(() => leerPng(Buffer.from("esto no es una imagen, de verdad"))).toThrow(/no es un PNG/);
  });
});

describe("contraste", () => {
  it("da los valores de referencia de WCAG", () => {
    expect(contraste([0, 0, 0], [255, 255, 255])).toBe(21);
    expect(contraste([255, 255, 255], [0, 0, 0])).toBe(21);
    // El gris #767676 sobre blanco es el ejemplo de manual del 4,5:1.
    expect(contraste([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  /** El caso del Tier 14: pulgar, pista y fondo del mismo color no se distinguen. */
  it("dos colores iguales dan 1, que es no verse", () => {
    expect(contraste([0, 0, 0], [0, 0, 0])).toBe(1);
    expect(contraste([18, 52, 86], [18, 52, 86])).toBe(1);
  });

  it("sin uno de los dos colores no da ninguna cifra", () => {
    expect(contraste(null, [0, 0, 0])).toBeNull();
    expect(contraste([0, 0, 0], undefined)).toBeNull();
  });
});
