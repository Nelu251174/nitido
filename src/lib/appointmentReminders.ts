import type {Database} from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {emailConfigured,sendEmail} from './email';
import {emailIsVerified} from './emailVerification';
import {sendPush,PushProviderError,type PushPlatform} from './pushProviders';
import {WorkspaceError} from './workspace';
const HOUR=3600000;
type Appointment={id:string;firm_id:string;user_id:string;scheduled_at:string;city:string;street:string;floor:string|null;postal_code:string|null;status:string;verified:number;suspended_until:string|null};
type Reminder={id:string;job_id:string;firm_id:string;scheduled_at:string;kind:'24h'|'2h';channel:'inapp'|'push'|'email';device_id:string;status:string;attempts:number;claim_token:string|null;created_ms:number};
const appointmentSql=`SELECT j.id,j.accepted_firm_id firm_id,f.user_id,j.scheduled_at,j.city,j.street,j.floor,j.postal_code,j.status,f.verified,f.suspended_until FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id`;
const path=(id:string)=>'/firma/programari?jobId='+encodeURIComponent(id);
export function appointmentReminderConfig(){return {emailReady:emailConfigured(),enabled:process.env.NITIDO_APPOINTMENT_REMINDERS_ENABLED==='true',pushEnabled:process.env.PUSH_ENABLED==='true',androidReady:!!process.env.FIREBASE_PROJECT_ID&&!!process.env.FIREBASE_CLIENT_EMAIL&&!!process.env.FIREBASE_PRIVATE_KEY,iosReady:!!process.env.APNS_KEY_ID&&!!process.env.APNS_TEAM_ID&&!!process.env.APNS_PRIVATE_KEY&&!!process.env.APNS_BUNDLE_ID&&(process.env.NEXT_PUBLIC_SITE_URL!=='https://nitido.ro'||process.env.APNS_USE_SANDBOX==='false')};}
function eligible(a:Appointment|undefined,now:number){return !!a&&a.status==='accepted'&&a.verified===1&&(!a.suspended_until||Number.isFinite(Date.parse(a.suspended_until))&&Date.parse(a.suspended_until)<=now)&&Number.isFinite(Date.parse(a.scheduled_at))&&Date.parse(a.scheduled_at)>now;}
function stage(a:Appointment,now:number):'24h'|'2h'|null{const left=Date.parse(a.scheduled_at)-now;return left>0&&left<=2*HOUR?'2h':left>2*HOUR&&left<=24*HOUR?'24h':null;}
function valid(db:Database,r:Reminder,now:number){const a=db.prepare(appointmentSql+' WHERE j.id=? AND j.accepted_firm_id=? AND j.scheduled_at=?').get(r.job_id,r.firm_id,r.scheduled_at) as Appointment|undefined;return eligible(a,now)&&stage(a!,now)===r.kind?a:null;}
/** Inbox reads hide obsolete reminders immediately, even before the next worker run. */
export function currentAppointmentNotices(db:Database,userId:string){return db.prepare(`SELECT n.id,n.message,n.path,n.created_at FROM workspace_notices n
 WHERE n.user_id=? AND n.read_at IS NULL AND (n.id NOT LIKE 'appointment:%' OR EXISTS(
 SELECT 1 FROM appointment_reminders r JOIN jobs j ON j.id=r.job_id JOIN firms f ON f.id=r.firm_id
 WHERE n.id='appointment:'||r.id AND f.user_id=n.user_id AND j.accepted_firm_id=r.firm_id AND j.scheduled_at=r.scheduled_at AND j.status='accepted' AND j.scheduled_at>?))
 ORDER BY n.created_at DESC LIMIT 30`).all(userId,new Date().toISOString());}
export function listFirmAppointments(db:Database,firmId:string,jobId:string|null=null){return (db.prepare(appointmentSql+` WHERE f.id=? AND j.status IN ('accepted','arrived') AND j.scheduled_at>? AND (? IS NULL OR j.id=?) ORDER BY j.scheduled_at,j.id LIMIT 100`).all(firmId,new Date().toISOString(),jobId,jobId) as Appointment[]).map(a=>({id:a.id,city:a.city,street:a.street,floor:a.floor,postalCode:a.postal_code,scheduledAt:a.scheduled_at,status:a.status,
 confirmation:db.prepare('SELECT confirmed_at FROM appointment_acknowledgments WHERE job_id=? AND firm_id=? AND scheduled_at=?').get(a.id,firmId,a.scheduled_at)??null}));}
export function acknowledgeAppointment(db:Database,firmId:string,userId:string,jobId:unknown,scheduledAt:unknown){
 if(typeof jobId!=='string'||jobId.length>100||typeof scheduledAt!=='string'||scheduledAt.length>40)throw new WorkspaceError('Programare invalidă.',400);
 return db.transaction(()=>{const a=db.prepare(appointmentSql+' WHERE j.id=? AND f.id=? AND f.user_id=?').get(jobId,firmId,userId) as Appointment|undefined;
 if(!a)throw new WorkspaceError('Programare inexistentă.',404);if(a.scheduled_at!==scheduledAt||!eligible(a,Date.now()))throw new WorkspaceError('Programarea s-a schimbat sau nu mai este confirmabilă. Actualizează lista.',409);
 db.prepare('INSERT OR IGNORE INTO appointment_acknowledgments VALUES(?,?,?,?,?)').run(jobId,firmId,scheduledAt,userId,new Date().toISOString());return {ok:true,confirmation:db.prepare('SELECT confirmed_at FROM appointment_acknowledgments WHERE job_id=? AND firm_id=? AND scheduled_at=?').get(jobId,firmId,scheduledAt)};
 }).immediate();
}
/** Claims one current stage per booking; late workers skip the obsolete 24h stage. */
export function queueAppointmentReminders(db:Database){
 if(!appointmentReminderConfig().enabled)return {queued:0};
 return db.transaction(()=>{const now=Date.now(),rows=db.prepare(appointmentSql+" WHERE j.status='accepted' AND j.scheduled_at>? AND j.scheduled_at<=? AND NOT EXISTS(SELECT 1 FROM appointment_reminders r WHERE r.job_id=j.id AND r.firm_id=j.accepted_firm_id AND r.scheduled_at=j.scheduled_at AND r.channel='inapp' AND r.kind=CASE WHEN j.scheduled_at<=? THEN '2h' ELSE '24h' END) ORDER BY j.scheduled_at,j.id LIMIT 500").all(new Date(now).toISOString(),new Date(now+24*HOUR).toISOString(),new Date(now+2*HOUR).toISOString()) as Appointment[];let queued=0;
 for(const a of rows){if(!eligible(a,now))continue;const kind=stage(a,now)!;
 const insert=(channel:string,device='')=>{queued+=db.prepare('INSERT OR IGNORE INTO appointment_reminders(id,job_id,firm_id,scheduled_at,kind,channel,device_id,created_ms) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),a.id,a.firm_id,a.scheduled_at,kind,channel,device,now).changes;};
 insert('inapp');const email=(db.prepare('SELECT email FROM users WHERE id=?').get(a.user_id) as {email:string|null}|undefined)?.email;if(email&&emailIsVerified(db,a.user_id))insert('email',createHash('sha256').update(email).digest('hex'));for(const d of db.prepare('SELECT id FROM push_devices WHERE user_id=? AND push_enabled=1 AND revoked_at IS NULL ORDER BY id LIMIT 10').all(a.user_id) as {id:string}[])insert('push',d.id);
 }return {queued};}).immediate();
}
type Sender=typeof sendPush;
export async function processAppointmentReminders(db:Database,sender:Sender=sendPush,emailSender:typeof sendEmail=sendEmail){
 if(!appointmentReminderConfig().enabled)return {queued:0,sent:0,suppressed:0,blocked:0};
 const {queued}=queueAppointmentReminders(db),began=Date.now();let sent=0,suppressed=0,blocked=0;
 db.prepare("UPDATE appointment_reminders SET status=CASE WHEN dispatch_ms IS NULL THEN 'failed' ELSE 'unknown' END,last_error='LEASE_EXPIRED',next_ms=? WHERE status='sending' AND claimed_ms<?").run(Date.now(),Date.now()-5*60000);
 const rows=db.prepare("SELECT * FROM appointment_reminders WHERE status IN ('pending','failed','blocked') AND attempts<3 AND next_ms<=? ORDER BY created_ms,id LIMIT 10").all(Date.now()) as Reminder[];
 for(const r of rows){if(Date.now()-began>30000)break;
 const token=randomUUID();const claim=db.transaction(()=>{
 const a=valid(db,r,Date.now());if(!a){db.prepare("UPDATE appointment_reminders SET status='suppressed',last_error='OBSOLETE' WHERE id=? AND status IN ('pending','failed','blocked')").run(r.id);return null;}
 const got=db.prepare("UPDATE appointment_reminders SET status='sending',claim_token=?,claimed_ms=?,dispatch_ms=NULL WHERE id=? AND status IN ('pending','failed','blocked') AND next_ms<=?").run(token,Date.now(),r.id,Date.now());return got.changes?a:undefined;
 }).immediate();
 if(claim===null){suppressed++;continue;}if(!claim)continue;
 const a=claim,stamp=new Intl.DateTimeFormat('ro-RO',{timeZone:'Europe/Bucharest',dateStyle:'medium',timeStyle:'short'}).format(new Date(a.scheduled_at));
 const body=`Programare ${stamp}, ${a.city}. Deschide rezervarea pentru adresă și confirmă că ajungi.`;
 const finish=(status:string,error:string|null=null,provider:string|null=null)=>db.prepare('UPDATE appointment_reminders SET status=?,last_error=?,provider_id=?,next_ms=? WHERE id=? AND claim_token=? AND status=\'sending\'').run(status,error,provider,Date.now()+5*60000,r.id,token);
 if(r.channel==='inapp'){
  db.transaction(()=>{if(!valid(db,r,Date.now())){finish('suppressed','OBSOLETE');suppressed++;return;}
  db.prepare('INSERT OR IGNORE INTO workspace_notices(id,user_id,job_id,message,path,created_at) VALUES(?,?,?,?,?,?)').run('appointment:'+r.id,a.user_id,a.id,body,path(a.id),new Date().toISOString());finish('sent');sent++;}).immediate();continue;
 }
 if(r.channel==='email'){
  const email=(db.prepare('SELECT email FROM users WHERE id=?').get(a.user_id) as {email:string|null}|undefined)?.email;
  if(!email||!emailIsVerified(db,a.user_id)||createHash('sha256').update(email).digest('hex')!==r.device_id){finish('suppressed','EMAIL_CHANGED_OR_UNVERIFIED');suppressed++;continue;}
  const origin=process.env.NEXT_PUBLIC_SITE_URL??'';
  if(!emailConfigured()||!['https://nitido.ro','https://sandbox.nitido.ro'].includes(origin)){finish('blocked','EMAIL_NOT_CONFIGURED');blocked++;continue;}
  if(!valid(db,r,Date.now())){finish('suppressed','OBSOLETE');suppressed++;continue;}
  if(!db.prepare("UPDATE appointment_reminders SET dispatch_ms=?,attempts=attempts+1 WHERE id=? AND claim_token=? AND status='sending'").run(Date.now(),r.id,token).changes)continue;
  const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  try{const accepted=await emailSender({to:email,subject:'NITIDO — reamintire programare',idempotencyKey:'appointment:'+r.id,html:`<h1>Reamintire programare</h1><p>${escape(body)}</p><p><a href="${escape(origin+path(a.id))}">Deschide programarea și confirmă că ajungi</a></p><p>Data și ora sunt cele din România. Dacă programarea s-a modificat, verifică datele actuale din cont.</p>`});if(accepted){finish('sent');sent++;}else finish('unknown','EMAIL_ACCEPTANCE_UNKNOWN');}catch{finish('unknown','EMAIL_ACCEPTANCE_UNKNOWN');}
  continue;
 }
 const preference=db.prepare('SELECT job_status_notifications enabled FROM notification_preferences WHERE user_id=?').get(a.user_id) as {enabled:number}|undefined;
 if(preference?.enabled===0){finish('suppressed','PREFERENCE_DISABLED');suppressed++;continue;}
 const device=db.prepare('SELECT platform,device_token FROM push_devices WHERE id=? AND user_id=? AND push_enabled=1 AND revoked_at IS NULL').get(r.device_id,a.user_id) as {platform:PushPlatform;device_token:string}|undefined;
 if(!device){finish('suppressed','DEVICE_UNAVAILABLE');suppressed++;continue;}
 const config=appointmentReminderConfig();if(!config.pushEnabled||device.platform==='IOS'&&!config.iosReady||device.platform==='ANDROID'&&!config.androidReady){finish('blocked','PUSH_NOT_CONFIGURED');blocked++;continue;}
 if(!valid(db,r,Date.now())){finish('suppressed','OBSOLETE');suppressed++;continue;}
 if(!db.prepare("UPDATE appointment_reminders SET dispatch_ms=?,attempts=attempts+1 WHERE id=? AND claim_token=? AND status='sending'").run(Date.now(),r.id,token).changes)continue;
 try{const result=await sender(device.platform,device.device_token,{title:'Reamintire programare NITIDO',body,data:{event_type:'APPOINTMENT_REMINDER',job_id:a.id,path:path(a.id),reminder_id:r.id}});finish('sent',null,result.providerMessageId);sent++;}
 catch(e){if(e instanceof PushProviderError)finish(e.permanent?'suppressed':'failed',e.message);else finish('unknown','DELIVERY_UNKNOWN');}
 }
 return {queued,sent,suppressed,blocked};
}
export function appointmentReminderMetrics(db:Database){return {config:appointmentReminderConfig(),deliveries:db.prepare('SELECT channel,status,COUNT(*) count FROM appointment_reminders GROUP BY channel,status').all(),confirmations:(db.prepare('SELECT COUNT(*) count FROM appointment_acknowledgments').get() as {count:number}).count};}
