import { bucharestScheduledAt } from "@/lib/scheduling";
export { bucharestScheduledAt } from "@/lib/scheduling";
import type { Database } from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
import {
  calcGrossPrice,
  calcDurationMinutes,
  BUFFER_MINUTES,
  type SpaceType,
} from "@/lib/pricing";
import { acceptJobAtomic } from "@/lib/acceptJob";

/**
 * Nitido Repeat (Etapa 3) — abonamente recurente cu aceeași echipă.
 * Un plan păstrează șablonul lucrării; `generateDueRecurringJobs` creează
 * automat următoarea lucrare când e scadentă și o alocă firmei preferate
 * (dacă e disponibilă), reutilizând acceptJobAtomic pentru blocare + plată.
 * Funcții pure (primesc `db`), testabile fără Next.js.
 */

export type Frequency = "weekly" | "biweekly" | "monthly";

export interface RecurringPlanInput {
  requestId?: string;
  clientId: string;
  preferredFirmId?: string | null;
  frequency: Frequency;
  street: string;
  postalCode?: string | null;
  city: string;
  floor?: string | null;
  sqm: number;
  spaceType: SpaceType;
  hour: number;
  details?: string | null;
  endDate?: string | null;
  startDate: string; // YYYY-MM-DD — prima zi de rulare
}

export type PlanResult =
  | { ok: true; planId: string }
  | { ok: false; error: string; status: number };

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}

/** Calendar dates are independent of the server timezone; monthly dates clamp. */
export function computeNextDate(frequency: Frequency, from: Date, anchorDay?:number): string {
  const local=ymd(from);const d=new Date(`${local}T12:00:00Z`);
  if(frequency==="weekly")d.setUTCDate(d.getUTCDate()+7);
  else if(frequency==="biweekly")d.setUTCDate(d.getUTCDate()+14);
  else {const day=anchorDay??d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}
  return d.toISOString().slice(0,10);
}

const VALID_SPACE: readonly SpaceType[] = ["apartament", "casa", "birou", "altul"];

/** Creează un abonament recurent. */
export function validateRecurringPlan(input: RecurringPlanInput): Extract<PlanResult,{ok:false}>|null {
  if(!input||typeof input!=="object")return {ok:false,error:"Date abonament invalide",status:400};
  if(input.requestId!==undefined&&(typeof input.requestId!=="string"||!/^[-a-zA-Z0-9]{16,100}$/.test(input.requestId)))return {ok:false,status:400,error:"Identificator de cerere invalid"};
  for(const [key,max,required] of [["clientId",200,true],["street",300,true],["city",120,true],["postalCode",30,false],["floor",100,false],["details",500,false],["preferredFirmId",200,false]] as const){
    const value=input[key];
    if(value==null&&!required)continue;
    if(typeof value!=="string"||value.length>max||(required&&!value.trim()))return {ok:false,error:"Date abonament invalide sau prea lungi",status:400};
  }
  if (!input.street || !input.city || !input.sqm || !input.spaceType || !input.frequency) {
    return { ok: false, error: "Câmpuri obligatorii lipsă", status: 400 };
  }
  if (!Number.isInteger(input.sqm) || input.sqm <= 0) {
    return { ok: false, error: "Suprafața trebuie să fie un număr întreg pozitiv", status: 400 };
  }
  if(input.sqm>1000)return {ok:false,error:"Suprafețele peste 1000 m² necesită evaluare personalizată înainte de abonare.",status:422};
  if (!VALID_SPACE.includes(input.spaceType)) {
    return { ok: false, error: "Tip spațiu invalid", status: 400 };
  }
  if (!["weekly", "biweekly", "monthly"].includes(input.frequency)) {
    return { ok: false, error: "Frecvență invalidă", status: 400 };
  }
  if (typeof input.startDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { ok: false, error: "Dată de start invalidă", status: 400 };
  }

  if (!Number.isInteger(input.hour)||![8,10,12,14,16,18].includes(input.hour))return {ok:false,error:"Oră invalidă",status:400};
  const parsed=new Date(`${input.startDate}T12:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==input.startDate)return {ok:false,error:"Dată invalidă",status:400};
  if(input.endDate!=null){
    if(typeof input.endDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))return {ok:false,status:400,error:"Dată de sfârșit invalidă"};
    const end=new Date(`${input.endDate}T12:00:00Z`);
    if(!Number.isFinite(end.getTime())||end.toISOString().slice(0,10)!==input.endDate||input.endDate<input.startDate)return {ok:false,status:400,error:"Data de sfârșit trebuie să fie validă și să nu fie înaintea primei vizite."};
  }
  return null;
}

export function createRecurringPlan(db: Database, input: RecurringPlanInput): PlanResult {
  const invalid=validateRecurringPlan(input);if(invalid)return invalid;
  const payloadHash=createHash("sha256").update(JSON.stringify([input.preferredFirmId??null,input.frequency,input.street.trim(),input.postalCode??null,input.city.trim(),input.floor??null,input.sqm,input.spaceType,input.hour,input.details?.trim()||null,input.startDate,input.endDate??null])).digest("hex");
  return db.transaction(():PlanResult=>{
  if(input.requestId){
    const prior=db.prepare("SELECT plan_id,payload_hash FROM recurring_creation_requests WHERE client_id=? AND request_id=?").get(input.clientId,input.requestId) as {plan_id:string;payload_hash:string}|undefined;
    if(prior)return prior.payload_hash===payloadHash?{ok:true,planId:prior.plan_id}:{ok:false,status:409,error:"Cererea a fost deja folosită cu alte date. Verifică abonamentele înainte de a crea unul nou."};
  }
  const planId = `plan_${randomUUID()}`;
  db.prepare(
    `INSERT INTO recurring_plans
       (id, client_id, preferred_firm_id, frequency, street, postal_code, city, floor,
        sqm, space_type, hour, details, status, next_run_date, anchor_day, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  ).run(
    planId,
    input.clientId,
    input.preferredFirmId ?? null,
    input.frequency,
    input.street.trim(),
    input.postalCode ?? null,
    input.city.trim(),
    input.floor ?? null,
    input.sqm,
    input.spaceType,
    input.hour,
    typeof input.details === "string" ? input.details.trim().slice(0, 500) || null : null,
    input.startDate,
    Number(input.startDate.slice(8,10)),
    input.endDate ?? null
  );
  if(input.requestId)db.prepare("INSERT INTO recurring_creation_requests(client_id,request_id,payload_hash,plan_id) VALUES(?,?,?,?)").run(input.clientId,input.requestId,payloadHash,planId);
  return { ok: true, planId };
  })();
}

interface PlanRow {
  id: string;
  client_id: string;
  preferred_firm_id: string | null;
  frequency: Frequency;
  street: string;
  postal_code: string | null;
  city: string;
  floor: string | null;
  sqm: number;
  space_type: SpaceType;
  hour: number;
  details: string | null;
  next_run_date: string;
  anchor_day: number|null;
  end_date: string|null;
}

/** Planurile unui client (active + pauză), pentru afișare în cont. */
export function listPlansForClient(db: Database, clientId: string) {
  return db
    .prepare(
      "SELECT p.*, r.start_date AS pause_start, r.end_date AS pause_end FROM recurring_plans p LEFT JOIN recurring_pauses r ON r.plan_id=p.id WHERE p.client_id = ? AND p.status != 'cancelled' ORDER BY p.created_at DESC"
    )
    .all(clientId);
}

/** Historicul demonstrabil, inclusiv seriile anulate; fără backfill presupus. */
export function listRecurringOccurrences(db:Database,clientId:string){
  return db.prepare(`SELECT o.plan_id,o.occurrence_date,o.job_id,o.scheduled_at,j.status,j.city
    FROM recurring_occurrences o JOIN recurring_plans p ON p.id=o.plan_id
    JOIN jobs j ON j.id=o.job_id
    WHERE p.client_id=? AND j.client_id=p.client_id
    ORDER BY o.occurrence_date DESC,o.created_at DESC,o.job_id DESC LIMIT 200`).all(clientId);
}

function pauseIntervalError(start:unknown,end:unknown,now:Date):Extract<PlanResult,{ok:false}>|null {
  const validDate=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
  if(!validDate(start)||!validDate(end)||start>end||start<ymd(now)||Number(end.slice(0,4))>now.getUTCFullYear()+5)return {ok:false,status:400,error:"Alege un interval valid, de astăzi încolo, în următorii 5 ani."};
  return null;
}

export type PausePreview = {ok:true;count:number;visits:Array<{job_id:string;scheduled_at:string;status:string;city:string}>}|Extract<PlanResult,{ok:false}>;
/** Read-only impact preview; saving must still recheck inside its transaction. */
export function previewPlanPause(db:Database,planId:string,clientId:string,start:unknown,end:unknown,now=new Date()):PausePreview {
  const invalid=pauseIntervalError(start,end,now);if(invalid)return invalid;
  return db.transaction(():PausePreview=>{
    const plan=db.prepare("SELECT status FROM recurring_plans WHERE id=? AND client_id=?").get(planId,clientId) as {status:string}|undefined;
    if(!plan)return {ok:false,status:404,error:"Abonament inexistent"};
    if(plan.status!=="active")return {ok:false,status:409,error:"Pauza pe interval se programează numai pentru un abonament activ."};
    const clause="FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND o.occurrence_date BETWEEN ? AND ? AND j.status NOT IN ('cancelled','completed')";
    const count=(db.prepare("SELECT COUNT(*) n "+clause).get(planId,start,end) as {n:number}).n;
    const visits=db.prepare("SELECT o.job_id,o.scheduled_at,j.status,j.city "+clause+" AND j.client_id=? ORDER BY o.occurrence_date,o.job_id LIMIT 100").all(planId,start,end,clientId) as Extract<PausePreview,{ok:true}>['visits'];
    return {ok:true,count,visits};
  })();
}

/** A pause never silently cancels an existing booking or releases a payment. */
export function schedulePlanPause(db:Database,planId:string,clientId:string,start:unknown,end:unknown,now=new Date()):PlanResult {
  const invalid=pauseIntervalError(start,end,now);if(invalid)return invalid;
  return db.transaction(():PlanResult=>{
    const plan=db.prepare("SELECT status FROM recurring_plans WHERE id=? AND client_id=?").get(planId,clientId) as {status:string}|undefined;
    if(!plan)return {ok:false,status:404,error:"Abonament inexistent"};
    if(plan.status!=="active")return {ok:false,status:409,error:"Pauza pe interval se programează numai pentru un abonament activ."};
    const existing=db.prepare(`SELECT COUNT(*) n FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND o.occurrence_date BETWEEN ? AND ? AND j.status NOT IN ('cancelled','completed')`).get(planId,start,end) as {n:number};
    if(existing.n)return {ok:false,status:409,error:`Există ${existing.n} vizite active în interval. Gestionează anularea lor din Rezervări, apoi programează pauza. Nicio vizită sau plată nu a fost modificată.`};
    db.prepare("INSERT INTO recurring_pauses(plan_id,start_date,end_date) VALUES(?,?,?) ON CONFLICT(plan_id) DO UPDATE SET start_date=excluded.start_date,end_date=excluded.end_date").run(planId,start,end);
    return {ok:true,planId};
  })();
}

/** Remove the interval displayed by the client without changing any occurrence. */
export function removePlanPause(db:Database,planId:string,clientId:string,start:unknown,end:unknown):PlanResult {
  if(typeof start!=="string"||typeof end!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return {ok:false,status:400,error:"Interval de pauză invalid"};
  return db.transaction(():PlanResult=>{
    const plan=db.prepare("SELECT status FROM recurring_plans WHERE id=? AND client_id=?").get(planId,clientId) as {status:string}|undefined;
    if(!plan)return {ok:false,status:404,error:"Abonament inexistent"};
    if(plan.status==="cancelled")return {ok:false,status:409,error:"Abonamentul este anulat și nu poate fi reluat."};
    const pause=db.prepare("SELECT start_date,end_date FROM recurring_pauses WHERE plan_id=?").get(planId) as {start_date:string;end_date:string}|undefined;
    if(!pause)return {ok:true,planId};
    if(pause.start_date!==start||pause.end_date!==end)return {ok:false,status:409,error:"Pauza a fost modificată între timp. Reîncarcă lista și verifică intervalul."};
    db.prepare("DELETE FROM recurring_pauses WHERE plan_id=?").run(planId);
    return {ok:true,planId};
  })();
}

export function setPlanStatus(
  db: Database,
  planId: string,
  clientId: string,
  status: "active" | "paused" | "cancelled"
): PlanResult {
  if (!["active", "paused", "cancelled"].includes(status)) return {ok:false,error:"Stare invalidă",status:400};
  return db.transaction((): PlanResult => {
    const plan=db.prepare("SELECT status FROM recurring_plans WHERE id=? AND client_id=?").get(planId,clientId) as {status:string}|undefined;
    if(!plan)return {ok:false,error:"Abonament inexistent",status:404};
    if(plan.status==="cancelled"&&status!=="cancelled")return {ok:false,error:"Un abonament anulat nu poate fi reactivat. Creează un abonament nou.",status:409};
    db.prepare("UPDATE recurring_plans SET status=? WHERE id=? AND client_id=?").run(status,planId,clientId);
    return {ok:true,planId};
  })();
}

/**
 * Generează lucrările pentru toate abonamentele scadente (next_run_date <= azi).
 * Pentru fiecare: creează o lucrare (mod 'express', pre-alocată), încearcă
 * alocarea la firma preferată; apoi avansează next_run_date. Rulat de un
 * declanșator programat (vezi 3.2).
 */
export async function generateDueRecurringJobs(
  db: Database,
  now: Date = new Date(),
  clientId?: string
): Promise<{ created: string[] }> {
  const today = ymd(now);
  const due = (clientId
    ? db.prepare("SELECT * FROM recurring_plans WHERE status = 'active' AND (end_date IS NULL OR next_run_date <= end_date) AND next_run_date <= ? AND client_id = ?").all(today, clientId)
    : db.prepare("SELECT * FROM recurring_plans WHERE status = 'active' AND (end_date IS NULL OR next_run_date <= end_date) AND next_run_date <= ?").all(today)) as PlanRow[];

  const created: string[] = [];
  for (const candidate of due) {
    // Claim and advance synchronously before any Stripe/network work can yield.
    const claimed=db.transaction(()=>{
      const plan=db.prepare("SELECT * FROM recurring_plans WHERE id=? AND status='active' AND next_run_date=?").get(candidate.id,candidate.next_run_date) as PlanRow|undefined;
      if(!plan||(plan.end_date&&plan.next_run_date>plan.end_date))return null;
      // Skip only elapsed occurrences, preserving an upcoming visit today.
      let occurrenceDate=plan.next_run_date;
      let scheduledAt=bucharestScheduledAt(occurrenceDate,plan.hour);
      const pause=db.prepare("SELECT start_date,end_date FROM recurring_pauses WHERE plan_id=?").get(plan.id) as {start_date:string;end_date:string}|undefined;
      while(scheduledAt.getTime()<now.getTime()||(pause&&occurrenceDate>=pause.start_date&&occurrenceDate<=pause.end_date)){
        occurrenceDate=computeNextDate(plan.frequency,new Date(`${occurrenceDate}T12:00:00Z`),plan.anchor_day??undefined);
        scheduledAt=bucharestScheduledAt(occurrenceDate,plan.hour);
      }
      if(occurrenceDate>today||(plan.end_date&&occurrenceDate>plan.end_date)){
        db.prepare("UPDATE recurring_plans SET next_run_date=? WHERE id=?").run(occurrenceDate,plan.id);
        return null;
      }
      plan.next_run_date=occurrenceDate;
      const next=()=>computeNextDate(plan.frequency,new Date(`${occurrenceDate}T12:00:00Z`),plan.anchor_day??undefined);
      const existing=db.prepare("SELECT job_id FROM recurring_occurrences WHERE plan_id=? AND occurrence_date=?").get(plan.id,plan.next_run_date) as {job_id:string}|undefined;
      if(existing){
        db.prepare("UPDATE recurring_plans SET next_run_date=?,last_job_id=? WHERE id=?").run(next(),existing.job_id,plan.id);
        return null;
      }
      const jobId=`job_${randomUUID()}`;
      db.prepare(`INSERT INTO jobs(id,client_id,street,postal_code,city,floor,details,sqm,space_type,when_type,scheduled_at,price_gross,credit_applied,duration_minutes,buffer_minutes,photos_count,mode,status)
        VALUES(?,?,?,?,?,?,?,?,?,'scheduled',?,?,0,?,?,0,'express','waiting')`).run(jobId,plan.client_id,plan.street,plan.postal_code,plan.city,plan.floor,plan.details,plan.sqm,plan.space_type,scheduledAt.toISOString(),calcGrossPrice(plan.space_type,plan.sqm),calcDurationMinutes(plan.sqm),BUFFER_MINUTES);
      db.prepare("INSERT INTO recurring_occurrences(plan_id,occurrence_date,job_id,scheduled_at) VALUES(?,?,?,?)").run(plan.id,plan.next_run_date,jobId,scheduledAt.toISOString());
      db.prepare("UPDATE recurring_plans SET next_run_date=?,last_job_id=? WHERE id=?").run(next(),jobId,plan.id);
      return {jobId,preferredFirmId:plan.preferred_firm_id};
    })();
    if(!claimed)continue;
    created.push(claimed.jobId);
    if(claimed.preferredFirmId){try{await acceptJobAtomic(db,claimed.jobId,claimed.preferredFirmId)}catch{/* Job remains waiting for the existing recovery flow. */}}
  }
  return {created};
}
