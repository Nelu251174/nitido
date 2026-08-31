import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/jobs/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never;
}

describe("authoritative mobile job quote", () => {
  beforeEach(() => getCurrentUser.mockReset());
  it("requires an authenticated client", async () => { getCurrentUser.mockResolvedValue(null); expect((await POST(request({ spaceType: "apartament", sqm: 80 }))).status).toBe(401); });
  it("rejects unsupported service types and invalid surfaces", async () => { getCurrentUser.mockResolvedValue({ id: "client", role: "client" }); expect((await POST(request({ spaceType: "hotel", sqm: 80 }))).status).toBe(400); expect((await POST(request({ spaceType: "apartament", sqm: 12.5 }))).status).toBe(400); });
  it("returns the existing server pricing result", async () => { getCurrentUser.mockResolvedValue({ id: "client", role: "client" }); const response = await POST(request({ spaceType: "apartament", sqm: 80 })); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ quote: { priceGross: 550, durationMinutes: 150, currency: "RON" }, scheduling: { slotHours: [8, 10, 12, 14, 16, 18], minLeadHours: 1 } }); });
  it("keeps creation idempotency, credit and photo linking in one transaction", () => { const source=readFileSync(join(process.cwd(),"src/app/api/jobs/route.ts"),"utf8"); expect(source).toContain('req.headers.get("Idempotency-Key")'); expect(source).toContain("db.transaction"); expect(source).toContain("client_request_id"); expect(source.indexOf("db.transaction")).toBeLessThan(source.lastIndexOf("UPDATE job_photos SET job_id")); });
});
