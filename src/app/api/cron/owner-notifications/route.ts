import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/db';
import {enqueueOwnerEvent,processOwnerEmails} from '@/lib/adminOwnerEvents';
import {processLeadNotifications} from '@/lib/pro/leadNotifications';
import {saveStoreReports} from '@/lib/adminOwnerReports';
export const runtime='nodejs';
export const maxDuration=60;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const secret=process.env.NITIDO_OWNER_ALERTS_CRON_SECRET,provided=req.headers.get('x-owner-cron-secret')??'';
 if(!secret||secret.length<32||Buffer.byteLength(secret)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(secret),Buffer.from(provided)))return reply({error:'UNAUTHORIZED'},401);
 const raw=await req.text();if(Buffer.byteLength(raw)>200000)return reply({error:'REQUEST_TOO_LARGE'},413);
 let ids:string[]|undefined;
 try{
  if(raw){const input=JSON.parse(raw);
   if(input?.action==='reports'&&Object.keys(input).every(k=>['action','reports','digestDate'].includes(k)))ids=[saveStoreReports(db,input.reports,input.digestDate)];
   else if(input?.action==='test'&&Object.keys(input).length===1)ids=[enqueueOwnerEvent(db,'SYSTEM_TEST','owner-alerts-activation-v1')];
   else return reply({error:'INVALID_ACTION'},400);
  }
 }catch{return reply({error:'INVALID_REPORT'},400);}
 const result=await processOwnerEmails(db,{ids});
 if(!raw&&process.env.NEXT_PUBLIC_NITIDO_PRO_PUBLIC==='true'&&db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pro_idempotency'").get())await processLeadNotifications(db);
 return reply(result);
}
