import { describe, expect, it } from "vitest";
import type { JobRow } from "./types";
import {
  canRateJob,
  clientCanReadJob,
  firmCanReadFullJob,
  firmCanSeeWaitingJob,
  firmCanTransitionJob,
  shouldSeedDemo,
} from "./authorization";

const job = (overrides: Partial<JobRow> = {}): JobRow => ({
  id: "job_1", client_id: "client_a", street: "Secret 1", postal_code: "000000",
  city: "Constanța", floor: "2", sqm: 50, space_type: "apartament", when_type: "scheduled",
  scheduled_at: new Date().toISOString(), price_gross: 500, credit_applied: 0,
  duration_minutes: 120, buffer_minutes: 30, photos_count: 1, status: "waiting",
  accepted_firm_id: null, accepted_at: null, arrived_confirmed_at: null, completed_at: null,
  created_at: new Date().toISOString(), ...overrides,
});

describe("security authorization boundaries", () => {
  it("client A cannot read client B's private job", () => {
    expect(clientCanReadJob("client_a", job())).toBe(true);
    expect(clientCanReadJob("client_b", job())).toBe(false);
  });

  it("a firm sees only minimal waiting eligibility until it owns the accepted job", () => {
    expect(firmCanSeeWaitingJob("firm_a", job(), true)).toBe(true);
    expect(firmCanReadFullJob("firm_a", job())).toBe(false);
    expect(firmCanReadFullJob("firm_a", job({ status: "accepted", accepted_firm_id: "firm_a" }))).toBe(true);
  });

  it("firm A cannot arrive or complete firm B's job", () => {
    const ownedByB = job({ status: "accepted", accepted_firm_id: "firm_b" });
    expect(firmCanTransitionJob("firm_a", ownedByB, "arrived")).toBe(false);
    expect(firmCanTransitionJob("firm_a", ownedByB, "complete")).toBe(false);
  });

  it("normal client rating and firm transitions remain valid", () => {
    expect(firmCanTransitionJob("firm_a", job({ status: "accepted", accepted_firm_id: "firm_a" }), "arrived")).toBe(true);
    expect(firmCanTransitionJob("firm_a", job({ status: "arrived", accepted_firm_id: "firm_a" }), "complete")).toBe(true);
    expect(canRateJob("client_a", job({ status: "completed", accepted_firm_id: "firm_a" }))).toBe(true);
  });

  it("never enables demo seed data in production", () => {
    expect(shouldSeedDemo("production", "true")).toBe(false);
    expect(shouldSeedDemo("development", "true")).toBe(true);
    expect(shouldSeedDemo("development", undefined)).toBe(false);
  });
});
