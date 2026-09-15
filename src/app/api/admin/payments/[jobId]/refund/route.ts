import {NextResponse} from "next/server";
import {isAdmin,auditAdminAction} from "@/lib/adminAuth";
import {db} from "@/lib/db";
import {refundCapturedPayment} from "@/lib/payments";

export async function POST(_req:Request,{params}:{params:Promise<{jobId:string}>}){
  if(!(await isAdmin()))return NextResponse.json({error:"Neautorizat"},{status:401});
  const {jobId}=await params;
  try{const status=await refundCapturedPayment(db,jobId);auditAdminAction(status==="succeeded"?"PAYMENT_REFUNDED":"PAYMENT_REFUND_CHECKED",jobId,{status});return NextResponse.json({ok:status!=="failed",status,...(status==="failed"?{error:"Rambursarea a eșuat. Este necesară verificarea financiară."}:{})},{status:status==="pending"?202:status==="failed"?409:200});}
  catch{return NextResponse.json({error:"Rambursarea nu a putut fi confirmată. Verifică starea înainte de a reîncerca."},{status:409});}
}
