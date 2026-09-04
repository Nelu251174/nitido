import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "nitido.db");

// Singleton connection (dev server hot-reloads reuse the same instance)
declare global {
  // eslint-disable-next-line no-var
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES users(id),
  street TEXT NOT NULL,
  postal_code TEXT,
  city TEXT NOT NULL,
  floor TEXT,
  sqm REAL NOT NULL,
  space_type TEXT NOT NULL CHECK (space_type IN ('apartament','casa','birou','altul')),
  when_type TEXT NOT NULL CHECK (when_type IN ('asap','scheduled')),
  scheduled_at TEXT,
  price_gross INTEGER NOT NULL,
  credit_applied INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 30,
  photos_count INTEGER NOT NULL DEFAULT 0,
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
  filename TEXT NOT NULL,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(SCHEMA_SQL);

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
ensureColumn("users", "referral_code", "TEXT");
ensureColumn("users", "referred_by_code", "TEXT");
ensureColumn("users", "credit_balance", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("jobs", "credit_applied", "INTEGER NOT NULL DEFAULT 0");

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// --- Seed date demo (idempotent) ---------------------------------------
// 1 client demo + 3 firme demo în Constanța, ca fluxurile client/firmă să
// poată fi testate real (inclusiv mecanismul de "primul care apasă câștigă")
// fără un sistem de autentificare complet, care nu face parte din acest MVP.
const seedCount = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
if (seedCount.c === 0) {
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
): {
  id: string;
  coverage_city: string;
  coverage_cities_extra: string | null;
  stripe_account_id: string | null;
} | undefined {
  return db
    .prepare(
      "SELECT id, coverage_city, coverage_cities_extra, stripe_account_id FROM firms WHERE user_id = ?"
    )
    .get(userId) as
    | {
        id: string;
        coverage_city: string;
        coverage_cities_extra: string | null;
        stripe_account_id: string | null;
      }
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
