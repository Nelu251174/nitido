import { describe, it, expect } from "vitest";
import {
  calcGrossPrice,
  calcNetForFirm,
  calcDurationMinutes,
  calcBlockedMinutes,
  isSlotValid,
  overlapsExisting,
} from "./pricing";

describe("calcGrossPrice — trepte apartament (spec secțiunea 6)", () => {
  it("garsonieră (<=40 mp) = 350 lei", () => {
    expect(calcGrossPrice("apartament", 35)).toBe(350);
    expect(calcGrossPrice("apartament", 40)).toBe(350);
  });
  it("2 camere (40-60 mp) = 400 lei", () => {
    expect(calcGrossPrice("apartament", 60)).toBe(400);
  });
  it("3 camere (60-80 mp) = 550 lei", () => {
    expect(calcGrossPrice("apartament", 75)).toBe(550);
  });
  it("4 camere (80-100 mp) = 650 lei", () => {
    expect(calcGrossPrice("apartament", 100)).toBe(650);
  });
  it("peste 100 mp = 650 + 6.5 lei/mp suplimentar", () => {
    expect(calcGrossPrice("apartament", 120)).toBe(Math.round(650 + 20 * 6.5));
  });
});

describe("calcGrossPrice — preț/mp casă, birou, altul", () => {
  it("casă: 5.5 lei/mp", () => {
    expect(calcGrossPrice("casa", 100)).toBe(550);
  });
  it("birou: 4.5 lei/mp", () => {
    expect(calcGrossPrice("birou", 100)).toBe(450);
  });
  it("altul: 5 lei/mp", () => {
    expect(calcGrossPrice("altul", 100)).toBe(500);
  });
});

describe("calcNetForFirm — comision 18% (spec secțiunea 7)", () => {
  it("550 lei brut -> 451 lei net firmă", () => {
    expect(calcNetForFirm(550)).toBe(451);
  });
  it("400 lei brut -> 328 lei net firmă", () => {
    expect(calcNetForFirm(400)).toBe(328);
  });
});

describe("calcDurationMinutes / calcBlockedMinutes (spec secțiunea 5d)", () => {
  it.each([
    [30, 90],
    [40, 90],
    [55, 120],
    [70, 150],
    [95, 180],
    [140, 210], // 100 + 40 => +30 min peste 180
    [180, 240], // 100 + 80 => +60 min peste 180
  ])("sqm=%d -> durata=%d min", (sqm, expected) => {
    expect(calcDurationMinutes(sqm)).toBe(expected);
  });

  it("blocked = durată + buffer 30 min", () => {
    expect(calcBlockedMinutes(75)).toBe(150 + 30);
  });
});

describe("isSlotValid — prag minim 1 oră (spec secțiunea 5d)", () => {
  it("respinge un slot la mai puțin de 1 oră distanță", () => {
    const now = new Date("2026-08-16T17:45:00");
    const day = new Date("2026-08-16T00:00:00");
    expect(isSlotValid(day, 18, now)).toBe(false); // 18:00 e la 15 min distanță
  });

  it("acceptă un slot la exact pragul de 1 oră sau mai mult", () => {
    const now = new Date("2026-08-16T13:00:00");
    const day = new Date("2026-08-16T00:00:00");
    expect(isSlotValid(day, 14, now)).toBe(true); // exact 1 oră
    expect(isSlotValid(day, 16, now)).toBe(true);
  });
});

describe("overlapsExisting — blocare calendar firmă (spec secțiunea 5d)", () => {
  it("detectează suprapunerea cu o lucrare existentă", () => {
    const existing = [{ start: new Date("2026-08-16T14:00:00"), blockedMinutes: 180 }]; // 14:00-17:00
    const candidate = new Date("2026-08-16T16:00:00"); // s-ar suprapune
    expect(overlapsExisting(candidate, 120, existing)).toBe(true);
  });

  it("nu raportează fals-pozitiv pentru sloturi consecutive fără suprapunere", () => {
    const existing = [{ start: new Date("2026-08-16T14:00:00"), blockedMinutes: 180 }]; // până la 17:00
    const candidate = new Date("2026-08-16T17:00:00"); // începe exact când se termină precedenta
    expect(overlapsExisting(candidate, 90, existing)).toBe(false);
  });
});
