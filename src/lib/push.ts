import type {Database} from "better-sqlite3";
import {newId} from "@/lib/db";
import {firmCoversCity} from "@/lib/text";
import {processSmsOutbox,queueJobAcceptedClientSms,queueJobArrivedClientSms,queueJobCreatedFirmAlerts} from "@/lib/notifications";
import {PushProviderError,sendPush,type PushPayload,type PushPlatform} from "@/lib/pushProviders";

export type PushEventType="JOB_CREATED_FIRM_PUSH"|"JOB_ACCEPTED_CLIENT_PUSH"|"JOB_ARRIVED_CLIENT_PUSH"|"JOB_COMPLETED_CLIENT_PUSH";
type PushSender=(platform:PushPlatform,token:string,payload:PushPayload)=>Promise<{providerMessageId:string}>;
const labels:Record<string,string>={apartament:"apartament",casa:"casă",birou:"birou",altul:"alt tip de spațiu"};
export const pushEnabled=()=>process.env.PUSH_ENABLED==="true";
export const smsFallbackEnabled=()=>process.env.SMS_FALLBACK_ENABLED!=="false";

function enqueueUser(db:Database,eventType:PushEventType,jobId:string,userId:string,title:string,body:string,path:string):string[]{
  const preferenceColumn:Record<PushEventType,string>={JOB_CREATED_FIRM_PUSH:"new_job_alerts",JOB_ACCEPTED_CLIENT_PUSH:"job_status_notifications",JOB_ARRIVED_CLIENT_PUSH:"arrival_notifications",JOB_COMPLETED_CLIENT_PUSH:"completion_notifications"};
  const preference=db.prepare(`SELECT ${preferenceColumn[eventType]} enabled FROM notification_preferences WHERE user_id=?`).get(userId) as {enabled:number}|undefined;if(preference?.enabled===0)return [];
  const devices=db.prepare("SELECT id FROM push_devices WHERE user_id=? AND push_enabled=1 AND revoked_at IS NULL").all(userId) as {id:string}[];
  const targets=devices.length?devices:[{id:"none"}];const ids:string[]=[];
  for(const target of targets){const id=newId("push"),tokenId=target.id==="none"?null:target.id,key=`${eventType}:${jobId}:${userId}:${target.id}`;db.prepare(`INSERT OR IGNORE INTO push_notification_outbox(id,idempotency_key,event_type,job_id,recipient_user_id,device_token_id,title,message_body,data_json) VALUES(?,?,?,?,?,?,?,?,?)`).run(id,key,eventType,jobId,userId,tokenId,title,body,JSON.stringify({job_id:jobId,event_type:eventType.replace(/_(FIRM|CLIENT)_PUSH$/,"").replace("JOB_CREATED","JOB_CREATED"),path}));const row=db.prepare("SELECT id FROM push_notification_outbox WHERE idempotency_key=?").get(key) as {id:string};ids.push(row.id);}
  return ids;
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
  if(!smsFallbackEnabled())return;let ids:string[]=[];
  if(row.event_type==="JOB_CREATED_FIRM_PUSH"){const phone=(db.prepare("SELECT phone FROM users WHERE id=?").get(row.recipient_user_id) as {phone:string|null}|undefined)?.phone;const job=db.prepare("SELECT id,city,space_type,sqm,scheduled_at FROM jobs WHERE id=?").get(row.job_id) as {id:string;city:string;space_type:string;sqm:number;scheduled_at:string|null}|undefined;if(job)ids=queueJobCreatedFirmAlerts(db,{id:job.id,city:job.city,spaceType:job.space_type,sqm:job.sqm,scheduledAt:job.scheduled_at},[phone??null]);}
  if(row.event_type==="JOB_ACCEPTED_CLIENT_PUSH")ids=queueJobAcceptedClientSms(db,row.job_id);
  if(row.event_type==="JOB_ARRIVED_CLIENT_PUSH")ids=queueJobArrivedClientSms(db,row.job_id);
  if(ids.length)await processSmsOutbox(db,ids);
}

export async function processPushOutbox(db:Database,ids?:string[],sender:PushSender=sendPush):Promise<void>{
  const rows=(ids?.length?db.prepare(`SELECT o.*,d.platform,d.device_token FROM push_notification_outbox o LEFT JOIN push_devices d ON d.id=o.device_token_id WHERE o.id IN (${ids.map(()=>"?").join(",")})`).all(...ids):db.prepare(`SELECT o.*,d.platform,d.device_token FROM push_notification_outbox o LEFT JOIN push_devices d ON d.id=o.device_token_id WHERE o.status IN ('pending','failed') AND o.attempt_count<3 ORDER BY o.created_at LIMIT 100`).all()) as {id:string;event_type:PushEventType;job_id:string;recipient_user_id:string;device_token_id:string|null;platform:PushPlatform|null;device_token:string|null;title:string;message_body:string;data_json:string;status:string;attempt_count:number}[];
  const groups=new Map<string,typeof rows>();for(const row of rows){const key=`${row.event_type}:${row.job_id}:${row.recipient_user_id}`;groups.set(key,[...(groups.get(key)??[]),row]);}
  for(const group of groups.values()){
    let sent=false,allPermanent=true;
    for(const row of group){if(row.status==="sent"){sent=true;continue;}if(!row.device_token_id||!row.device_token||!row.platform||!pushEnabled()){db.prepare("UPDATE push_notification_outbox SET status='failed',attempt_count=attempt_count+1,last_error=? WHERE id=?").run(!row.device_token_id?"NO_ACTIVE_DEVICE":"PUSH_DISABLED",row.id);continue;}
      const claimed=db.prepare("UPDATE push_notification_outbox SET status='sending',attempt_count=attempt_count+1,last_error=NULL WHERE id=? AND status IN ('pending','failed') AND attempt_count<3").run(row.id);if(!claimed.changes)continue;
      try{const result=await sender(row.platform,row.device_token,{title:row.title,body:row.message_body,data:JSON.parse(row.data_json)});db.prepare("UPDATE push_notification_outbox SET status='sent',provider_message_id=?,sent_at=datetime('now') WHERE id=?").run(result.providerMessageId,row.id);sent=true;}
      catch(error){const permanent=error instanceof PushProviderError&&error.permanent;allPermanent&&=permanent;db.prepare("UPDATE push_notification_outbox SET status='failed',last_error=? WHERE id=?").run(error instanceof Error?error.message:"PUSH_PROVIDER_ERROR",row.id);if(permanent)db.prepare("UPDATE push_devices SET push_enabled=0,revoked_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(row.device_token_id);}
    }
    const state=db.prepare(`SELECT SUM(status='sent') sent,SUM(CASE WHEN status IN ('pending','sending') OR (status='failed' AND attempt_count<3 AND last_error NOT IN ('NO_ACTIVE_DEVICE','PUSH_DISABLED','PUSH_TOKEN_INVALID')) THEN 1 ELSE 0 END) retryable FROM push_notification_outbox WHERE event_type=? AND job_id=? AND recipient_user_id=?`).get(group[0].event_type,group[0].job_id,group[0].recipient_user_id) as {sent:number;retryable:number};
    if(!sent&&!state.sent&&(state.retryable===0||allPermanent))await fallbackSms(db,group[0]);
  }
}
