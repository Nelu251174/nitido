import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {ownerInbox,markOwnerEventsRead} from '@/lib/adminOwnerEvents';
import {storeReportInbox} from '@/lib/adminOwnerReports';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const actor=await getAdminActorId();if(!actor)return reply({error:'UNAUTHORIZED'},401);
 return reply({...ownerInbox(db,actor),reports:storeReportInbox(db)});
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return reply({error:'UNAUTHORIZED'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'INVALID_ORIGIN'},403);
 const raw=await req.text();if(Buffer.byteLength(raw)>6000)return reply({error:'REQUEST_TOO_LARGE'},413);
 try{
  const input=JSON.parse(raw);if(!input||Object.keys(input).length!==1||!Array.isArray(input.ids))return reply({error:'INVALID_EVENT_IDS'},400);
  const result=db.transaction(()=>{const result=markOwnerEventsRead(db,input.ids,actor);auditAdminAction('OWNER_ALERTS_READ',actor,{count:result.changed});return result;}).immediate();
  return reply(result);
 }catch{return reply({error:'INVALID_EVENT_IDS'},400);}
}
