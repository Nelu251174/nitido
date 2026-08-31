import { NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { JobRow } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { clientCanReadJob, firmCanReadFullJob } from "@/lib/authorization";
import { firmCoversCity } from "@/lib/text";
import { calcNetForFirm } from "@/lib/pricing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Autentificare necesară" }, { status: 401 });
  const { id } = await params;
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "Lucrare inexistentă" }, { status: 404 });

  const firm = user.role === "firma" ? getFirmByUserId(user.id) : null;
  const authorized =
    (user.role === "client" && clientCanReadJob(user.id, job)) ||
    (firm && firmCanReadFullJob(firm.id, job));
  if (!authorized) {
    const canPreview=Boolean(user.role==="firma"&&firm?.verified&&job.status==="waiting"&&firmCoversCity(firm.coverage_city,firm.coverage_cities_extra,job.city));
    if(!canPreview) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
    return NextResponse.json({job:{id:job.id,city:job.city,sqm:job.sqm,space_type:job.space_type,scheduled_at:job.scheduled_at,price_gross:job.price_gross,firm_payout:calcNetForFirm(job.price_gross),duration_minutes:job.duration_minutes,status:job.status,created_at:job.created_at}});
  }

  let firmName: string | null = null;
  if (job.accepted_firm_id) {
    const firm = db
      .prepare(
        `SELECT users.name as name FROM firms JOIN users ON users.id = firms.user_id WHERE firms.id = ?`
      )
      .get(job.accepted_firm_id) as { name: string } | undefined;
    firmName = firm?.name ?? null;
  }

  const ownReview=user.role==="client"?db.prepare(`SELECT stars rating,comment reviewText FROM ratings
    WHERE job_id=? AND client_id=? AND status='active' AND moderation_status!='hidden'
      AND EXISTS(SELECT 1 FROM payments p WHERE p.job_id=ratings.job_id AND p.status='captured')
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=ratings.job_id AND p.uploaded_by_firm_id=ratings.firm_id AND p.proof_type='ARRIVAL' AND p.status='VALID' AND p.validated_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM job_photos p WHERE p.job_id=ratings.job_id AND p.uploaded_by_firm_id=ratings.firm_id AND p.proof_type='COMPLETION' AND p.status='VALID' AND p.validated_at IS NOT NULL)`).get(id,user.id) as {rating:number;reviewText:string|null}|undefined:undefined;
  const payment=db.prepare("SELECT status paymentStatus,amount_net firmPayout,transfer_status transferStatus,payout_status payoutStatus,refund_status refundStatus,dispute_status disputeStatus FROM payments WHERE job_id=?").get(id) as {paymentStatus:string;firmPayout:number;transferStatus:string;payoutStatus:string;refundStatus:string;disputeStatus:string}|undefined;
  const photos=db.prepare("SELECT id FROM job_photos WHERE job_id=? AND status='VALID'").all(id) as {id:string}[];
  const proofs=db.prepare("SELECT id,proof_type type,created_at createdAt FROM job_photos WHERE job_id=? AND proof_type IN ('ARRIVAL','COMPLETION') AND status='VALID' AND validated_at IS NOT NULL").all(id) as {id:string;type:"ARRIVAL"|"COMPLETION";createdAt:string}[];
  const safeFinancial=payment?{paymentStatus:payment.paymentStatus,transferStatus:payment.transferStatus,payoutStatus:payment.payoutStatus,refundStatus:payment.refundStatus,disputeStatus:payment.disputeStatus,...(user.role==="firma"?{firmPayout:payment.firmPayout}:{})}:null;
  return NextResponse.json({ job:{...job,photos:photos.map(photo=>`/api/uploads/${photo.id}`),proofs:proofs.map(proof=>({...proof,url:`/api/uploads/${proof.id}`})),ownReview:ownReview?{...ownReview,badge:"Recenzie verificată"}:null,financial:safeFinancial,...(user.role==="firma"&&payment?{firm_payout:payment.firmPayout}:{})}, firmName });
}
