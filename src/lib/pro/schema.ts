import type { Database } from "better-sqlite3";

/** Explicit migration only. Never execute DDL from a page or request. */
export const PRO_SCHEMA = `
CREATE TABLE pro_schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE pro_organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'onboarding' CHECK(status IN ('onboarding','active','paused','archived')),threshold INTEGER NOT NULL DEFAULT 0 CHECK(threshold>=0),separate_approver INTEGER NOT NULL DEFAULT 1,contract_ref TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE pro_members(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES pro_organizations(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','manager','approver','viewer','contact','operator')),scope_json TEXT NOT NULL DEFAULT '[]',active INTEGER NOT NULL DEFAULT 1,UNIQUE(organization_id,user_id,role));
CREATE TABLE pro_partners(id TEXT PRIMARY KEY,name TEXT NOT NULL,legal_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','active','suspended','inactive')),cities_json TEXT NOT NULL,services_json TEXT NOT NULL,verified_ref TEXT NOT NULL);
CREATE TABLE pro_partner_members(partner_id TEXT NOT NULL REFERENCES pro_partners(id),user_id TEXT NOT NULL REFERENCES users(id),active INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(partner_id,user_id));
CREATE TABLE pro_properties(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES pro_organizations(id),name TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,postal_code TEXT NOT NULL DEFAULT '',floor TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'apartment',timezone TEXT NOT NULL DEFAULT 'Europe/Bucharest',threshold INTEGER CHECK(threshold>=0),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),instructions TEXT NOT NULL DEFAULT '',UNIQUE(organization_id,id));
CREATE TABLE pro_work_orders(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES pro_organizations(id),property_id TEXT NOT NULL,title TEXT NOT NULL,service TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','scheduled','offered','accepted','in_progress','submitted_for_review','rework_requested','completed','cancelled')),starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,partner_id TEXT REFERENCES pro_partners(id),threshold_snapshot INTEGER NOT NULL,estimate INTEGER NOT NULL CHECK(estimate>=0),final_cost INTEGER CHECK(final_cost>=0),financial_status TEXT NOT NULL CHECK(financial_status IN ('pending','approved','not_required','rejected','changes_requested')),quote_version INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,checklist_json TEXT NOT NULL,answers_json TEXT NOT NULL DEFAULT '{}',review_note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(organization_id,id),FOREIGN KEY(organization_id,property_id) REFERENCES pro_properties(organization_id,id));
CREATE TABLE pro_offers(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,work_order_id TEXT NOT NULL,partner_id TEXT NOT NULL REFERENCES pro_partners(id),status TEXT NOT NULL CHECK(status IN ('offered','accepted','declined','expired','withdrawn')),expires_at TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(organization_id,work_order_id) REFERENCES pro_work_orders(organization_id,id));
CREATE UNIQUE INDEX pro_v11_one_offer ON pro_offers(work_order_id) WHERE status='offered';
CREATE TABLE pro_approvals(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,work_order_id TEXT NOT NULL,quote_version INTEGER NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'RON' CHECK(currency='RON'),requested_by TEXT NOT NULL,decision TEXT NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','rejected','changes_requested','superseded')),decided_by TEXT,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,decided_at TEXT,UNIQUE(work_order_id,quote_version),FOREIGN KEY(organization_id,work_order_id) REFERENCES pro_work_orders(organization_id,id));
CREATE TABLE pro_tickets(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,property_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,priority TEXT NOT NULL CHECK(priority IN ('normal','urgent','critical')),status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','awaiting_quote','awaiting_approval','approved','assigned','in_progress','resolved','closed','cancelled')),work_order_id TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(organization_id,id),FOREIGN KEY(organization_id,property_id) REFERENCES pro_properties(organization_id,id),FOREIGN KEY(organization_id,work_order_id) REFERENCES pro_work_orders(organization_id,id));
CREATE TABLE pro_media(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,work_order_id TEXT,ticket_id TEXT,category TEXT NOT NULL,filename TEXT NOT NULL UNIQUE,mime TEXT NOT NULL,bytes INTEGER NOT NULL,hash TEXT NOT NULL,author TEXT NOT NULL,created_at TEXT NOT NULL,CHECK((work_order_id IS NULL)!=(ticket_id IS NULL)),FOREIGN KEY(organization_id,work_order_id) REFERENCES pro_work_orders(organization_id,id),FOREIGN KEY(organization_id,ticket_id) REFERENCES pro_tickets(organization_id,id));
CREATE TABLE pro_cost_entries(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,property_id TEXT,work_order_id TEXT UNIQUE,category TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'RON' CHECK(currency='RON'),invoice_ref TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'validated' CHECK(status IN ('validated','invoiced_external','paid_external')),created_at TEXT NOT NULL,FOREIGN KEY(organization_id,property_id) REFERENCES pro_properties(organization_id,id),FOREIGN KEY(organization_id,work_order_id) REFERENCES pro_work_orders(organization_id,id));
CREATE TABLE pro_recurring_rules(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,property_id TEXT NOT NULL,title TEXT NOT NULL,service TEXT NOT NULL,frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly')),next_date TEXT NOT NULL,anchor_day INTEGER NOT NULL,hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),duration INTEGER NOT NULL CHECK(duration BETWEEN 15 AND 720),estimate INTEGER NOT NULL CHECK(estimate>=0),end_date TEXT,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,FOREIGN KEY(organization_id,property_id) REFERENCES pro_properties(organization_id,id));
CREATE TABLE pro_occurrences(rule_id TEXT NOT NULL REFERENCES pro_recurring_rules(id),day TEXT NOT NULL,work_order_id TEXT REFERENCES pro_work_orders(id),status TEXT NOT NULL CHECK(status IN ('generated','skipped','missed')),PRIMARY KEY(rule_id,day));
CREATE TABLE pro_invites(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES pro_organizations(id),email TEXT NOT NULL,role TEXT NOT NULL,scope_json TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used_at TEXT,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE pro_access_credentials(property_id TEXT PRIMARY KEY REFERENCES pro_properties(id),ciphertext TEXT NOT NULL,key_version TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE pro_audit_logs(id TEXT PRIMARY KEY,organization_id TEXT,actor TEXT NOT NULL,entity_id TEXT NOT NULL,action TEXT NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER pro_v11_audit_no_update BEFORE UPDATE ON pro_audit_logs BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
CREATE TRIGGER pro_v11_audit_no_delete BEFORE DELETE ON pro_audit_logs BEGIN SELECT RAISE(ABORT,'audit is append-only'); END;
CREATE TABLE pro_notifications(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,user_id TEXT NOT NULL,event_key TEXT NOT NULL,title TEXT NOT NULL,href TEXT NOT NULL,read_at TEXT,email_status TEXT NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','sending','sent','failed','disabled')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt TEXT NOT NULL,lease_until TEXT,created_at TEXT NOT NULL,UNIQUE(user_id,event_key));
CREATE TABLE pro_leads(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('client','partner')),name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,city TEXT NOT NULL,property_count INTEGER,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_review','qualified','rejected','converted')),note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
CREATE TABLE pro_idempotency(actor TEXT NOT NULL,key TEXT NOT NULL,request_hash TEXT NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(actor,key));
CREATE TABLE pro_rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX pro_v11_work_org ON pro_work_orders(organization_id,status,starts_at);
CREATE INDEX pro_v11_ticket_org ON pro_tickets(organization_id,status);
CREATE INDEX pro_v11_member_user ON pro_members(user_id,active);
CREATE INDEX pro_v11_audit_org ON pro_audit_logs(organization_id,created_at);
CREATE INDEX pro_v11_notification_user ON pro_notifications(user_id,read_at);
INSERT INTO pro_schema_migrations VALUES(11,datetime('now'));
`;
/** Additive migration: existing work snapshots and all marketplace data stay intact. */
export const PRO_CHECKLIST_SCHEMA = `
CREATE TABLE pro_property_checklists(
 property_id TEXT NOT NULL REFERENCES pro_properties(id),
 service TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 items_json TEXT NOT NULL,
 reason TEXT NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(property_id,service,revision)
);
CREATE TRIGGER pro_checklists_no_update BEFORE UPDATE ON pro_property_checklists BEGIN SELECT RAISE(ABORT,'checklists are append-only'); END;
CREATE TRIGGER pro_checklists_no_delete BEFORE DELETE ON pro_property_checklists BEGIN SELECT RAISE(ABORT,'checklists are append-only'); END;
INSERT INTO pro_schema_migrations VALUES(12,datetime('now'));
`;
function migrateChecklists(db: Database) {
  db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM pro_schema_migrations WHERE version=12").get())
      db.exec(PRO_CHECKLIST_SCHEMA);
  }).immediate();
}
export function migratePro(db: Database) {
  if (
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='pro_schema_migrations'",
      )
      .get()
  ) {
    if (
      !db.prepare("SELECT 1 FROM pro_schema_migrations WHERE version=11").get()
    )
      throw new Error(
        "Unsupported Pro schema version; explicit migration required",
      );
    migrateChecklists(db);
    return;
  }
  if (
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name LIKE 'pro_%'",
      )
      .get()
  ) {
    throw new Error(
      "Legacy Pro tables detected. Preserve a verified backup and reconcile their data before v1.1 migration. No table was deleted.",
    );
  }
  db.transaction(() => { db.exec(PRO_SCHEMA); db.exec(PRO_CHECKLIST_SCHEMA); }).immediate();
}
