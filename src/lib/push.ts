import {claimNotification,startNotificationDispatch,finishNotification,recoverNotificationClaims,retryableNotificationSql} from "./notificationClaims";
import type {Database} from "better-sqlite3";
import {newId} from "@/lib/db";
import {firmCoversCity} from "@/lib/text";
import {processSmsOutbox,queueJobAcceptedClientSms,queueJobArrivedClientSms,queueJobCreatedFirmAlerts} from "@/lib/notifications";
import {PushProviderError,sendPush,type PushPayload,type PushPlatform} from "@/lib/pushProviders";

export type PushEventType="JOB_CREATED_FIRM_PUSH"|"JOB_ACCEPTED_CLIENT_PUSH"|"JOB_ARRIVED_CLIENT_PUSH"|"JOB_COMPLETED_CLIENT_PUSH"|"MESSAGE_RECEIVED_PUSH";
type PushSender=(platform:PushPlatform,token:string,payload:PushPayload)=>Promise<{providerMessageId:string}>;
const labels:Record<string,string>={apartament:"apartament",casa:"casă",birou:"birou",altul:"alt tip de spațiu"};
export const pushEnabled=()=>process.env.PUSH_ENABLED==="true";
export const smsFallbackEnabled=()=>process.env.SMS_FALLBACK_ENABLED!=="false";

const preferenceColumn:Record<PushEventType,string>={JOB_CREATED_FIRM_PUSH:"new_job_alerts",JOB_ACCEPTED_CLIENT_PUSH:"job_status_notifications",JOB_ARRIVED_CLIENT_PUSH:"arrival_notifications",JOB_COMPLETED_CLIENT_PUSH:"completion_notifications",MESSAGE_RECEIVED_PUSH:"job_status_notifications"};
// Suppression is terminal, but retains the existing schema and an explicit audit reason.
export const PUSH_RETRYABLE_SQL=retryableNotificationSql(3);
type DeliveryRecipient={event_type:PushEventType;job_id:string;recipient_user_id:string;data_json?:string};
function deliveryBlock(db:Database,row:DeliveryRecipient):string|null{
  const preference=db.prepare(`SELECT ${preferenceColumn[row.event_type]} enabled FROM notification_preferences WHERE user_id=?`).get(row.recipient_user_id) as {enabled:number}|undefined;
  if(preference?.enabled===0)return "SUPPRESSED_PREFERENCE";
  const job=db.prepare("SELECT client_id,city,status,accepted_firm_id FROM jobs WHERE id=?").get(row.job_id) as {client_id:string;city:string;status:string;accepted_firm_id:string|null}|undefined;
  if(!job)return "SUPPRESSED_JOB_UNAVAILABLE";
  if(row.event_type==="MESSAGE_RECEIVED_PUSH"){
    const data=JSON.parse(row.data_json??"{}");
    const message=db.prepare(`SELECT m.id FROM workspace_messages m JOIN jobs j ON j.id=m.job_id JOIN firms f ON f.id=j.accepted_firm_id
     WHERE m.id=? AND m.job_id=? AND ((m.sender_id=j.client_id AND f.user_id=?) OR (m.sender_id=f.user_id AND j.client_id=?))
     AND NOT EXISTS(SELECT 1 FROM workspace_message_reads r WHERE r.message_id=m.id AND r.user_id=?)`).get(data.message_id,row.job_id,row.recipient_user_id,row.recipient_user_id,row.recipient_user_id);
    return message?null:"SUPPRESSED_RECIPIENT_OR_READ";
  }
  if(row.event_type!=="JOB_CREATED_FIRM_PUSH")return job.client_id===row.recipient_user_id?null:"SUPPRESSED_RECIPIENT";
  if(job.status!=="waiting"||job.accepted_firm_id)return "SUPPRESSED_JOB_UNAVAILABLE";
  const firm=db.prepare("SELECT verified,coverage_city,coverage_cities_extra,suspended_until FROM firms WHERE user_id=?").get(row.recipient_user_id) as {verified:number;coverage_city:string;coverage_cities_extra:string|null;suspended_until:string|null}|undefined;
  if(!firm||firm.verified!==1||!firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,job.city))return "SUPPRESSED_FIRM_INELIGIBLE";
  if(firm.suspended_until){const until=Date.parse(firm.suspended_until);if(!Number.isFinite(until)||until>Date.now())return "SUPPRESSED_FIRM_INELIGIBLE";}
  return null;
}

function enqueueUser(db:Database,eventType:PushEventType,jobId:string,userId:string,title:string,body:string,path:string,messageId?:string):string[]{
  const preference=db.prepare(`SELECT ${preferenceColumn[eventType]} enabled FROM notification_preferences WHERE user_id=?`).get(userId) as {enabled:number}|undefined;if(preference?.enabled===0)return [];
  const devices=db.prepare("SELECT id FROM push_devices WHERE user_id=? AND push_enabled=1 AND revoked_at IS NULL").all(userId) as {id:string}[];
  const targets=devices.length?devices:[{id:"none"}];const ids:string[]=[];
  for(const target of targets){const id=newId("push"),tokenId=target.id==="none"?null:target.id,key=`${eventType}:${messageId??jobId}:${userId}:${target.id}`;db.prepare(`INSERT OR IGNORE INTO push_notification_outbox(id,idempotency_key,event_type,job_id,recipient_user_id,device_token_id,title,message_body,data_json) VALUES(?,?,?,?,?,?,?,?,?)`).run(id,key,eventType,jobId,userId,tokenId,title,body,JSON.stringify({...messageId?{message_id:messageId}:{},job_id:jobId,event_type:eventType.replace(/_(FIRM|CLIENT)_PUSH$/,"").replace(/_PUSH$/,""),path}));const row=db.prepare("SELECT id FROM push_notification_outbox WHERE idempotency_key=?").get(key) as {id:string};ids.push(row.id);}
  return ids;
}

export function queueMessagePush(db:Database,messageId:string){
 const m=db.prepare(`SELECT m.job_id,m.sender_id,j.client_id,f.user_id firm_user_id FROM workspace_messages m JOIN jobs j ON j.id=m.job_id JOIN firms f ON f.id=j.accepted_firm_id WHERE m.id=?`).get(messageId) as {job_id:string;sender_id:string;client_id:string;firm_user_id:string}|undefined;
 if(!m||![m.client_id,m.firm_user_id].includes(m.sender_id))return [];
 const recipient=m.sender_id===m.client_id?m.firm_user_id:m.client_id;
 return enqueueUser(db,"MESSAGE_RECEIVED_PUSH",m.job_id,recipient,"Mesaj nou NITIDO","Ai primit un mesaj nou. Deschide conversația pentru a-l citi.",m.sender_id===m.client_id?"/firma/mesaje":"/client/mesaje",messageId);
}

export function queueNewJobFirmPushes(db:Database,job:{id:string;city:string;spaceType:string;sqm:number}):string[]{
  const firms=db.prepare(`SELECT f.id,f.user_id,f.coverage_city,f.coverage_cities_extra,f.suspended_until FROM firms f WHERE f.verified=1`).all() as {id:string;user_id:string;coverage_city:string;coverage_cities_extra:string|null;suspended_until:string|null}[];
  const now=new Date();return firms.filter(f=>firmCoversCity(f.coverage_city,f.coverage_cities_extra,job.city)&&!(f.suspended_until&&new Date(f.suspended_until)>now)).flatMap(f=>enqueueUser(db,"JOB_CREATED_FIRM_PUSH",job.id,f.user_id,"Lucrare nouă disponibilă",`Curățenie ${labels[job.spaceType]??"serviciu"} · ${job.city} · ${job.sqm} m². Deschide NITIDO pentru detalii.`,`/firma?job=${encodeURIComponent(job.id)}`));
}

function clientAndFirm(db:Database,jobId:string,status:string,extra="1=1"){return db.prepare(`SELECT j.client_id,fu.name firm_name FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id JOIN users fu ON fu.id=f.user_id WHERE j.id=? AND j.status=? AND ${extra}`).get(jobId,status) as {client_id:string;firm_name:string}|undefined;}
export function queueAcceptedClientPush(db:Database,jobId:string){const row=clientAndFirm(db,jobId,"accepted","EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='authorized')");return row?enqueueUser(db,"JOB_ACCEPTED_CLIENT_PUSH",jobId,row.client_id,"Lucrare confirmată",`${row.firm_name} a preluat lucrarea ta. Poți urmări statusul în NITIDO.`,`/client?job=${encodeURIComponent(jobId)}`):[];}
export function queueArrivedClientPush(db:Database,jobId:string){const row=clientAndFirm(db,jobId,"arrived","EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)");return row?enqueueUser(db,"JOB_ARRIVED_CLIENT_PUSH",jobId,row.client_id,"Echipa a ajuns",`${row.firm_name} a confirmat sosirea la locație.`,`/client?job=${encodeURIComponent(jobId)}`):[];}
export function queueCompletedClientPush(db:Database,jobId:string){const row=clientAndFirm(db,jobId,"completed","EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=j.accepted_firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL) AND EXISTS(SELECT 1 FROM payments pay WHERE pay.job_id=j.id AND pay.status='captured')");return row?enqueueUser(db,"JOB_COMPLETED_CLIENT_PUSH",jobId,row.client_id,"Lucrare finalizată","Lucrarea a fost finalizată. Verifică detaliile și continuă fluxul de confirmare/evaluare.",`/client?job=${encodeURIComponent(jobId)}`):[];}

async function fallbackSms(db:Database,row:{event_type:PushEventType;job_id:string;recipient_user_id:string}){
  if(row.event_type==="MESSAGE_RECEIVED_PUSH")return;
  if(!smsFallbackEnabled()||deliveryBlock(db,row))return;let ids:string[]=[];
  if(row.event_type==="JOB_CREATED_FIRM_PUSH"){const phone=(db.prepare("SELECT phone FROM users WHERE id=?").get(row.recipient_user_id) as {phone:string|null}|undefined)?.phone;const job=db.prepare("SELECT id,city,space_type,sqm,scheduled_at FROM jobs WHERE id=?").get(row.job_id) as {id:string;city:string;space_type:string;sqm:number;scheduled_at:string|null}|undefined;if(job)ids=queueJobCreatedFirmAlerts(db,{id:job.id,city:job.city,spaceType:job.space_type,sqm:job.sqm,scheduledAt:job.scheduled_at},[phone??null]);}
  if(row.event_type==="JOB_ACCEPTED_CLIENT_PUSH")ids=queueJobAcceptedClientSms(db,row.job_id);
  if(row.event_type==="JOB_ARRIVED_CLIENT_PUSH")ids=queueJobArrivedClientSms(db,row.job_id);
  if(ids.length)await processSmsOutbox(db,ids);
}

export async function processPushOutbox(db:Database,ids?:string[],sender:PushSender=sendPush):Promise<void>{
  if(ids&&ids.length===0)return;
  recoverNotificationClaims(db);
  const rows=(ids?db.prepare(`SELECT * FROM push_notification_outbox WHERE ${PUSH_RETRYABLE_SQL} AND id IN (${ids.map(()=>"?").join(",")}) ORDER BY created_at,rowid`).all(...ids):db.prepare(`SELECT * FROM push_notification_outbox WHERE ${PUSH_RETRYABLE_SQL} ORDER BY created_at,rowid LIMIT 100`).all()) as (DeliveryRecipient&{id:string;device_token_id:string|null;title:string;message_body:string;data_json:string})[];
  const groups=new Map<string,typeof rows>();
  for(const row of rows){const key=`${row.event_type}:${row.job_id}:${row.recipient_user_id}`;groups.set(key,[...(groups.get(key)??[]),row]);}
  for(const group of groups.values()){
    for(const row of group){
      // Claim every branch, including missing tokens, to preserve retry limits under concurrency.
      const claim=claimNotification(db,"push",row.id);
      if(!claim)continue;
      const block=deliveryBlock(db,row);
      if(block){finishNotification(db,"push",row.id,claim,{error:block});continue;}
      // Resolve immediately before dispatch: a previous provider call may have yielded to logout/revocation.
      const device=row.device_token_id?db.prepare("SELECT platform,device_token FROM push_devices WHERE id=? AND user_id=? AND push_enabled=1 AND revoked_at IS NULL").get(row.device_token_id,row.recipient_user_id) as {platform:PushPlatform;device_token:string}|undefined:undefined;
      if(!device||!pushEnabled()){
        finishNotification(db,"push",row.id,claim,{error:!device?"NO_ACTIVE_DEVICE":"PUSH_DISABLED"});continue;
      }
      if(!startNotificationDispatch(db,"push",row.id,claim))continue;
      try{
        const result=await sender(device.platform,device.device_token,{title:row.title,body:row.message_body,data:JSON.parse(row.data_json)});
        finishNotification(db,"push",row.id,claim,result);
      }catch(error){
        const permanent=error instanceof PushProviderError&&error.permanent;
        const allowedErrors=new Set(["PUSH_TOKEN_INVALID","FCM_NOT_CONFIGURED","FCM_AUTH_FAILED","FCM_TEMPORARY_FAILURE","APNS_NOT_CONFIGURED","APNS_TIMEOUT","APNS_TEMPORARY_FAILURE"]);
        const uncertain=!(error instanceof PushProviderError)||["APNS_TIMEOUT","APNS_TEMPORARY_FAILURE"].includes(error.message);
        const code=permanent?"PUSH_TOKEN_INVALID":uncertain?"DELIVERY_UNKNOWN":allowedErrors.has(error.message)?error.message:"DELIVERY_UNKNOWN";
        finishNotification(db,"push",row.id,claim,{error:code});
        if(permanent)db.prepare("UPDATE push_devices SET push_enabled=0,revoked_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND user_id=? AND device_token=?").run(row.device_token_id,row.recipient_user_id,device.device_token);
      }
    }
    const state=db.prepare(`SELECT SUM(status='sent') sent,SUM(CASE WHEN status IN ('pending','sending') OR (status='failed' AND last_error='DELIVERY_UNKNOWN') OR (status='failed' AND attempt_count<3 AND (last_error IS NULL OR (last_error NOT LIKE 'SUPPRESSED_%' AND last_error NOT IN ('NO_ACTIVE_DEVICE','PUSH_DISABLED','PUSH_TOKEN_INVALID')))) THEN 1 ELSE 0 END) retryable FROM push_notification_outbox WHERE event_type=? AND job_id=? AND recipient_user_id=?`).get(group[0].event_type,group[0].job_id,group[0].recipient_user_id) as {sent:number;retryable:number};
    // Another worker's sending row is not a permanent failure; never fall back while it is in flight.
    if(!state.sent&&state.retryable===0)await fallbackSms(db,group[0]);
  }
}
