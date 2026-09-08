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
  return d.toISOString().slice(0, 10);
}

/** Următoarea dată de rulare, în funcție de frecvență. */
export function computeNextDate(frequency: Frequency, from: Date): string {
  const d = new Date(from.getTime());
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return ymd(d);
}

const VALID_SPACE: readonly SpaceType[] = ["apartament", "casa", "birou", "altul"];

/** Creează un abonament recurent. */
export function createRecurringPlan(db: Database, input: RecurringPlanInput): PlanResult {
  if (!input.street || !input.city || !input.sqm || !input.spaceType || !input.frequency) {
    return { ok: false, error: "Câmpuri obligatorii lipsă", status: 400 };
  }
  if (!Number.isInteger(input.sqm) || input.sqm <= 0) {
    return { ok: false, error: "Suprafața trebuie să fie un număr întreg pozitiv", status: 400 };
  }
  if (!VALID_SPACE.includes(input.spaceType)) {
    return { ok: false, error: "Tip spațiu invalid", status: 400 };
  }
  if (!["weekly", "biweekly", "monthly"].includes(input.frequency)) {
    return { ok: false, error: "Frecvență invalidă", status: 400 };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { ok: false, error: "Dată de start invalidă", status: 400 };
  }

  const planId = `plan_${randomUUID()}`;
  db.prepare(
    `INSERT INTO recurring_plans
       (id, client_id, preferred_firm_id, frequency, street, postal_code, city, floor,
        sqm, space_type, hour, details, status, next_run_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    planId,
    input.clientId,
    input.preferredFirmId ?? null,
    input.frequency,
    input.street,
    input.postalCode ?? null,
    input.city,
    input.floor ?? null,
    input.sqm,
    input.spaceType,
    input.hour,
    typeof input.details === "string" ? input.details.trim().slice(0, 500) || null : null,
    input.startDate
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
  const plan = db
    .prepare("SELECT id FROM recurring_plans WHERE id = ? AND client_id = ?")
    .get(planId, clientId) as { id: string } | undefined;
  if (!plan) return { ok: false, error: "Abonament inexistent", status: 404 };
  db.prepare("UPDATE recurring_plans SET status = ? WHERE id = ?").run(status, planId);
  return { ok: true, planId };
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
  for (const plan of due) {
    const jobId = `job_${randomUUID()}`;
    const scheduledAt = new Date(`${plan.next_run_date}T00:00:00`);
    scheduledAt.setHours(plan.hour, 0, 0, 0);
    const priceGross = calcGrossPrice(plan.space_type, plan.sqm);
    const durationMinutes = calcDurationMinutes(plan.sqm);

    db.prepare(
      `INSERT INTO jobs
         (id, client_id, street, postal_code, city, floor, details, sqm, space_type, when_type,
          scheduled_at, price_gross, credit_applied, duration_minutes, buffer_minutes, photos_count, mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, 0, ?, ?, 0, 'express', 'waiting')`
    ).run(
      jobId,
      plan.client_id,
      plan.street,
      plan.postal_code,
      plan.city,
      plan.floor,
      plan.details,
      plan.sqm,
      plan.space_type,
      scheduledAt.toISOString(),
      priceGross,
      durationMinutes,
      BUFFER_MINUTES
    );

    // Alocă firmei preferate dacă e posibil; dacă nu, lucrarea rămâne 'waiting'
    // (o poate prelua altă firmă din zonă — nu blocăm abonamentul).
    if (plan.preferred_firm_id) {
      try {
        await acceptJobAtomic(db, jobId, plan.preferred_firm_id);
      } catch {
        /* rămâne waiting */
      }
    }

    db.prepare("UPDATE recurring_plans SET next_run_date = ?, last_job_id = ? WHERE id = ?").run(
      computeNextDate(plan.frequency, new Date(`${plan.next_run_date}T00:00:00`)),
      jobId,
      plan.id
    );
    created.push(jobId);
  }
  return { created };
}
