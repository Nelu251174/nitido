import {createHash,randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {emailConfigured} from './email';

export const OWNER_EMAIL_RETRY_WINDOW_MS=23*60*60*1000;
const LEASE_MS=120_000;
export type OwnerEmailResult={id:string}|{error:string;retryable:boolean};
export type OwnerEmail={to:string;subject:string;html:string;idempotencyKey:string};
export type OwnerSender=(mail:OwnerEmail)=>Promise<OwnerEmailResult>;
export function ownerNotificationConfig(){
 const recipient=(process.env.NITIDO_OWNER_NOTIFICATION_EMAIL??'').trim();
 const recipientValid=recipient.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
 return {enabled:process.env.NITIDO_OWNER_NOTIFICATIONS_ENABLED==='true',recipient:recipientValid?recipient:null,emailConfigured:emailConfigured()};
}
const eventId=(key:string)=>'owner_'+createHash('sha256').update(key).digest('hex').slice(0,32);
export function enqueueOwnerEvent(db:Database,type:'CLIENT_REGISTERED'|'FIRM_REGISTERED'|'DAILY_DOWNLOAD_REPORT'|'SYSTEM_TEST',key:string,payload:object={},userId:string|null=null,now=Date.now()){
 const id=eventId(key);
 db.prepare('INSERT OR IGNORE INTO admin_owner_events(id,event_key,event_type,user_id,payload_json,created_ms) VALUES(?,?,?,?,?,?)').run(id,key,type,userId,JSON.stringify(payload),now);
 return id;
}
/** Called inside the same transaction as user/firm creation; no country restriction. */
export function queueOwnerRegistration(db:Database,userId:string,role:'client'|'firma',connectionCountry:string|null=null,now=Date.now()){
 const country=connectionCountry&&/^[A-Z]{2}$/.test(connectionCountry)?connectionCountry:null;
 return enqueueOwnerEvent(db,role==='firma'?'FIRM_REGISTERED':'CLIENT_REGISTERED','signup:'+userId,{connectionCountry:country},userId,now);
}
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function adminLink(){return process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro'?'https://sandbox.nitido.ro/admin#inscrieri':'https://nitido.ro/admin#inscrieri';}
type EventRow={id:string;event_type:string;user_id:string|null;payload_json:string;created_ms:number;first_dispatch_ms:number|null;attempt_count:number};
function accountLabel(role:string|null,business:number){return role==='firma'?'Firmă de curățenie':role==='client'?(business?'Client comercial (firmă)':'Client privat'):null;}
export function ownerEventMail(db:Database,row:EventRow,to:string):OwnerEmail|null{
 const payload=JSON.parse(row.payload_json);
 let subject:string,html:string;
 if(row.event_type==='SYSTEM_TEST'){
  subject='NITIDO — verificare alerte administrator';html='<p>Mesaj de verificare pentru alertele NITIDO. Nu reprezintă un client nou, o firmă nouă sau o descărcare.</p>';
 }else if(row.event_type==='DAILY_DOWNLOAD_REPORT'){
  subject='NITIDO — raport zilnic descărcări '+String(payload.digestDate);
  html='<h2>Descărcări oficiale pe țări</h2><p>Sursele pot publica datele cu întârziere. Datele în așteptare nu înseamnă zero descărcări.</p>';
  for(const report of payload.reports??[]){
   html+=`<h3>${escape(report.source==='apple'?'Apple App Store':'Google Play')} — ${escape(report.reportDate)}</h3>`;
   if(report.status!=='ready'){html+=`<p>${report.status==='pending'?'Raport în așteptare':'Acces la raport indisponibil'} (${escape(report.reason??'UNKNOWN')}).</p>`;continue;}
   html+=`<p>${report.metric==='app_units'?'Descărcări inițiale / redescărcări':report.metric==='device_installs'?'Instalări pe dispozitive':'Evenimente de instalare'}</p><ul>`;
   if(!report.countries.length)html+='<li>0 unități raportate pentru această aplicație.</li>';
   for(const c of report.countries)html+=`<li>${escape(c.country)}: ${escape(c.installs)}${report.metric==='app_units'?` / ${escape(c.redownloads??0)}`:''}</li>`;
   html+='</ul>';
  }
 }else{
  const user=row.user_id?db.prepare('SELECT role,name,email,phone,is_business,company_name FROM users WHERE id=?').get(row.user_id) as {role:string;name:string;email:string;phone:string|null;is_business:number;company_name:string|null}|undefined:undefined;
  if(!user||user.role!==(row.event_type==='FIRM_REGISTERED'?'firma':'client'))return null;
  const accountType=accountLabel(user.role,user.is_business);
  subject='Înscriere nouă pe NÍTIDO: '+user.name.replace(/[\r\n\u0000-\u001f\u007f]+/g,' ').trim().slice(0,150);
  const registeredAt=new Date(row.created_ms).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'});
  html=`<h2>Cont nou pe NÍTIDO</h2><p><strong>Nume:</strong> ${escape(user.name)}</p><p><strong>Email:</strong> ${escape(user.email)}</p><p><strong>Tip cont:</strong> ${accountType}</p><p><strong>Telefon:</strong> ${escape(user.phone??'necompletat')}</p>${user.is_business&&user.company_name?`<p><strong>Firmă client:</strong> ${escape(user.company_name)}</p>`:''}<p><strong>Înregistrare:</strong> ${escape(registeredAt)} (ora României)</p><p>Țara conexiunii, estimată din IP: ${escape(payload.connectionCountry??'nedeterminată')}</p>`;
  if(user.role==='firma')html+='<p>Cont creat. Verificarea și aprobarea firmei sunt etape distincte.</p>';
 }
 html+=`<p><a href="${adminLink()}">Deschide alertele din administrare</a></p>`;
 return {to,subject,html,idempotencyKey:'nitido-owner-'+row.id};
}
/** Resend retains idempotency keys for 24 hours. Automatic retries stop earlier. */
export const sendOwnerEmail:OwnerSender=async mail=>{
 if(!emailConfigured())return {error:'EMAIL_NOT_CONFIGURED',retryable:false};
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':mail.idempotencyKey},body:JSON.stringify({from:process.env.RESEND_FROM,to:[mail.to],subject:mail.subject,html:mail.html})});
  if(!response.ok)return {error:'EMAIL_HTTP_'+response.status,retryable:response.status===429||response.status>=500};
  const value=await response.json();return typeof value.id==='string'&&value.id?{id:value.id}:{error:'EMAIL_RESPONSE_UNKNOWN',retryable:true};
 }catch{return {error:'EMAIL_RESPONSE_UNKNOWN',retryable:true};}
};
export async function processOwnerEmails(db:Database,options:{ids?:string[];sender?:OwnerSender;now?:number;limit?:number}={}){
 const config=ownerNotificationConfig();
 const result={selected:0,accepted:0,failed:0,suppressed:0,uncertain:0};
 if(!config.enabled||!config.recipient||!config.emailConfigured)return {status:'disabled' as const,...result};
 if(options.ids?.length===0)return {status:'completed' as const,...result};
 const now=options.now??Date.now(),limit=Math.max(1,Math.min(options.limit??5,5));
 db.prepare("UPDATE admin_owner_events SET email_status='uncertain',last_error='IDEMPOTENCY_WINDOW_EXPIRED',claim_token=NULL WHERE email_status IN ('failed','sending') AND first_dispatch_ms IS NOT NULL AND first_dispatch_ms<=? AND (claim_ms IS NULL OR claim_ms<=?)").run(now-OWNER_EMAIL_RETRY_WINDOW_MS,now-LEASE_MS);
 db.prepare("UPDATE admin_owner_events SET email_status='failed',last_error='INTERRUPTED',claim_token=NULL WHERE email_status='sending' AND claim_ms<=? AND first_dispatch_ms>?").run(now-LEASE_MS,now-OWNER_EMAIL_RETRY_WINDOW_MS);
 const rows=db.prepare(`SELECT id FROM admin_owner_events WHERE email_status IN ('pending','failed') AND next_attempt_ms<=? AND attempt_count<5 ${options.ids?'AND id IN ('+options.ids.map(()=>'?').join(',')+')':''} ORDER BY created_ms,id LIMIT ?`).all(now,...(options.ids??[]),limit) as {id:string}[];
 for(const {id} of rows){
  const token=randomUUID();
  const row=db.transaction(()=>{
   const changed=db.prepare("UPDATE admin_owner_events SET email_status='sending',claim_token=?,claim_ms=?,first_dispatch_ms=COALESCE(first_dispatch_ms,?),attempt_count=attempt_count+1 WHERE id=? AND email_status IN ('pending','failed') AND next_attempt_ms<=? AND attempt_count<5").run(token,now,now,id,now);
   return changed.changes?db.prepare('SELECT * FROM admin_owner_events WHERE id=?').get(id) as EventRow:null;
  }).immediate();
  if(!row)continue;result.selected++;
  const mail=ownerEventMail(db,row,config.recipient);
  if(!mail){db.prepare("UPDATE admin_owner_events SET email_status='suppressed',last_error='ACCOUNT_UNAVAILABLE',claim_token=NULL WHERE id=? AND claim_token=?").run(id,token);result.suppressed++;continue;}
  // A retry must carry the exact same payload for the provider's idempotency key.
  // Store only a digest, not another copy of the account's personal information.
  const fingerprint=createHash('sha256').update(JSON.stringify([process.env.RESEND_FROM,mail])).digest('hex');
  const stored=db.prepare('SELECT mail_fingerprint FROM admin_owner_events WHERE id=?').get(id) as {mail_fingerprint:string|null};
  if(stored.mail_fingerprint&&stored.mail_fingerprint!==fingerprint){
   db.prepare("UPDATE admin_owner_events SET email_status='uncertain',last_error='MAIL_CHANGED_AFTER_DISPATCH',claim_token=NULL WHERE id=? AND claim_token=?").run(id,token);result.uncertain++;continue;
  }
  db.prepare('UPDATE admin_owner_events SET mail_fingerprint=? WHERE id=? AND claim_token=?').run(fingerprint,id,token);
  let sent:OwnerEmailResult;try{sent=await (options.sender??sendOwnerEmail)(mail);}catch{sent={error:'EMAIL_RESPONSE_UNKNOWN',retryable:true};}
  if('id' in sent&&typeof sent.id==='string'&&sent.id){
   db.prepare("UPDATE admin_owner_events SET email_status='sent',sent_ms=?,provider_message_id=?,last_error=NULL,claim_token=NULL WHERE id=? AND claim_token=? AND email_status='sending'").run(now,sent.id,id,token);result.accepted++;
  }else{
   const error='error' in sent&&/^[A-Z0-9_]{1,80}$/.test(sent.error)?sent.error:'EMAIL_RESPONSE_UNKNOWN';
   const retry='retryable' in sent&&sent.retryable;
   db.prepare("UPDATE admin_owner_events SET email_status='failed',last_error=?,next_attempt_ms=?,attempt_count=CASE WHEN ? THEN attempt_count ELSE 5 END,claim_token=NULL WHERE id=? AND claim_token=? AND email_status='sending'").run(error,now+Math.min(60*60_000,60_000*2**(row.attempt_count-1)),retry?1:0,id,token);result.failed++;
  }
 }
 return {status:'completed' as const,...result};
}
export function ownerInbox(db:Database,actor:string){
 const events=db.prepare(`SELECT e.id,e.event_type,e.payload_json,e.created_ms,e.email_status,e.attempt_count,e.last_error,e.sent_ms,u.role,u.name,u.email,u.is_business,r.read_ms FROM admin_owner_events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN admin_owner_reads r ON r.event_id=e.id AND r.admin_id=? ORDER BY e.created_ms DESC,e.id DESC LIMIT 100`).all(actor) as (EventRow&{read_ms:number|null;name:string|null;email:string|null;role:string|null;is_business:number|null})[];
 const unread=db.prepare('SELECT COUNT(*) n FROM admin_owner_events e WHERE NOT EXISTS(SELECT 1 FROM admin_owner_reads r WHERE r.event_id=e.id AND r.admin_id=?)').get(actor) as {n:number};
 return {events:events.map(({payload_json,is_business,...row})=>({...row,accountType:['CLIENT_REGISTERED','FIRM_REGISTERED'].includes(row.event_type)?accountLabel(row.role,is_business??0):null,payload:JSON.parse(payload_json)})),unread:unread.n,config:ownerNotificationConfig()};
}
export function markOwnerEventsRead(db:Database,ids:string[],actor:string,now=Date.now()){
 if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!/^owner_[a-f0-9]{32}$/.test(id)))throw Error('INVALID_EVENT_IDS');
 return db.transaction(()=>{let changed=0;for(const id of new Set(ids))changed+=db.prepare('INSERT OR IGNORE INTO admin_owner_reads(event_id,admin_id,read_ms) SELECT id,?,? FROM admin_owner_events WHERE id=?').run(actor,now,id).changes;return {changed};}).immediate();
}
