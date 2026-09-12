import {EMAIL_VERIFICATION_SCHEMA} from "./emailVerification";
import { ASSESSMENT_SCHEMA } from "./assessments";
import { CATALOG_CAPACITY_SCHEMA } from "./catalogCapacity";
import { initializeCatalog } from "./serviceCatalog";
import { PRICING_SNAPSHOT_LOCK_SQL } from "./pricingSnapshot";
import { WORKSPACE_SCHEMA } from "@/lib/workspace";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { shouldSeedDemo } from "@/lib/authorization";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "nitido.db");

// Singleton connection (dev server hot-reloads reuse the same instance)
declare global {
  var __nitidoDb: Database.Database | undefined;
}

export const db: Database.Database = global.__nitidoDb ?? new Database(DB_PATH);
if (process.env.NODE_ENV !== "production") global.__nitidoDb = db;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Exportată separat ca teste (vitest) să poată crea o bază de date in-memory
// cu aceeași schemă, izolată de fișierul de date reale.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('client','firma')),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  referral_code TEXT,
  referred_by_code TEXT,
  credit_balance INTEGER NOT NULL DEFAULT 0,
  -- Nitido Office (Etapa 3, B2B): cont de business + date firmă pentru raport.
  is_business INTEGER NOT NULL DEFAULT 0,
  company_name TEXT,
  company_cui TEXT,
  company_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  cui TEXT,
  coverage_city TEXT NOT NULL,
  coverage_cities_extra TEXT,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  strikes_30d INTEGER NOT NULL DEFAULT 0,
  strikes_90d INTEGER NOT NULL DEFAULT 0,
  suspended_until TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  stripe_account_id TEXT,
  stripe_account_status TEXT NOT NULL DEFAULT 'not_started',
  stripe_transfers_capability TEXT NOT NULL DEFAULT 'inactive',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES users(id),
  street TEXT NOT NULL,
  postal_code TEXT,
  city TEXT NOT NULL,
  floor TEXT,
  details TEXT,
  client_request_id TEXT,
  sqm REAL NOT NULL,
  space_type TEXT NOT NULL CHECK (space_type IN ('apartament','casa','birou','altul')),
  when_type TEXT NOT NULL CHECK (when_type IN ('asap','scheduled')),
  scheduled_at TEXT,
  price_gross INTEGER NOT NULL,
  credit_applied INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 30,
  photos_count INTEGER NOT NULL DEFAULT 0,
  -- Modul de preluare al lucrării (repoziționare „Etapa 2"):
  --   'express'  = urgențe → prima firmă disponibilă preia direct (acceptJobAtomic)
  --   'standard' = restul pieței → firmele trimit ofertă, clientul alege pe calitate
  -- Implicit 'express' ca să NU schimbe comportamentul lucrărilor deja existente.
  mode TEXT NOT NULL DEFAULT 'express'
    CHECK (mode IN ('express','standard')),
  -- Nitido Guaranteed (Etapa 3): dacă lucrarea e o re-curățare gratuită în
  -- garanție, aici e id-ul lucrării originale pe care o repară.
  guarantee_of TEXT REFERENCES jobs(id),
  -- Express 60 (Pachet C): tier premium cu preluare garantată în 60 min.
  --   express_60           = 1 dacă lucrarea e Express 60 (retrogradat la 0 dacă garanția nu e respectată)
  --   express_60_fee       = suplimentul (lei) inclus în price_gross la postare
  --   express_60_deadline  = termenul garanției (postare + 60 min), ISO
  --   express_60_status    = 'pending' | 'met' | 'breached' (NULL dacă nu e Express 60)
  express_60 INTEGER NOT NULL DEFAULT 0,
  express_60_fee INTEGER NOT NULL DEFAULT 0,
  express_60_deadline TEXT,
  express_60_status TEXT,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','accepted','arrived','completed','cancelled','no_show')),
  accepted_firm_id TEXT REFERENCES firms(id),
  accepted_at TEXT,
  arrived_confirmed_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_photos (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  owner_user_id TEXT REFERENCES users(id),
  uploaded_by_firm_id TEXT REFERENCES firms(id),
  proof_type TEXT NOT NULL DEFAULT 'CLIENT_CONTEXT'
    CHECK (proof_type IN ('CLIENT_CONTEXT','ARRIVAL','COMPLETION')),
  -- Nitido Scan (Pachet C): eticheta încăperii pentru pozele de context ale
  -- clientului (bucatarie/baie/living/...). NULL = poză de context neetichetată
  -- sau dovadă de lucru (ARRIVAL/COMPLETION).
  context_label TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID','REJECTED','DELETED')),
  validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  client_id TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  punctuality INTEGER NOT NULL DEFAULT 0,
  quality INTEGER NOT NULL DEFAULT 0,
  communication INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  moderation_status TEXT NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published','under_review','hidden')),
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_one_per_job ON ratings(job_id);

CREATE TABLE IF NOT EXISTS review_reports (
  id TEXT PRIMARY KEY,
  rating_id TEXT NOT NULL REFERENCES ratings(id),
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (reason IN ('limbaj_abuziv','date_personale','spam','informatii_false','alt_motiv')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(rating_id, reported_by_user_id)
);

CREATE TABLE IF NOT EXISTS strikes (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  amount_gross INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  amount_net INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'authorized'
    CHECK (status IN ('authorized','captured','cancelled','refunded')),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_fee_amount INTEGER,
  transfer_status TEXT NOT NULL DEFAULT 'not_started',
  stripe_transfer_id TEXT,
  payout_status TEXT NOT NULL DEFAULT 'unknown',
  refund_status TEXT NOT NULL DEFAULT 'none',
  dispute_status TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_authorization_attempts (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id),
 request_json TEXT NOT NULL,
 provider_key_hash TEXT NOT NULL,
 created_ms INTEGER NOT NULL,
 stripe_payment_intent_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS stripe_bank_payouts (
 account_id TEXT NOT NULL,
 payout_id TEXT NOT NULL,
 amount_minor INTEGER NOT NULL,
 currency TEXT NOT NULL,
 status TEXT NOT NULL,
 arrival_date INTEGER NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(account_id,payout_id)
);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount INTEGER NOT NULL,
  stripe_refund_id TEXT,
  stripe_reversal_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  firm_id TEXT REFERENCES firms(id),
  user_id TEXT REFERENCES users(id),
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_job ON workflow_audit_log(job_id, created_at);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('JOB_CREATED_FIRM_ALERT','JOB_ACCEPTED_CLIENT_CONFIRMATION','JOB_ARRIVED_CLIENT_NOTIFICATION')),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel = 'sms'),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status, created_at);

CREATE TABLE IF NOT EXISTS push_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL CHECK (platform IN ('IOS','ANDROID')),
  device_token TEXT NOT NULL UNIQUE,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id,push_enabled,revoked_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  new_job_alerts INTEGER NOT NULL DEFAULT 1,
  job_status_notifications INTEGER NOT NULL DEFAULT 1,
  arrival_notifications INTEGER NOT NULL DEFAULT 1,
  completion_notifications INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_notification_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('JOB_CREATED_FIRM_PUSH','JOB_ACCEPTED_CLIENT_PUSH','JOB_ARRIVED_CLIENT_PUSH','JOB_COMPLETED_CLIENT_PUSH')),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  recipient_user_id TEXT NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL DEFAULT 'push' CHECK (channel='push'),
  device_token_id TEXT REFERENCES push_devices(id),
  title TEXT NOT NULL,
  message_body TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_outbox_status ON push_notification_outbox(status,created_at);

CREATE TABLE IF NOT EXISTS job_live_locations (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_live_locations_firm ON job_live_locations(firm_id,updated_at);

-- Oferte pentru lucrările în mod 'standard' (repoziționare „Etapa 2"):
-- fiecare firmă verificată din zonă poate trimite O SINGURĂ ofertă per lucrare;
-- clientul vede ofertele (cu semnalele de calitate) și alege una. Prețul rămâne
-- fix (calcGrossPrice) — oferta e interes + mesaj, nu negociere de preț.
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_per_firm_job ON offers(job_id, firm_id);
CREATE INDEX IF NOT EXISTS idx_offers_job ON offers(job_id, status);

-- Nitido Repeat (Etapa 3): abonamente recurente — aceeași echipă, la interval fix.
-- Planul păstrează șablonul lucrării; sistemul generează automat următoarea
-- lucrare când e scadentă (next_run_date) și o alocă firmei preferate.
CREATE TABLE IF NOT EXISTS recurring_plans (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES users(id),
  preferred_firm_id TEXT REFERENCES firms(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')),
  street TEXT NOT NULL,
  postal_code TEXT,
  city TEXT NOT NULL,
  floor TEXT,
  sqm REAL NOT NULL,
  space_type TEXT NOT NULL CHECK (space_type IN ('apartament','casa','birou','altul')),
  hour INTEGER NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  next_run_date TEXT NOT NULL,
  anchor_day INTEGER,
  last_job_id TEXT REFERENCES jobs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_plans(status, next_run_date);
CREATE INDEX IF NOT EXISTS idx_recurring_client ON recurring_plans(client_id, status);

-- Evidența vizitelor generate; o dată din serie poate crea o singură lucrare.
CREATE TABLE IF NOT EXISTS recurring_occurrences (
  plan_id TEXT NOT NULL REFERENCES recurring_plans(id),
  occurrence_date TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id),
  scheduled_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(plan_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrence_date ON recurring_occurrences(occurrence_date DESC);


-- Opțiunile din ESTIMATOR LIVE, gestionate de admin (ce tipuri vede clientul).
-- Cheia e limitată la tipurile cu tarif oficial; adminul schimbă doar
-- eticheta / vizibilitatea / ordinea.
CREATE TABLE IF NOT EXISTS estimator_options (
  key TEXT PRIMARY KEY CHECK (key IN ('apartament','casa','birou','altul')),
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`;

db.exec(SCHEMA_SQL);
db.exec(WORKSPACE_SCHEMA);
initializeCatalog(db);
db.exec(CATALOG_CAPACITY_SCHEMA);
db.exec(ASSESSMENT_SCHEMA);
db.exec(EMAIL_VERIFICATION_SCHEMA);

// Migrare simplă pentru coloane noi adăugate DUPĂ ce baza de date există deja
// în producție — `CREATE TABLE IF NOT EXISTS` de mai sus nu face nimic pe un
// fișier existent, deci orice coloană nouă trebuie adăugată explicit aici,
// o singură dată (verificăm întâi dacă lipsește).
function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("firms", "coverage_cities_extra", "TEXT");
ensureColumn("firms", "stripe_account_status", "TEXT NOT NULL DEFAULT 'not_started'");
ensureColumn("firms", "stripe_transfers_capability", "TEXT NOT NULL DEFAULT 'inactive'");
ensureColumn("firms", "description", "TEXT");
ensureColumn("firms", "working_hours", "TEXT");
ensureColumn("firms", "services", "TEXT");
ensureColumn("firms", "website", "TEXT");
ensureColumn("users", "referral_code", "TEXT");
ensureColumn("users", "referred_by_code", "TEXT");
ensureColumn("users", "credit_balance", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "stripe_customer_id", "TEXT");
ensureColumn("users", "stripe_payment_method_id", "TEXT");
// Etapa 3 — Nitido Office (cont business + date firmă pentru facturare/raport).
ensureColumn("users", "is_business", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "company_name", "TEXT");
ensureColumn("users", "company_cui", "TEXT");
ensureColumn("users", "company_address", "TEXT");
ensureColumn("jobs", "credit_applied", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("jobs", "details", "TEXT");
ensureColumn("jobs", "pricing_snapshot", "TEXT");
// Published pricing is an audit record, separate from later refunds/adjustments.
db.exec(PRICING_SNAPSHOT_LOCK_SQL);
ensureColumn("jobs", "client_request_id", "TEXT");
// Etapa 2 — modul de preluare (implicit 'express' pentru lucrările existente,
// ca să nu se schimbe comportamentul actual). CHECK-ul e aplicat doar pe baze
// noi (via SCHEMA_SQL); pe cele existente rămâne o coloană TEXT simplă cu default.
ensureColumn("jobs", "mode", "TEXT NOT NULL DEFAULT 'express'");
// Etapa 3 — legătura de garanție (re-curățare gratuită).
ensureColumn("jobs", "guarantee_of", "TEXT REFERENCES jobs(id)");
// Express 60 (Pachet C) — tier premium cu preluare garantată în 60 min.
ensureColumn("jobs", "express_60", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("jobs", "express_60_fee", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("jobs", "express_60_deadline", "TEXT");
ensureColumn("jobs", "express_60_status", "TEXT");
ensureColumn("job_photos", "owner_user_id", "TEXT REFERENCES users(id)");
ensureColumn("job_photos", "uploaded_by_firm_id", "TEXT REFERENCES firms(id)");
ensureColumn("job_photos", "proof_type", "TEXT NOT NULL DEFAULT 'CLIENT_CONTEXT'");
ensureColumn("job_photos", "mime_type", "TEXT");
ensureColumn("job_photos", "file_size", "INTEGER");
ensureColumn("job_photos", "status", "TEXT NOT NULL DEFAULT 'VALID'");
ensureColumn("job_photos", "validated_at", "TEXT");
// Nitido Scan (Pachet C) — eticheta încăperii pentru pozele de context.
ensureColumn("job_photos", "context_label", "TEXT");
ensureColumn("ratings", "status", "TEXT NOT NULL DEFAULT 'active'");
ensureColumn("ratings", "moderation_status", "TEXT NOT NULL DEFAULT 'published'");
ensureColumn("ratings", "updated_at", "TEXT");
ensureColumn("payments", "stripe_charge_id", "TEXT");
ensureColumn("payments", "stripe_fee_amount", "INTEGER");
ensureColumn("payments", "transfer_status", "TEXT NOT NULL DEFAULT 'not_started'");
ensureColumn("payments", "stripe_transfer_id", "TEXT");
ensureColumn("payments", "payout_status", "TEXT NOT NULL DEFAULT 'unknown'");
ensureColumn("payments", "refund_status", "TEXT NOT NULL DEFAULT 'none'");
ensureColumn("recurring_plans", "anchor_day", "INTEGER");
ensureColumn("workspace_properties", "budget_enforced", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("workspace_approvals", "snapshot_street", "TEXT NOT NULL DEFAULT ''");
ensureColumn("workspace_approvals", "snapshot_city", "TEXT NOT NULL DEFAULT ''");
db.exec("UPDATE recurring_plans SET anchor_day=CAST(substr(next_run_date,9,2) AS INTEGER) WHERE anchor_day IS NULL");
ensureColumn("payments", "dispute_status", "TEXT NOT NULL DEFAULT 'none'");
db.exec("CREATE INDEX IF NOT EXISTS idx_job_photos_proof ON job_photos(job_id, uploaded_by_firm_id, proof_type, status)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_one_per_job ON ratings(job_id)");

// Seed ESTIMATOR LIVE (opțiunile implicite) — doar dacă tabelul e gol.
if ((db.prepare("SELECT COUNT(*) c FROM estimator_options").get() as { c: number }).c === 0) {
  const seedEstimator = db.prepare("INSERT INTO estimator_options (key, label, enabled, sort_order) VALUES (?, ?, 1, ?)");
  ([["apartament", "Apartament"], ["casa", "Casă / Vilă"], ["birou", "Birou"], ["altul", "Altul"]] as const)
    .forEach(([key, label], i) => seedEstimator.run(key, label, i));
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_client_request ON jobs(client_id, client_request_id) WHERE client_request_id IS NOT NULL");

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// --- Seed date demo (idempotent) ---------------------------------------
// 1 client demo + 3 firme demo în Constanța, ca fluxurile client/firmă să
// poată fi testate real (inclusiv mecanismul de "primul care apasă câștigă")
// fără un sistem de autentificare complet, care nu face parte din acest MVP.
const seedCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
const demoSeedEnabled = shouldSeedDemo(process.env.NODE_ENV, process.env.NITIDO_SEED_DEMO);
if (demoSeedEnabled && seedCount.c === 0) {
  const insertUser = db.prepare(
    "INSERT INTO users (id, role, name, email, phone) VALUES (?, ?, ?, ?, ?)"
  );
  const insertFirm = db.prepare(
    "INSERT INTO firms (id, user_id, cui, coverage_city, verified) VALUES (?, ?, ?, ?, 1)"
  );

  const clientId = "user_demo_client";
  insertUser.run(clientId, "client", "Nelu (demo client)", "demo-client@nitido.ro", "0722000000");

  const firmsSeed = [
    { name: "CleanPro SRL", cui: "RO11111111", city: "Constanța" },
    { name: "Sparkle Home", cui: "RO22222222", city: "Constanța" },
    { name: "Curat Total", cui: "RO33333333", city: "Constanța" },
  ];
  for (const f of firmsSeed) {
    const userId = newId("user");
    const firmId = newId("firm");
    insertUser.run(userId, "firma", f.name, null, null);
    insertFirm.run(firmId, userId, f.cui, f.city);
  }
}

export function getDemoClientId(): string {
  return "user_demo_client";
}

export function listFirms(): { id: string; name: string; coverage_city: string }[] {
  return db
    .prepare(
      `SELECT firms.id as id, users.name as name, firms.coverage_city as coverage_city
       FROM firms JOIN users ON users.id = firms.user_id
       ORDER BY users.name`
    )
    .all() as { id: string; name: string; coverage_city: string }[];
}

/**
 * Firmele eligibile pentru alerta de "lucrare nouă" (SMS) — verificate, cu
 * telefon salvat, neridicate din activitate (suspendare temporară/strike-uri).
 * Potrivirea de oraș se face în JS de către apelant, cu normalizeCity — vezi
 * src/lib/text.ts.
 */
export function listAlertableFirms(): {
  id: string;
  coverage_city: string;
  coverage_cities_extra: string | null;
  phone: string | null;
  suspended_until: string | null;
}[] {
  return db
    .prepare(
      `SELECT firms.id as id, firms.coverage_city as coverage_city,
              firms.coverage_cities_extra as coverage_cities_extra, users.phone as phone,
              firms.suspended_until as suspended_until
       FROM firms JOIN users ON users.id = firms.user_id
       WHERE firms.verified = 1`
    )
    .all() as {
    id: string;
    coverage_city: string;
    coverage_cities_extra: string | null;
    phone: string | null;
    suspended_until: string | null;
  }[];
}

export interface UserRow {
  id: string;
  role: "client" | "firma";
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  referral_code: string | null;
  referred_by_code: string | null;
  credit_balance: number;
  created_at: string;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function getUserByReferralCode(code: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE referral_code = ?").get(code) as
    | UserRow
    | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getFirmByUserId(
  userId: string
): { id: string; coverage_city: string; coverage_cities_extra: string | null; verified:number; stripe_account_status:string; stripe_transfers_capability:string; description:string|null; working_hours:string|null; services:string|null; website:string|null } | undefined {
  return db
    .prepare("SELECT id, coverage_city, coverage_cities_extra, verified, stripe_account_status, stripe_transfers_capability, description, working_hours, services, website FROM firms WHERE user_id = ?")
    .get(userId) as
    | { id: string; coverage_city: string; coverage_cities_extra: string | null; verified:number; stripe_account_status:string; stripe_transfers_capability:string; description:string|null; working_hours:string|null; services:string|null; website:string|null }
    | undefined;
}

export function getFirmById(
  firmId: string
): { id: string; coverage_city: string; coverage_cities_extra: string | null } | undefined {
  return db
    .prepare("SELECT id, coverage_city, coverage_cities_extra FROM firms WHERE id = ?")
    .get(firmId) as
    | { id: string; coverage_city: string; coverage_cities_extra: string | null }
    | undefined;
}
