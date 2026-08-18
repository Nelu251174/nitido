import { NextRequest, NextResponse } from "next/server";
import { db, newId, listAlertableFirms, getFirmById } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  calcGrossPrice,
  calcDurationMinutes,
  BUFFER_MINUTES,
  MIN_LEAD_HOURS,
  isSlotValid,
  nextValidAsapSlot,
  SpaceType,
} from "@/lib/pricing";
import { normalizeCity, firmCoversCity } from "@/lib/text";
import { sendNewJobAlertSms } from "@/lib/sms";
import { applyCredit } from "@/lib/referral";
import { JobRow } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const city = searchParams.get("city");
  const firmId = searchParams.get("firmId");

  let query = "SELECT * FROM jobs WHERE 1=1";
  const params: unknown[] = [];
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  // Orașul NU se filtrează în SQL (comparație exactă de șiruri) — se face mai
  // jos, ca "Constanța" / "constanta" / "Constanta " să se potrivească între
  // ele, și ca o firmă cu localități extra acoperite să vadă și lucrările de
  // acolo (vezi firmCoversCity în src/lib/text.ts).
  query += " ORDER BY created_at DESC";

  let jobs = db.prepare(query).all(...params) as JobRow[];
  if (firmId) {
    // Filtrare pe zona reală de acoperire a firmei (oraș principal + eventuale
    // localități extra) — folosit de panoul de Firmă pentru "Alerte noi".
    const firm = getFirmById(firmId);
    if (firm) {
      jobs = jobs.filter((j) => firmCoversCity(firm.coverage_city, firm.coverage_cities_extra, j.city));
    } else {
      jobs = [];
    }
  } else if (city) {
    const target = normalizeCity(city);
    jobs = jobs.filter((j) => normalizeCity(j.city) === target);
  }

  const photosByJob = new Map<string, string[]>();
  if (jobs.length > 0) {
    const placeholders = jobs.map(() => "?").join(",");
    const photos = db
      .prepare(`SELECT job_id, filename FROM job_photos WHERE job_id IN (${placeholders})`)
      .all(...jobs.map((j) => j.id)) as { job_id: string; filename: string }[];
    for (const p of photos) {
      const arr = photosByJob.get(p.job_id) ?? [];
      arr.push(`/uploads/${p.filename}`);
      photosByJob.set(p.job_id, arr);
    }
  }

  const jobsWithPhotos = jobs.map((j) => ({ ...j, photos: photosByJob.get(j.id) ?? [] }));
  return NextResponse.json({ jobs: jobsWithPhotos });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }

  const body = await req.json();

  const {
    street,
    postalCode,
    city,
    floor,
    sqm,
    spaceType,
    whenType,
    scheduledDate, // ISO date string (ziua aleasă), doar dacă whenType === 'scheduled'
    scheduledHour, // oră din SLOT_HOURS, doar dacă whenType === 'scheduled'
    photoIds,
  } = body as {
    street: string;
    postalCode?: string;
    city: string;
    floor?: string;
    sqm: number;
    spaceType: SpaceType;
    whenType: "asap" | "scheduled";
    scheduledDate?: string;
    scheduledHour?: number;
    photoIds?: string[];
  };

  if (!street || !city || !sqm || !spaceType || !whenType) {
    return NextResponse.json({ error: "Câmpuri obligatorii lipsă" }, { status: 400 });
  }
  if (sqm <= 0) {
    return NextResponse.json({ error: "Suprafața trebuie să fie pozitivă" }, { status: 400 });
  }

  let scheduledAt: Date;

  if (whenType === "asap") {
    const slot = nextValidAsapSlot();
    if (!slot) {
      return NextResponse.json(
        { error: "Niciun slot disponibil în următoarele 3 zile" },
        { status: 400 }
      );
    }
    scheduledAt = new Date(slot.date);
    scheduledAt.setHours(slot.hour, 0, 0, 0);
  } else {
    if (!scheduledDate || scheduledHour === undefined) {
      return NextResponse.json(
        { error: "Dată și oră necesare pentru programare" },
        { status: 400 }
      );
    }
    const day = new Date(scheduledDate);
    if (!isSlotValid(day, scheduledHour)) {
      return NextResponse.json(
        {
          error: `Slotul ales nu respectă pragul minim de ${MIN_LEAD_HOURS} oră/ore până la ora dorită`,
        },
        { status: 400 }
      );
    }
    scheduledAt = new Date(day);
    scheduledAt.setHours(scheduledHour, 0, 0, 0);
  }

  const priceGross = calcGrossPrice(spaceType, sqm);
  const durationMinutes = calcDurationMinutes(sqm);

  // Aplicare automată a creditului disponibil (program de recomandare — vezi
  // src/lib/referral.ts). Firma tot primește pe baza prețului INTEGRAL — vezi
  // src/lib/payments.ts, discount-ul e absorbit din comisionul platformei.
  const { creditUsed } = applyCredit(priceGross, user.credit_balance);
  if (creditUsed > 0) {
    db.prepare("UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?").run(
      creditUsed,
      user.id
    );
  }

  const validPhotoIds = (photoIds ?? []).slice(0, 5);

  const id = newId("job");
  db.prepare(
    `INSERT INTO jobs
      (id, client_id, street, postal_code, city, floor, sqm, space_type, when_type,
       scheduled_at, price_gross, credit_applied, duration_minutes, buffer_minutes, photos_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`
  ).run(
    id,
    user.id,
    street,
    postalCode ?? null,
    city,
    floor ?? null,
    sqm,
    spaceType,
    whenType,
    scheduledAt.toISOString(),
    priceGross,
    creditUsed,
    durationMinutes,
    BUFFER_MINUTES,
    validPhotoIds.length
  );

  if (validPhotoIds.length > 0) {
    const linkPhoto = db.prepare("UPDATE job_photos SET job_id = ? WHERE id = ? AND job_id IS NULL");
    for (const photoId of validPhotoIds) linkPhoto.run(id, photoId);
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;

  // Alertă SMS către firmele eligibile din oraș (inclusiv localități extra
  // acoperite de o firmă, dincolo de orașul ei de bază — vezi firmCoversCity)
  // — interimar, cât timp aplicația mobilă nu e publicată (vezi comentariul
  // din src/lib/sms.ts). Fire-and-forget: nu blocăm răspunsul pe durata trimiterii.
  const now = new Date();
  const matchingPhones = listAlertableFirms()
    .filter(
      (f) =>
        firmCoversCity(f.coverage_city, f.coverage_cities_extra, city) &&
        !(f.suspended_until && new Date(f.suspended_until) > now)
    )
    .map((f) => f.phone);
  sendNewJobAlertSms(matchingPhones, { city, spaceType, sqm }).catch(() => {});

  return NextResponse.json({ job }, { status: 201 });
}
