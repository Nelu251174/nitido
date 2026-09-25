import {currentMarginPolicy,evaluateMarginPolicy} from '@/lib/marginPolicy';
import {listManualEstimates} from '@/lib/manualEstimates';
import {NextRequest,NextResponse} from 'next/server';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {listManualOffers,publishManualOffer,withdrawManualOffer,manualOffersEnabled} from '@/lib/manualOffers';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId())return response({error:'Neautorizat'},401);
 const id=req.nextUrl.searchParams.get('id');if(!id||id.length>100)return response({error:'Referință invalidă'},400);
 const policy=currentMarginPolicy(db),estimate=listManualEstimates(db,id)[0];
 return response({offers:listManualOffers(db,id,null),enabled:manualOffersEnabled(),marginReview:{policy,estimateRevision:estimate?.revision??null,result:estimate?evaluateMarginPolicy(estimate.definition,policy):null}});
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOffersEnabled())return response({error:'Publicarea ofertelor este disponibilă numai în sandbox, după activare.'},403);
 try{
 const raw=await req.text();if(Buffer.byteLength(raw)>30000)return response({error:'Cerere prea mare'},413);
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body)||!['publish','withdraw'].includes(body.action))return response({error:'Cerere invalidă'},400);
 const offer=db.transaction(()=>{const result=body.action==='publish'?publishManualOffer(db,body,actor):withdrawManualOffer(db,body.id,actor,body.reason);auditAdminAction(`assessment.offer_${body.action}`,result.assessmentId,{actorId:actor,offerId:result.id,revision:result.revision});return result;}).immediate();
 return response({offer});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Operațiunea nu a fost confirmată. Reîncarcă istoricul înainte de reîncercare.'},500);}
}
