import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, buildAuthorizedSupportContext, validateSupportMessages } = vi.hoisted(() => ({ getCurrentUser: vi.fn(), buildAuthorizedSupportContext: vi.fn(), validateSupportMessages: vi.fn(() => [{ role: "user", content: "ajutor" }]) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/security", () => ({ consumeRateLimit: vi.fn(() => true), requestIp: vi.fn(() => "127.0.0.1"), tokenHash: vi.fn(() => "safehash") }));
vi.mock("@/lib/supportAi", () => ({ buildAuthorizedSupportContext, finalizeSupportAnswer: vi.fn((answer: string) => answer), SUPPORT_INSTRUCTIONS: "support only; refuză date despre alt cont", validateSupportMessages }));

import { GET, POST } from "./route";

describe("support AI route without provider credentials", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalEnabled = process.env.NITIDO_AI_ENABLED;
  beforeEach(() => { delete process.env.OPENAI_API_KEY; delete process.env.NITIDO_AI_ENABLED; getCurrentUser.mockReset().mockResolvedValue(null); buildAuthorizedSupportContext.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); if (originalKey) process.env.OPENAI_API_KEY = originalKey; else delete process.env.OPENAI_API_KEY; if (originalEnabled) process.env.NITIDO_AI_ENABLED = originalEnabled; else delete process.env.NITIDO_AI_ENABLED; });

  it("reports guide availability separately from unavailable AI", async () => {
    const response = await GET(new Request("http://localhost/api/support/ai") as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, aiAvailable: false, authenticated: false });
  });

  it("returns a clearly attributed guide fallback without provider or private context", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const response = await POST(new Request("http://localhost/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "guide", answer: expect.stringContaining("AI-ul este momentan indisponibil") });
    expect(provider).not.toHaveBeenCalled();
    expect(buildAuthorizedSupportContext).not.toHaveBeenCalled();
  });

  it("answers a canonical quick question from the guide even when AI is configured", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.NITIDO_AI_ENABLED = "true";
    validateSupportMessages.mockReturnValueOnce([{ role: "user", content: "Cum postez o lucrare?" }]);
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    const response = await POST(new Request("http://localhost/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "guide", topic: "post-job", answer: expect.stringContaining("autentifică-te în contul de client") });
    expect(provider).not.toHaveBeenCalled();
    expect(buildAuthorizedSupportContext).not.toHaveBeenCalled();
  });

  it("uses only server-authorized context when explicitly enabled", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.NITIDO_AI_ENABLED = "true";
    const user = { id: "client_a", role: "client", name: "Client A" };
    getCurrentUser.mockResolvedValue(user);
    buildAuthorizedSupportContext.mockReturnValue('{"ownJobs":[]}');
    const provider = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ flagged: false }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: "Răspuns sigur" }), { status: 200 }));
    vi.stubGlobal("fetch", provider);

    const response = await POST(new Request("http://localhost/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: "Răspuns sigur", source: "ai" });
    expect(buildAuthorizedSupportContext).toHaveBeenCalledWith(user);
    expect(provider.mock.calls[0][0]).toBe("https://api.openai.com/v1/moderations");
    const requestBody = JSON.parse(provider.mock.calls[1][1].body);
    expect(requestBody.store).toBe(false);
    expect(requestBody.tools).toBeUndefined();
    expect(requestBody.instructions).toContain("ownJobs");
    expect(requestBody.instructions).toContain("alt cont");
    expect(provider.mock.calls[1][1].headers.Authorization).toBe("Bearer test-only-key");
  });

  it("blocks content flagged by moderation before private context is built", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.NITIDO_AI_ENABLED = "true";
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ flagged: true }] }), { status: 200 }));
    vi.stubGlobal("fetch", provider);
    const response = await POST(new Request("http://localhost/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) as never);
    expect(response.status).toBe(400);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(buildAuthorizedSupportContext).not.toHaveBeenCalled();
  });

  it("scopes an authenticated firm request through the firm server context", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.NITIDO_AI_ENABLED = "true";
    const firm = { id: "firm_user_a", role: "firma", name: "Firma A" };
    getCurrentUser.mockResolvedValue(firm);
    buildAuthorizedSupportContext.mockReturnValue('{"ownAllocatedJobs":[]}');
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ flagged: false }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: "Status firmă" }), { status: 200 })));

    const response = await POST(new Request("http://localhost/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) as never);
    expect(response.status).toBe(200);
    expect(buildAuthorizedSupportContext).toHaveBeenCalledWith(firm);
  });
});
