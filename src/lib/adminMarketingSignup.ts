import type {Database} from 'better-sqlite3';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {initializeMarketing,MarketingError,saveMarketingContacts,updateMarketingContact,linkMarketingRegion} from './adminMarketing';
import {MARKETING_CATEGORIES,type MarketingContact} from './adminMarketingShared';
import {marketingRegion} from './adminMarketingRegions';
import {marketingEmailDomain,type DomainReader} from './adminMarketingEmailVerification';
import {marketingEmailSuppressed,suppressMarketingEmail} from './adminMarketingSuppression';
import {MARKETING_SIGNUP_CONSENT,MARKETING_SIGNUP_CONSENT_VERSION,type MarketingSignupRow,type MarketingSignupView} from './adminMarketingSignupShared';
export const MARKETING_SIGNUP_SCHEMA=`CREATE TABLE IF NOT EXISTS marketing_signups(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('individual','business','cleaning')),county_code TEXT NOT NULL,city TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','withdrawn')),consent_version TEXT NOT NULL,consent_text TEXT NOT NULL,requested_at TEXT NOT NULL,confirmed_at TEXT,contact_id TEXT,
 confirmation_hash TEXT UNIQUE,expires_at TEXT,campaign_id TEXT NOT NULL DEFAULT '',review_required TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,UNIQUE(category,email,county_code));
CREATE INDEX IF NOT EXISTS marketing_signup_queue ON marketing_signups(state,county_code,requested_at);`;
export function initializeMarketingSignup(db:Database){initializeMarketing(db);db.exec(MARKETING_SIGNUP_SCHEMA);}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const now=()=>new Date().toISOString();
function text(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.trim().length>max||/[\x00-\x1f\x7f]/.test(v))throw new MarketingError('Verifică datele completate.');return v.trim();}
function audit(db:Database,action:string,id:string,actor:string){db.prepare('INSERT INTO admin_audit_log(id,action,target_id,details) VALUES(?,?,?,?)').run(randomUUID(),action,id,JSON.stringify({actor}));}
export function submitMarketingSignup(db:Database,value:unknown){
 const b=value as Record<string,unknown>;if(!b||typeof b!=='object'||Array.isArray(b))throw new MarketingError('Cerere invalidă.');
 if(b.website)return {received:true}; // Honeypot has the same public response and never creates a lead.
 if(b.consent!==true||b.consentVersion!==MARKETING_SIGNUP_CONSENT_VERSION)throw new MarketingError('Confirmă acordul pentru comunicările NITIDO.');
 const name=text(b.name,100),email=text(b.email,254).toLowerCase(),city=text(b.city,100),region=marketingRegion(b.county);
 if(!region||!Object.hasOwn(MARKETING_CATEGORIES,String(b.category))||!marketingEmailDomain(email))throw new MarketingError('Verifică emailul, județul și categoria.');
 initializeMarketingSignup(db);
 db.transaction(()=>{
  db.prepare("DELETE FROM marketing_signups WHERE state='pending' AND requested_at<?").run(new Date(Date.now()-30*86400000).toISOString());
  let campaign='';if(typeof b.campaign==='string'&&/^[a-f0-9-]{36}$/i.test(b.campaign)&&db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_campaigns'").get()&&db.prepare('SELECT 1 FROM marketing_campaigns WHERE id=?').get(b.campaign))campaign=b.campaign;
  db.prepare('INSERT OR IGNORE INTO marketing_signups(id,name,email,category,county_code,city,consent_version,consent_text,requested_at,campaign_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),name,email,b.category as string,region.code,region.code==='B'?'București':city,MARKETING_SIGNUP_CONSENT_VERSION,MARKETING_SIGNUP_CONSENT,now(),campaign);
 }).immediate();return {received:true};
}
/** Internal preparation only; a transport must be separately authorized. Never return this token through public/admin signup APIs. */
export function prepareMarketingSignupConfirmation(db:Database,id:string){
 if(process.env.NITIDO_MARKETING_DELIVERY_ENABLED!=='true')throw new MarketingError('Trimiterea emailurilor este oprită.',409);
 initializeMarketingSignup(db);const token=randomBytes(32).toString('base64url');
 const changed=db.prepare("UPDATE marketing_signups SET confirmation_hash=?,expires_at=?,version=version+1 WHERE id=? AND state='pending' AND requested_at>=?").run(digest(token),new Date(Date.now()+7*86400000).toISOString(),id,new Date(Date.now()-30*86400000).toISOString()).changes;
 if(!changed)throw new MarketingError('Înscrierea nu poate fi confirmată.',409);return token;
}
export function confirmMarketingSignup(db:Database,value:unknown){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw new MarketingError('Linkul de confirmare nu este valid sau a expirat.');
 initializeMarketingSignup(db);
 return db.transaction(()=>{
  const row=db.prepare('SELECT * FROM marketing_signups WHERE confirmation_hash=?').get(digest(value)) as MarketingSignupRow&{consent_version:string;consent_text:string;expires_at:string}|undefined;
  if(!row||row.state==='withdrawn'||!row.expires_at||row.expires_at<now())throw new MarketingError('Linkul de confirmare nu este valid sau a expirat.');
  if(row.state==='confirmed')return {confirmed:true,emailToVerify:null};
  const protectedEmail=marketingEmailSuppressed(db,row.email)||!!db.prepare("SELECT 1 FROM marketing_contacts WHERE email=? AND (consent='withdrawn' OR status='do_not_contact')").get(row.email);
  let contactId:string|null=null;
  if(!protectedEmail){
   const region=marketingRegion(row.county_code)!,evidence=`Înscriere Marketing ${row.id}; formular ${row.consent_version}; acord ${row.requested_at}; adresă confirmată ${now()}.`;
   const input={name:row.name,email:row.email,category:row.category,county:region.name,city:row.city,source:'NITIDO · formular Marketing confirmat',consent:'granted' as const,consentEvidence:evidence};
   saveMarketingContacts(db,[input],'marketing-signup:confirmed');
   const contact=db.prepare("SELECT id,status,consent,version FROM marketing_contacts WHERE category=? AND email=?").get(row.category,row.email) as Pick<MarketingContact,'id'|'status'|'consent'|'version'>;
   contactId=contact.id;linkMarketingRegion(db,contact.id,{...input,phone:'',cui:'',website:'',notes:''});
   if(contact.consent==='not_recorded')updateMarketingContact(db,{id:contact.id,version:contact.version,status:contact.status,consent:'granted' as const,consentEvidence:evidence});
   db.prepare("INSERT INTO marketing_email_checks(email,source_status) VALUES(?,'verified') ON CONFLICT(email) DO UPDATE SET source_status='verified',status=CASE WHEN source_status<>'verified' THEN 'pending' ELSE status END").run(row.email);
  }
  db.prepare("UPDATE marketing_signups SET state='confirmed',confirmed_at=?,contact_id=?,review_required=?,version=version+1 WHERE id=?").run(now(),contactId,protectedEmail?'protected_contact':'',row.id);
  audit(db,'marketing.signup.confirmed',row.id,'email-owner-confirmation');return {confirmed:true,emailToVerify:protectedEmail?null:row.email};
 }).immediate();
}
export function marketingSignupView(db:Database,params:URLSearchParams):MarketingSignupView{
 initializeMarketingSignup(db);const region=params.get('county')?marketingRegion(params.get('county')):null,state=params.get('state')??'',category=params.get('category')??'';
 if(params.get('county')&&!region||state&&!['pending','confirmed','withdrawn'].includes(state)||category&&!Object.hasOwn(MARKETING_CATEGORIES,category))throw new MarketingError('Filtru invalid.');
 const page=Number(params.get('page')??1);if(!Number.isSafeInteger(page)||page<1)throw new MarketingError('Pagină invalidă.');
 const where="WHERE (?='' OR county_code=?) AND (?='' OR state=?) AND (?='' OR category=?)",values=[region?.code??'',region?.code??'',state,state,category,category];
 const total=(db.prepare('SELECT COUNT(*) n FROM marketing_signups '+where).get(...values) as {n:number}).n;
 const items=db.prepare('SELECT id,name,email,category,county_code,city,state,requested_at,confirmed_at,contact_id,review_required,consent_version,consent_text,version FROM marketing_signups '+where+' ORDER BY requested_at DESC,id LIMIT 50 OFFSET ?').all(...values,(page-1)*50) as MarketingSignupRow[];
 const counts={pending:0,confirmed:0,withdrawn:0};for(const r of db.prepare('SELECT state,COUNT(*) n FROM marketing_signups GROUP BY state').all() as {state:keyof typeof counts;n:number}[])counts[r.state]=r.n;
 return {items,total,page,pages:Math.max(1,Math.ceil(total/50)),counts};
}
export function withdrawMarketingSignup(db:Database,id:unknown,version:unknown,actor:string){
 initializeMarketingSignup(db);if(typeof id!=='string'||!Number.isSafeInteger(version))throw new MarketingError('Cerere invalidă.');
 return db.transaction(()=>{
  const row=db.prepare('SELECT state,version,contact_id,email FROM marketing_signups WHERE id=?').get(id) as {state:string;version:number;contact_id:string|null;email:string}|undefined;
  if(!row||row.version!==version)throw new MarketingError('Înscrierea a fost modificată. Reîncarcă lista.',409);
  if(row.state==='confirmed'&&row.contact_id){const c=db.prepare('SELECT id,status,version FROM marketing_contacts WHERE id=?').get(row.contact_id) as Pick<MarketingContact,'id'|'status'|'version'>|undefined;if(c)updateMarketingContact(db,{...c,consent:'withdrawn'});}
  if(row.state==='confirmed')suppressMarketingEmail(db,row.email,'manual');
  db.prepare("UPDATE marketing_signups SET state='withdrawn',confirmation_hash=NULL,expires_at=NULL,version=version+1 WHERE id=?").run(id);audit(db,'marketing.signup.withdrawn',id,actor);return {withdrawn:true};
 }).immediate();
}

const cleanupAt=new WeakMap<Database,number>();
export async function processMarketingAudienceChecks(db:Database,reader?:DomainReader){
 initializeMarketingSignup(db);
 if((cleanupAt.get(db)??0)<Date.now()-3600000){db.prepare("DELETE FROM marketing_signups WHERE state='pending' AND requested_at<?").run(new Date(Date.now()-30*86400000).toISOString());cleanupAt.set(db,Date.now());}
 db.prepare("INSERT OR IGNORE INTO marketing_email_checks(email,source_status) SELECT DISTINCT email,'verified' FROM marketing_contacts WHERE email<>'' AND status='reviewed' AND consent='granted' AND TRIM(consent_evidence)<>'' AND NOT EXISTS(SELECT 1 FROM marketing_email_checks e WHERE e.email=marketing_contacts.email) LIMIT 100").run();
 db.prepare("UPDATE marketing_email_checks SET source_status='verified',status='pending',attempts=0,next_attempt_at=NULL WHERE source_status<>'verified' AND EXISTS(SELECT 1 FROM marketing_contacts c WHERE c.email=marketing_email_checks.email AND c.status='reviewed' AND c.consent='granted' AND TRIM(c.consent_evidence)<>'')").run();
 const rows=db.prepare("SELECT DISTINCT e.email FROM marketing_email_checks e JOIN marketing_contacts c ON c.email=e.email LEFT JOIN marketing_signups s ON s.contact_id=c.id WHERE ((s.state='confirmed' AND s.review_required='') OR (c.status='reviewed' AND c.consent='granted' AND TRIM(c.consent_evidence)<>'')) AND e.source_status='verified' AND e.status='pending' AND (e.next_attempt_at IS NULL OR e.next_attempt_at<=?) LIMIT 3").all(now()) as {email:string}[];
 const {verifyMarketingEmail}=await import('./adminMarketingEmailVerification');for(const row of rows)await verifyMarketingEmail(db,row.email,reader);
}
