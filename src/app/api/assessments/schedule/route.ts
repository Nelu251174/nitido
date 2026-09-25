import {latestAssistedOperation} from '@/lib/assistedOperations';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {compatibleManualOffer,manualOfferBookingEnabled} from '@/lib/manualOfferBooking';
import {latestOfferSchedule,publicOfferSchedule,saveOfferSchedule,scheduleOwner} from '@/lib/manualOfferSchedule';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const admin=req.nextUrl.searchParams.get('admin')==='true';
 const actor=admin?await getAdminActorId('operations'):null;
 const user=admin?null:await getCurrentUser(req);
 if(admin?!actor:(!user||user.role!=='client'))return response({error:'Neautorizat'},401);
 try{
  const id=req.nextUrl.searchParams.get('id');scheduleOwner(db,id,admin?null:user!.id);
  const schedule=latestOfferSchedule(db,id!);
  return response({schedule:admin?schedule:publicOfferSchedule(schedule),enabled:manualOfferBookingEnabled()});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);throw e;}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('operations');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOfferBookingEnabled())return response({error:'Programarea ofertelor nu este activată în sandbox.'},403);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>5000)return response({error:'Cerere prea mare'},413);
  const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return response({error:'Cerere invalidă'},400);
  const schedule=db.transaction(()=>{
   if(latestAssistedOperation(db,input.id))throw new MarginError('Folosește propunerea operațională pentru schimbarea intervalului.',409);
   const owner=scheduleOwner(db,input.id,null),source=compatibleManualOffer(db,owner,input.id);
   if(source.jobId)throw new MarginError('Rezervarea există deja. Folosește fluxul de reprogramare a lucrării.',409);
   const result=saveOfferSchedule(db,input.id,input,actor);
   auditAdminAction('assessment.schedule_'+result.action,source.row.assessment_id,{actorId:actor,offerId:input.id,revision:result.revision});
   return result;
  }).immediate();
  return response({schedule});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Programarea nu a fost confirmată. Actualizează istoricul înainte de reîncercare.'},500);}
}
