import { describe, expect, it } from "vitest";
import { canTransition } from "./status";

describe("pro status machine", () => {
  it("allows planned to allocated", () => {
    expect(canTransition("planificata", "alocata")).toBe(true);
  });
  it("rejects closed to anything", () => {
    expect(canTransition("inchisa", "noua")).toBe(false);
  });
  it("allows cancel from allocated", () => {
    expect(canTransition("alocata", "anulata")).toBe(true);
  });
});
