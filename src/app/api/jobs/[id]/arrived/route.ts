import { after, NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {processPushOutbox,queueArrivedClientPush} from "@/lib/push";
import { JobRow } from "@/lib/types";
import { markArrivedWithProof } from "@/lib/proofOfWork";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);
  if(!user||user.role!=="firma") return NextResponse.json({error:"Trebuie să fii autentificat ca firmă"},{status:401});
  const firm=getFirmByUserId(user.id);
  if(!firm) return NextResponse.json({error:"Profilul firmei nu a fost găsit"},{status:403});
  const {id}=await params;
  const result=markArrivedWithProof(db,id,firm.id,user.id);
  if(!result.ok) return NextResponse.json({error:result.error},{status:result.status});
  const job=db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  try{const ids=queueArrivedClientPush(db,id);if(ids.length)after(()=>processPushOutbox(db,ids));}
  catch{console.error("[push-outbox] enqueue_failed JOB_ARRIVED_CLIENT_PUSH");}
  return NextResponse.json({job});
}
