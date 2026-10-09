import type {Database} from 'better-sqlite3';
import {MarginError} from './operationalMargin';
import {bookingDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from './scheduling';
import {SLOT_HOURS,MIN_LEAD_HOURS} from './pricing';

export const MANUAL_OFFER_SCHEDULE_SCHEMA=`
CREATE TABLE IF NOT EXISTS assessment_offer_schedules (
 offer_id TEXT NOT NULL REFERENCES assessment_offers(id), revision INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('propose','withdraw')),
 scheduled_date TEXT, scheduled_hour INTEGER, starts_at TEXT, expires_at TEXT,
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(offer_id,revision)
);
CREATE TRIGGER IF NOT EXISTS offer_schedule_no_update BEFORE UPDATE ON assessment_offer_schedules BEGIN SELECT RAISE(ABORT,'Schedule immutable'); END;
CREATE TRIGGER IF NOT EXISTS offer_schedule_no_delete BEFORE DELETE ON assessment_offer_schedules BEGIN SELECT RAISE(ABORT,'Schedule retained'); END;
`;
export type OfferSchedule={offer_id:string;revision:number;action:'propose'|'withdraw';scheduled_date:string|null;scheduled_hour:number|null;starts_at:string|null;expires_at:string|null;reason:string;actor_id:string;created_at:string};
export type PublicOfferSchedule=Omit<OfferSchedule,'reason'|'actor_id'>;
export function latestOfferSchedule(db:Database,id:string):OfferSchedule|null {
 return db.prepare('SELECT * FROM assessment_offer_schedules WHERE offer_id=? ORDER BY revision DESC LIMIT 1').get(id) as OfferSchedule|undefined??null;
}
export function publicOfferSchedule(s:OfferSchedule|null):PublicOfferSchedule|null {
 if(!s)return null;
 const {reason,actor_id,...publicFields}=s;void reason;void actor_id;return publicFields;
}
export function scheduleOwner(db:Database,id:unknown,clientId:string|null):string {
 if(typeof id!=='string'||!id||id.length>100)throw new MarginError('Referință ofertă invalidă.');
 const row=db.prepare('SELECT a.client_id FROM assessment_offers o JOIN service_assessments a ON a.id=o.assessment_id WHERE o.id=?').get(id) as {client_id:string}|undefined;
 if(!row||(clientId!==null&&clientId!==row.client_id))throw new MarginError('Oferta nu este disponibilă pentru acest cont.',404);
 return row.client_id;
}
// Call inside the same transaction as compatibility validation and the administrator audit.
export function saveOfferSchedule(db:Database,id:string,input:Record<string,unknown>,actor:string,now=new Date()) {
 if(!db.inTransaction)throw new MarginError('Programarea necesită o tranzacție.',500);
 const last=latestOfferSchedule(db,id);
 if(!Number.isSafeInteger(input.revision)||input.revision!==(last?.revision??0))throw new MarginError('Programarea s-a modificat. Actualizează înainte de a continua.',409);
 if(!['propose','withdraw'].includes(String(input.action)))throw new MarginError('Acțiune invalidă.');
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2000)throw new MarginError('Completează motivul intern.');
 let date:string|null=null,hour:number|null=null,start:string|null=null,expiry:string|null=null;
 if(input.action==='propose'){
  date=bookingDateKey(input.scheduledDate);
  if(!date||date!==input.scheduledDate||typeof input.scheduledHour!=='number'||!(SLOT_HOURS as readonly number[]).includes(input.scheduledHour))throw new MarginError('Alege o zi și o oră valide din calendarul României.');
  hour=input.scheduledHour;const instant=bucharestScheduledAt(date,hour);
  if(!hasSchedulingLeadTime(instant,now))throw new MarginError('Intervalul nu mai respectă timpul minim de programare.',409);
  start=instant.toISOString();
  if(typeof input.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.expiresAt))throw new MarginError('Expirarea necesită o dată UTC validă.');
  const end=new Date(input.expiresAt);
  if(!Number.isFinite(end.getTime())||end.toISOString().replace('.000Z','Z')!==input.expiresAt.replace('.000Z','Z')||end<=now||end.getTime()>instant.getTime()-MIN_LEAD_HOURS*3600000)throw new MarginError('Expirarea trebuie să fie în viitor, înaintea limitei de programare.');
  expiry=end.toISOString();
 }else if(!last||last.action==='withdraw')throw new MarginError('Nu există o propunere de retras.',409);
 db.prepare('INSERT INTO assessment_offer_schedules VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,(last?.revision??0)+1,input.action,date,hour,start,expiry,input.reason.trim(),actor,now.toISOString());
 return latestOfferSchedule(db,id)!;
}
export function validateOfferSchedule(db:Database,id:string,body:Record<string,unknown>,now=new Date()):PublicOfferSchedule|null {
 const last=latestOfferSchedule(db,id);
 if(body.whenType==='asap'){
  if(body.manualScheduleRevision!=null||last?.action==='propose')throw new MarginError('Există un interval propus. Confirmă-l sau cere operatorului retragerea lui.',409);
  return null;
 }
 if(body.whenType!=='scheduled'||!last||last.action!=='propose')throw new MarginError('Programarea necesită un interval propus de operator.',422);
 if(body.manualScheduleRevision!==last.revision||body.scheduledDate!==last.scheduled_date||body.scheduledHour!==last.scheduled_hour)throw new MarginError('Intervalul s-a modificat. Recitește și confirmă propunerea curentă.',409);
 if(new Date(last.expires_at!).getTime()<=now.getTime()||!hasSchedulingLeadTime(new Date(last.starts_at!),now))throw new MarginError('Propunerea de programare a expirat. Solicită un interval nou.',409);
 return publicOfferSchedule(last);
}
