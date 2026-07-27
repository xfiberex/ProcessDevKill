import { describe, expect, it } from "vitest";
import { formatMemory, formatUptime } from "./format";

describe("formatUptime", () => {
  it("usa segundos por debajo del minuto", () => {
    expect(formatUptime(0)).toBe("0s");
    expect(formatUptime(59)).toBe("59s");
  });

  it("usa minutos por debajo de la hora", () => {
    expect(formatUptime(60)).toBe("1m");
    expect(formatUptime(3599)).toBe("59m");
  });

  it("usa horas y minutos por encima de la hora", () => {
    expect(formatUptime(3600)).toBe("1h 0m");
    expect(formatUptime(3661)).toBe("1h 1m");
    expect(formatUptime(90061)).toBe("25h 1m");
  });
});

describe("formatMemory", () => {
  it("usa MB sin decimales por debajo de 1 GB", () => {
    expect(formatMemory(0)).toBe("0 MB");
    expect(formatMemory(651.7)).toBe("652 MB");
    expect(formatMemory(1023)).toBe("1023 MB");
  });

  it("salta a GB con un decimal justo en 1024", () => {
    expect(formatMemory(1024)).toBe("1.0 GB");
    expect(formatMemory(2048)).toBe("2.0 GB");
    expect(formatMemory(1536)).toBe("1.5 GB");
  });
});
