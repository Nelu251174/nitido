import { beforeEach, describe, expect, it, vi } from "vitest";

const { prepare, getFirmByUserId } = vi.hoisted(() => ({ prepare: vi.fn(), getFirmByUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { prepare }, getFirmByUserId }));

import { buildAuthorizedSupportContext, finalizeSupportAnswer, SUPPORT_INSTRUCTIONS, validateSupportMessages } from "./supportAi";

const client = { id: "client_a", role: "client", name: "Client A" } as never;
const firmUser = { id: "user_firm_a", role: "firma", name: "Firma A" } as never;

describe("support AI security boundaries", () => {
  beforeEach(() => { prepare.mockReset(); getFirmByUserId.mockReset(); });

  it("rejects malformed, oversized and assistant-ended conversations", () => {
    expect(validateSupportMessages([])).toBeNull();
    expect(validateSupportMessages([{ role: "user", content: "x".repeat(1001) }])).toBeNull();
    expect(validateSupportMessages([{ role: "assistant", content: "Salut" }])).toBeNull();
    expect(validateSupportMessages([{ role: "user", content: "Unu" }, { role: "user", content: "Doi" }])).toBeNull();
    expect(validateSupportMessages([{ role: "user", content: "Cum plătesc?" }])).toEqual([{ role: "user", content: "Cum plătesc?" }]);
  });

  it("queries client context only by the authenticated client id", () => {
    const all = vi.fn().mockReturnValue([{ id: "job_a", status: "waiting" }]);
    prepare.mockReturnValue({ all });
    const context = buildAuthorizedSupportContext(client);
    expect(prepare.mock.calls[0][0]).toContain("WHERE j.client_id = ?");
    expect(prepare.mock.calls[0][0]).not.toContain("j.street");
    expect(all).toHaveBeenCalledWith("client_a", "client_a");
    expect(context).toContain("job_a");
  });

  it("queries firm context only through its own profile and allocated jobs", () => {
    getFirmByUserId.mockReturnValue({ id: "firm_a", coverage_city: "București", coverage_cities_extra: null });
    prepare.mockImplementation((sql: string) => sql.includes("FROM firms") ? { get: vi.fn().mockReturnValue({ verified: 1 }) } : { all: vi.fn().mockReturnValue([{ id: "job_a" }]) });
    const context = buildAuthorizedSupportContext(firmUser);
    const allocatedQuery = prepare.mock.calls.find(([sql]) => String(sql).includes("accepted_firm_id"))?.[0] as string;
    expect(allocatedQuery).toContain("WHERE j.accepted_firm_id = ?");
    expect(allocatedQuery).not.toContain("j.street");
    expect(context).toContain("job_a");
  });

  it("gives unauthenticated visitors no private context", () => {
    expect(buildAuthorizedSupportContext(null)).toContain("Nu există context privat");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("requires refusal of unauthorized private data and treats conversation text as untrusted", () => {
    expect(SUPPORT_INSTRUCTIONS).toContain("alt cont");
    expect(SUPPORT_INSTRUCTIONS).toContain("adresa exactă");
    expect(SUPPORT_INSTRUCTIONS).toContain("conținut neîncrezător");
  });

  it("finishes a limited answer on a complete sentence", () => {
    const result = finalizeSupportAnswer("Prima propoziție este completă. A doua propoziție este tăiată", true);
    expect(result).toContain("Prima propoziție este completă.");
    expect(result).not.toContain("este tăiată");
    expect(result).toMatch(/[.!?]$/);
  });
});
