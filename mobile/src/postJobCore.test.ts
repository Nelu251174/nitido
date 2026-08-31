import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiCore";
import { buildCreatePayload, canAddPhoto, EMPTY_DRAFT, isDateAllowed, isSlotAllowed, nextPostStep, postJobError, previousPostStep, quoteMatchesDraft, validateSqm, type JobQuote, type PostJobDraft } from "./postJobCore";
import { publishClientJob, requestAuthoritativeQuote } from "./postJobService";

const draft = (overrides: Partial<PostJobDraft> = {}): PostJobDraft => ({ ...EMPTY_DRAFT, spaceType: "apartament", sqm: "80", city: "București", street: "Strada Test 10", scheduledDate: "2026-09-02", scheduledHour: 10, ...overrides });
const quote: JobQuote = { spaceType: "apartament", sqm: 80, priceGross: 550, durationMinutes: 150, currency: "RON" };

describe("client post-job validation", () => {
  it("uses only canonical job types", () => { expect(buildCreatePayload(draft()).spaceType).toBe("apartament"); });
  it("validates positive integer surface", () => { expect(validateSqm("80")).toBeNull(); expect(validateSqm("0")).toContain("întreagă"); expect(validateSqm("12.5")).toContain("întreagă"); });
  it("rejects past dates without timezone shifting", () => { const now = new Date("2026-08-30T12:00:00"); expect(isDateAllowed("2026-08-29", now)).toBe(false); expect(isDateAllowed("2026-08-30", now)).toBe(true); });
  it("enforces canonical slots and minimum lead time", () => { const now = new Date("2026-08-30T09:30:00"); expect(isSlotAllowed("2026-08-30", 10, now)).toBe(false); expect(isSlotAllowed("2026-08-30", 12, now)).toBe(true); expect(isSlotAllowed("2026-08-30", 11, now)).toBe(false); });
  it("invalidates a stale quote after pricing inputs change", () => { expect(quoteMatchesDraft(quote, draft())).toBe(true); expect(quoteMatchesDraft(quote, draft({ sqm: "81" }))).toBe(false); expect(quoteMatchesDraft(quote, draft({ spaceType: "casa" }))).toBe(false); });
  it("moves through ten bounded steps without losing draft state", () => { expect(nextPostStep(0)).toBe(1); expect(nextPostStep(9)).toBe(9); expect(previousPostStep(5)).toBe(4); expect(previousPostStep(0)).toBe(0); expect(draft().city).toBe("București"); });
  it("enforces the five-photo maximum", () => { expect(canAddPhoto(4)).toBe(true); expect(canAddPhoto(5)).toBe(false); });
});

describe("authoritative quote and creation requests", () => {
  it("requests pricing from the backend", async () => { const request = vi.fn().mockResolvedValue({ quote }); await expect(requestAuthoritativeQuote(draft(), request)).resolves.toEqual({ quote }); expect(request).toHaveBeenCalledWith("/api/jobs/quote", expect.objectContaining({ method: "POST" })); });
  it("publishes once with an idempotency key and no client identity or price", async () => { const request = vi.fn().mockResolvedValue({ job: { id: "job_1" } }); await publishClientJob(draft(), "mobile-key", request); const [, init] = request.mock.calls[0]; const body = JSON.parse(String(init.body)); expect(init.headers).toEqual({ "Idempotency-Key": "mobile-key" }); expect(body).not.toHaveProperty("client_id"); expect(body).not.toHaveProperty("price_gross"); expect(body.street).toBe("Strada Test 10"); });
  it("maps authentication and backend failures to safe Romanian messages", () => { expect(postJobError(new ApiError("internal", 401))).toContain("Sesiunea"); expect(postJobError(new ApiError("internal", 500))).not.toContain("internal"); });
  it("surfaces quote and create failures without fake success", async () => { const failed = vi.fn().mockRejectedValue(new ApiError("Suprafață invalidă", 400)); await expect(requestAuthoritativeQuote(draft(), failed)).rejects.toThrow("Suprafață invalidă"); await expect(publishClientJob(draft(), "same-key", failed)).rejects.toThrow("Suprafață invalidă"); });
});

describe("screen integration", () => {
  const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
  it("prevents duplicate submit taps and refreshes jobs on focus", () => { const post = source("app/(client)/post.tsx"); expect(post).toContain("if (submitting || createdId) return"); expect(post).toContain("publishClientJob"); expect(source("src/useJobs.ts")).toContain("useFocusEffect"); });
  it("keeps exact address out of the pre-allocation firm card", () => { const card = source("src/jobUi.tsx"); expect(card).not.toContain("job.street"); expect(card).toContain("Adresa exactă"); });
  it("keeps native-only picker code out of the web implementation", () => { expect(source("src/DateSelector.web.tsx")).not.toContain("@react-native-community/datetimepicker"); expect(source("src/DateSelector.native.tsx")).toContain("DateTimePicker"); });
  it("routes authoritative creation to job detail and exposes retry", () => { const post=source("app/(client)/post.tsx"); expect(post).toContain('/(client)/job/[id]'); expect(post).toContain("Reîncearcă încărcarea"); const detail=source("app/(client)/job/[id].tsx"); expect(detail).toContain("Evoluția lucrării"); expect(detail).toContain("Așteptăm o firmă"); });
});
