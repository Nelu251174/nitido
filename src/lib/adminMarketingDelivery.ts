import type { Database } from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Webhook } from 'svix';
import { marketingEnabled, MarketingError } from './adminMarketing';
import { emailHash, marketingEmailSuppressed, suppressMarketingEmail } from './adminMarketingSuppression';
import { getMarketingCampaign, initializeMarketingWorkspace, marketingCampaignHtml, marketingSettings, previewMarketingCampaign, selectAudience } from './adminMarketingWorkspace';
import type { MarketingCampaign, MarketingSettings } from './adminMarketingWorkspaceShared';

export const DELIVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS marketing_delivery_runs(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('test','live')),scheduled_at TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,UNIQUE(campaign_id,request_id));
CREATE TABLE IF NOT EXISTS marketing_outbox(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES marketing_delivery_runs(id),campaign_id TEXT NOT NULL,mode TEXT NOT NULL,contact_id TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL,provider_id TEXT UNIQUE,updated_at TEXT NOT NULL,cost REAL NOT NULL,html TEXT,UNIQUE(campaign_id,mode,email));
CREATE INDEX IF NOT EXISTS marketing_outbox_run ON marketing_outbox(run_id,status);
CREATE TABLE IF NOT EXISTS marketing_unsubscribe(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_provider_events(id TEXT PRIMARY KEY,received_at TEXT NOT NULL,event_type TEXT NOT NULL,provider_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_worker(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,until_ms INTEGER NOT NULL);
`;
export function initializeMarketingDelivery(db: Database) { initializeMarketingWorkspace(db); db.exec(DELIVERY_SCHEMA); }
export function marketingDeliveryReadiness() {
  return { enabled: marketingEnabled() && process.env.NITIDO_MARKETING_DELIVERY_ENABLED === 'true', providerConfigured: !!process.env.RESEND_API_KEY, webhookConfigured: !!process.env.NITIDO_MARKETING_WEBHOOK_SECRET };
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fingerprint = (c: MarketingCampaign) => hash(JSON.stringify([c.name,c.subject,c.body,c.category,c.city,c.ctaLabel,c.ctaUrl,c.budgetRon]));
function audit(db: Database, action: string, id: string, actor: string) { db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor})); }
type Snapshot = { campaign: MarketingCampaign; settings: MarketingSettings; fingerprint: string };
type Run = { id: string; campaign_id: string; mode: 'test'|'live'; scheduled_at: string; payload: string };
type Job = { id: string; run_id: string; campaign_id: string; mode: 'test'|'live'; contact_id: string; email: string; status: string; provider_id: string|null; cost: number; updated_at: string; html: string|null };
export function queueMarketingCampaign(db: Database, value: unknown, actor: string) {
  const b = value as Record<string, unknown>;
  if (!b || typeof b.id !== 'string' || !Number.isInteger(b.version) || typeof b.requestId !== 'string' || !/^[\w-]{16,80}$/.test(b.requestId) || !['test','live'].includes(String(b.mode))) throw new MarketingError('Cerere de expediere invalidă.');
  const mode = b.mode as 'test'|'live';
  const readiness = marketingDeliveryReadiness();
  if (mode === 'live' && (!readiness.enabled || !readiness.providerConfigured || !readiness.webhookConfigured)) throw new MarketingError('Trimiterea reală este oprită sau configurarea furnizorului/webhookului este incompletă.',409);
  const scheduled = b.scheduledAt ? new Date(String(b.scheduledAt)) : new Date();
  if (!Number.isFinite(+scheduled) || +scheduled < Date.now()-60000 || +scheduled > Date.now()+90*86400000) throw new MarketingError('Programare invalidă; maximum 90 de zile.');
  const requestHash = hash(JSON.stringify([b.id,b.version,mode,b.scheduledAt ?? '']));
  initializeMarketingDelivery(db);
  return db.transaction(() => {
    const existing = db.prepare('SELECT id,request_hash FROM marketing_delivery_runs WHERE campaign_id=? AND request_id=?').get(b.id,b.requestId) as {id:string;request_hash:string}|undefined;
    if (existing) { if (existing.request_hash !== requestHash) throw new MarketingError('Identificator de expediere reutilizat.',409); return {id:existing.id,replayed:true}; }
    const campaign = getMarketingCampaign(db,b.id as string), settings = marketingSettings(db);
    if (campaign.version !== b.version || campaign.state !== 'ready') throw new MarketingError('Reîncarcă și pregătește versiunea actuală a campaniei.',409);
    const preview = previewMarketingCampaign(db,campaign.id); if (preview.blockers.length) throw new MarketingError(preview.blockers.join(' '));
    const ids = selectAudience(db,campaign).eligible;
    const duplicate = db.prepare('SELECT 1 FROM marketing_outbox WHERE campaign_id=? AND mode=? AND email=(SELECT email FROM marketing_contacts WHERE id=?)');
    if (ids.some(id => duplicate.get(campaign.id,mode,id))) throw new MarketingError('Campania are deja destinatari în coadă. Vezi Rezultate; pentru o nouă expediere creează altă campanie.',409);
    if (mode === 'live') {
      const reserved = db.prepare("SELECT COALESCE(SUM(cost),0) n FROM marketing_outbox WHERE mode='live' AND status NOT IN ('failed','canceled','suppressed') AND campaign_id=?").get(campaign.id) as {n:number};
      if (campaign.budgetRon !== null && reserved.n + (preview.estimatedCostRon ?? 0) > campaign.budgetRon+0.0000001) throw new MarketingError('Bugetul campaniei este deja rezervat.');
    }
    const id=randomUUID(), now=new Date().toISOString();
    db.prepare('INSERT INTO marketing_delivery_runs VALUES(?,?,?,?,?,?,?,?,?)').run(id,campaign.id,b.requestId,requestHash,mode,scheduled.toISOString(),JSON.stringify({campaign,settings,fingerprint:fingerprint(campaign)}),now,actor);
    const insert=db.prepare("INSERT INTO marketing_outbox(id,run_id,campaign_id,mode,contact_id,email,status,updated_at,cost) VALUES(?,?,?,?,?,?,'pending',?,?)");
    for (const contact of ids) { const row=db.prepare('SELECT email FROM marketing_contacts WHERE id=?').get(contact) as {email:string}; insert.run(randomUUID(),id,campaign.id,mode,contact,row.email,now,settings.unitCostRon ?? 0); }
    audit(db,'marketing.delivery.queued.'+mode,id,actor); return {id,replayed:false};
  }).immediate();
}
export type MarketingMessage = { to:string; from:string; reply_to:string; subject:string; html:string; text:string; headers:Record<string,string> };
export type MarketingTransport = (message: MarketingMessage, idempotencyKey:string) => Promise<{id:string}>;
export class DeliveryRejected extends Error {}
/** Only called for explicitly enabled live jobs. Test mode never invokes this adapter. */
export const sendMarketingResend: MarketingTransport = async (message,idempotencyKey) => {
  const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(message),signal:AbortSignal.timeout(10000),redirect:'error'});
  if (!response.ok) { if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 409 && response.status !== 429) throw new DeliveryRejected('PROVIDER_REJECTED'); throw Error('PROVIDER_UNCONFIRMED'); }
  const data=await response.json(); if (typeof data.id !== 'string' || !data.id || data.id.length>200) throw Error('PROVIDER_UNCONFIRMED'); return {id:data.id};
};
function bucharest(value: string) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
function canSpend(db: Database, job: Job, snapshot: Snapshot) {
  if(job.mode==='test') return true;
  const settings=marketingSettings(db), day=bucharest(new Date().toISOString()), month=day.slice(0,7);
  const used=db.prepare("SELECT updated_at,cost,campaign_id FROM marketing_outbox WHERE mode='live' AND status IN ('sending','accepted','unknown','delivered','bounced','complained')").all() as {updated_at:string;cost:number;campaign_id:string}[];
  const daily=used.filter(row=>bucharest(row.updated_at)===day).length, monthly=used.filter(row=>bucharest(row.updated_at).slice(0,7)===month).reduce((n,row)=>n+row.cost,0);
  const campaignCost=used.filter(row=>row.campaign_id===job.campaign_id).reduce((n,row)=>n+row.cost,0);
  return daily < Math.min(settings.dailyLimit,snapshot.settings.dailyLimit) && (settings.monthlyBudgetRon===null || monthly+job.cost <= settings.monthlyBudgetRon+1e-7) && (snapshot.settings.monthlyBudgetRon===null || monthly+job.cost<=snapshot.settings.monthlyBudgetRon+1e-7) && (snapshot.campaign.budgetRon===null || campaignCost+job.cost<=snapshot.campaign.budgetRon+1e-7);
}
function eligible(db: Database, job: Job) {
  const row=db.prepare("SELECT 1 FROM marketing_contacts c WHERE id=? AND email=? AND status='reviewed' AND consent='granted' AND TRIM(consent_evidence)<>'' AND NOT EXISTS(SELECT 1 FROM marketing_contacts s WHERE s.email=c.email AND (s.status='do_not_contact' OR s.consent='withdrawn'))").get(job.contact_id,job.email);
  return !!row && !marketingEmailSuppressed(db,job.email);
}
export async function processMarketingDelivery(db: Database, transport: MarketingTransport=sendMarketingResend) {
  initializeMarketingDelivery(db); const owner=randomUUID(), now=Date.now();
  const acquired=db.transaction(()=>{ const lock=db.prepare('SELECT until_ms FROM marketing_worker WHERE id=1').get() as {until_ms:number}|undefined; if(lock && lock.until_ms>now)return false; db.prepare('INSERT INTO marketing_worker VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,until_ms=excluded.until_ms').run(owner,now+120000); db.prepare("UPDATE marketing_outbox SET status='unknown',updated_at=? WHERE status='sending'").run(new Date().toISOString()); return true; }).immediate();
  if(!acquired) return {processed:0}; let processed=0;
  try {
    const runs=db.prepare('SELECT * FROM marketing_delivery_runs WHERE scheduled_at<=? ORDER BY scheduled_at,id').all(new Date().toISOString()) as Run[];
    for(const run of runs) {
      if(processed>=5)break;
      const readiness=marketingDeliveryReadiness(); if(run.mode==='live' && (!readiness.enabled || !readiness.providerConfigured || !readiness.webhookConfigured))continue;
      const snapshot=JSON.parse(run.payload) as Snapshot, current=getMarketingCampaign(db,run.campaign_id);
      if(current.state==='archived' || fingerprint(current)!==snapshot.fingerprint) {db.prepare("UPDATE marketing_outbox SET status='canceled',updated_at=? WHERE run_id=? AND status='pending'").run(new Date().toISOString(),run.id);continue;}
      if(current.state!=='ready')continue;
      const jobs=db.prepare("SELECT * FROM marketing_outbox WHERE run_id=? AND status='pending' ORDER BY id LIMIT ?").all(run.id,5-processed) as Job[];
      for(const job of jobs) {
        const claimed=db.transaction(()=>{
          if(!eligible(db,job)){db.prepare("UPDATE marketing_outbox SET status='suppressed',updated_at=? WHERE id=? AND status='pending'").run(new Date().toISOString(),job.id);return false;}
          if(!canSpend(db,job,snapshot))return false;
          return !!db.prepare("UPDATE marketing_outbox SET status='sending',updated_at=? WHERE id=? AND status='pending'").run(new Date().toISOString(),job.id).changes;
        }).immediate(); if(!claimed)continue;
        const token=randomBytes(32).toString('base64url'), origin=new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sandbox.nitido.ro').origin;
        db.prepare('INSERT INTO marketing_unsubscribe VALUES(?,?,?)').run(hash(token),job.email,new Date().toISOString());
        const unsubscribe=origin+'/marketing/dezabonare#'+token, html=marketingCampaignHtml(snapshot.campaign,snapshot.settings,unsubscribe);
        try {
          if(run.mode==='test') db.prepare("UPDATE marketing_outbox SET status='captured',html=?,updated_at=? WHERE id=?").run(html,new Date().toISOString(),job.id);
          else {
            // Re-read immediately before external dispatch; no implicit retry after ambiguous outcomes.
            if(!eligible(db,job) || getMarketingCampaign(db,run.campaign_id).state!=='ready' || !marketingDeliveryReadiness().enabled) {db.prepare("UPDATE marketing_outbox SET status='suppressed',updated_at=? WHERE id=?").run(new Date().toISOString(),job.id);continue;}
            const result=await transport({to:job.email,from:`${snapshot.settings.senderName.replace(/[<>\r\n"]/g,'')} <${snapshot.settings.senderEmail}>`,reply_to:snapshot.settings.replyTo,subject:snapshot.campaign.subject,html,text:snapshot.campaign.body+'\n\n'+snapshot.settings.postalAddress+'\nDezabonare: '+unsubscribe,headers:{'List-Unsubscribe':`<${unsubscribe}>`}},'nitido-marketing-'+job.id);
            db.prepare("UPDATE marketing_outbox SET status=CASE WHEN status='sending' THEN 'accepted' ELSE status END,provider_id=?,updated_at=? WHERE id=?").run(result.id,new Date().toISOString(),job.id);
            applyMarketingProviderEvents(db,{...job,provider_id:result.id,status:'accepted'});
            await new Promise(resolve=>setTimeout(resolve,600));
          }
        } catch(error) {db.prepare("UPDATE marketing_outbox SET status=?,updated_at=? WHERE id=? AND status='sending'").run(error instanceof DeliveryRejected?'failed':'unknown',new Date().toISOString(),job.id);}
        processed++;
      }
    }
    return {processed};
  } finally {db.prepare('DELETE FROM marketing_worker WHERE id=1 AND owner=?').run(owner);}
}
export function cancelMarketingRun(db: Database, id: string, actor: string) { initializeMarketingDelivery(db); return db.transaction(()=>{ const changed=db.prepare("UPDATE marketing_outbox SET status='canceled',updated_at=? WHERE run_id=? AND status='pending'").run(new Date().toISOString(),id).changes; audit(db,'marketing.delivery.canceled',id,actor);return {canceled:changed}; }).immediate(); }
export function marketingDeliveryReport(db: Database) {
  initializeMarketingDelivery(db);
  const runs=db.prepare('SELECT id,campaign_id,mode,scheduled_at,created_at,payload FROM marketing_delivery_runs ORDER BY created_at DESC,id LIMIT 100').all() as (Run & {created_at:string})[];
  return {readiness:marketingDeliveryReadiness(),runs:runs.map(run=>({id:run.id,campaignId:run.campaign_id,campaignName:(JSON.parse(run.payload) as Snapshot).campaign.name,mode:run.mode,scheduledAt:run.scheduled_at,createdAt:run.created_at,holdReason:run.mode==='live'&&!marketingDeliveryReadiness().enabled?'Expedierea reală este oprită.':getMarketingCampaign(db,run.campaign_id).state==='paused'?'Campania este în pauză.':new Date(run.scheduled_at)>new Date()?'Așteaptă data programată.':'Mesajele în așteptare sunt procesate în loturi, în limitele zilnice și de buget.',counts:db.prepare('SELECT status,COUNT(*) count FROM marketing_outbox WHERE run_id=? GROUP BY status').all(run.id)})),realEmailsSent:(db.prepare("SELECT COUNT(*) n FROM marketing_outbox WHERE mode='live' AND provider_id IS NOT NULL").get() as {n:number}).n};
}
export function marketingCapturedMessages(db: Database, id: string) { initializeMarketingDelivery(db);return db.prepare("SELECT id,email,html FROM marketing_outbox WHERE run_id=? AND mode='test' AND status='captured' ORDER BY id LIMIT 20").all(id); }
export function unsubscribeMarketing(db: Database, token: unknown) {
  if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token))throw new MarketingError('Link de dezabonare invalid.',400);
  initializeMarketingDelivery(db);
  return db.transaction(()=>{
    const row=db.prepare('SELECT email FROM marketing_unsubscribe WHERE token_hash=?').get(hash(token)) as {email:string}|undefined;
    if(!row)throw new MarketingError('Link de dezabonare invalid.',400);
    suppressMarketingEmail(db,row.email,'unsubscribe');
    db.prepare("UPDATE marketing_contacts SET consent='withdrawn',status='do_not_contact',version=version+1,updated_at=? WHERE email=? AND (consent<>'withdrawn' OR status<>'do_not_contact')").run(new Date().toISOString(),row.email);
    db.prepare("UPDATE marketing_outbox SET status='suppressed',updated_at=? WHERE email=? AND status='pending'").run(new Date().toISOString(),row.email);
    return {unsubscribed:true};
  }).immediate();
}
export function receiveMarketingWebhook(db: Database, raw: string, headers: Record<string,string>) {
  if(!process.env.NITIDO_MARKETING_WEBHOOK_SECRET)throw new MarketingError('Webhook neconfigurat.',503);
  let event: {type:string;data:{email_id?:string}};
  try { new Webhook(process.env.NITIDO_MARKETING_WEBHOOK_SECRET).verify(raw,headers); event=JSON.parse(raw); if(!event || typeof event.type!=='string')throw Error(); }catch{throw new MarketingError('Semnătură invalidă.',401);}
  initializeMarketingDelivery(db);
  return db.transaction(()=>{
    const eventId=headers['svix-id']; if(!eventId || eventId.length>200)throw new MarketingError('Eveniment invalid.');
    const provider=typeof event.data?.email_id==='string'?event.data.email_id:'';
    if(provider.length>200)throw new MarketingError('Eveniment invalid.');
    if(!db.prepare('INSERT OR IGNORE INTO marketing_provider_events VALUES(?,?,?,?)').run(eventId,new Date().toISOString(),event.type,provider).changes)return {replayed:true};
    const job=db.prepare("SELECT * FROM marketing_outbox WHERE provider_id=? AND mode='live'").get(provider) as Job|undefined;
    if(!job)return {ignored:true};
    applyMarketingProviderEvents(db,job);return {received:true};
  }).immediate();
}
function applyMarketingProviderEvents(db:Database,job:Job) {
  const events=db.prepare('SELECT event_type FROM marketing_provider_events WHERE provider_id=?').all(job.provider_id) as {event_type:string}[];
  const types=new Set(events.map(e=>e.event_type));
  const next=types.has('email.complained')?'complained':types.has('email.bounced')?'bounced':types.has('email.delivered')?'delivered':null;
  if(!next)return;
  if(next==='bounced'||next==='complained') {
    suppressMarketingEmail(db,job.email,next);
    db.prepare("UPDATE marketing_contacts SET status='do_not_contact',consent='withdrawn',version=version+1,updated_at=? WHERE email=? AND status<>'do_not_contact'").run(new Date().toISOString(),job.email);
    db.prepare("UPDATE marketing_outbox SET status='suppressed',updated_at=? WHERE email=? AND status='pending'").run(new Date().toISOString(),job.email);
  }
  db.prepare('UPDATE marketing_outbox SET status=? WHERE id=?').run(next,job.id);
}

export function regrantMarketingContact(db:Database,value:unknown,actor:string) {
  const b=value as Record<string,unknown>;
  if(!b || typeof b.id!=='string' || !Number.isInteger(b.version) || typeof b.proof!=='string' || b.proof.trim().length<12 || b.proof.length>1000 || /[\x00-\x1f]/.test(b.proof))throw new MarketingError('Completează dovada noului acord, cu sursă și dată.');
  const proof=b.proof.trim(),contactId=b.id;
  initializeMarketingDelivery(db);
  return db.transaction(()=>{
    const row=db.prepare('SELECT email,version,consent_evidence FROM marketing_contacts WHERE id=?').get(b.id) as {email:string;version:number;consent_evidence:string}|undefined;
    if(!row || row.version!==b.version)throw new MarketingError('Contactul a fost modificat. Reîncarcă lista.',409);
    if(!row.email || b.confirmation!==row.email || proof===row.consent_evidence.trim())throw new MarketingError('Confirmă adresa exactă și înregistrează o dovadă nouă de acord.');
    const suppression=db.prepare('SELECT reason FROM marketing_suppressions WHERE email_hash=?').get(emailHash(row.email)) as {reason:string}|undefined;
    if(suppression && ['bounced','complained'].includes(suppression.reason))throw new MarketingError('Adresa are o respingere sau reclamație la furnizor. Este necesară verificarea acesteia înainte de reactivare.',409);
    db.prepare('DELETE FROM marketing_suppressions WHERE email_hash=?').run(emailHash(row.email));
    db.prepare("UPDATE marketing_contacts SET consent='granted',consent_evidence=?,status='reviewed',version=version+1,updated_at=? WHERE email=?").run(proof,new Date().toISOString(),row.email);
    audit(db,'marketing.consent.regranted',contactId,actor);return {updated:true};
  }).immediate();
}
