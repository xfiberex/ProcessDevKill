import { describe, expect, it } from "vitest";
import { formatMemory, formatRelative, formatUptime } from "./format";

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

describe("formatRelative", () => {
  // Un miércoles a las 9:00, hora local: los días naturales se cuentan en la zona del equipo.
  const AHORA = new Date(2026, 8, 23, 9, 0, 0).getTime();
  const antes = (ms: number) => AHORA - ms;
  const MIN = 60_000;
  const HORA = 60 * MIN;

  it("lo de hace unos segundos es «ahora»", () => {
    expect(formatRelative(antes(10_000), AHORA, "es")).toBe("ahora");
    expect(formatRelative(antes(10_000), AHORA, "en")).toBe("now");
  });

  it("minutos y horas, dentro del mismo dia", () => {
    expect(formatRelative(antes(5 * MIN), AHORA, "es")).toBe("hace 5 minutos");
    expect(formatRelative(antes(3 * HORA), AHORA, "es")).toBe("hace 3 horas");
    expect(formatRelative(antes(3 * HORA), AHORA, "en")).toBe("3 hours ago");
  });

  /** Por calendario: anoche a las 23:00, visto a las 9:00, es «ayer» aunque solo pasaran 10 h. */
  it("cuenta los dias por calendario, no por horas", () => {
    expect(formatRelative(antes(10 * HORA), AHORA, "es")).toBe("ayer");
    expect(formatRelative(antes(10 * HORA), AHORA, "en")).toBe("yesterday");
    expect(formatRelative(antes(3 * 24 * HORA), AHORA, "es")).toBe("hace 3 días");
  });

  it("a partir de una semana, la fecha; el año solo si no es el de ahora", () => {
    const septiembre = new Date(2026, 8, 2, 12, 0).getTime();
    expect(formatRelative(septiembre, AHORA, "es")).not.toMatch(/2026/);
    expect(formatRelative(septiembre, AHORA, "es")).toMatch(/2/);

    const añoPasado = new Date(2025, 11, 30, 12, 0).getTime();
    expect(formatRelative(añoPasado, AHORA, "es")).toMatch(/2025/);
  });
});
