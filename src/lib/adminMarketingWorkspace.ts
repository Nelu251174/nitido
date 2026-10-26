import { marketingRegion } from './adminMarketingRegions';
import { marketingEmailSuppressed,emailHash } from './adminMarketingSuppression';
import type { Database } from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { initializeMarketing, marketingEnabled, marketingKey, MarketingError } from './adminMarketing';
import { MARKETING_CATEGORIES, type MarketingContact } from './adminMarketingShared';
import { CAMPAIGN_STATES, type MarketingAudience, type MarketingCampaign, type MarketingCollectionRun, type MarketingSettings, type MarketingSimulation, type MarketingWorkspace } from './adminMarketingWorkspaceShared';

export const MARKETING_WORKSPACE_SCHEMA = `
CREATE TABLE IF NOT EXISTS marketing_settings(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_campaigns(id TEXT PRIMARY KEY,version INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','ready','paused','archived')),payload TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_simulations(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id),request_id TEXT NOT NULL,request_hash TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,UNIQUE(campaign_id,request_id));
CREATE TABLE IF NOT EXISTS marketing_collection_runs(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL);
`;
const defaults: MarketingSettings = { version: 0, senderName: 'NITIDO', senderEmail: '', replyTo: '', postalAddress: '', dailyLimit: 500, unitCostRon: null, monthlyBudgetRon: null };
export function initializeMarketingWorkspace(db: Database) { initializeMarketing(db); db.exec(MARKETING_WORKSPACE_SCHEMA); }
function string(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new MarketingError(`${label}: valoare invalidă.`);
  if (required && !value.trim()) throw new MarketingError(`${label}: completează câmpul.`);
  return value.trim();
}
function money(value: unknown, label: string): number | null {
  if (value === null || value === '' || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) throw new MarketingError(`${label}: sumă invalidă.`);
  return Math.round(value * 1000000) / 1000000;
}
function email(value: unknown, label: string): string { const text = string(value, label, 254).toLowerCase(); if (text && !/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(text)) throw new MarketingError(`${label}: email invalid.`); return text; }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MarketingError('Date invalide.'); return value as Record<string, unknown>; }
function audit(db: Database, action: string, target: string, actor: string, details: object = {}) {
  db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(), action, target, JSON.stringify({ actor, ...details }));
}
export function marketingSettings(db: Database): MarketingSettings {
  initializeMarketingWorkspace(db);
  const row = db.prepare('SELECT version,payload FROM marketing_settings WHERE id=1').get() as { version: number; payload: string } | undefined;
  return row ? { ...JSON.parse(row.payload), version: row.version } : { ...defaults };
}
export function saveMarketingSettings(db: Database, value: unknown, actor: string): MarketingSettings {
  const b = record(value);
  const settings: MarketingSettings = { version: 0, senderName: string(b.senderName, 'Nume expeditor', 120, true), senderEmail: email(b.senderEmail, 'Email expeditor'), replyTo: email(b.replyTo, 'Email răspuns'), postalAddress: string(b.postalAddress, 'Adresă poștală', 500), dailyLimit: Number(b.dailyLimit), unitCostRon: money(b.unitCostRon, 'Cost/email'), monthlyBudgetRon: money(b.monthlyBudgetRon, 'Buget lunar') };
  if (!Number.isInteger(settings.dailyLimit) || settings.dailyLimit < 1 || settings.dailyLimit > 5000) throw new MarketingError('Limita zilnică trebuie să fie între 1 și 5.000.');
  initializeMarketingWorkspace(db);
  return db.transaction(() => {
    const current = marketingSettings(db); if (b.version !== current.version) throw new MarketingError('Setările au fost modificate. Reîncarcă pagina.', 409);
    settings.version = current.version + 1;
    db.prepare('INSERT INTO marketing_settings VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload').run(settings.version, JSON.stringify(settings));
    audit(db, 'marketing.settings.saved', 'marketing', actor, { version: settings.version }); return settings;
  }).immediate();
}
export function getMarketingCampaign(db: Database, id: string): MarketingCampaign {
  initializeMarketingWorkspace(db);
  const row = db.prepare('SELECT id,version,state,payload,updated_at FROM marketing_campaigns WHERE id=?').get(id) as { id: string; version: number; state: MarketingCampaign['state']; payload: string; updated_at: string } | undefined;
  if (!row) throw new MarketingError('Campania nu există.', 404);
  return { county:'',variant:'',recipientLimit:null,...JSON.parse(row.payload), id: row.id, version: row.version, state: row.state, updatedAt: row.updated_at };
}
export function saveMarketingCampaign(db: Database, value: unknown, actor: string): MarketingCampaign {
  const b = record(value), id = b.id ? string(b.id, 'Campanie', 80, true) : randomUUID();
  const category = string(b.category, 'Categorie', 20); if (category && !Object.hasOwn(MARKETING_CATEGORIES, category)) throw new MarketingError('Categorie invalidă.');
  const variant=b.variant??'';if(typeof variant!=='string'||!['','A','B'].includes(variant))throw new MarketingError('Variantă invalidă.');
  const region=b.county?marketingRegion(b.county):null;if(b.county&&!region)throw new MarketingError('Județ invalid.');
  const recipientLimit=b.recipientLimit===undefined||b.recipientLimit===null||b.recipientLimit===''?null:Number(b.recipientLimit);
  if(recipientLimit!==null&&(!Number.isInteger(recipientLimit)||recipientLimit<1||recipientLimit>5000))throw new MarketingError('Lotul de expediere trebuie să fie între 1 și 5.000 de destinatari.');
  const campaign: MarketingCampaign = { county:region?.code??'',variant:variant as ''|'A'|'B',recipientLimit,id, version: 1, state: 'draft', name: string(b.name, 'Nume campanie', 180, true), subject: string(b.subject, 'Subiect', 200), body: string(b.body, 'Mesaj', 10000), category: category as MarketingCampaign['category'], city: string(b.city, 'Localitate', 100), ctaLabel: string(b.ctaLabel, 'Text buton', 100), ctaUrl: string(b.ctaUrl, 'Adresă buton', 1000), budgetRon: money(b.budgetRon, 'Buget campanie'), updatedAt: new Date().toISOString() };
  if (campaign.ctaUrl) { try { const url = new URL(campaign.ctaUrl); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); campaign.ctaUrl = url.href; } catch { throw new MarketingError('Butonul necesită o adresă HTTPS validă.'); } }
  initializeMarketingWorkspace(db);
  return db.transaction(() => {
    const previous = b.id ? getMarketingCampaign(db, id) : null;
    if (previous && b.version !== previous.version) throw new MarketingError('Campania a fost modificată. Reîncarcă lista.', 409);
    if (previous?.state === 'archived') throw new MarketingError('Campania este arhivată.', 409);
    campaign.version = (previous?.version ?? 0) + 1;
    db.prepare('INSERT INTO marketing_campaigns VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,state=excluded.state,payload=excluded.payload,updated_at=excluded.updated_at').run(id, campaign.version, campaign.state, JSON.stringify(campaign), campaign.updatedAt, actor);
    audit(db, 'marketing.campaign.saved', id, actor, { version: campaign.version }); return campaign;
  }).immediate();
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function marketingCampaignHtml(campaign: MarketingCampaign, settings: MarketingSettings, unsubscribe?: string): string {
  let link = '';
  if (campaign.ctaUrl && campaign.ctaLabel) { const url = new URL(campaign.ctaUrl); url.searchParams.set('utm_source', 'nitido'); url.searchParams.set('utm_medium', 'email'); url.searchParams.set('utm_campaign', campaign.id); link = `<p><a href="${escape(url.href)}">${escape(campaign.ctaLabel)}</a></p>`; }
  return `<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${escape(campaign.subject)}</title><body style="font-family:Arial,sans-serif;max-width:600px;padding:24px;margin:auto;line-height:1.6"><h2>${escape(settings.senderName)}</h2><h1>${escape(campaign.subject)}</h1><div style="white-space:pre-wrap">${escape(campaign.body)}</div>${link}<hr><p>${escape(settings.postalAddress)}</p><p style="font-size:12px">${unsubscribe ? `<a href="${escape(unsubscribe)}">Dezabonare de la mesajele Marketing</a>` : 'Previzualizare. Linkul personal de dezabonare este adăugat la procesarea mesajului.'}</p></body></html>`;
}
export function selectAudience(db: Database, campaign: MarketingCampaign) {
  initializeMarketingWorkspace(db);
  const region=campaign.county?marketingRegion(campaign.county):null;if(campaign.county&&!region)throw new MarketingError('Județ invalid.');
  const city=marketingKey(campaign.city),county=region?.key??'';
  const contacts=db.prepare(`SELECT c.id,c.name,c.category,c.email,c.consent,c.consent_evidence,c.status,e.status AS email_verification FROM marketing_contacts c LEFT JOIN marketing_email_checks e ON e.email=c.email WHERE (?='' OR c.category=?) AND
   ((?='' AND (?='' OR c.city_key=?)) OR (?<>'' AND EXISTS(SELECT 1 FROM marketing_contact_regions r WHERE r.contact_id=c.id AND r.county_key=? AND (?='' OR r.city_key=?)))) ORDER BY c.created_at,c.id`).iterate(campaign.category,campaign.category,county,city,city,county,county,city,city) as Iterable<MarketingContact & {consent_evidence:string;email_verification:string|null}>;
  const suppressed = new Set((db.prepare("SELECT DISTINCT email FROM marketing_contacts WHERE email<>'' AND (status='do_not_contact' OR consent='withdrawn')").all() as { email: string }[]).map(row => row.email));
  const suppressedHashes=new Set((db.prepare('SELECT email_hash FROM marketing_suppressions').all() as {email_hash:string}[]).map(r=>r.email_hash));
  const seen = new Set<string>(), eligible: string[] = [], reasons = { suppressed: 0, noEmail: 0, noConsent: 0, notReviewed: 0, duplicate: 0, unverifiedEmail:0 };
  let selected=0,deferred=0;
  for (const row of contacts) {
    selected++;
    if (row.status === 'do_not_contact' || row.consent === 'withdrawn' || suppressed.has(row.email) || suppressedHashes.has(emailHash(row.email))) reasons.suppressed++;
    else if (!row.email) reasons.noEmail++;
    else if (row.consent !== 'granted' || !row.consent_evidence.trim()) reasons.noConsent++;
    else if (row.status !== 'reviewed') reasons.notReviewed++;
    else if(row.email_verification!=='verified')reasons.unverifiedEmail++;
    else if (seen.has(row.email)) reasons.duplicate++;
    else { seen.add(row.email); if(marketingCampaignVariantMatches(campaign,row.email)&&eligible.length<(campaign.recipientLimit??Infinity))eligible.push(row.id);else deferred++; }
  }
  return { selected, eligible, deferred, reasons };
}
export function previewMarketingCampaign(db: Database, id: string): MarketingAudience {
  const campaign = getMarketingCampaign(db, id), settings = marketingSettings(db), audience = selectAudience(db, campaign);
  const blockers: string[] = [];
  if (!campaign.subject || !campaign.body) blockers.push('Completează subiectul și mesajul.');
  if (Boolean(campaign.ctaLabel) !== Boolean(campaign.ctaUrl)) blockers.push('Completează atât textul, cât și adresa butonului, sau lasă ambele câmpuri goale.');
  const missingSender = [!settings.senderEmail && 'emailul expeditorului', !settings.replyTo && 'adresa de răspuns', !settings.postalAddress && 'adresa poștală'].filter(Boolean);
  if (missingSender.length) blockers.push(`Completează în Setări: ${missingSender.join(', ')}.`);
  if (!audience.eligible.length) blockers.push('Nu există contacte eligibile. Verifică acordul, emailul și starea Verificat.');
  const estimated = settings.unitCostRon === null ? null : Math.round(audience.eligible.length * settings.unitCostRon * 1000000) / 1000000;
  if ((campaign.budgetRon !== null || settings.monthlyBudgetRon !== null) && estimated === null) blockers.push('Configurează costul estimat per email pentru verificarea bugetului.');
  if (estimated !== null && campaign.budgetRon !== null && estimated > campaign.budgetRon) blockers.push('Costul estimat depășește bugetul campaniei.');
  if (estimated !== null && settings.monthlyBudgetRon !== null && estimated > settings.monthlyBudgetRon) blockers.push('Costul estimat depășește bugetul lunar configurat.');
  return { selected: audience.selected, eligible: audience.eligible.length, excluded: audience.selected - audience.eligible.length-audience.deferred, deferred:audience.deferred, reasons: audience.reasons, estimatedCostRon: estimated, blockers, html: marketingCampaignHtml(campaign, settings) };
}
export function setMarketingCampaignState(db: Database, value: unknown, actor: string): MarketingCampaign {
  const b = record(value), id = string(b.id, 'Campanie', 80, true);
  if (typeof b.state !== 'string' || !Object.hasOwn(CAMPAIGN_STATES, b.state) || b.state === 'draft') throw new MarketingError('Stare invalidă.');
  initializeMarketingWorkspace(db);
  return db.transaction(() => {
    const campaign = getMarketingCampaign(db, id);
    if (campaign.version !== b.version) throw new MarketingError('Campania a fost modificată. Reîncarcă lista.', 409);
    if (campaign.state === 'archived') throw new MarketingError('Campania este arhivată.', 409);
    if (b.state === 'ready') { const preview = previewMarketingCampaign(db, id); if (preview.blockers.length) throw new MarketingError(preview.blockers.join(' ')); }
    if (b.state === 'paused' && campaign.state !== 'ready') throw new MarketingError('Doar o campanie pregătită poate fi pusă în pauză.');
    db.prepare('UPDATE marketing_campaigns SET state=?,version=version+1,updated_at=? WHERE id=?').run(b.state, new Date().toISOString(), id);
    audit(db, 'marketing.campaign.state', id, actor, { state: b.state }); return getMarketingCampaign(db, id);
  }).immediate();
}
export function simulateMarketingCampaign(db: Database, value: unknown, actor: string): { simulation: MarketingSimulation; replayed: boolean } {
  const b = record(value), id = string(b.id, 'Campanie', 80, true), requestId = string(b.requestId, 'Identificator rulare', 80, true);
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId) || !Number.isInteger(b.version)) throw new MarketingError('Cerere de simulare invalidă.');
  const requestHash = createHash('sha256').update(JSON.stringify([id, b.version])).digest('hex');
  initializeMarketingWorkspace(db);
  return db.transaction(() => {
    const existing = db.prepare('SELECT request_hash,payload FROM marketing_simulations WHERE campaign_id=? AND request_id=?').get(id, requestId) as { request_hash: string; payload: string } | undefined;
    if (existing) { if (existing.request_hash !== requestHash) throw new MarketingError('Identificatorul rulării a fost deja folosit pentru altă versiune.', 409); return { simulation: JSON.parse(existing.payload), replayed: true }; }
    const campaign = getMarketingCampaign(db, id);
    if (campaign.version !== b.version) throw new MarketingError('Campania a fost modificată. Reîncarcă lista.', 409);
    if (campaign.state !== 'ready') throw new MarketingError('Pregătește campania înainte de simulare.', 409);
    const preview = previewMarketingCampaign(db, id); if (preview.blockers.length) throw new MarketingError(preview.blockers.join(' '));
    const simulation: MarketingSimulation = { id: randomUUID(), campaignId: id, campaignName: campaign.name, eligible: preview.eligible, excluded: preview.excluded, estimatedCostRon: preview.estimatedCostRon, createdAt: new Date().toISOString(), realEmailsSent: 0 };
    // No transport or notification queue is imported or invoked. This ledger is simulation-only.
    db.prepare('INSERT INTO marketing_simulations VALUES(?,?,?,?,?,?,?)').run(simulation.id, id, requestId, requestHash, JSON.stringify({ ...simulation, reasons: preview.reasons, campaignSnapshot: campaign, settingsVersion: marketingSettings(db).version }), simulation.createdAt, actor);
    db.prepare('UPDATE marketing_campaigns SET version=version+1,updated_at=? WHERE id=?').run(simulation.createdAt, id);
    audit(db, 'marketing.campaign.simulated', id, actor, { simulationId: simulation.id, eligible: preview.eligible, realEmailsSent: 0 });
    return { simulation, replayed: false };
  }).immediate();
}
export function recordMarketingCollection(db: Database, value: unknown, selected: number, saved: { created: number; duplicates: number }, actor: string) {
  const b = record(value); if (!['csv', 'anaf', 'openstreetmap', 'websites'].includes(String(b.source))) throw new MarketingError('Sursă de colectare invalidă.');
  const requested = Number(b.requested), excluded = Number(b.excluded);
  if (!Number.isInteger(requested) || !Number.isInteger(excluded) || requested < selected || requested > 200 || excluded < 0 || excluded !== requested - selected) throw new MarketingError('Contoare de colectare invalide.');
  initializeMarketingWorkspace(db);
  const row: MarketingCollectionRun = { id: randomUUID(), source: String(b.source), city: string(b.city, 'Localitate', 100), category: string(b.category, 'Categorie', 20), requested, selected, excluded, ...saved, createdAt: new Date().toISOString() };
  db.prepare('INSERT INTO marketing_collection_runs VALUES(?,?,?,?)').run(row.id, JSON.stringify(row), row.createdAt, actor);
}
export function getMarketingWorkspace(db: Database): MarketingWorkspace {
  initializeMarketingWorkspace(db);
  const ids = db.prepare('SELECT id FROM marketing_campaigns ORDER BY updated_at DESC,id').all() as { id: string }[];
  const simulations = (db.prepare('SELECT payload FROM marketing_simulations ORDER BY created_at DESC,id LIMIT 100').all() as { payload: string }[]).map(row => JSON.parse(row.payload) as MarketingSimulation);
  const collections = (db.prepare('SELECT payload FROM marketing_collection_runs ORDER BY created_at DESC,id LIMIT 100').all() as { payload: string }[]).map(row => JSON.parse(row.payload) as MarketingCollectionRun);
  const counts = db.prepare("SELECT COUNT(*) contacts,COALESCE(SUM(status='reviewed'),0) reviewed,COALESCE(SUM(status='do_not_contact' OR consent='withdrawn'),0) suppressed FROM marketing_contacts").get() as { contacts: number; reviewed: number; suppressed: number };
  const stats = db.prepare("SELECT COUNT(*) simulations,COALESCE(SUM(json_extract(payload,'$.eligible')),0) simulatedRecipients FROM marketing_simulations").get() as { simulations: number; simulatedRecipients: number };
  const audienceRows = db.prepare("SELECT DISTINCT c.email FROM marketing_contacts c WHERE c.email<>'' AND EXISTS(SELECT 1 FROM marketing_email_checks e WHERE e.email=c.email AND e.status='verified') AND c.status='reviewed' AND c.consent='granted' AND TRIM(c.consent_evidence)<>'' AND NOT EXISTS(SELECT 1 FROM marketing_contacts s WHERE s.email=c.email AND (s.status='do_not_contact' OR s.consent='withdrawn'))").all() as {email:string}[];
  const audience = {eligible:audienceRows.filter(row=>!marketingEmailSuppressed(db,row.email)).length};
  const realEmailsSent = db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_outbox'").get() ? (db.prepare("SELECT COUNT(*) n FROM marketing_outbox WHERE mode='live' AND provider_id IS NOT NULL").get() as {n:number}).n : 0;
  return { settings: marketingSettings(db), campaigns: ids.map(row => getMarketingCampaign(db, row.id)), simulations, collections, totals: { ...counts, ...stats, campaigns: (db.prepare('SELECT COUNT(*) n FROM marketing_campaigns').get() as { n: number }).n, eligible: audience.eligible, realEmailsSent }, deliveryEnabled: marketingEnabled() && process.env.NITIDO_MARKETING_DELIVERY_ENABLED === 'true' };
}

/** Recheck geography/category at dispatch, after any edits to a contact's county memberships. */
export function marketingCampaignVariantMatches(campaign:MarketingCampaign,email:string){return !campaign.variant||(parseInt(emailHash(email)[0],16)%2===0?'A':'B')===campaign.variant;}
export function marketingCampaignMatchesContact(db:Database,campaign:MarketingCampaign,id:string){
 const region=campaign.county?marketingRegion(campaign.county):null;if(campaign.county&&!region)return false;
 const county=region?.key??'',city=marketingKey(campaign.city);
 const row=db.prepare(`SELECT c.email FROM marketing_contacts c WHERE c.id=? AND (?='' OR c.category=?) AND ((?='' AND (?='' OR c.city_key=?)) OR (?<>'' AND EXISTS(SELECT 1 FROM marketing_contact_regions r WHERE r.contact_id=c.id AND r.county_key=? AND (?='' OR r.city_key=?))))`).get(id,campaign.category,campaign.category,county,city,city,county,county,city,city) as {email:string}|undefined;return !!row&&marketingCampaignVariantMatches(campaign,row.email);
}
