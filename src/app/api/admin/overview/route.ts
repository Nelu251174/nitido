import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { JobRow } from "@/lib/types";
import { isAdmin } from "@/lib/adminAuth";
import { maskSmsRecipient } from "@/lib/notifications";

// Panou minimal de administrare — spec secțiunea 3.3 / 8 (aprobare firme, rapoarte,
// monitorizare no-show). Nu e un admin complet (fără autentificare), doar o fereastră
// de verificare pentru acest MVP.
export async function GET(_req: NextRequest) {
  void _req;
  if (!(await isAdmin())) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const jobs = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all() as JobRow[];
  const firms = db
    .prepare(
      `SELECT firms.id, users.name, firms.coverage_city, firms.cui, firms.rating_sum, firms.rating_count,
              firms.strikes_30d, firms.strikes_90d, firms.suspended_until, firms.verified
       FROM firms JOIN users ON users.id = firms.user_id`
    )
    .all() as { id: string; name: string; verified: number }[];
  const payments = db.prepare("SELECT id,job_id,amount_gross,commission_amount,amount_net,status,stripe_fee_amount,transfer_status,payout_status,refund_status,dispute_status,created_at FROM payments ORDER BY created_at DESC").all();
  const notifications = (db.prepare(`SELECT id,event_type,channel,recipient,status,attempt_count,last_error,created_at,sent_at
    FROM notification_outbox ORDER BY created_at DESC LIMIT 100`).all() as {recipient:string;[key:string]:unknown}[])
    .map(({recipient,...row})=>({...row,recipient_masked:maskSmsRecipient(recipient)}));
  const pushNotifications=(db.prepare(`SELECT o.id,o.event_type,o.channel,o.recipient_user_id,o.status,o.attempt_count,o.last_error,o.created_at,o.sent_at,d.platform FROM push_notification_outbox o LEFT JOIN push_devices d ON d.id=o.device_token_id ORDER BY o.created_at DESC LIMIT 100`).all() as {recipient_user_id:string;[key:string]:unknown}[]).map(({recipient_user_id,...row})=>({...row,recipient_masked:`user:${recipient_user_id.slice(0,4)}•••${recipient_user_id.slice(-3)}`}));
  const proofs = (db.prepare(`SELECT p.id,p.job_id,p.uploaded_by_firm_id,p.proof_type,p.status,p.created_at,p.validated_at
    FROM job_photos p WHERE p.proof_type IN ('ARRIVAL','COMPLETION') ORDER BY p.created_at DESC`).all() as {id:string;[key:string]:unknown}[])
    .map(proof=>({...proof,url:`/api/uploads/${proof.id}`}));
  const reviews=db.prepare(`SELECT r.id,r.job_id,r.firm_id,r.stars,r.comment,r.moderation_status,r.created_at,
    CASE WHEN j.status='completed'
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)
      THEN 1 ELSE 0 END verified_job,
    (SELECT COUNT(*) FROM review_reports rr WHERE rr.rating_id=r.id AND rr.status='open') report_count
    FROM ratings r JOIN jobs j ON j.id=r.job_id
    WHERE j.status='completed'
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=j.id AND p.status='captured')
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=j.id AND p.uploaded_by_firm_id=r.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)
    ORDER BY r.created_at DESC`).all();

  // Statistici agregate — ca platforma să poată fi condusă din cifre reale,
  // nu doar liste brute. Nimic din ce nu poate fi calculat direct din datele
  // existente; niciun număr fals/estimat.
  const today = new Date().toISOString().slice(0, 10);
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const everAcceptedJobs = jobs.filter((j) =>
    ["accepted", "arrived", "completed", "no_show"].includes(j.status)
  );
  const noShowJobs = jobs.filter((j) => j.status === "no_show");
  const gmv = completedJobs.reduce((sum, j) => sum + j.price_gross, 0);

  const completedCountByFirm = new Map<string, number>();
  for (const j of completedJobs) {
    if (!j.accepted_firm_id) continue;
    completedCountByFirm.set(
      j.accepted_firm_id,
      (completedCountByFirm.get(j.accepted_firm_id) ?? 0) + 1
    );
  }
  const topFirms = firms
    .map((f) => ({ id: f.id, name: f.name, completedJobs: completedCountByFirm.get(f.id) ?? 0 }))
    .filter((f) => f.completedJobs > 0)
    .sort((a, b) => b.completedJobs - a.completedJobs)
    .slice(0, 5);

  const stats = {
    totalJobs: jobs.length,
    jobsToday: jobs.filter((j) => j.created_at.slice(0, 10) === today).length,
    completedJobs: completedJobs.length,
    gmv,
    avgOrderValue: completedJobs.length > 0 ? Math.round(gmv / completedJobs.length) : 0,
    noShowRatePct:
      everAcceptedJobs.length > 0
        ? Math.round((noShowJobs.length / everAcceptedJobs.length) * 1000) / 10
        : 0,
    verifiedFirms: firms.filter((f) => f.verified).length,
    totalFirms: firms.length,
    topFirms,
  };

  return NextResponse.json({ jobs, firms, payments, notifications:[...pushNotifications,...notifications].sort((a,b)=>String((b as Record<string,unknown>).created_at).localeCompare(String((a as Record<string,unknown>).created_at))).slice(0,100), proofs, reviews, stats });
}
