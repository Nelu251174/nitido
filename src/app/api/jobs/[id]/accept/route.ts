import { after, NextRequest, NextResponse } from "next/server";
import { db, getFirmByUserId } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { acceptJobAtomic } from "@/lib/acceptJob";
import {processPushOutbox,queueAcceptedClientPush} from "@/lib/push";
import { JobRow } from "@/lib/types";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(req);
  if(!user||user.role!=="firma") return NextResponse.json({error:"Trebuie să fii autentificat ca firmă"},{status:401});
  const firm=getFirmByUserId(user.id);
  if(!firm) return NextResponse.json({error:"Profilul firmei nu a fost găsit"},{status:403});
  const {id}=await params;
  const result=await acceptJobAtomic(db,id,firm.id);
  if(!result.ok) return NextResponse.json({error:result.error,code:result.status===409?"ALREADY_TAKEN":"ACCEPT_FAILED"},{status:result.status});
  const updated=db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow;
  try{const ids=queueAcceptedClientPush(db,id);if(ids.length)after(()=>processPushOutbox(db,ids));}
  catch{console.error("[push-outbox] enqueue_failed JOB_ACCEPTED_CLIENT_PUSH");}
  return NextResponse.json({job:updated});
}
