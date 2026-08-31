import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const card = readFileSync(join(root, "src/components/PaymentTrustCard.tsx"), "utf8");
const homepage = readFileSync(join(root, "src/app/page.tsx"), "utf8");

describe("payment trust section", () => {
  it("uses five local vector payment marks", () => {
    for (const brand of ["visa", "mastercard", "stripe", "revolut", "wise"]) {
      expect(card).toContain(`/payment/${brand}.svg`);
      expect(existsSync(join(root, `public/payment/${brand}.svg`))).toBe(true);
    }
  });

  it("keeps payment claims provider-authoritative", () => {
    expect(card).toContain("numai după confirmarea procesatorului");
    expect(card).toContain("numai după răspunsul reușit al procesatorului");
    expect(card).toContain("poate depinde de procesatorul de plăți și de bancă");
    expect(card).not.toMatch(/garantat|instant în contul bancar/i);
  });

  it("distinguishes card brands from the Stripe processor", () => {
    expect(card).toContain("Visa și Mastercard sunt rețele de card");
    expect(card).toContain("Revolut și Wise sunt afișate orientativ");
    expect(card).toContain("procesarea NITIDO este realizată prin Stripe");
  });

  it("fills both side cards and preserves the responsive three-column composition", () => {
    expect(homepage).toContain("minmax(360px,1.08fr)");
    expect(homepage).toContain("max-[1100px]:grid-cols-1");
    expect(homepage).toContain("Suport rapid dacă apare o problemă");
    expect(homepage).toContain("Capturarea plății după finalizare și confirmarea procesatorului");
  });
});
