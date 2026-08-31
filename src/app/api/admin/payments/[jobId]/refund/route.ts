import {NextResponse} from "next/server";
import {isAdmin,auditAdminAction} from "@/lib/adminAuth";
import {db} from "@/lib/db";
import {refundCapturedPayment} from "@/lib/payments";

export async function POST(_req:Request,{params}:{params:Promise<{jobId:string}>}){
  if(!(await isAdmin()))return NextResponse.json({error:"Neautorizat"},{status:401});
  const {jobId}=await params;
  try{await refundCapturedPayment(db,jobId);auditAdminAction("PAYMENT_REFUNDED",jobId,{});return NextResponse.json({ok:true});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Rambursare eșuată"},{status:409});}
}
