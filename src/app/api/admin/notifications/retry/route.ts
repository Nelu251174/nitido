import {recoverNotificationClaims} from "@/lib/notificationClaims";
import { after, NextResponse } from "next/server";
import { auditAdminAction, isAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { processSmsOutbox,SMS_RETRYABLE_SQL } from "@/lib/notifications";
import {processPushOutbox,PUSH_RETRYABLE_SQL} from "@/lib/push";

export async function POST(){
  if(!(await isAdmin())) return NextResponse.json({error:"Neautorizat"},{status:401});
  const recovery=recoverNotificationClaims(db);
  const sms=(db.prepare(`SELECT count(*) count FROM notification_outbox WHERE ${SMS_RETRYABLE_SQL}`).get() as {count:number}).count;
  const push=(db.prepare(`SELECT count(*) count FROM push_notification_outbox WHERE ${PUSH_RETRYABLE_SQL}`).get() as {count:number}).count;
  auditAdminAction("notifications.retry",null,{sms,push,...recovery});
  if(sms>0)after(()=>processSmsOutbox(db));if(push>0)after(()=>processPushOutbox(db));
  return NextResponse.json({ok:true,queued:sms+push,sms,push,...recovery});
}
