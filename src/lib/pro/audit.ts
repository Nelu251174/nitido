import { db, newId } from "@/lib/db";
export function audit(actorUserId: string | null, entityType: string, entityId: string, action: string, metadata?: Record<string, unknown>) {
  db.prepare(`INSERT INTO pro_audit_events (id, actor_user_id, entity_type, entity_id, action, metadata_json) VALUES (?, ?, ?, ?, ?, ?)`).run(newId("aud"), actorUserId, entityType, entityId, action, metadata ? JSON.stringify(metadata) : null);
}
