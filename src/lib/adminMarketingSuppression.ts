import type { Database } from 'better-sqlite3';
import { createHash } from 'node:crypto';
export const suppressionSchema = `CREATE TABLE IF NOT EXISTS marketing_suppressions(email_hash TEXT PRIMARY KEY,reason TEXT NOT NULL,created_at TEXT NOT NULL);`;
export const emailHash = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export function suppressMarketingEmail(db: Database, email: string, reason: string) {
  if (!email) return;
  db.exec(suppressionSchema);
  db.prepare("INSERT INTO marketing_suppressions VALUES(?,?,?) ON CONFLICT(email_hash) DO UPDATE SET reason=CASE WHEN reason='complained' OR excluded.reason='complained' THEN 'complained' WHEN reason='bounced' OR excluded.reason='bounced' THEN 'bounced' ELSE reason END").run(emailHash(email), reason, new Date().toISOString());
}
export function marketingEmailSuppressed(db: Database, email: string) {
  db.exec(suppressionSchema);
  return !!db.prepare('SELECT 1 FROM marketing_suppressions WHERE email_hash=?').get(emailHash(email));
}
