import {createHash,randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {weekContext,listWeekOpenings,selectedOpening,AvailabilityError} from './weeklyAvailability';
import {bookingDateKey,bucharestDateKey,bucharestScheduledAt} from './scheduling';
import {availabilityAlertDates} from './availabilityAlertDates';
import {BUFFER_MINUTES} from './pricing';
import {normalizeCity} from './text';
import {emailIsVerified} from './emailVerification';
import {emailConfigured,sendEmail} from './email';
import {sendPush,PushProviderError,type PushPlatform,type PushPayload} from './pushProviders';

export const availabilityAlertsEnabled=()=>process.env.NITIDO_AVAILABILITY_ALERTS_ENABLED!=='false';
type Channel='inapp'|'email'|'push';
export type AlertCriteria={city:string;spaceType:string;sqm:number;bathroomCount:number;windowsSqm:number;fromDate:string;toDate:string;fromHour:number;toHour:number};
type Subscription={id:string;client_id:string;criteria_json:string;channels_json:string;active:number;expires_at:string};
type Item={subscription_id:string;criteria_json:string;channels_json:string;slot_id:string;revision:number;starts_at:string};
type Match={slotId:string;revision:number;startsAt:string;firmName:string;criteria:AlertCriteria};
const hour=(s:string)=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',hour:'2-digit',hourCycle:'h23'}).format(new Date(s)));
const pushConfigured=(platform:string)=>process.env.PUSH_ENABLED==='true'&&(platform==='IOS'?['APNS_KEY_ID','APNS_TEAM_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID']:['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY']).every(k=>Boolean(process.env[k]));
export function alertChannels(db:Database,clientId:string){
  const devices=db.prepare('SELECT platform FROM push_devices WHERE user_id=? AND push_enabled=1 AND revoked_at IS NULL').all(clientId) as {platform:string}[];
  return {inapp:true,email:emailConfigured()&&emailIsVerified(db,clientId),push:devices.some(d=>pushConfigured(d.platform))};
}
export function validateAlertCriteria(value:Record<string,unknown>,now=new Date()):AlertCriteria{
  const c=weekContext(value),{min:today,max:last}=availabilityAlertDates(now);
  const from=String(value.fromDate??''),to=String(value.toDate??''),fromHour=value.fromHour,toHour=value.toHour;
  if(bookingDateKey(from)!==from||bookingDateKey(to)!==to||from<today||to<from||to>last||!Number.isInteger(fromHour)||!Number.isInteger(toHour)||Number(fromHour)<6||Number(toHour)>23||Number(toHour)<=Number(fromHour))throw new AvailabilityError('Alege date valide în următoarele șapte zile și un interval între 06:00 și 23:00.',400);
  if(bucharestScheduledAt(to,Number(toHour)).getTime()<=now.getTime())throw new AvailabilityError('Perioada alertei a expirat. Alege un interval viitor.',400);
  return {city:c.city,spaceType:c.spaceType,sqm:c.sqm,bathroomCount:c.bathroomCount,windowsSqm:c.windowsSqm,fromDate:from,toDate:to,fromHour:Number(fromHour),toHour:Number(toHour)};
}
export function subscribeAvailability(db:Database,clientId:string,input:Record<string,unknown>){
  if(!availabilityAlertsEnabled())throw new AvailabilityError('Alertele de disponibilitate sunt oprite temporar.',503);
  if(input.consent!==true)throw new AvailabilityError('Confirmă explicit abonarea la alertă.',400);
  const c=validateAlertCriteria(input),cap=alertChannels(db,clientId);
  if(!Array.isArray(input.channels)||!input.channels.length||input.channels.some(x=>!['inapp','email','push'].includes(String(x))||!cap[x as Channel]))throw new AvailabilityError('Alege un canal disponibil. Pentru e-mail confirmă adresa, iar pentru push activează notificările pe dispozitiv.',400);
  const channels=[...new Set(input.channels as Channel[])].sort();
  const fingerprint=createHash('sha256').update(JSON.stringify({...c,city:normalizeCity(c.city)})).digest('hex');
  const expires=bucharestScheduledAt(c.toDate,c.toHour).toISOString();
  return db.transaction(()=>{
    const old=db.prepare('SELECT id FROM availability_subscriptions WHERE client_id=? AND fingerprint=?').get(clientId,fingerprint) as {id:string}|undefined;
    if(!old&&(db.prepare('SELECT COUNT(*) n FROM availability_subscriptions WHERE client_id=? AND active=1 AND expires_at>?').get(clientId,new Date().toISOString()) as {n:number}).n>=20)throw new AvailabilityError('Ai deja 20 de alerte active. Oprește una înainte de a adăuga alta.',400);
    const id=old?.id??randomUUID();
    db.prepare(`INSERT INTO availability_subscriptions(id,client_id,fingerprint,criteria_json,channels_json,active,consent_at,expires_at,created_ms) VALUES(?,?,?,?,?,1,?,?,?)
      ON CONFLICT(client_id,fingerprint) DO UPDATE SET channels_json=excluded.channels_json,active=1,consent_at=excluded.consent_at,expires_at=excluded.expires_at`).run(id,clientId,fingerprint,JSON.stringify(c),JSON.stringify(channels),new Date().toISOString(),expires,Date.now());return id;
  }).immediate();
}
export function unsubscribeAvailability(db:Database,clientId:string,id:string){
  db.transaction(()=>{
    if(!db.prepare('SELECT 1 FROM availability_subscriptions WHERE id=? AND client_id=?').get(id,clientId))throw new AvailabilityError('Alertă inexistentă.',404);
    db.prepare('UPDATE availability_subscriptions SET active=0 WHERE id=? AND client_id=?').run(id,clientId);
    // Only notices with no still-active source are removed. Sent external messages cannot be recalled.
    const batches=db.prepare('SELECT id FROM availability_alert_batches WHERE client_id=?').all(clientId) as {id:string}[];
    for(const b of batches)if(!batchMatches(db,clientId,b.id).length)db.prepare('DELETE FROM workspace_notices WHERE user_id=? AND path=?').run(clientId,batchPath(b.id));
  }).immediate();
}
const batchPath=(id:string)=>'/client/alerte-disponibilitate?batch='+encodeURIComponent(id);
function inside(c:AlertCriteria,start:string,end:string){const day=bucharestDateKey(new Date(start));return day>=c.fromDate&&day<=c.toDate&&bucharestDateKey(new Date(end))===day&&hour(start)>=c.fromHour&&Date.parse(end)<=bucharestScheduledAt(day,c.toHour).getTime();}
export function subscriptionMatches(db:Database,s:Subscription){
  const c=JSON.parse(s.criteria_json) as AlertCriteria;
  if(!s.active||Date.parse(s.expires_at)<=Date.now())return [];
  return listWeekOpenings(db,c,(start,end)=>inside(c,start,end)).options;
}
export function batchMatches(db:Database,clientId:string,batchId:string,channel?:Channel):Match[]{
  const items=db.prepare(`SELECT i.*,s.criteria_json,s.channels_json FROM availability_alert_items i JOIN availability_subscriptions s ON s.id=i.subscription_id
    JOIN availability_alert_batches b ON b.id=i.batch_id WHERE b.id=? AND b.client_id=? AND s.client_id=b.client_id AND s.active=1 AND s.expires_at>?`)
    .all(batchId,clientId,new Date().toISOString()) as Item[];
  const result:Match[]=[];
  for(const i of items){
    if(channel&&!(JSON.parse(i.channels_json) as Channel[]).includes(channel))continue;
    const c=JSON.parse(i.criteria_json) as AlertCriteria;
    try{const selected=selectedOpening(db,{...c,slotId:i.slot_id,revision:i.revision,startsAt:i.starts_at});if(inside(c,i.starts_at,new Date(Date.parse(i.starts_at)+(selected.context.duration+BUFFER_MINUTES)*60000).toISOString()))result.push({slotId:i.slot_id,revision:i.revision,startsAt:i.starts_at,firmName:selected.firmName,criteria:c});}
    catch(e){if(!(e instanceof AvailabilityError))throw e;}
  }
  return result;
}
/** One persisted notification event per client and Bucharest day, shared across all channels. */
export function queueAvailabilityAlerts(db:Database){
  if(!availabilityAlertsEnabled())return {queued:0};
  return db.transaction(()=>{
    const day=bucharestDateKey(new Date());let queued=0;
    db.prepare('UPDATE availability_subscriptions SET active=0 WHERE active=1 AND expires_at<=?').run(new Date().toISOString());
    const subscriptions=db.prepare(`SELECT s.* FROM availability_subscriptions s JOIN users u ON u.id=s.client_id WHERE s.active=1 AND u.role='client'
      AND NOT EXISTS(SELECT 1 FROM availability_alert_batches b WHERE b.client_id=s.client_id AND b.day_key=?) ORDER BY s.last_checked_ms,s.created_ms,s.id LIMIT 200`).all(day) as Subscription[];
    const grouped=new Map<string,Subscription[]>();for(const s of subscriptions)grouped.set(s.client_id,[...(grouped.get(s.client_id)??[]),s]);
    for(const [clientId,group] of grouped){
      for(const s of group)db.prepare('UPDATE availability_subscriptions SET last_checked_ms=? WHERE id=?').run(Date.now(),s.id);
      const matches=group.flatMap(s=>subscriptionMatches(db,s).filter(o=>!db.prepare('SELECT 1 FROM availability_alert_items WHERE subscription_id=? AND slot_id=? AND revision=? AND starts_at=?').get(s.id,o.slotId,o.revision,o.startsAt)).slice(0,10).map(o=>({s,o})));
      if(!matches.length)continue;
      const batch=randomUUID();db.prepare('INSERT INTO availability_alert_batches(id,client_id,day_key,created_ms) VALUES(?,?,?,?)').run(batch,clientId,day,Date.now());
      const channels=new Set<Channel>();
      for(const {s,o} of matches){db.prepare('INSERT INTO availability_alert_items VALUES(?,?,?,?,?)').run(batch,s.id,o.slotId,o.revision,o.startsAt);for(const ch of JSON.parse(s.channels_json) as Channel[])channels.add(ch);}
      const insert=(channel:Channel,device='')=>db.prepare('INSERT OR IGNORE INTO availability_alert_deliveries(id,batch_id,channel,device_id) VALUES(?,?,?,?)').run(randomUUID(),batch,channel,device);
      for(const ch of channels){if(ch==='push'){const devices=db.prepare('SELECT id FROM push_devices WHERE user_id=? AND push_enabled=1 AND revoked_at IS NULL ORDER BY id LIMIT 10').all(clientId) as {id:string}[];for(const d of devices)insert(ch,d.id);}else insert(ch);}
      queued++;
    }
    return {queued};
  }).immediate();
}
type Delivery={id:string;batch_id:string;channel:Channel;device_id:string;attempts:number;client_id:string;created_ms:number};
type Senders={email?:typeof sendEmail;push?:(platform:PushPlatform,token:string,payload:PushPayload)=>Promise<{providerMessageId:string}>};
/** Rechecks cancellation, current recipient and live capacity immediately before each dispatch. */
export async function processAvailabilityAlerts(db:Database,senders:Senders={}){
  if(!availabilityAlertsEnabled())return {queued:0,sent:0,suppressed:0};
  const {queued}=queueAvailabilityAlerts(db);let sent=0,suppressed=0;
  // Expired claims after dispatch are quarantined; do not duplicate an uncertain push.
  db.prepare("UPDATE availability_alert_deliveries SET status=CASE WHEN dispatch_ms IS NULL THEN 'failed' ELSE 'unknown' END,last_error='LEASE_EXPIRED',next_ms=? WHERE status='sending' AND claimed_ms<?").run(Date.now(),Date.now()-5*60000);
  const rows=db.prepare(`SELECT d.*,b.client_id,b.created_ms FROM availability_alert_deliveries d JOIN availability_alert_batches b ON b.id=d.batch_id
    WHERE d.status IN ('pending','failed') AND d.attempts<3 AND d.next_ms<=? ORDER BY b.created_ms,d.id LIMIT 5`).all(Date.now()) as Delivery[];
  for(const d of rows){
    const claim=randomUUID();if(!db.prepare("UPDATE availability_alert_deliveries SET status='sending',claim=?,claimed_ms=?,dispatch_ms=NULL,attempts=attempts+1 WHERE id=? AND status IN ('pending','failed') AND attempts<3 AND next_ms<=?").run(claim,Date.now(),d.id,Date.now()).changes)continue;
    const finish=(status:string,error:string|null=null)=>db.prepare("UPDATE availability_alert_deliveries SET status=?,last_error=?,sent_ms=CASE WHEN ?='sent' THEN ? ELSE sent_ms END,next_ms=? WHERE id=? AND claim=? AND status='sending'").run(status,error,status,Date.now(),Date.now()+5*60000,d.id,claim);
    const valid=()=>availabilityAlertsEnabled()&&batchMatches(db,d.client_id,d.batch_id,d.channel).length>0&&(db.prepare("SELECT role FROM users WHERE id=?").get(d.client_id) as {role:string}|undefined)?.role==='client';
    if(!valid()||Date.now()-d.created_ms>=20*3600000){finish('suppressed','CANCELLED_EXPIRED_OR_UNAVAILABLE');suppressed++;continue;}
    if(d.channel==='inapp'){
      db.transaction(()=>{if(!valid()){finish('suppressed','CANCELLED_OR_UNAVAILABLE');suppressed++;return;}db.prepare('INSERT OR IGNORE INTO workspace_notices(id,user_id,job_id,message,path,created_at) VALUES(?,?,NULL,?,?,?)').run(d.id,d.client_id,'A apărut un interval potrivit. Verifică disponibilitatea înainte de a trimite cererea.',batchPath(d.batch_id),new Date().toISOString());finish('sent');sent++;}).immediate();continue;
    }
    const caps=alertChannels(db,d.client_id);if(!caps[d.channel]){finish('suppressed','CHANNEL_UNAVAILABLE');suppressed++;continue;}
    const device=d.channel==='push'?db.prepare('SELECT platform,device_token FROM push_devices WHERE id=? AND user_id=? AND push_enabled=1 AND revoked_at IS NULL').get(d.device_id,d.client_id) as {platform:PushPlatform;device_token:string}|undefined:undefined;
    const email=d.channel==='email'?(db.prepare('SELECT email FROM users WHERE id=?').get(d.client_id) as {email:string}|undefined)?.email:undefined;
    if(d.channel==='push'&&(!device||!pushConfigured(device.platform))||d.channel==='email'&&!email){finish('suppressed','RECIPIENT_UNAVAILABLE');suppressed++;continue;}
    if(!valid()){finish('suppressed','CANCELLED_OR_UNAVAILABLE');suppressed++;continue;}
    if(!db.prepare("UPDATE availability_alert_deliveries SET dispatch_ms=? WHERE id=? AND claim=? AND status='sending' AND claimed_ms>?").run(Date.now(),d.id,claim,Date.now()-5*60000).changes)continue;
    const title='A apărut un interval potrivit',body='Deschide NÍTIDO și verifică disponibilitatea. Alerta nu confirmă și nu rezervă un loc.';
    try{
      if(d.channel==='email'){
        const accepted=await (senders.email??sendEmail)({to:email!,subject:'NÍTIDO — '+title,html:`<h1>${title}</h1><p>${body}</p><p><a href="https://nitido.ro${batchPath(d.batch_id)}">Vezi intervalele și gestionează alerta</a></p><p>Poți opri alerta din cont. Ai primit acest mesaj deoarece ai solicitat explicit o alertă de disponibilitate.</p>`,idempotencyKey:'availability-'+d.id});
        if(!accepted){finish('failed','EMAIL_NOT_CONFIRMED');continue;}
      }else await (senders.push??sendPush)(device!.platform,device!.device_token,{title,body,data:{event_type:'AVAILABILITY_ALERT',path:batchPath(d.batch_id)}});
      finish('sent');sent++;
    }catch(e){const known=e instanceof PushProviderError,permanent=known&&e.permanent;
      finish(permanent?'suppressed':known&&['FCM_NOT_CONFIGURED','FCM_AUTH_FAILED','FCM_TEMPORARY_FAILURE','APNS_NOT_CONFIGURED'].includes(e.message)?'failed':'unknown',permanent?'TOKEN_INVALID':known?'PROVIDER_NOT_CONFIRMED':'DELIVERY_UNKNOWN');
    }
  }
  return {queued,sent,suppressed};
}

/** Attribution is advisory and never selects a provider or changes pricing. */
export function attachAlertOrigin(db:Database,jobId:string,clientId:string,batchId:string){
  if(!db.prepare('SELECT 1 FROM availability_alert_batches WHERE id=? AND client_id=?').get(batchId,clientId))throw new AvailabilityError('Informarea nu este disponibilă în contul tău.',404);
  const j=db.prepare('SELECT * FROM jobs WHERE id=? AND client_id=?').get(jobId,clientId) as {city:string;sqm:number;space_type:string;bathroom_count:number;windows_sqm:number;scheduled_at:string}|undefined;
  const r=db.prepare('SELECT slot_id,slot_revision FROM job_slot_requests WHERE job_id=?').get(jobId) as {slot_id:string;slot_revision:number}|undefined;
  if(!j||!r)return;
  if(batchMatches(db,clientId,batchId).some(m=>m.slotId===r.slot_id&&m.revision===r.slot_revision&&m.startsAt===j.scheduled_at&&normalizeCity(m.criteria.city)===normalizeCity(j.city)&&m.criteria.sqm===j.sqm&&m.criteria.spaceType===j.space_type&&m.criteria.bathroomCount===j.bathroom_count&&m.criteria.windowsSqm===j.windows_sqm))
    db.prepare('INSERT INTO job_availability_origins(job_id,batch_id) VALUES(?,?)').run(jobId,batchId);
}
