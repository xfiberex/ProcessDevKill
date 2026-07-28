import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, sortProcesses } from "./sort";
import { proceso } from "../test/tauri-mock";

const pids = (lista: ReturnType<typeof sortProcesses>) => lista.map((p) => p.pid);

describe("orden por defecto", () => {
  it("es el mismo que manda Rust: RAM descendente", () => {
    const lista = [
      proceso({ pid: 1, memoryMb: 100 }),
      proceso({ pid: 2, memoryMb: 900 }),
      proceso({ pid: 3, memoryMb: 500 }),
    ];
    expect(pids(sortProcesses(lista, DEFAULT_SORT))).toEqual([2, 3, 1]);
  });

  it("no modifica la lista que recibe", () => {
    const lista = [proceso({ pid: 1, memoryMb: 100 }), proceso({ pid: 2, memoryMb: 900 })];
    sortProcesses(lista, DEFAULT_SORT);
    expect(pids(lista)).toEqual([1, 2]);
  });
});

describe("columnas", () => {
  it("ordena por nombre sin distinguir el orden de llegada", () => {
    const lista = [
      proceso({ pid: 1, name: "python.exe" }),
      proceso({ pid: 2, name: "dotnet.exe" }),
      proceso({ pid: 3, name: "node.exe" }),
    ];
    expect(pids(sortProcesses(lista, { key: "name", dir: "asc" }))).toEqual([2, 3, 1]);
    expect(pids(sortProcesses(lista, { key: "name", dir: "desc" }))).toEqual([1, 3, 2]);
  });

  it("ordena por CPU, por PID y por tiempo activo", () => {
    const lista = [
      proceso({ pid: 30, cpu: 1, runTimeSecs: 300 }),
      proceso({ pid: 10, cpu: 9, runTimeSecs: 100 }),
      proceso({ pid: 20, cpu: 5, runTimeSecs: 200 }),
    ];
    expect(pids(sortProcesses(lista, { key: "cpu", dir: "desc" }))).toEqual([10, 20, 30]);
    expect(pids(sortProcesses(lista, { key: "pid", dir: "asc" }))).toEqual([10, 20, 30]);
    expect(pids(sortProcesses(lista, { key: "runTimeSecs", dir: "desc" }))).toEqual([
      30, 20, 10,
    ]);
  });

  it("por puerto usa el mas bajo cuando el proceso escucha en varios", () => {
    const lista = [
      proceso({ pid: 1, ports: [8080, 3000] }),
      proceso({ pid: 2, ports: [5173] }),
    ];
    expect(pids(sortProcesses(lista, { key: "port", dir: "asc" }))).toEqual([1, 2]);
  });
});

/**
 * Los dos criterios que no se ven mirando una sola captura de la tabla, y que son
 * justo los que hacen que ordenar sirva de algo.
 */
describe("lo que no se ve en una sola pasada", () => {
  it("los procesos sin puerto van al final en las dos direcciones", () => {
    const lista = [
      proceso({ pid: 1, ports: [] }),
      proceso({ pid: 2, ports: [3000] }),
      proceso({ pid: 3, ports: [] }),
      proceso({ pid: 4, ports: [8080] }),
    ];

    // Ascendente: primero los puertos de menor a mayor, y los guiones al final.
    expect(pids(sortProcesses(lista, { key: "port", dir: "asc" }))).toEqual([2, 4, 1, 3]);
    // Descendente: cambia el orden de los que SI tienen puerto, pero los que no
    // siguen abajo. Al reves, media tabla de guiones taparia lo que se busca.
    expect(pids(sortProcesses(lista, { key: "port", dir: "desc" }))).toEqual([4, 2, 1, 3]);
  });

  /**
   * **Regresion de un baile de filas.** Rust reenvia la lista cada dos segundos
   * ya ordenada por RAM, y la RAM fluctua: el orden de partida no es el mismo
   * entre refrescos. Sin desempatar por PID, ordenar por CPU —donde media tabla
   * marca 0,0 %— haria saltar filas de sitio solas cada dos segundos.
   */
  it("dos refrescos con el mismo contenido dan el mismo orden", () => {
    const a = proceso({ pid: 77, cpu: 0, memoryMb: 120 });
    const b = proceso({ pid: 12, cpu: 0, memoryMb: 118 });
    const c = proceso({ pid: 45, cpu: 0, memoryMb: 119 });

    // Dos llegadas de Rust con los mismos procesos en distinto orden, que es lo
    // que pasa de verdad cuando la RAM se mueve unos MB entre ciclos.
    const primera = sortProcesses([a, c, b], { key: "cpu", dir: "desc" });
    const segunda = sortProcesses([b, a, c], { key: "cpu", dir: "desc" });

    expect(pids(primera)).toEqual(pids(segunda));
    expect(pids(primera)).toEqual([12, 45, 77]);
  });

  it("el desempate no se invierte al cambiar de direccion", () => {
    const lista = [proceso({ pid: 9, cpu: 0 }), proceso({ pid: 3, cpu: 0 })];
    expect(pids(sortProcesses(lista, { key: "cpu", dir: "asc" }))).toEqual([3, 9]);
    expect(pids(sortProcesses(lista, { key: "cpu", dir: "desc" }))).toEqual([3, 9]);
  });
});
