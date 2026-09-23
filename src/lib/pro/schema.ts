import { db } from "@/lib/db";

const PRO_SCHEMA = `
CREATE TABLE IF NOT EXISTS pro_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pilot'
    CHECK (status IN ('pilot','paused','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_partners (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  display_name TEXT NOT NULL,
  service_types TEXT NOT NULL,
  coverage_areas TEXT NOT NULL,
  availability_notes TEXT,
  experience_notes TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  capacity_notes TEXT,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','active','suspended','rejected')),
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  organization_id TEXT REFERENCES pro_organizations(id),
  partner_id TEXT REFERENCES pro_partners(id),
  role TEXT NOT NULL CHECK (role IN ('owner_client','partner','nitido_admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_leads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('client','partner')),
  payload_json TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_review','qualified','rejected')),
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_properties (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES pro_organizations(id),
  label TEXT NOT NULL,
  property_type TEXT,
  city TEXT NOT NULL,
  zone TEXT,
  address_line TEXT NOT NULL,
  access_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_recurring_services (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES pro_properties(id),
  service_type TEXT NOT NULL
    CHECK (service_type IN ('curatenie_recurenta','verificare','mentenanta_usoara','interventie')),
  frequency TEXT,
  scope_text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES pro_organizations(id),
  property_id TEXT NOT NULL REFERENCES pro_properties(id),
  recurring_service_id TEXT REFERENCES pro_recurring_services(id),
  service_type TEXT NOT NULL
    CHECK (service_type IN ('curatenie_recurenta','verificare','mentenanta_usoara','interventie')),
  title TEXT NOT NULL,
  scope_text TEXT NOT NULL,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'noua'
    CHECK (status IN (
      'noua','in_evaluare','planificata','alocata','acceptata',
      'in_desfasurare','raportata','necesita_clarificare',
      'aprobata','inchisa','anulata'
    )),
  assigned_partner_id TEXT REFERENCES pro_partners(id),
  created_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_assignments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES pro_jobs(id),
  partner_id TEXT NOT NULL REFERENCES pro_partners(id),
  state TEXT NOT NULL DEFAULT 'offered'
    CHECK (state IN ('offered','accepted','declined','cancelled')),
  offered_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  decided_by_user_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pro_job_status_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES pro_jobs(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_reports (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES pro_jobs(id),
  author_partner_id TEXT NOT NULL REFERENCES pro_partners(id),
  activities_text TEXT NOT NULL,
  observations_text TEXT,
  issues_text TEXT,
  extra_cost_proposed INTEGER,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_report_addenda (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES pro_reports(id),
  author_user_id TEXT REFERENCES users(id),
  body_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_quotes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES pro_jobs(id),
  partner_id TEXT NOT NULL REFERENCES pro_partners(id),
  amount_bani INTEGER NOT NULL,
  reason_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','overridden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_quote_decisions (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES pro_quotes(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','overridden')),
  is_override INTEGER NOT NULL DEFAULT 0,
  reason_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_invoice_refs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES pro_organizations(id),
  job_id TEXT REFERENCES pro_jobs(id),
  reference_code TEXT NOT NULL,
  amount_bani INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'to_invoice'
    CHECK (status IN ('to_invoice','invoiced_external','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_partner_reviews_internal (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES pro_partners(id),
  job_id TEXT NOT NULL REFERENCES pro_jobs(id),
  punctuality INTEGER,
  reporting_quality INTEGER,
  procedure_compliance INTEGER,
  notes TEXT,
  author_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pro_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pro_memberships_user ON pro_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_org ON pro_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_partner ON pro_jobs(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_pro_assignments_partner ON pro_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_pro_audit_entity ON pro_audit_events(entity_type, entity_id);
`;

export function initProSchema() {
  db.exec(PRO_SCHEMA);
}

initProSchema();
