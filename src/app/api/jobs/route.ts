import { after, NextRequest, NextResponse } from "next/server";
import { db, newId, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  calcGrossPrice,
  calcDurationMinutes,
  calcNetForFirm,
  BUFFER_MINUTES,
  MIN_LEAD_HOURS,
  SLOT_HOURS,
  isSlotValid,
  nextValidAsapSlot,
  SpaceType,
} from "@/lib/pricing";
import { firmCoversCity } from "@/lib/text";
import {processPushOutbox,queueNewJobFirmPushes} from "@/lib/push";
import { applyCredit } from "@/lib/referral";
import { getClientCardInfo } from "@/lib/clientPayments";
import { JobRow } from "@/lib/types";
import { scanRoomLabel } from "@/lib/nitidoScan";
import { EXPRESS_60_FEE_LEI, express60Deadline, expireExpress60Guarantees } from "@/lib/express60";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  // Express 60: retrogradează lazy lucrările premium cu garanția expirată, la
  // orice încărcare de feed — astfel breach-ul funcționează și fără cron extern
  // (backstop-ul programat /api/cron/express60 rămâne disponibil în plus).
  expireExpress60Guarantees(db);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

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
  let firmId: string | null = null;
  if (user.role === "client") {
    jobs = jobs.filter((j) => j.client_id === user.id);
  } else {
    const firm = getFirmByUserId(user.id);
    if (!firm) return NextResponse.json({ error: "Profil firmă inexistent" }, { status: 403 });
    firmId = firm.id;
    jobs = jobs.filter(
      (j) =>
        j.accepted_firm_id === firm.id ||
        (Boolean(firm.verified) && j.status === "waiting" && firmCoversCity(firm.coverage_city, firm.coverage_cities_extra, j.city))
    );
    // Express 60 = prioritate maximă: lucrările premium urcă în capul feed-ului
    // (restul rămâne pe ordinea existentă, cele mai noi primele).
    jobs = jobs
      .map((j, index) => ({ j, index }))
      .sort((a, b) => {
        const aEx = a.j.status === "waiting" && a.j.express_60 ? 1 : 0;
        const bEx = b.j.status === "waiting" && b.j.express_60 ? 1 : 0;
        return bEx - aEx || a.index - b.index;
      })
      .map((entry) => entry.j);
  }

  const photosByJob = new Map<string, string[]>();
  const scanByJob = new Map<string, {id:string;url:string;room:string|null;roomLabel:string}[]>();
  const proofsByJob = new Map<string, {id:string;type:"ARRIVAL"|"COMPLETION";url:string;createdAt:string}[]>();
  const ownReviewsByJob = new Map<string,{rating:number;reviewText:string|null;badge:"Recenzie verificată"}>();
  const paymentsByJob = new Map<string,{paymentStatus:string;firmPayout:number;transferStatus:string;payoutStatus:string;refundStatus:string;disputeStatus:string}>();
  if (jobs.length > 0) {
    const placeholders = jobs.map(() => "?").join(",");
    const photos = db
      .prepare(`SELECT id, job_id, filename, proof_type, context_label, created_at FROM job_photos WHERE job_id IN (${placeholders}) AND status='VALID'`)
      .all(...jobs.map((j) => j.id)) as { id: string; job_id: string; filename: string; proof_type:string; context_label:string|null; created_at:string }[];
    for (const p of photos) {
      const arr = photosByJob.get(p.job_id) ?? [];
      arr.push(`/api/uploads/${p.id}`);
      photosByJob.set(p.job_id, arr);
      if (p.proof_type === "CLIENT_CONTEXT") {
        const scan = scanByJob.get(p.job_id) ?? [];
        scan.push({ id:p.id, url:`/api/uploads/${p.id}`, room:p.context_label, roomLabel:scanRoomLabel(p.context_label) });
        scanByJob.set(p.job_id, scan);
      }
      if (p.proof_type === "ARRIVAL" || p.proof_type === "COMPLETION") {
        const proofs = proofsByJob.get(p.job_id) ?? [];
        proofs.push({ id:p.id, type:p.proof_type, url:`/api/uploads/${p.id}`, createdAt:p.created_at });
        proofsByJob.set(p.job_id, proofs);
      }
    }
  }

  if(user.role==="client"&&jobs.length){const placeholders=jobs.map(()=>"?").join(",");const reviews=db.prepare(`SELECT job_id,stars,comment FROM ratings r WHERE client_id=? AND status='active' AND moderation_status!='hidden' AND job_id IN (${placeholders}) AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=r.job_id AND p.status='captured') AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=r.job_id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL) AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=r.job_id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)`).all(user.id,...jobs.map(j=>j.id)) as {job_id:string;stars:number;comment:string|null}[];for(const review of reviews)ownReviewsByJob.set(review.job_id,{rating:review.stars,reviewText:review.comment,badge:"Recenzie verificată"});}
  if(jobs.length){const placeholders=jobs.map(()=>"?").join(",");const rows=db.prepare(`SELECT job_id,status,amount_net,transfer_status,payout_status,refund_status,dispute_status FROM payments WHERE job_id IN (${placeholders})`).all(...jobs.map(job=>job.id)) as {job_id:string;status:string;amount_net:number;transfer_status:string;payout_status:string;refund_status:string;dispute_status:string}[];for(const payment of rows)paymentsByJob.set(payment.job_id,{paymentStatus:payment.status,firmPayout:payment.amount_net,transferStatus:payment.transfer_status,payoutStatus:payment.payout_status,refundStatus:payment.refund_status,disputeStatus:payment.dispute_status});}

  const jobsWithPhotos = jobs.map((j) => {
    const canSeePrivate = user.role === "client" || j.accepted_firm_id === firmId;
    if (canSeePrivate) {const payment=paymentsByJob.get(j.id)??null;return { ...j, photos: photosByJob.get(j.id) ?? [], scan: scanByJob.get(j.id) ?? [], proofs: proofsByJob.get(j.id) ?? [], ownReview:user.role==="client"?ownReviewsByJob.get(j.id)??null:undefined, financial:payment?{paymentStatus:payment.paymentStatus,transferStatus:payment.transferStatus,payoutStatus:payment.payoutStatus,refundStatus:payment.refundStatus,disputeStatus:payment.disputeStatus,...(user.role==="firma"?{firmPayout:payment.firmPayout}:{})}:null,...(user.role==="firma"?{firm_payout:payment?.firmPayout??null}:{}) };}
    return {
      id: j.id,
      city: j.city,
      sqm: j.sqm,
      space_type: j.space_type,
      when_type: j.when_type,
      mode: j.mode,
      scheduled_at: j.scheduled_at,
      price_gross: j.price_gross,
      firm_payout: calcNetForFirm(j.price_gross),
      duration_minutes: j.duration_minutes,
      status: j.status,
      created_at: j.created_at,
      // Express 60: firma vede că e tier premium cu preluare garantată + countdown.
      express_60: j.express_60,
      express_60_deadline: j.express_60_deadline,
      express_60_status: j.express_60_status,
      // Nitido Scan: firma vede pozele de context etichetate încă din feed,
      // ca să estimeze mai bine înainte de a prelua/oferta.
      scan: scanByJob.get(j.id) ?? [],
    };
  });
  // Pentru firme: lista lucrărilor la care firma a trimis deja o ofertă (ca UI-ul
  // să arate „Ofertă trimisă" în loc de butonul de ofertă).
  let offeredJobIds: string[] = [];
  if (user.role === "firma" && firmId) {
    offeredJobIds = (db
      .prepare("SELECT job_id FROM offers WHERE firm_id = ? AND status IN ('pending','accepted')")
      .all(firmId) as { job_id: string }[]).map((o) => o.job_id);
  }
  return NextResponse.json({ jobs: jobsWithPhotos, offeredJobIds });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Trebuie să fii autentificat ca client" }, { status: 401 });
  }

  // Card obligatoriu înainte de postare — la acceptare se pune HOLD pe acest
  // card, deci trebuie salvat dinainte. Dacă Stripe nu e activat, se sare peste.
  const card = getClientCardInfo(db, user.id);
  if (card.stripeConfigured && !card.hasCard) {
    return NextResponse.json(
      { error: "Adaugă un card înainte de a posta o lucrare.", needsCard: true },
      { status: 402 }
    );
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
    mode, // 'express' (urgențe, primul care acceptă) | 'standard' (oferte, clientul alege)
    express60, // true = tier premium Express 60 (preluare garantată în 60 min)
    scheduledDate, // ISO date string (ziua aleasă), doar dacă whenType === 'scheduled'
    scheduledHour, // oră din SLOT_HOURS, doar dacă whenType === 'scheduled'
    photoIds,
    details,
  } = body as {
    street: string;
    postalCode?: string;
    city: string;
    floor?: string;
    sqm: number;
    spaceType: SpaceType;
    whenType: "asap" | "scheduled";
    mode?: "express" | "standard";
    express60?: boolean;
    scheduledDate?: string;
    scheduledHour?: number;
    photoIds?: string[];
    details?: string;
  };

  // Express 60 e inerent urgent → forțează modul 'express' (preluare directă).
  // Altfel: modul ales de client, implicit 'express' pentru compatibilitate.
  const isExpress60 = express60 === true;
  const jobMode: "express" | "standard" = isExpress60 ? "express" : mode === "standard" ? "standard" : "express";
  // Express 60 nu are sens pentru lucrări programate în viitor — doar „cât mai curând".
  if (isExpress60 && whenType !== "asap") {
    return NextResponse.json({ error: "Express 60 este disponibil doar pentru preluare imediată (Cât mai curând)" }, { status: 400 });
  }

  const validSpaceTypes: readonly SpaceType[] = ["apartament", "casa", "birou", "altul"];
  const requestId = req.headers.get("Idempotency-Key")?.trim() || null;
  if (requestId && requestId.length > 100) {
    return NextResponse.json({ error: "Identificatorul cererii este invalid" }, { status: 400 });
  }
  if (requestId) {
    const existing = db.prepare("SELECT * FROM jobs WHERE client_id = ? AND client_request_id = ?").get(user.id, requestId) as JobRow | undefined;
    if (existing) return NextResponse.json({ job: existing, replayed: true });
  }

  if (!street || !city || !sqm || !spaceType || !whenType) {
    return NextResponse.json({ error: "Câmpuri obligatorii lipsă" }, { status: 400 });
  }
  if (sqm <= 0) {
    return NextResponse.json({ error: "Suprafața trebuie să fie pozitivă" }, { status: 400 });
  }
  if (!Number.isInteger(sqm)) {
    return NextResponse.json({ error: "Suprafața trebuie să fie un număr întreg" }, { status: 400 });
  }
  if (!validSpaceTypes.includes(spaceType)) {
    return NextResponse.json({ error: "Tipul serviciului nu este valid" }, { status: 400 });
  }
  if (whenType !== "asap" && whenType !== "scheduled") {
    return NextResponse.json({ error: "Tipul programării nu este valid" }, { status: 400 });
  }
  if (typeof details === "string" && details.length > 500) {
    return NextResponse.json({ error: "Detaliile pot avea maximum 500 de caractere" }, { status: 400 });
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
    if (!scheduledDate || scheduledHour === undefined || !SLOT_HOURS.includes(scheduledHour as typeof SLOT_HOURS[number])) {
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

  // Express 60: suplimentul premium se adaugă la prețul brut. HOLD-ul se pune
  // abia la acceptare, deci se percepe DOAR dacă o firmă chiar preia; dacă
  // garanția nu e respectată, suplimentul se scoate din nou (vezi express60.ts).
  const express60Fee = isExpress60 ? EXPRESS_60_FEE_LEI : 0;
  const priceGross = calcGrossPrice(spaceType, sqm) + express60Fee;
  const durationMinutes = calcDurationMinutes(sqm);

  // Aplicare automată a creditului disponibil (program de recomandare — vezi
  // src/lib/referral.ts). Firma tot primește pe baza prețului INTEGRAL — vezi
  // src/lib/payments.ts, discount-ul e absorbit din comisionul platformei.
  const { creditUsed } = applyCredit(priceGross, user.credit_balance);
  const requestedPhotoIds = Array.from(new Set(photoIds ?? [])).slice(0, 5);
  const ownedPhotoIds = requestedPhotoIds.filter((photoId) =>
    db.prepare("SELECT 1 FROM job_photos WHERE id = ? AND owner_user_id = ? AND job_id IS NULL")
      .get(photoId, user.id)
  );
  if (ownedPhotoIds.length !== requestedPhotoIds.length) {
    return NextResponse.json({ error: "Una sau mai multe poze nu îți aparțin" }, { status: 403 });
  }
  const id = newId("job");
  const created = db.transaction((): { job: JobRow; replayed: boolean } => {
    if (requestId) {
      const existing = db.prepare("SELECT * FROM jobs WHERE client_id = ? AND client_request_id = ?").get(user.id, requestId) as JobRow | undefined;
      if (existing) return { job: existing, replayed: true };
    }
    if (creditUsed > 0) db.prepare("UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?").run(creditUsed, user.id);
    db.prepare(
      `INSERT INTO jobs
        (id, client_id, street, postal_code, city, floor, details, client_request_id, sqm, space_type, when_type,
         scheduled_at, price_gross, credit_applied, duration_minutes, buffer_minutes, photos_count, mode,
         express_60, express_60_fee, express_60_deadline, express_60_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`
    ).run(id,user.id,street,postalCode ?? null,city,floor ?? null,typeof details === "string" ? details.trim() || null : null,requestId,sqm,spaceType,whenType,scheduledAt.toISOString(),priceGross,creditUsed,durationMinutes,BUFFER_MINUTES,ownedPhotoIds.length,jobMode,isExpress60?1:0,express60Fee,isExpress60?express60Deadline(new Date().toISOString()).toISOString():null,isExpress60?"pending":null);
    if (ownedPhotoIds.length > 0) {
      const linkPhoto = db.prepare("UPDATE job_photos SET job_id = ? WHERE id = ? AND owner_user_id = ? AND job_id IS NULL");
      for (const photoId of ownedPhotoIds) linkPhoto.run(id, photoId, user.id);
    }
    return { job: db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow, replayed: false };
  })();
  if (created.replayed) return NextResponse.json({ job: created.job, replayed: true });
  const job = created.job;

  try {
    const notificationIds=queueNewJobFirmPushes(db,{id:job.id,city,spaceType,sqm});
    if(notificationIds.length)after(()=>processPushOutbox(db,notificationIds));
  } catch {
    console.error("[push-outbox] enqueue_failed JOB_CREATED_FIRM_PUSH");
  }

  return NextResponse.json({ job }, { status: 201 });
}
