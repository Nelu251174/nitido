import { describe, it, expect } from "vitest";
import { determineConsequence } from "./strikes";

describe("determineConsequence — praguri no-show (spec secțiunea 5b)", () => {
  it("1 no-show -> avertisment", () => {
    expect(determineConsequence(1, 1)).toBe("warning");
  });
  it("2 no-show-uri în 30 de zile -> suspendare 7 zile", () => {
    expect(determineConsequence(2, 2)).toBe("suspend_7d");
  });
  it("3+ no-show-uri în 90 de zile -> suspendare permanentă", () => {
    expect(determineConsequence(1, 3)).toBe("suspend_permanent");
  });
  it("suspendarea permanentă are prioritate față de pragul de 30 zile", () => {
    expect(determineConsequence(2, 3)).toBe("suspend_permanent");
  });
});
