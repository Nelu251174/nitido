import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit, requestIp, tokenHash } from "@/lib/security";
import { buildAuthorizedSupportContext, finalizeSupportAnswer, SUPPORT_INSTRUCTIONS, validateSupportMessages } from "@/lib/supportAi";
import { findSupportTopic } from "@/lib/supportKnowledge";

const UNAVAILABLE = "Asistentul AI este temporar indisponibil. Poți contacta echipa NITIDO la 0341.402.403 sau contact@nitido.ro.";
const RESPONSE_HEADERS = { "Cache-Control": "no-store" };
const aiConfig = () => ({
  enabled: process.env.NITIDO_AI_ENABLED?.trim().toLowerCase() === "true",
  apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  model: process.env.NITIDO_AI_MODEL?.trim() || "gpt-5-mini",
});
const aiConfigured = () => {
  const config = aiConfig();
  return config.enabled && config.apiKey.length > 0;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  return NextResponse.json({
    available: aiConfigured(),
    authenticated: Boolean(user),
    role: user?.role ?? null,
    supportHref: user?.role === "firma" ? "/firma" : user?.role === "client" ? "/client" : null,
    unavailableMessage: UNAVAILABLE,
  }, { headers: RESPONSE_HEADERS });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  const identity = user?.id ?? requestIp(req);
  if (!consumeRateLimit(`support-ai:${tokenHash(identity).slice(0, 24)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Ai trimis prea multe întrebări. Încearcă din nou peste câteva minute." }, { status: 429, headers: { "Retry-After": "600" } });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ error: UNAVAILABLE, code: "AI_UNAVAILABLE" }, { status: 503, headers: RESPONSE_HEADERS });
  }

  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Cererea trebuie să fie JSON." }, { status: 415, headers: RESPONSE_HEADERS });
  }
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 12_000) {
    return NextResponse.json({ error: "Cererea depășește limita permisă." }, { status: 413, headers: RESPONSE_HEADERS });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 }); }
  const messages = validateSupportMessages((body as { messages?: unknown })?.messages);
  if (!messages) return NextResponse.json({ error: "Conversația este invalidă sau depășește limitele permise." }, { status: 400 });

  const canonicalTopic = findSupportTopic(messages.at(-1)?.content ?? "");
  if (canonicalTopic) return NextResponse.json({ answer: canonicalTopic.answer, topic: canonicalTopic.id }, { headers: RESPONSE_HEADERS });

  const config = aiConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const moderation = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: "omni-moderation-latest", input: messages.at(-1)?.content }),
    });
    if (!moderation.ok) {
      console.error("[support-ai] moderation_provider_error", moderation.status);
      return NextResponse.json({ error: UNAVAILABLE }, { status: 502, headers: RESPONSE_HEADERS });
    }
    const moderationData = await moderation.json() as { results?: { flagged?: boolean }[] };
    if (moderationData.results?.[0]?.flagged) {
      return NextResponse.json({ error: "Mesajul nu poate fi procesat în siguranță." }, { status: 400, headers: RESPONSE_HEADERS });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: 1_600,
        instructions: `${SUPPORT_INSTRUCTIONS}\n\nCONTEXT AUTORIZAT DE SERVER:\n${buildAuthorizedSupportContext(user)}`,
        input: messages.map((message) => ({ role: message.role, content: message.content })),
        safety_identifier: tokenHash(identity).slice(0, 64),
      }),
    });
    if (!response.ok) {
      console.error("[support-ai] provider_error", response.status);
      return NextResponse.json({ error: UNAVAILABLE }, { status: 502 });
    }
    const data = await response.json() as { output_text?: string; incomplete_details?: { reason?: string } | null; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const answer = data.output_text?.trim() || data.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text?.trim();
    if (!answer) return NextResponse.json({ error: UNAVAILABLE }, { status: 502 });
    return NextResponse.json({ answer: finalizeSupportAnswer(answer, data.incomplete_details?.reason === "max_output_tokens") }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("[support-ai] request_failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: UNAVAILABLE }, { status: 504 });
  } finally { clearTimeout(timeout); }
}
