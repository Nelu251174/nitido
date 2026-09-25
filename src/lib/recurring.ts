import {freezeExecutionRules} from '@/lib/executionTemplates';
import {assertCustomerCanCreate,CustomerRestrictionError} from '@/lib/customerRestrictions';
import {requirePropertyModule,enforceOrganizationBooking,OrganizationError} from "./organizations";
import {snapshotInstructions,notice} from "./visitCare";
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
import {pricingSnapshot} from './pricingSnapshot';
import {enforcePropertyBudget,AccessError} from './collaborationAccess';

/**
 * Nitido Repeat (Etapa 3) — abonamente recurente cu aceeași echipă.
 * Un plan păstrează șablonul lucrării; `generateDueRecurringJobs` creează
 * vizitele următoare; firma și plata se confirmă separat pentru fiecare vizită.
 * Funcții pure (primesc `db`), testabile fără Next.js.
 */

export type Frequency = "weekly" | "biweekly" | "monthly";

export interface RecurringPlanInput {
  requestId?: string;
  propertyId?: string | null;
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
  const payloadHash=createHash("sha256").update(JSON.stringify([input.preferredFirmId??null,input.frequency,input.street.trim(),input.postalCode??null,input.city.trim(),input.floor??null,input.sqm,input.spaceType,input.hour,input.details?.trim()||null,input.startDate,input.endDate??null,input.propertyId??null])).digest("hex");
  return db.transaction(():PlanResult=>{
  if(input.propertyId!=null&&(typeof input.propertyId!=='string'||!db.prepare('SELECT 1 FROM workspace_properties WHERE id=? AND owner_id=? AND archived=0').get(input.propertyId,input.clientId)))return {ok:false,status:404,error:'Proprietate indisponibilă.'};
  if(input.propertyId){try{requirePropertyModule(db,input.propertyId);}catch(e){if(e instanceof OrganizationError)return {ok:false,status:e.status,error:e.message};throw e;}}
  if(input.requestId){
    const prior=db.prepare("SELECT plan_id,payload_hash FROM recurring_creation_requests WHERE client_id=? AND request_id=?").get(input.clientId,input.requestId) as {plan_id:string;payload_hash:string}|undefined;
    if(prior)return prior.payload_hash===payloadHash?{ok:true,planId:prior.plan_id}:{ok:false,status:409,error:"Cererea a fost deja folosită cu alte date. Verifică abonamentele înainte de a crea unul nou."};
  }
  if(input.preferredFirmId&&!db.prepare("SELECT 1 FROM firms f JOIN jobs j ON j.accepted_firm_id=f.id WHERE f.id=? AND j.client_id=? AND j.status='completed' AND f.verified=1").get(input.preferredFirmId,input.clientId))return {ok:false,status:400,error:'Alege o firmă verificată cu care ai finalizat o lucrare.'};
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
  if(input.propertyId)db.prepare('UPDATE recurring_plans SET property_id=? WHERE id=?').run(input.propertyId,planId);
  if(input.requestId)db.prepare("INSERT INTO recurring_creation_requests(client_id,request_id,payload_hash,plan_id) VALUES(?,?,?,?)").run(input.clientId,input.requestId,payloadHash,planId);
  return { ok: true, planId };
  })();
}

interface PlanRow {
  schedule_generation: number;
  property_id: string | null;
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
  status: string;
}

function scheduleRevision(plan: PlanRow): string {
  return createHash("sha256").update(JSON.stringify([
    plan.frequency, plan.hour, plan.next_run_date, plan.anchor_day,
    plan.end_date, plan.details, plan.status, plan.schedule_generation,
  ])).digest("hex");
}

/** Change only the template for ungenerated visits, never jobs or payments. */
export function updateRecurringSchedule(
  db: Database, planId: string, clientId: string,
  input: { revision: unknown; frequency: Frequency; hour: number; startDate: string; endDate?: string | null; details?: string | null },
  now = new Date()
): PlanResult {
  return db.transaction((): PlanResult => {
    const plan = db.prepare("SELECT * FROM recurring_plans WHERE id=? AND client_id=?").get(planId, clientId) as PlanRow | undefined;
    if (!plan) return { ok: false, status: 404, error: "Seria nu există." };
    if (plan.status === "cancelled") return { ok: false, status: 409, error: "Seria a fost anulată." };
    if (input.revision !== scheduleRevision(plan)) return { ok: false, status: 409, error: "Programul s-a schimbat între timp. Reîncarcă lista și redeschide modificarea." };
    const invalid = validateRecurringPlan({
      clientId, street: plan.street, city: plan.city, sqm: plan.sqm, spaceType: plan.space_type,
      frequency: input.frequency, hour: input.hour, startDate: input.startDate,
      endDate: input.endDate, details: input.details,
    });
    if (invalid) return invalid;
    if (input.startDate < plan.next_run_date || bucharestScheduledAt(input.startDate, input.hour) <= now) {
      return { ok: false, status: 400, error: "Alege o dată viitoare, cel mai devreme următoarea dată a seriei." };
    }
    const last = db.prepare("SELECT MAX(occurrence_date) date FROM recurring_occurrences WHERE plan_id=? AND schedule_generation=?").get(planId,plan.schedule_generation) as { date: string | null };
    if (last.date && input.startDate <= last.date) return { ok: false, status: 409, error: "Există deja vizite generate până la această dată. Alege o dată ulterioară." };
    const anchor = input.frequency === plan.frequency && input.startDate === plan.next_run_date
      ? plan.anchor_day ?? Number(input.startDate.slice(8, 10))
      : Number(input.startDate.slice(8, 10));
    db.prepare("UPDATE recurring_plans SET frequency=?,hour=?,next_run_date=?,anchor_day=?,end_date=?,details=? WHERE id=? AND client_id=?")
      .run(input.frequency, input.hour, input.startDate, anchor, input.endDate ?? null, input.details?.trim() || null, planId, clientId);
    return { ok: true, planId };
  })();
}

/** Read-only, rolling 30-day calendar. No bookings, allocation or card actions. */
function upcomingPlanDates(plan: PlanRow & { pause_start: string | null; pause_end: string | null }, now: Date): string[] {
  if (plan.status !== "active") return [];
  const horizon = new Date(`${ymd(now)}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const until = horizon.toISOString().slice(0, 10);
  const dates: string[] = [];
  let date = plan.next_run_date;
  while (date <= until && (!plan.end_date || date <= plan.end_date)) {
    const scheduled = bucharestScheduledAt(date, plan.hour);
    const paused = plan.pause_start && plan.pause_end && date >= plan.pause_start && date <= plan.pause_end;
    if (scheduled >= now && !paused) dates.push(scheduled.toISOString());
    date = computeNextDate(plan.frequency, new Date(`${date}T12:00:00Z`), plan.anchor_day ?? undefined);
  }
  return dates;
}

/** Planurile unui client (active + pauză), pentru afișare în cont. */
export function listPlansForClient(db: Database, clientId: string) {
  const plans = db
    .prepare(
      "SELECT p.*, r.start_date AS pause_start, r.end_date AS pause_end FROM recurring_plans p LEFT JOIN recurring_pauses r ON r.plan_id=p.id WHERE p.client_id = ? AND p.status != 'cancelled' ORDER BY p.created_at DESC"
    )
    .all(clientId) as Array<PlanRow & { pause_start: string | null; pause_end: string | null }>;
  const now = new Date();
  return plans.map(plan => ({ ...plan, preferred_firm_name:plan.preferred_firm_id?(db.prepare("SELECT u.name FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=?").get(plan.preferred_firm_id) as {name:string}|undefined)?.name??null:null,schedule_revision: scheduleRevision(plan), upcoming_dates: upcomingPlanDates(plan, now),
    next_visit_at:(db.prepare("SELECT MIN(j.scheduled_at) date FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.status IN ('waiting','accepted','arrived') AND j.scheduled_at>=?").get(plan.id,now.toISOString()) as {date:string|null}).date,
  }));
}

/** Historicul demonstrabil, inclusiv seriile anulate; fără backfill presupus. */
export function listRecurringOccurrences(db:Database,clientId:string){
  return db.prepare(`SELECT o.plan_id,o.occurrence_date,o.job_id,j.scheduled_at,j.status,j.city,p.preferred_firm_id,
    (SELECT u.name FROM firms f JOIN users u ON u.id=f.user_id WHERE f.id=p.preferred_firm_id) preferred_firm_name,
    (SELECT status FROM offers WHERE job_id=j.id AND firm_id=p.preferred_firm_id ORDER BY created_at DESC LIMIT 1) preferred_offer_status,
    j.accepted_firm_id
    FROM recurring_occurrences o JOIN recurring_plans p ON p.id=o.plan_id
    JOIN jobs j ON j.id=o.job_id
    WHERE p.client_id=? AND j.client_id=p.client_id
    ORDER BY j.scheduled_at DESC,o.created_at DESC,o.job_id DESC LIMIT 200`).all(clientId);
}

function pauseIntervalError(start:unknown,end:unknown,now:Date):Extract<PlanResult,{ok:false}>|null {
  const validDate=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
  if(!validDate(start)||!validDate(end)||start>end||start<ymd(now)||Number(end.slice(0,4))>now.getUTCFullYear()+5)return {ok:false,status:400,error:"Alege un interval valid, de astăzi încolo, în următorii 5 ani."};
  return null;
}

export type PausePreview = {ok:true;count:number;visits:Array<{job_id:string;scheduled_at:string;status:string;city:string}>}|Extract<PlanResult,{ok:false}>;
function pauseBounds(start:string,end:string){
  const next=new Date(`${end}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  return [bucharestScheduledAt(start,0).toISOString(),bucharestScheduledAt(next.toISOString().slice(0,10),0).toISOString()] as const;
}
/** Read-only impact preview; saving must still recheck inside its transaction. */
export function previewPlanPause(db:Database,planId:string,clientId:string,start:unknown,end:unknown,now=new Date()):PausePreview {
  const invalid=pauseIntervalError(start,end,now);if(invalid)return invalid;
  return db.transaction(():PausePreview=>{
    const plan=db.prepare("SELECT status FROM recurring_plans WHERE id=? AND client_id=?").get(planId,clientId) as {status:string}|undefined;
    if(!plan)return {ok:false,status:404,error:"Abonament inexistent"};
    if(plan.status!=="active")return {ok:false,status:409,error:"Pauza pe interval se programează numai pentru un abonament activ."};
    const bounds=pauseBounds(start as string,end as string);
    const clause="FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.scheduled_at >= ? AND j.scheduled_at < ? AND j.status NOT IN ('cancelled','completed')";
    const count=(db.prepare("SELECT COUNT(*) n "+clause).get(planId,...bounds) as {n:number}).n;
    const visits=db.prepare("SELECT o.job_id,j.scheduled_at,j.status,j.city "+clause+" AND j.client_id=? ORDER BY j.scheduled_at,o.job_id LIMIT 100").all(planId,...bounds,clientId) as Extract<PausePreview,{ok:true}>['visits'];
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
    const existing=db.prepare(`SELECT COUNT(*) n FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.scheduled_at >= ? AND j.scheduled_at < ? AND j.status NOT IN ('cancelled','completed')`).get(planId,...pauseBounds(start as string,end as string)) as {n:number};
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

/** Creates a rolling horizon without allocating a firm or authorizing a card. */
export async function generateDueRecurringJobs(
  db: Database, now: Date = new Date(), clientId?: string
): Promise<{created:string[];blocked:Array<{planId:string;error:string}>}> {
  const configured=Number(process.env.NITIDO_RECURRING_HORIZON_DAYS??30);
  const days=Number.isInteger(configured)&&configured>=1&&configured<=90?configured:30;
  const boundary=new Date(`${ymd(now)}T12:00:00Z`);boundary.setUTCDate(boundary.getUTCDate()+days);
  const horizon=boundary.toISOString().slice(0,10);
  const ids=(clientId
    ? db.prepare("SELECT id FROM recurring_plans WHERE status='active' AND client_id=? AND next_run_date<=?").all(clientId,horizon)
    : db.prepare("SELECT id FROM recurring_plans WHERE status='active' AND next_run_date<=?").all(horizon)) as {id:string}[];
  const created:string[]=[];
  const blocked:Array<{planId:string;error:string}>=[];
  for(const {id} of ids){
    try {
    const batch=db.transaction(()=>{
      const plan=db.prepare("SELECT * FROM recurring_plans WHERE id=? AND status='active'").get(id) as PlanRow|undefined;
      if(!plan||(clientId&&plan.client_id!==clientId))return [];
      if(plan.property_id&&!db.prepare('SELECT 1 FROM workspace_properties WHERE id=? AND owner_id=? AND archived=0').get(plan.property_id,plan.client_id))return [];
      assertCustomerCanCreate(db,plan.client_id,'bookings');
      const pause=db.prepare('SELECT start_date,end_date FROM recurring_pauses WHERE plan_id=?').get(id) as {start_date:string;end_date:string}|undefined;
      const result:string[]=[];
      let date=plan.next_run_date;
      while(date<=horizon&&(!plan.end_date||date<=plan.end_date)){
        const scheduled=bucharestScheduledAt(date,plan.hour);
        const paused=pause&&date>=pause.start_date&&date<=pause.end_date;
        if(scheduled.getTime()>=now.getTime()+3600000&&!paused&&!db.prepare('SELECT 1 FROM recurring_occurrences WHERE plan_id=? AND schedule_generation=? AND occurrence_date=?').get(id,plan.schedule_generation,date)){
          if(db.prepare("SELECT 1 FROM recurring_occurrences o JOIN jobs j ON j.id=o.job_id WHERE o.plan_id=? AND j.scheduled_at=? AND j.status NOT IN ('cancelled','no_show')").get(id,scheduled.toISOString()))throw new AccessError('O vizită existentă ocupă noul interval al seriei. Soluționează reprogramarea înainte de generare.',409);
          const jobId=`job_${randomUUID()}`;
          const snapshot=pricingSnapshot({spaceType:plan.space_type,sqm:plan.sqm,expressFeeLei:0,creditLei:0,createdAt:now.toISOString()});
          db.prepare(`INSERT INTO jobs(id,client_id,street,postal_code,city,floor,details,sqm,space_type,when_type,scheduled_at,price_gross,credit_applied,duration_minutes,buffer_minutes,photos_count,mode,status,pricing_snapshot)
            VALUES(?,?,?,?,?,?,?,?,?,'scheduled',?,?,0,?,?,0,'standard','waiting',?)`).run(jobId,plan.client_id,plan.street,plan.postal_code,plan.city,plan.floor,plan.details,plan.sqm,plan.space_type,scheduled.toISOString(),calcGrossPrice(plan.space_type,plan.sqm),calcDurationMinutes(plan.sqm),BUFFER_MINUTES,JSON.stringify(snapshot));
          freezeExecutionRules(db,jobId,'standard');
          db.prepare('INSERT INTO recurring_occurrences(plan_id,schedule_generation,occurrence_date,job_id,scheduled_at) VALUES(?,?,?,?,?)').run(id,plan.schedule_generation,date,jobId,scheduled.toISOString());
          if(plan.property_id){db.prepare('INSERT INTO workspace_property_jobs(job_id,property_id) VALUES(?,?)').run(jobId,plan.property_id);enforceOrganizationBooking(db,plan.property_id,jobId);enforcePropertyBudget(db,plan.property_id,jobId);snapshotInstructions(db,jobId,plan.property_id,plan.client_id);}
          db.prepare('UPDATE recurring_plans SET last_job_id=? WHERE id=?').run(jobId,id);
          notice(db,plan.client_id,jobId,'O vizită recurentă a fost creată. Verifică prețul și alege firma.',`/client?jobId=${encodeURIComponent(jobId)}`);
          if(plan.preferred_firm_id){const recipient=db.prepare('SELECT user_id FROM firms WHERE id=? AND verified=1').get(plan.preferred_firm_id) as {user_id:string}|undefined;if(recipient)notice(db,recipient.user_id,jobId,'Ai o invitație pentru o vizită recurentă. Verifică disponibilitatea și trimite candidatura.',`/firma?job=${encodeURIComponent(jobId)}`);}
          result.push(jobId);
        }
        date=computeNextDate(plan.frequency,new Date(`${date}T12:00:00Z`),plan.anchor_day??undefined);
      }
      db.prepare('UPDATE recurring_plans SET next_run_date=? WHERE id=?').run(date,id);
      return result;
    }).immediate();
    created.push(...batch);
    }catch(error){if(error instanceof CustomerRestrictionError||error instanceof AccessError||error instanceof OrganizationError)blocked.push({planId:id,error:error.message});else throw error;}
  }
  return {created,blocked};
}

export function setPreferredFirm(db:Database,clientId:string,planId:string,firmId:unknown){
 return db.transaction(():PlanResult=>{
  if(!db.prepare("SELECT 1 FROM recurring_plans WHERE id=? AND client_id=? AND status!='cancelled'").get(planId,clientId))return {ok:false,status:404,error:'Serie inexistentă.'};
  if(firmId!==null&&(typeof firmId!=='string'||!db.prepare("SELECT 1 FROM firms f JOIN jobs j ON j.accepted_firm_id=f.id WHERE f.id=? AND j.client_id=? AND j.status='completed' AND f.verified=1").get(firmId,clientId)))return {ok:false,status:400,error:'Alege o firmă verificată cu care ai finalizat o lucrare.'};
  db.prepare('UPDATE recurring_plans SET preferred_firm_id=? WHERE id=?').run(firmId,planId);
  return {ok:true,planId};
 }).immediate();
}
