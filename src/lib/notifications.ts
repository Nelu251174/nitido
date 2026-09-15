import {claimNotification,startNotificationDispatch,finishNotification,recoverNotificationClaims,retryableNotificationSql} from "./notificationClaims";
import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";
import { sendSmsViaTwilio, toE164Romania, SmsProviderError } from "@/lib/sms";
import { firmCoversCity } from "@/lib/text";

export type SmsEventType = "JOB_CREATED_FIRM_ALERT" | "JOB_ACCEPTED_CLIENT_CONFIRMATION" | "JOB_ARRIVED_CLIENT_NOTIFICATION";
type Sender = (to: string, body: string) => Promise<{ providerMessageId: string }>;

const labels: Record<string,string> = { apartament:"apartament", casa:"casă", birou:"birou", altul:"spațiu" };
export function eligibleSmsRecipients(firms:{coverage_city:string;coverage_cities_extra:string|null;phone:string|null;suspended_until:string|null}[],city:string,now=new Date()):string[]{
  return [...new Set(firms.filter(f=>firmCoversCity(f.coverage_city,f.coverage_cities_extra,city)&&!(f.suspended_until&&new Date(f.suspended_until)>now)).map(f=>f.phone&&toE164Romania(f.phone)).filter((p):p is string=>Boolean(p)))];
}
function scheduledLabel(value: string | null): string {
  if (!value) return "cât mai curând";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle:"short", timeStyle:"short", timeZone:"Europe/Bucharest" }).format(new Date(value));
}

function enqueue(db: Database, eventType: SmsEventType, jobId: string, recipientRaw: string | null, body: string, suffix = "once"): string | null {
  if (!recipientRaw) return null;
  const recipient = toE164Romania(recipientRaw);
  if (!recipient) return null;
  const idempotencyKey = `${eventType}:${jobId}:${suffix === "recipient" ? recipient : suffix}`;
  const users=db.prepare("SELECT id,phone FROM users WHERE phone IS NOT NULL").all() as {id:string;phone:string}[];
  const matches=users.filter(user=>toE164Romania(user.phone)===recipient);
  const recipientUserId=matches.length===1?matches[0].id:null;
  const id = newId("sms");
  db.prepare(`INSERT OR IGNORE INTO notification_outbox
    (id,idempotency_key,event_type,job_id,recipient,message_body,recipient_user_id) VALUES (?,?,?,?,?,?,?)`)
    .run(id,idempotencyKey,eventType,jobId,recipient,body,recipientUserId);
  const row = db.prepare("SELECT id FROM notification_outbox WHERE idempotency_key = ?").get(idempotencyKey) as {id:string};
  return row.id;
}

export function queueJobCreatedFirmAlerts(db: Database, job: {id:string;city:string;spaceType:string;sqm:number;scheduledAt:string|null}, phones:(string|null)[]): string[] {
  const body = `NITIDO.RO: Lucrare nouă disponibilă în ${job.city}. Tip: ${labels[job.spaceType]??"curățenie"}, suprafață: ${job.sqm} m², data/ora: ${scheduledLabel(job.scheduledAt)}. Deschide NITIDO pentru detalii și Accept.`;
  return [...new Set(phones.map(p=>p&&toE164Romania(p)).filter((p):p is string=>Boolean(p)))]
    .map(phone=>enqueue(db,"JOB_CREATED_FIRM_ALERT",job.id,phone,body,"recipient")).filter((id):id is string=>Boolean(id));
}

export function queueJobAcceptedClientSms(db: Database, jobId:string): string[] {
  const row = db.prepare(`SELECT u.phone, fu.name firm_name FROM jobs j
    JOIN users u ON u.id=j.client_id JOIN firms f ON f.id=j.accepted_firm_id JOIN users fu ON fu.id=f.user_id
    WHERE j.id=? AND j.status='accepted'`).get(jobId) as {phone:string|null;firm_name:string}|undefined;
  if(!row) return [];
  const id=enqueue(db,"JOB_ACCEPTED_CLIENT_CONFIRMATION",jobId,row.phone,`NITIDO.RO: Lucrarea ta a fost confirmată. ${row.firm_name} a preluat comanda. Poți urmări statusul lucrării în contul tău NITIDO.`);
  return id?[id]:[];
}

export function queueJobArrivedClientSms(db: Database, jobId:string): string[] {
  const row = db.prepare(`SELECT u.phone, fu.name firm_name FROM jobs j
    JOIN users u ON u.id=j.client_id JOIN firms f ON f.id=j.accepted_firm_id JOIN users fu ON fu.id=f.user_id
    WHERE j.id=? AND j.status='arrived'`).get(jobId) as {phone:string|null;firm_name:string}|undefined;
  if(!row) return [];
  const id=enqueue(db,"JOB_ARRIVED_CLIENT_NOTIFICATION",jobId,row.phone,`NITIDO.RO: Echipa ${row.firm_name} a ajuns la locație. Lucrarea poate începe.`);
  return id?[id]:[];
}

function smsDeliveryBlock(db:Database,row:{job_id:string;event_type:SmsEventType;recipient:string;recipient_user_id:string|null}):string|null{
  if(!row.recipient_user_id)return "SUPPRESSED_RECIPIENT_UNBOUND";
  const user=db.prepare("SELECT phone FROM users WHERE id=?").get(row.recipient_user_id) as {phone:string|null}|undefined;
  if(!user?.phone||toE164Romania(user.phone)!==row.recipient)return "SUPPRESSED_RECIPIENT";
  const field=row.event_type==="JOB_CREATED_FIRM_ALERT"?"new_job_alerts":row.event_type==="JOB_ACCEPTED_CLIENT_CONFIRMATION"?"job_status_notifications":"arrival_notifications";
  const preference=db.prepare(`SELECT ${field} enabled FROM notification_preferences WHERE user_id=?`).get(row.recipient_user_id) as {enabled:number}|undefined;
  if(preference?.enabled===0)return "SUPPRESSED_PREFERENCE";
  const job=db.prepare("SELECT client_id,city,status,accepted_firm_id FROM jobs WHERE id=?").get(row.job_id) as {client_id:string;city:string;status:string;accepted_firm_id:string|null}|undefined;
  if(!job)return "SUPPRESSED_JOB_UNAVAILABLE";
  if(row.event_type==="JOB_CREATED_FIRM_ALERT"){
    if(job.status!=="waiting"||job.accepted_firm_id)return "SUPPRESSED_JOB_UNAVAILABLE";
    const firm=db.prepare("SELECT verified,coverage_city,coverage_cities_extra,suspended_until FROM firms WHERE user_id=?").get(row.recipient_user_id) as {verified:number;coverage_city:string;coverage_cities_extra:string|null;suspended_until:string|null}|undefined;
    if(!firm||firm.verified!==1||!firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,job.city)||(firm.suspended_until&&(!Number.isFinite(Date.parse(firm.suspended_until))||Date.parse(firm.suspended_until)>Date.now())))return "SUPPRESSED_FIRM_INELIGIBLE";
  }else{
    if(job.client_id!==row.recipient_user_id)return "SUPPRESSED_RECIPIENT";
    if(job.status!==(row.event_type==="JOB_ACCEPTED_CLIENT_CONFIRMATION"?"accepted":"arrived"))return "SUPPRESSED_JOB_UNAVAILABLE";
    if(row.event_type==="JOB_ACCEPTED_CLIENT_CONFIRMATION"&&!db.prepare("SELECT 1 FROM payments WHERE job_id=? AND status='authorized'").get(row.job_id))return "SUPPRESSED_PAYMENT_UNCONFIRMED";
    if(row.event_type==="JOB_ARRIVED_CLIENT_NOTIFICATION"&&!db.prepare("SELECT 1 FROM job_photos WHERE job_id=? AND uploaded_by_firm_id=? AND proof_type='ARRIVAL' AND status='VALID' AND validated_at IS NOT NULL").get(row.job_id,job.accepted_firm_id))return "SUPPRESSED_PROOF_UNCONFIRMED";
  }
  return null;
}

export const SMS_RETRYABLE_SQL=retryableNotificationSql(5);

export async function processSmsOutbox(db: Database, ids?:string[], sender:Sender=sendSmsViaTwilio): Promise<void> {
  if(ids&&ids.length===0)return;
  recoverNotificationClaims(db);
  const rows = (ids ? db.prepare(`SELECT * FROM notification_outbox WHERE ${SMS_RETRYABLE_SQL} AND id IN (${ids.map(()=>"?").join(",")})`).all(...ids) : db.prepare(`SELECT * FROM notification_outbox WHERE ${SMS_RETRYABLE_SQL} ORDER BY created_at LIMIT 50`).all()) as {id:string;recipient:string;recipient_user_id:string|null;job_id:string;event_type:SmsEventType;message_body:string}[];
  for(const row of rows){
    const claim=claimNotification(db,"sms",row.id);
    if(!claim)continue;
    const block=smsDeliveryBlock(db,row);
    if(block){finishNotification(db,"sms",row.id,claim,{error:block});continue;}
    if(!startNotificationDispatch(db,"sms",row.id,claim))continue;
    try{const result=await sender(row.recipient,row.message_body);finishNotification(db,"sms",row.id,claim,result);}
    catch(error){const code=error instanceof SmsProviderError?(error.message==="SMS_PROVIDER_NOT_CONFIGURED"?"SMS_PROVIDER_NOT_CONFIGURED":"SMS_PROVIDER_ERROR"):"DELIVERY_UNKNOWN";finishNotification(db,"sms",row.id,claim,{error:code});}
  }
}

export function maskSmsRecipient(value:string):string { return value.length>=6?`${value.slice(0,3)}•••••${value.slice(-3)}`:"••••"; }
