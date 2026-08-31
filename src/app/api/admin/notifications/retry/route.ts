import { after, NextResponse } from "next/server";
import { auditAdminAction, isAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { processSmsOutbox } from "@/lib/notifications";
import {processPushOutbox} from "@/lib/push";

export async function POST(){
  if(!(await isAdmin())) return NextResponse.json({error:"Neautorizat"},{status:401});
  const sms=(db.prepare("SELECT count(*) count FROM notification_outbox WHERE status IN ('pending','failed') AND attempt_count < 5").get() as {count:number}).count;
  const push=(db.prepare("SELECT count(*) count FROM push_notification_outbox WHERE status IN ('pending','failed') AND attempt_count < 3").get() as {count:number}).count;
  auditAdminAction("notifications.retry",null,{sms,push});
  if(sms>0)after(()=>processSmsOutbox(db));if(push>0)after(()=>processPushOutbox(db));
  return NextResponse.json({ok:true,queued:sms+push,sms,push});
}
