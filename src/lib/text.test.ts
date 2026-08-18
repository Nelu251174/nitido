import { describe, it, expect } from "vitest";
import { normalizeCity, sanitizeCoverageCitiesInput, firmCoversCity } from "./text";

describe("normalizeCity — potrivire oraș indiferent de diacritice/majuscule/spații", () => {
  it("elimină diacriticele", () => {
    expect(normalizeCity("Constanța")).toBe("constanta");
  });
  it("ignoră majusculele", () => {
    expect(normalizeCity("CONSTANȚA")).toBe("constanta");
  });
  it("elimină spațiile de la capete", () => {
    expect(normalizeCity(" Constanța ")).toBe("constanta");
  });
  it("tratează la fel variantele cu și fără diacritice", () => {
    expect(normalizeCity("Constanța")).toBe(normalizeCity("constanta"));
    expect(normalizeCity("Cluj-Napoca")).toBe(normalizeCity(" cluj-napoca "));
  });
});

describe("sanitizeCoverageCitiesInput — listă de localități extra introdusă liber", () => {
  it("curăță spațiile din jurul virgulelor", () => {
    expect(sanitizeCoverageCitiesInput("Ovidiu,  Mamaia ,Năvodari")).toBe(
      "Ovidiu, Mamaia, Năvodari"
    );
  });
  it("elimină intrările goale (virgule consecutive)", () => {
    expect(sanitizeCoverageCitiesInput("Ovidiu,, Mamaia,")).toBe("Ovidiu, Mamaia");
  });
  it("șir gol rămâne gol", () => {
    expect(sanitizeCoverageCitiesInput("")).toBe("");
  });
});

describe("firmCoversCity — lucrare din oraș principal SAU dintr-o localitate extra", () => {
  it("se potrivește pe orașul principal", () => {
    expect(firmCoversCity("Constanța", null, "constanta")).toBe(true);
  });
  it("se potrivește pe o localitate extra", () => {
    expect(firmCoversCity("Constanța", "Ovidiu, Mamaia, Năvodari", "Mamaia")).toBe(true);
  });
  it("nu se potrivește dacă orașul lucrării nu e nici principal, nici extra", () => {
    expect(firmCoversCity("Constanța", "Ovidiu, Mamaia", "Cluj-Napoca")).toBe(false);
  });
  it("funcționează fără localități extra (null/gol)", () => {
    expect(firmCoversCity("Constanța", null, "Cluj-Napoca")).toBe(false);
    expect(firmCoversCity("Constanța", "", "Cluj-Napoca")).toBe(false);
  });
});
