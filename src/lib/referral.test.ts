import { describe, it, expect } from "vitest";
import { generateReferralCode, applyCredit, REFERRAL_BONUS_LEI } from "./referral";

describe("generateReferralCode", () => {
  it("produce un cod cu prefix pe baza numelui și un sufix aleatoriu", () => {
    const code = generateReferralCode("Ana Popescu");
    expect(code).toMatch(/^ANAP-[A-Z0-9]{4}$/);
  });
  it("elimină diacriticele din nume", () => {
    const code = generateReferralCode("Ștefan Ionescu");
    expect(code.startsWith("STEF")).toBe(true);
  });
  it("cade pe un prefix implicit dacă numele nu are litere (caz limită)", () => {
    const code = generateReferralCode("123");
    expect(code.startsWith("NIT-")).toBe(true);
  });
  it("generează coduri diferite la apeluri succesive (sufix aleatoriu)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode("Ana")));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("applyCredit", () => {
  it("scade creditul disponibil din preț", () => {
    expect(applyCredit(400, 20)).toEqual({ finalPrice: 380, creditUsed: 20 });
  });
  it("nu lasă prețul să scadă sub zero — plafonează la valoarea lucrării", () => {
    expect(applyCredit(15, 20)).toEqual({ finalPrice: 0, creditUsed: 15 });
  });
  it("fără credit disponibil, prețul rămâne neschimbat", () => {
    expect(applyCredit(400, 0)).toEqual({ finalPrice: 400, creditUsed: 0 });
  });
  it("ignoră un credit negativ (nu ar trebui să existe, dar nu crapă)", () => {
    expect(applyCredit(400, -10)).toEqual({ finalPrice: 400, creditUsed: 0 });
  });
  it("bonusul standard de recomandare e 20 lei", () => {
    expect(REFERRAL_BONUS_LEI).toBe(20);
  });
});
