import { db, newId } from "@/lib/db";
import { audit } from "./audit";
import { clientOrgIds, isAdmin } from "./authz";

export function decideQuote(
  userId: string,
  quoteId: string,
  decision: "approved" | "rejected"
) {
  const quote = db
    .prepare(
      `SELECT q.*, j.organization_id as organization_id
       FROM pro_quotes q JOIN pro_jobs j ON j.id = q.job_id
       WHERE q.id = ?`
    )
    .get(quoteId) as { id: string; status: string; organization_id: string } | undefined;
  if (!quote) return { error: "not_found", status: 404 as const };
  if (quote.status !== "pending") return { error: "already_decided", status: 409 as const };
  if (!clientOrgIds(userId).includes(quote.organization_id)) {
    return { error: "not_found", status: 404 as const };
  }
  db.prepare("UPDATE pro_quotes SET status = ? WHERE id = ?").run(decision, quoteId);
  db.prepare(
    `INSERT INTO pro_quote_decisions (id, quote_id, actor_user_id, decision, is_override, reason_text)
     VALUES (?, ?, ?, ?, 0, NULL)`
  ).run(newId("qdec"), quoteId, userId, decision);
  audit(userId, "pro_quote", quoteId, decision);
  return { ok: true as const };
}

export function overrideQuote(userId: string, quoteId: string, reason: string) {
  if (!isAdmin(userId)) return { error: "not_found", status: 404 as const };
  if (!reason || reason.trim().length < 8) {
    return { error: "Motivul de override este obligatoriu.", status: 400 as const };
  }
  const quote = db.prepare("SELECT * FROM pro_quotes WHERE id = ?").get(quoteId) as
    | { id: string }
    | undefined;
  if (!quote) return { error: "not_found", status: 404 as const };
  db.prepare("UPDATE pro_quotes SET status = 'overridden' WHERE id = ?").run(quoteId);
  db.prepare(
    `INSERT INTO pro_quote_decisions (id, quote_id, actor_user_id, decision, is_override, reason_text)
     VALUES (?, ?, ?, 'overridden', 1, ?)`
  ).run(newId("qdec"), quoteId, userId, reason.trim());
  audit(userId, "pro_quote", quoteId, "overridden", { reason: reason.trim() });
  return { ok: true as const };
}
