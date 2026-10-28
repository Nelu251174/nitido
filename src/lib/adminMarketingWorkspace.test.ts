import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { bulkMarketingContactStatus, listMarketingContacts, saveMarketingContacts, updateMarketingContact } from './adminMarketing';
import { getMarketingCampaign, getMarketingWorkspace, initializeMarketingWorkspace, marketingSettings, previewMarketingCampaign, recordMarketingCollection, saveMarketingCampaign, saveMarketingSettings, setMarketingCampaignState, simulateMarketingCampaign } from './adminMarketingWorkspace';

let db: Database.Database;
const actor = 'synthetic-admin';
function add(patch: Record<string, unknown> = {}, reviewed = true) {
  saveMarketingContacts(db, [{ name: 'Contact test', category: 'business', city: 'Constanța', email: 'one@example.test', source: 'Fixture sintetică', consent: 'granted', consentEvidence: 'Formular sintetic 2026-10-24', ...patch }], actor);
  const rows = listMarketingContacts(db, new URLSearchParams()).contacts;
  const row = rows.find(row => row.email === (patch.email ?? 'one@example.test') && row.category === (patch.category ?? 'business'))!;
  if (reviewed && row.consent !== 'withdrawn') updateMarketingContact(db, { ...row, status: 'reviewed' });
  if(row.email)db.prepare("INSERT OR REPLACE INTO marketing_email_checks(email,status,source_status,domain_status) VALUES(?,'verified','verified','mx')").run(row.email);
  return row.id;
}
function settings(patch = {}) { return saveMarketingSettings(db, { ...marketingSettings(db), senderEmail: 'marketing@example.test', replyTo: 'reply@example.test', postalAddress: 'Adresă sintetică', unitCostRon: 0.01, ...patch }, actor); }
function draft(patch = {}) { return saveMarketingCampaign(db, { name: 'Campanie test', subject: 'Bun venit', body: 'Mesaj sintetic', category: '', city: '', ctaLabel: 'Descoperă', ctaUrl: 'https://nitido.ro', budgetRon: null, ...patch }, actor); }
function ready() { add(); settings(); const campaign = draft(); return setMarketingCampaignState(db, { id: campaign.id, version: campaign.version, state: 'ready' }, actor); }
beforeEach(() => { vi.stubEnv('LEGAL_ENTITY_ADDRESS',''); db = new Database(':memory:'); db.pragma('foreign_keys=ON'); db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT); CREATE TABLE jobs(id TEXT); INSERT INTO jobs VALUES(\'existing\')'); initializeMarketingWorkspace(db); });
afterEach(() => { db.close(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function operatorAddress(address = 'Strada Exemplu 10, Localitate, România') {
  vi.stubEnv('LEGAL_ENTITY_NAME','Operator sintetic'); vi.stubEnv('LEGAL_ENTITY_REGISTRATION','TEST-123');
  vi.stubEnv('LEGAL_CONTACT_EMAIL','support@example.test'); vi.stubEnv('LEGAL_ENTITY_ADDRESS',address);
}
describe('Marketing workspace and eligibility', () => {
  it('starts with honest empty results and leaves other application data intact', () => {
    expect(getMarketingWorkspace(db)).toMatchObject({ deliveryEnabled: false, totals: { contacts: 0, campaigns: 0, simulations: 0, realEmailsSent: 0 } });
    expect(marketingSettings(db).unitCostRon).toBeNull(); expect(db.prepare('SELECT * FROM jobs').all()).toEqual([{ id: 'existing' }]);
  });
  it('applies documented consent, verification, email deduplication and global suppression across categories', () => {
    add(); add({ email: '', cui: '123456' }); add({ email: 'no-consent@example.test', consent: 'not_recorded', consentEvidence: '' });
    add({ email: 'not-reviewed@example.test', category: 'individual' }, false); add({ category: 'cleaning' });
    add({ email: 'suppressed@example.test', category: 'cleaning' }); add({ email: 'suppressed@example.test', consent: 'withdrawn', consentEvidence: '' }, false);
    settings(); const preview = previewMarketingCampaign(db, draft().id);
    expect(preview).toMatchObject({ selected: 7, eligible: 1, excluded: 6, reasons: { suppressed: 2, noEmail: 1, noConsent: 1, notReviewed: 1, duplicate: 1 }, estimatedCostRon: 0.01, blockers: [] });
    expect(getMarketingWorkspace(db).totals.eligible).toBe(1);
  });
  it('filters by category and locality and blocks incomplete sender/content settings', () => {
    add(); add({ category: 'cleaning', email: 'clean@example.test', city: 'București' });
    const campaign = draft({ category: 'business', city: 'constanta', body: '' });
    const preview = previewMarketingCampaign(db, campaign.id); expect(preview.selected).toBe(1); expect(preview.blockers).toHaveLength(2);
    expect(() => setMarketingCampaignState(db, { id: campaign.id, version: 1, state: 'ready' }, actor)).toThrow('Completează');
  });
  it('names only the missing sender fields instead of reporting configured fields as absent', () => {
    add(); settings({replyTo:''});
    expect(previewMarketingCampaign(db,draft().id).blockers).toEqual(['Completează în Setări: adresa de răspuns.']);
  });
  it('uses the configured operator address for existing empty Marketing settings, preview and preparation without dispatch', () => {
    const network = vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('No dispatch expected'));
    add(); const saved=settings({postalAddress:''}); const campaign=draft(); operatorAddress();
    expect(marketingSettings(db)).toMatchObject({postalAddress:'Strada Exemplu 10, Localitate, România',version:saved.version});
    const preview=previewMarketingCampaign(db,campaign.id); expect(preview.blockers).toEqual([]);
    expect(preview.html).toContain('Strada Exemplu 10, Localitate, România');
    expect(setMarketingCampaignState(db,{id:campaign.id,version:campaign.version,state:'ready'},actor).state).toBe('ready');
    expect(getMarketingWorkspace(db).totals.realEmailsSent).toBe(0); expect(network).not.toHaveBeenCalled();
    expect(JSON.parse((db.prepare('SELECT payload FROM marketing_settings WHERE id=1').get() as {payload:string}).payload).postalAddress).toBe('');
  });
  it('shows the operator address in new settings and preserves an explicit Marketing address', () => {
    operatorAddress(); expect(marketingSettings(db)).toMatchObject({version:0,postalAddress:'Strada Exemplu 10, Localitate, România'});
    settings({postalAddress:'Adresă Marketing aleasă de administrator'});
    expect(marketingSettings(db).postalAddress).toBe('Adresă Marketing aleasă de administrator');
  });
  it.each(['','x'.repeat(501),'Strada exemplu\nDate suplimentare'])('keeps the postal blocker when the operator address is absent or invalid',address=>{
    add();settings({postalAddress:''});operatorAddress(address);
    expect(previewMarketingCampaign(db,draft().id).blockers).toEqual(['Completează în Setări: adresa poștală.']);
  });
  it('keeps the postal blocker when the legal identity is incomplete',()=>{
    add();settings({postalAddress:''});operatorAddress();vi.stubEnv('LEGAL_ENTITY_NAME','');
    expect(previewMarketingCampaign(db,draft().id).blockers).toEqual(['Completează în Setări: adresa poștală.']);
  });
  it('does not invent pricing and validates limits and budgets before preparing a campaign', () => {
    add(); settings({ unitCostRon: null }); const campaign = draft({ budgetRon: 1 });
    expect(previewMarketingCampaign(db, campaign.id).estimatedCostRon).toBeNull();
    expect(previewMarketingCampaign(db, campaign.id).blockers.join(' ')).toContain('costul estimat');
    settings({ unitCostRon: 2, monthlyBudgetRon: 1 }); expect(previewMarketingCampaign(db, campaign.id).blockers.join(' ')).toContain('bugetul campaniei');
    expect(previewMarketingCampaign(db, campaign.id).blockers.join(' ')).toContain('bugetul lunar');
    add({ email: 'two@example.test' }); settings({ dailyLimit: 1 }); expect(previewMarketingCampaign(db, draft().id)).toMatchObject({eligible:2,blockers:[]});
  });
  it('escapes HTML in messages and validates action URLs without executing network calls', () => {
    settings(); const campaign = draft({ subject: '<script>alert(1)</script>', body: '<img src=x onerror=alert(1)>', ctaUrl: 'https://nitido.ro/?x=1&y=2' });
    const html = previewMarketingCampaign(db, campaign.id).html;
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('&lt;img'); expect(html).toContain('utm_campaign=');
    expect(() => draft({ ctaUrl: 'javascript:alert(1)' })).toThrow('HTTPS');
    expect(() => draft({ ctaUrl: 'https://user:pass@example.test' })).toThrow('HTTPS');
  });
});
describe('campaign lifecycle without email delivery', () => {
  it('simulates once per request ID and separates simulation records from real results', () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('No network expected'));
    const campaign = ready(), request = { id: campaign.id, version: campaign.version, requestId: 'synthetic-request-001' };
    const first = simulateMarketingCampaign(db, request, actor), replay = simulateMarketingCampaign(db, request, actor);
    expect(first.replayed).toBe(false); expect(replay.replayed).toBe(true); expect(replay.simulation.id).toBe(first.simulation.id);
    expect(getMarketingWorkspace(db).totals).toMatchObject({ simulations: 1, simulatedRecipients: 1, realEmailsSent: 0 });
    expect(network).not.toHaveBeenCalled();
    expect(() => simulateMarketingCampaign(db, { ...request, version: campaign.version + 1 }, actor)).toThrow('altă versiune');
  });
  it('rechecks a withdrawal made after preview/preparation before a simulation', () => {
    const campaign = ready(), contact = listMarketingContacts(db, new URLSearchParams()).contacts[0];
    updateMarketingContact(db, { ...contact, consent: 'withdrawn' });
    expect(() => simulateMarketingCampaign(db, { id: campaign.id, version: campaign.version, requestId: 'synthetic-request-001' }, actor)).toThrow('Nu există contacte eligibile');
    expect(getMarketingWorkspace(db).totals.simulations).toBe(0);
  });
  it('supports pause, resume and archive and prevents simulation in paused/archived states', () => {
    const campaign = ready(), paused = setMarketingCampaignState(db, { id: campaign.id, version: campaign.version, state: 'paused' }, actor);
    expect(() => simulateMarketingCampaign(db, { id: paused.id, version: paused.version, requestId: 'synthetic-request-001' }, actor)).toThrow('Pregătește');
    const resumed = setMarketingCampaignState(db, { id: paused.id, version: paused.version, state: 'ready' }, actor);
    const archived = setMarketingCampaignState(db, { id: resumed.id, version: resumed.version, state: 'archived' }, actor);
    expect(() => saveMarketingCampaign(db, archived, actor)).toThrow('arhivată');
  });
  it('requires re-preparation after editing and rejects stale versions', () => {
    const campaign = ready();
    const edited = saveMarketingCampaign(db, { ...campaign, body: 'Mesaj nou' }, actor); expect(edited.state).toBe('draft');
    expect(() => saveMarketingCampaign(db, campaign, actor)).toThrow('modificată');
    expect(() => simulateMarketingCampaign(db, { id: campaign.id, version: campaign.version, requestId: 'synthetic-request-001' }, actor)).toThrow('modificată');
    const current = marketingSettings(db); settings(); expect(() => saveMarketingSettings(db, current, actor)).toThrow('modificate');
  });
  it('rolls back simulations and campaign versions if the audit fails', () => {
    const campaign = ready(); db.exec("CREATE TRIGGER fail_marketing_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
    expect(() => simulateMarketingCampaign(db, { id: campaign.id, version: campaign.version, requestId: 'synthetic-request-001' }, actor)).toThrow();
    expect(getMarketingWorkspace(db).totals.simulations).toBe(0); expect(getMarketingCampaign(db, campaign.id).version).toBe(campaign.version);
  });
});
describe('contact maintenance and collection history', () => {
  it('applies bulk verification atomically and never reactivates suppressed contacts', () => {
    add({}, false); add({ email: 'two@example.test', consent: 'withdrawn' }, false);
    const rows = listMarketingContacts(db, new URLSearchParams()).contacts;
    expect(() => bulkMarketingContactStatus(db, rows.map(row => ({ id: row.id, version: row.version })), 'reviewed')).toThrow('reactivate');
    expect(listMarketingContacts(db, new URLSearchParams()).contacts.find(row => row.email === 'one@example.test')!.status).toBe('new');
    expect(bulkMarketingContactStatus(db, rows.filter(row => row.status === 'new').map(row => ({ id: row.id, version: row.version })), 'reviewed')).toEqual({ updated: 1 });
    expect(() => bulkMarketingContactStatus(db, [{ id: rows[0].id, version: -1 }], 'do_not_contact')).toThrow('modificate');
  });
  it('updates identity fields, search/locality keys and protects against duplicate contacts', () => {
    add(); const first = listMarketingContacts(db, new URLSearchParams()).contacts[0];
    updateMarketingContact(db, { ...first, name: 'Nume nou', email: 'new@example.test', city: 'București' });
    expect(listMarketingContacts(db, new URLSearchParams({ city: 'bucuresti', search: 'nume nou' })).total).toBe(1);
    add({ email: 'two@example.test' }); const second = listMarketingContacts(db, new URLSearchParams({ search: 'two@' })).contacts[0];
    expect(() => updateMarketingContact(db, { ...second, email: 'new@example.test' })).toThrow('Există deja');
  });
  it('can correct an existing individual record after withdrawal without regranting consent', () => {
    add({ category: 'individual' }); const first = listMarketingContacts(db, new URLSearchParams()).contacts[0];
    updateMarketingContact(db, { ...first, name: 'Corectat', consent: 'withdrawn' });
    expect(listMarketingContacts(db, new URLSearchParams()).contacts[0]).toMatchObject({ name: 'Corectat', consent: 'withdrawn', status: 'do_not_contact' });
  });
  it('records truthful collection counters and rejects inconsistent histories', () => {
    recordMarketingCollection(db, { source: 'csv', requested: 4, excluded: 1, category: 'business', city: 'Constanța' }, 3, { created: 2, duplicates: 1 }, actor);
    expect(getMarketingWorkspace(db).collections[0]).toMatchObject({ requested: 4, selected: 3, created: 2, duplicates: 1, excluded: 1 });
    expect(() => recordMarketingCollection(db, { source: 'csv', requested: 4, excluded: 0 }, 3, { created: 3, duplicates: 0 }, actor)).toThrow('Contoare');
  });
});

describe('county campaigns and pilot batches',()=>{
 it('selects all localities in a county, including memberships of a shared email, while keeping București separate from Ilfov',()=>{
  add({email:'a@fixture.ro',county:'CT',city:'Mangalia'});add({email:'b@fixture.ro',county:'B',city:'București'});add({email:'c@fixture.ro',county:'IF',city:'Otopeni'});
  saveMarketingContacts(db,[{name:'Shared',category:'business',city:'Năvodari',county:'CT',email:'b@fixture.ro',source:'Public second location',consent:'not_recorded'}],actor);
  const ct=previewMarketingCampaign(db,draft({county:'CT'}).id);expect(ct.selected).toBe(2);expect(previewMarketingCampaign(db,draft({county:'CT',city:'Năvodari'}).id).selected).toBe(1);
  expect(previewMarketingCampaign(db,draft({county:'B'}).id).selected).toBe(1);expect(previewMarketingCampaign(db,draft({county:'IF'}).id).selected).toBe(1);
 });
 it('scans more than 5000 selected contacts and reports a limited pilot without truncating the audience',()=>{
  const put=db.prepare("INSERT INTO marketing_contacts(id,name,category,email,city,city_key,search_key,source,consent,consent_evidence,status,created_by,created_at,updated_at) VALUES(?,?,'business',?,'București','bucuresti','','Fixture','granted','Fixture opt-in','reviewed','owner','2026-10-25','2026-10-25')");
  db.transaction(()=>{for(let i=0;i<5003;i++)put.run('id'+i,'Firm '+i,'firm'+i+'@fixture.ro');})();
  db.prepare("INSERT INTO marketing_email_checks(email,status,source_status,domain_status) SELECT email,'verified','verified','mx' FROM marketing_contacts").run();
  const p=previewMarketingCampaign(db,draft({recipientLimit:50}).id);expect(p).toMatchObject({selected:5003,eligible:50,deferred:4953,excluded:0});
 });
});

describe('stable subject variants',()=>{it('keeps A and B disjoint for shared email addresses without reducing the complete audience',async()=>{
 for(let i=0;i<12;i++)add({email:'v'+i+'@fixture.ro'});
 const {selectAudience}=await import('./adminMarketingWorkspace');const a=selectAudience(db,draft({variant:'A'})).eligible,b=selectAudience(db,draft({variant:'B'})).eligible;
 expect(a.length+b.length).toBe(12);expect(a.filter(id=>b.includes(id))).toHaveLength(0);expect(selectAudience(db,draft({variant:'A'})).eligible).toEqual(a);
});});

describe('technical email readiness',()=>{it('excludes an unverified email even when consent and manual review are present',()=>{add();db.prepare("UPDATE marketing_email_checks SET status='invalid'").run();expect(previewMarketingCampaign(db,draft().id)).toMatchObject({eligible:0,reasons:{unverifiedEmail:1}});});});

describe('explicit public B2B campaign audience',()=>{
 it('prepares verified public firms without changing consent, review or the default campaign policy',()=>{
  const id=add({consent:'not_recorded',consentEvidence:''},false);settings();
  expect(previewMarketingCampaign(db,draft({county:'CT',category:'business'}).id).eligible).toBe(0);
  const campaign=draft({county:'CT',category:'business',audienceMode:'public_business'});
  expect(previewMarketingCampaign(db,campaign.id)).toMatchObject({eligible:1,blockers:[]});
  expect(setMarketingCampaignState(db,{...campaign,state:'ready'},actor).state).toBe('ready');
  expect(db.prepare('SELECT consent,consent_evidence,status FROM marketing_contacts WHERE id=?').get(id)).toEqual({consent:'not_recorded',consent_evidence:'',status:'new'});
 });
 it.each([{county:'IF',category:'business'},{county:'CT',category:'individual'},{county:'CT',category:''},{county:'',category:'business'}])('rejects public B2B outside its defined scope: %j',patch=>{
  expect(()=>draft({...patch,audienceMode:'public_business'})).toThrow('B2B');
 });
 it('excludes unverified sources, invalid domains, withdrawn contacts and out-of-county firms',()=>{
  const patch={consent:'not_recorded',consentEvidence:''};
  add({...patch,email:'source@example.test'},false);db.prepare("UPDATE marketing_email_checks SET source_status='pending'").run();
  add({...patch,email:'invalid@example.test'},false);db.prepare("UPDATE marketing_email_checks SET status='invalid' WHERE email='invalid@example.test'").run();
  add({...patch,email:'withdrawn@example.test',consent:'withdrawn'},false);
  add({...patch,email:'other@example.test',county:'IF',city:'Otopeni'},false);
  settings();expect(previewMarketingCampaign(db,draft({county:'CT',category:'business',audienceMode:'public_business'}).id)).toMatchObject({selected:3,eligible:0,reasons:{suppressed:1,unverifiedEmail:2}});
 });
});
