import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { exportMarketingCsv, initializeMarketing, listMarketingContacts, marketingEnabled, normalizeMarketingInput, parseMarketingCsv, saveMarketingContacts, updateMarketingContact } from './adminMarketing';

let db: Database.Database;
const contact = (extra = {}) => ({ name: 'Firma test', category: 'business', email: 'contact@example.test', city: 'Constanța', source: 'Fișier sintetic', ...extra });
beforeEach(() => { db = new Database(':memory:'); });
afterEach(() => db.close());
describe('Marketing test isolation', () => {
  it('enables only the sandbox and explicit local development, never a live or missing URL', () => {
    for (const url of ['', 'https://nitido.ro', 'https://sandbox.nitido.ro.evil.test', 'http://sandbox.nitido.ro', 'https://user:pass@sandbox.nitido.ro', 'http://localhost:3000']) expect(marketingEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: url })).toBe(false);
    expect(marketingEnabled({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://sandbox.nitido.ro' })).toBe(true);
    expect(marketingEnabled({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })).toBe(true);
  });
  it('creates only additive marketing tables and preserves existing data', () => {
    db.exec("CREATE TABLE jobs(id TEXT, value TEXT); INSERT INTO jobs VALUES('existing','preserve');");
    initializeMarketing(db); initializeMarketing(db); saveMarketingContacts(db, [contact()], 'admin');
    expect(db.prepare('SELECT * FROM jobs').all()).toEqual([{ id: 'existing', value: 'preserve' }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()).toEqual([{ name: 'jobs' }, { name: 'marketing_contacts' }, { name: 'marketing_suppressions' }]);
  });
});
describe('contact integrity', () => {
  it('normalizes email/CUI and requires a marketing consent record for individuals', () => {
    expect(normalizeMarketingInput(contact({ email: ' A@Example.test ', cui: 'RO123456' }))).toMatchObject({ email: 'a@example.test', cui: '123456' });
    expect(() => normalizeMarketingInput(contact({ category: 'individual' }))).toThrow('dovada acordului');
    expect(() => normalizeMarketingInput(contact({ category: 'individual', consent: 'granted' }))).toThrow('dovadă');
    expect(normalizeMarketingInput(contact({ category: 'individual', consent: 'granted', consentEvidence: 'Formular sintetic 2026-10-24' })).consent).toBe('granted');
  });
  it('rejects malformed identities, categories, URLs and source-less contacts', () => {
    for (const patch of [{ category: 'unknown' }, { category: '__proto__' }, { email: 'bad' }, { email: '', cui: '' }, { cui: '123script' }, { website: 'javascript:alert(1)' }, { website: 'https://u:p@example.test' }, { source: '' }]) expect(() => normalizeMarketingInput(contact(patch))).toThrow();
  });
  it('validates an entire batch before persisting any rows', () => {
    initializeMarketing(db);
    expect(() => saveMarketingContacts(db, [contact(), contact({ name: '' })], 'admin')).toThrow();
    expect(listMarketingContacts(db, new URLSearchParams()).total).toBe(0);
  });
  it('deduplicates by normalized email and CUI while preserving withdrawal and version', () => {
    expect(saveMarketingContacts(db, [contact({ cui: '123456' })], 'admin')).toEqual({ created: 1, duplicates: 0 });
    const original = listMarketingContacts(db, new URLSearchParams()).contacts[0];
    updateMarketingContact(db, { ...original, consent: 'withdrawn' });
    expect(saveMarketingContacts(db, [contact({ email: 'CONTACT@EXAMPLE.TEST' }), contact({ email: 'other@example.test', cui: '123456' })], 'admin')).toEqual({ created: 0, duplicates: 2 });
    expect(listMarketingContacts(db, new URLSearchParams()).contacts[0]).toMatchObject({ status: 'do_not_contact', consent: 'withdrawn', version: 2 });
    expect(() => updateMarketingContact(db, { ...original, status: 'reviewed' })).toThrow('Reîncarcă');
  });
  it('records company identities without inventing an email or consent', () => {
    saveMarketingContacts(db, [contact({ email: '', cui: '123456' })], 'admin');
    expect(listMarketingContacts(db, new URLSearchParams()).contacts[0]).toMatchObject({ email: '', consent: 'not_recorded', status: 'new' });
  });
  it('filters categories, localities with diacritics and paginates deterministically', () => {
    saveMarketingContacts(db, Array.from({ length: 30 }, (_, i) => contact({ email: `a${i}@example.test` })), 'admin');
    saveMarketingContacts(db, [contact({ category: 'cleaning', city: 'București' })], 'admin');
    const first = listMarketingContacts(db, new URLSearchParams({ category: 'business', city: 'constanta' }));
    const second = listMarketingContacts(db, new URLSearchParams({ category: 'business', city: 'constanta', page: '2' }));
    expect(first.contacts).toHaveLength(25); expect(second.contacts).toHaveLength(5); expect(first.total).toBe(30);
    expect(first.counts).toEqual({ business: 30, cleaning: 1, individual: 0 });
    expect(new Set([...first.contacts, ...second.contacts].map(c => c.id)).size).toBe(30);
    expect(listMarketingContacts(db, new URLSearchParams({ search: '%' })).total).toBe(0);
  });
  it('can initialize again after an outer transaction rolled back schema creation', () => {
    expect(() => db.transaction(() => { saveMarketingContacts(db, [contact()], 'admin'); throw Error('audit failure'); })()).toThrow();
    expect(saveMarketingContacts(db, [contact()], 'admin').created).toBe(1);
  });
});
describe('CSV import/export', () => {
  it('accepts BOM, semicolons, quoted separators, multiline notes and doubled quotes', () => {
    const rows = parseMarketingCsv('\uFEFFname;category;email;city;source;notes\r\n"Firma; test";cleaning;a@example.test;Constanța;"Sursa ""test""";"Linia 1\nLinia 2"\r\n');
    expect(rows[0]).toMatchObject({ name: 'Firma; test', category: 'cleaning', source: 'Sursa "test"', notes: 'Linia 1\nLinia 2' });
  });
  it('rejects malformed quoting, columns, consent and oversized batches', () => {
    for (const csv of ['name,category,city,source\n"bad,business,City,Source', 'name,category,city,source\na,business,City', 'name,category,email,city,source\na,individual,a@example.test,City,Source', 'name,name,category,city,source\na,a,business,City,Source', 'name,category,email,city,source\n' + 'a,business,a@example.test,City,Source\n'.repeat(201)]) expect(() => parseMarketingCsv(csv)).toThrow();
  });
  it('exports the applied filters and neutralizes spreadsheet formulas', () => {
    saveMarketingContacts(db, [contact({ name: '=HYPERLINK("bad")', phone: '+401234', notes: '\t@SUM(1)' }), contact({ email: 'clean@example.test', category: 'cleaning' })], 'admin');
    const csv = exportMarketingCsv(db, new URLSearchParams({ category: 'business' }));
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"'); expect(csv).toContain('"\'+401234"'); expect(csv).not.toContain('clean@example.test');
  });
});
