import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {compatibleManualOffer,manualOfferBookingEnabled} from '@/lib/manualOfferBooking';
import {scheduleOwner} from '@/lib/manualOfferSchedule';
import {latestAssistedOperation,proposeAssistedOperation} from '@/lib/assistedOperations';
import {listAssessmentPlans} from '@/lib/assessmentPlan';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId())return response({error:'Neautorizat'},401);
 try{const id=req.nextUrl.searchParams.get('id'),owner=scheduleOwner(db,id,null),s=compatibleManualOffer(db,owner,id,true);return response({operation:latestAssistedOperation(db,id!),plan:listAssessmentPlans(db,s.row.assessment_id)[0]??null,enabled:manualOfferBookingEnabled()&&!s.jobId});}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);throw e;}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOfferBookingEnabled())return response({error:'Alocarea asistată nu este activată în sandbox.'},403);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>5000)return response({error:'Cerere prea mare'},413);const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))return response({error:'Cerere invalidă'},400);
 const operation=db.transaction(()=>{const owner=scheduleOwner(db,input.id,null),s=compatibleManualOffer(db,owner,input.id,true);if(s.jobId)throw new MarginError('Rezervarea este deja creată.',409);const p=proposeAssistedOperation(db,input.id,s.row.assessment_id,input,actor);auditAdminAction('assessment.operational_proposal',s.row.assessment_id,{actorId:actor,offerId:input.id,revision:p.revision,planRevision:p.planRevision});return p;}).immediate();return response({operation});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Propunerea nu a fost confirmată. Actualizează înainte de reîncercare.'},500);}
}
