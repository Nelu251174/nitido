import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { MARKETING_CATEGORIES, MARKETING_CONSENTS, MARKETING_STATUSES, type MarketingInput, type MarketingCategory, type MarketingContact, type MarketingList } from './adminMarketingShared';

// Stage one is available only on the named sandbox or an explicit local development origin.
// A request's Host/Origin headers can never enable the module in production.
export function marketingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL ?? '');
    if (url.username || url.password) return false;
    return url.origin === 'https://sandbox.nitido.ro' ||
      (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch { return false; }
}

export class MarketingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const MARKETING_SCHEMA = `
CREATE TABLE IF NOT EXISTS marketing_contacts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('business','cleaning','individual')),
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', city TEXT NOT NULL,
 city_key TEXT NOT NULL, search_key TEXT NOT NULL,
 cui TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', source TEXT NOT NULL,
 consent TEXT NOT NULL CHECK(consent IN ('not_recorded','granted','withdrawn')),
 consent_evidence TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewed','do_not_contact')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_email ON marketing_contacts(category,email) WHERE email<>'';
CREATE UNIQUE INDEX IF NOT EXISTS marketing_cui ON marketing_contacts(category,cui) WHERE cui<>'';
CREATE INDEX IF NOT EXISTS marketing_city ON marketing_contacts(category,city_key);
`;

export function initializeMarketing(db: Database.Database) {
  db.exec(MARKETING_SCHEMA);
}
export function marketingKey(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ş/g, 's').replace(/ţ/g, 't').toLowerCase().trim();
}
function field(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new MarketingError(`${label}: valoare invalidă.`);
  const text = value.trim();
  if ((required && !text) || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new MarketingError(`${label}: valoare lipsă sau prea lungă.`);
  return text;
}
export function normalizeMarketingInput(value: unknown): MarketingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MarketingError('Contact invalid.');
  const b = value as Record<string, unknown>;
  if (!Object.hasOwn(MARKETING_CATEGORIES, String(b.category))) throw new MarketingError('Categorie invalidă.');
  const category = b.category as MarketingCategory;
  const name = field(b.name, 'Nume', 180, true), city = field(b.city, 'Localitate', 100, true);
  const email = field(b.email, 'Email', 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MarketingError('Adresă de email invalidă.');
  const cuiRaw = field(b.cui, 'CUI', 20).toUpperCase().replace(/^RO\s*/, '');
  if (cuiRaw && !/^\d{2,10}$/.test(cuiRaw)) throw new MarketingError('CUI invalid.');
  const cui = category === 'individual' ? '' : cuiRaw;
  if (!email && !cui) throw new MarketingError('Completează un email sau CUI pentru identificarea contactului.');
  let website = field(b.website, 'Website', 500);
  if (website) {
    try { const url = new URL(website); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error(); website = url.href; }
    catch { throw new MarketingError('Website-ul trebuie să fie o adresă HTTP sau HTTPS.'); }
  }
  const consent = b.consent ?? 'not_recorded';
  if (typeof consent !== 'string' || !Object.hasOwn(MARKETING_CONSENTS, consent)) throw new MarketingError('Stare acord invalidă.');
  const consentEvidence = field(b.consentEvidence, 'Dovadă acord', 1000);
  if (consent === 'granted' && !consentEvidence) throw new MarketingError('Acordul necesită o dovadă (sursă și dată).');
  if (category === 'individual' && (consent !== 'granted' || !consentEvidence)) throw new MarketingError('Persoanele fizice se adaugă numai cu dovada acordului de marketing.');
  return { name, category, city, email, cui, website, source: field(b.source, 'Sursă', 500, true), consent: consent as MarketingInput['consent'], consentEvidence, phone: field(b.phone, 'Telefon', 50), notes: field(b.notes, 'Observații', 2000) };
}

const select = `SELECT id,name,category,email,phone,city,cui,website,source,consent,consent_evidence AS consentEvidence,notes,status,version,created_at AS createdAt FROM marketing_contacts`;
export function saveMarketingContacts(db: Database.Database, values: unknown[], actor: string) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 200) throw new MarketingError('Salvează între 1 și 200 de contacte.');
  const rows = values.map(normalizeMarketingInput); // Validate the whole batch before writing anything.
  initializeMarketing(db);
  return db.transaction(() => {
    let created = 0;
    const insert = db.prepare(`INSERT OR IGNORE INTO marketing_contacts
      (id,name,category,email,phone,city,city_key,search_key,cui,website,source,consent,consent_evidence,notes,status,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const row of rows) {
      const now = new Date().toISOString();
      created += insert.run(randomUUID(), row.name, row.category, row.email, row.phone, row.city, marketingKey(row.city), marketingKey(`${row.name} ${row.email} ${row.cui}`), row.cui, row.website, row.source, row.consent, row.consentEvidence, row.notes, row.consent === 'withdrawn' ? 'do_not_contact' : 'new', actor, now, now).changes;
    }
    return { created, duplicates: rows.length - created };
  })();
}

export function updateMarketingContact(db: Database.Database, value: unknown) {
  if (!value || typeof value !== 'object') throw new MarketingError('Contact invalid.');
  const b = value as Record<string, unknown>;
  const id = field(b.id, 'Identificator', 80, true);
  if (!Number.isInteger(b.version) || typeof b.status !== 'string' || !Object.hasOwn(MARKETING_STATUSES, b.status) || typeof b.consent !== 'string' || !Object.hasOwn(MARKETING_CONSENTS, b.consent)) throw new MarketingError('Stare sau versiune invalidă.');
  const evidence = field(b.consentEvidence, 'Dovadă acord', 1000), notes = field(b.notes, 'Observații', 2000);
  if (b.consent === 'granted' && !evidence) throw new MarketingError('Acordul necesită o dovadă (sursă și dată).');
  initializeMarketing(db);
  const status = b.consent === 'withdrawn' ? 'do_not_contact' : b.status;
  const changed = db.prepare(`UPDATE marketing_contacts SET status=?,consent=?,consent_evidence=?,notes=?,version=version+1,updated_at=? WHERE id=? AND version=?`)
    .run(status, b.consent, evidence, notes, new Date().toISOString(), id, b.version).changes;
  if (!changed) throw new MarketingError('Contactul a fost modificat sau nu mai există. Reîncarcă lista.', 409);
  return { id };
}

function filters(params: URLSearchParams) {
  const clauses: string[] = [], values: string[] = [];
  const category = params.get('category'), status = params.get('status');
  if (category) { if (!Object.hasOwn(MARKETING_CATEGORIES, category)) throw new MarketingError('Categorie invalidă.'); clauses.push('category=?'); values.push(category); }
  if (status) { if (!Object.hasOwn(MARKETING_STATUSES, status)) throw new MarketingError('Stare invalidă.'); clauses.push('status=?'); values.push(status); }
  const city = field(params.get('city'), 'Localitate', 100), search = field(params.get('search'), 'Căutare', 180);
  if (city) { clauses.push('city_key=?'); values.push(marketingKey(city)); }
  if (search) { clauses.push("search_key LIKE ? ESCAPE '\\'"); values.push(`%${marketingKey(search).replace(/[\\%_]/g, '\\$&')}%`); }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}
export function listMarketingContacts(db: Database.Database, params: URLSearchParams): MarketingList {
  const { where, values } = filters(params);
  const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
  if (!Number.isInteger(page)) throw new MarketingError('Pagină invalidă.');
  initializeMarketing(db);
  const counts = { business: 0, cleaning: 0, individual: 0 };
  for (const row of db.prepare('SELECT category,COUNT(*) total FROM marketing_contacts GROUP BY category').all() as { category: MarketingCategory; total: number }[]) counts[row.category] = row.total;
  return {
    contacts: db.prepare(select + where + ' ORDER BY created_at DESC,id LIMIT 25 OFFSET ?').all(...values, (page - 1) * 25) as MarketingContact[],
    total: (db.prepare('SELECT COUNT(*) total FROM marketing_contacts' + where).get(...values) as { total: number }).total, page, counts,
  };
}

function csvCell(value: string) {
  // Spreadsheet formula injection also applies after leading whitespace.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function exportMarketingCsv(db: Database.Database, params: URLSearchParams): string {
  const { where, values } = filters(params); initializeMarketing(db);
  const rows = db.prepare(select + where + ' ORDER BY created_at DESC,id LIMIT 5001').all(...values) as MarketingContact[];
  if (rows.length > 5000) throw new MarketingError('Exportul depășește 5.000 de contacte. Restrânge filtrele.');
  const keys: (keyof MarketingInput | 'status')[] = ['name', 'category', 'email', 'phone', 'city', 'cui', 'website', 'source', 'consent', 'consentEvidence', 'notes', 'status'];
  return '\uFEFF' + [keys.join(','), ...rows.map(row => keys.map(key => csvCell(row[key])).join(','))].join('\r\n');
}

/** RFC 4180 quoting, including newlines; comma or semicolon delimiter. */
export function parseMarketingCsv(csv: unknown): MarketingInput[] {
  if (typeof csv !== 'string' || !csv.trim() || Buffer.byteLength(csv, 'utf8') > 250000) throw new MarketingError('CSV lipsă sau mai mare de 250 KB.');
  const text = csv.replace(/^\uFEFF/, ''), firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += ch; continue; }
    if (ch === '"') { if (cell || closed) throw new MarketingError('Ghilimele CSV invalide.'); quoted = true; }
    else if (ch === delimiter) { row.push(cell); cell = ''; closed = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; closed = false;
      if (rows.length > 201) throw new MarketingError('Maximum 200 de contacte per import.');
    } else { if (closed) throw new MarketingError('Conținut după ghilimele CSV.'); cell += ch; }
  }
  if (quoted) throw new MarketingError('Ghilimele CSV neînchise.');
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > 201) throw new MarketingError('CSV trebuie să conțină antet și 1–200 de contacte.');
  const headers = rows.shift()!.map(x => x.trim());
  const allowed = ['name', 'category', 'email', 'phone', 'city', 'cui', 'website', 'source', 'consent', 'consentEvidence', 'notes', 'status'];
  if (new Set(headers).size !== headers.length || headers.some(x => !allowed.includes(x)) || !['name', 'category', 'city', 'source'].every(x => headers.includes(x))) throw new MarketingError('Antet CSV invalid. Sunt necesare name, category, city și source.');
  return rows.map((cells, i) => {
    if (cells.length !== headers.length) throw new MarketingError(`Rândul ${i + 2}: număr incorect de coloane.`);
    try {
      const input = Object.fromEntries(headers.map((key, n) => [key, cells[n]]));
      // Preserve an exported suppression when importing into another test database.
      if (input.status === 'do_not_contact') input.consent = 'withdrawn';
      else if (input.status && !['new', 'reviewed'].includes(input.status)) throw new MarketingError('Stare invalidă.');
      return normalizeMarketingInput(input);
    }
    catch (e) { if (e instanceof MarketingError) throw new MarketingError(`Rândul ${i + 2}: ${e.message}`); throw e; }
  });
}
