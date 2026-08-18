import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("verifică cu succes parola corectă", async () => {
    const hash = await hashPassword("parola-mea-secreta");
    expect(await verifyPassword("parola-mea-secreta", hash)).toBe(true);
  });

  it("respinge o parolă greșită", async () => {
    const hash = await hashPassword("parola-mea-secreta");
    expect(await verifyPassword("altceva", hash)).toBe(false);
  });

  it("nu stochează parola în clar în hash", async () => {
    const hash = await hashPassword("parola-mea-secreta");
    expect(hash).not.toBe("parola-mea-secreta");
    expect(hash.length).toBeGreaterThan(20);
  });
});
