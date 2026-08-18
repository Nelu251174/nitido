import { describe, it, expect, vi, afterEach } from "vitest";
import { sanitizeCui, isPlausibleCui, verifyCuiWithAnaf } from "./cui";

describe("sanitizeCui / isPlausibleCui — format, fără rețea", () => {
  it("scoate prefixul RO și spațiile", () => {
    expect(sanitizeCui("RO 12345678")).toBe("12345678");
    expect(sanitizeCui("ro12345678")).toBe("12345678");
  });
  it("acceptă un șir plauzibil de cifre (2-10)", () => {
    expect(isPlausibleCui("RO12345678")).toBe(true);
    expect(isPlausibleCui("14")).toBe(true);
  });
  it("respinge text/litere sau cifre aleatorii nepotrivite ca format", () => {
    expect(isPlausibleCui("abcdefgh")).toBe(false);
    expect(isPlausibleCui("")).toBe(false);
    expect(isPlausibleCui("1")).toBe(false); // sub 2 cifre
    expect(isPlausibleCui("12345678901")).toBe(false); // peste 10 cifre
  });
});

describe("verifyCuiWithAnaf — interpretare răspuns ANAF (fetch mockuit)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marchează 'not_found' dacă ANAF nu găsește CUI-ul (firmă inventată)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ found: [], notFound: [{ cui: 99999999 }] }),
      })
    );
    const result = await verifyCuiWithAnaf("99999999");
    expect(result.status).toBe("not_found");
  });

  it("marchează 'valid' cu numele firmei dacă ANAF confirmă firma activă", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          found: [
            {
              date_generale: {
                denumire: "FIRMA TEST SRL",
                stare_inregistrare: "INREGISTRAT din data 2010-01-01",
                data_radiere: null,
              },
            },
          ],
        }),
      })
    );
    const result = await verifyCuiWithAnaf("14399840");
    expect(result).toEqual({ status: "valid", name: "FIRMA TEST SRL" });
  });

  it("marchează 'dissolved' dacă firma are dată de radiere", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          found: [
            {
              date_generale: {
                denumire: "FIRMA RADIATA SRL",
                stare_inregistrare: "RADIAT din data 2020-01-01",
                data_radiere: "2020-01-01",
              },
            },
          ],
        }),
      })
    );
    const result = await verifyCuiWithAnaf("11111111");
    expect(result.status).toBe("dissolved");
  });

  it("marchează 'unavailable' dacă ANAF nu răspunde (eroare de rețea) — nu blochează înregistrarea", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );
    const result = await verifyCuiWithAnaf("12345678");
    expect(result.status).toBe("unavailable");
  });

  it("marchează 'unavailable' dacă răspunsul ANAF nu e ok (ex. 500)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    const result = await verifyCuiWithAnaf("12345678");
    expect(result.status).toBe("unavailable");
  });
});
