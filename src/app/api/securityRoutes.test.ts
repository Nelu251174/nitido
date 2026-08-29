import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, isAdmin } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/adminAuth", () => ({ isAdmin, auditAdminAction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { prepare: vi.fn(() => ({ get: vi.fn(), all: vi.fn(), run: vi.fn() })) },
  getFirmByUserId: vi.fn(),
  getUserById: vi.fn(),
}));

import { POST as accept } from "./jobs/[id]/accept/route";
import { POST as arrived } from "./jobs/[id]/arrived/route";
import { POST as complete } from "./jobs/[id]/complete/route";
import { GET as adminOverview } from "./admin/overview/route";

const request = () => new Request("http://localhost/api/test", { method: "POST" }) as never;
const context = { params: Promise.resolve({ id: "job_1" }) };

describe("route authentication regressions", () => {
  beforeEach(() => {
    getCurrentUser.mockReset().mockResolvedValue(null);
    isAdmin.mockReset().mockResolvedValue(false);
  });

  it.each([
    ["accept", accept],
    ["arrived", arrived],
    ["complete", complete],
  ])("unauthenticated user cannot %s a job", async (_name, handler) => {
    const response = await handler(request(), context);
    expect(response.status).toBe(401);
  });

  it("unauthenticated user cannot access admin overview", async () => {
    const response = await adminOverview(request());
    expect(response.status).toBe(401);
  });
});
