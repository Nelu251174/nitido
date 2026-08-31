import type { Database } from "better-sqlite3";
import { newId } from "@/lib/db";
import { sendSmsViaTwilio, toE164Romania } from "@/lib/sms";
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
  const id = newId("sms");
  db.prepare(`INSERT OR IGNORE INTO notification_outbox
    (id,idempotency_key,event_type,job_id,recipient,message_body) VALUES (?,?,?,?,?,?)`)
    .run(id,idempotencyKey,eventType,jobId,recipient,body);
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

export async function processSmsOutbox(db: Database, ids?:string[], sender:Sender=sendSmsViaTwilio): Promise<void> {
  const rows = (ids?.length ? db.prepare(`SELECT * FROM notification_outbox WHERE id IN (${ids.map(()=>"?").join(",")})`).all(...ids) : db.prepare("SELECT * FROM notification_outbox WHERE status IN ('pending','failed') AND attempt_count < 5 ORDER BY created_at LIMIT 50").all()) as {id:string;recipient:string;message_body:string;status:string;attempt_count:number}[];
  for(const row of rows){
    const claimed=db.prepare("UPDATE notification_outbox SET status='sending', attempt_count=attempt_count+1, last_error=NULL WHERE id=? AND status IN ('pending','failed') AND attempt_count < 5").run(row.id);
    if(claimed.changes===0) continue;
    try{const result=await sender(row.recipient,row.message_body);db.prepare("UPDATE notification_outbox SET status='sent',provider_message_id=?,sent_at=datetime('now'),last_error=NULL WHERE id=?").run(result.providerMessageId,row.id);}
    catch(error){const code=error instanceof Error&&error.message==="SMS_PROVIDER_NOT_CONFIGURED"?"SMS_PROVIDER_NOT_CONFIGURED":"SMS_PROVIDER_ERROR";db.prepare("UPDATE notification_outbox SET status='failed',last_error=? WHERE id=?").run(code,row.id);}
  }
}

export function maskSmsRecipient(value:string):string { return value.length>=6?`${value.slice(0,3)}•••••${value.slice(-3)}`:"••••"; }
