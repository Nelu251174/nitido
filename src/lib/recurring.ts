import { bucharestScheduledAt } from "@/lib/scheduling";
export { bucharestScheduledAt } from "@/lib/scheduling";
import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
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
  return null;
}

export function createRecurringPlan(db: Database, input: RecurringPlanInput): PlanResult {
  const invalid=validateRecurringPlan(input);if(invalid)return invalid;
  const planId = `plan_${randomUUID()}`;
  db.prepare(
    `INSERT INTO recurring_plans
       (id, client_id, preferred_firm_id, frequency, street, postal_code, city, floor,
        sqm, space_type, hour, details, status, next_run_date, anchor_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
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
    Number(input.startDate.slice(8,10))
  );
  return { ok: true, planId };
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
}

/** Planurile unui client (active + pauză), pentru afișare în cont. */
export function listPlansForClient(db: Database, clientId: string) {
  return db
    .prepare(
      "SELECT * FROM recurring_plans WHERE client_id = ? AND status != 'cancelled' ORDER BY created_at DESC"
    )
    .all(clientId);
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
    ? db.prepare("SELECT * FROM recurring_plans WHERE status = 'active' AND next_run_date <= ? AND client_id = ?").all(today, clientId)
    : db.prepare("SELECT * FROM recurring_plans WHERE status = 'active' AND next_run_date <= ?").all(today)) as PlanRow[];

  const created: string[] = [];
  for (const candidate of due) {
    // Claim and advance synchronously before any Stripe/network work can yield.
    const claimed=db.transaction(()=>{
      const plan=db.prepare("SELECT * FROM recurring_plans WHERE id=? AND status='active' AND next_run_date=?").get(candidate.id,candidate.next_run_date) as PlanRow|undefined;
      if(!plan)return null;
      const scheduledAt=bucharestScheduledAt(plan.next_run_date,plan.hour);
      const next=()=>computeNextDate(plan.frequency,new Date(`${plan.next_run_date}T12:00:00Z`),plan.anchor_day??undefined);
      if(scheduledAt.getTime()<now.getTime()){
        let date=next();let skipped=0;
        while(date<=today&&skipped++<5000)date=computeNextDate(plan.frequency,new Date(`${date}T12:00:00Z`),plan.anchor_day??undefined);
        db.prepare("UPDATE recurring_plans SET next_run_date=? WHERE id=?").run(date,plan.id);
        return null;
      }
      const jobId=`job_${randomUUID()}`;
      db.prepare(`INSERT INTO jobs(id,client_id,street,postal_code,city,floor,details,sqm,space_type,when_type,scheduled_at,price_gross,credit_applied,duration_minutes,buffer_minutes,photos_count,mode,status)
        VALUES(?,?,?,?,?,?,?,?,?,'scheduled',?,?,0,?,?,0,'express','waiting')`).run(jobId,plan.client_id,plan.street,plan.postal_code,plan.city,plan.floor,plan.details,plan.sqm,plan.space_type,scheduledAt.toISOString(),calcGrossPrice(plan.space_type,plan.sqm),calcDurationMinutes(plan.sqm),BUFFER_MINUTES);
      db.prepare("UPDATE recurring_plans SET next_run_date=?,last_job_id=? WHERE id=?").run(next(),jobId,plan.id);
      return {jobId,preferredFirmId:plan.preferred_firm_id};
    })();
    if(!claimed)continue;
    created.push(claimed.jobId);
    if(claimed.preferredFirmId){try{await acceptJobAtomic(db,claimed.jobId,claimed.preferredFirmId)}catch{/* Job remains waiting for the existing recovery flow. */}}
  }
  return {created};
}
