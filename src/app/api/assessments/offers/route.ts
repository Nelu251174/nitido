import {latestAssistedOperation} from '@/lib/assistedOperations';
import {latestOfferSchedule,publicOfferSchedule} from '@/lib/manualOfferSchedule';
import {compatibleManualOffer,manualOfferBookingEnabled} from '@/lib/manualOfferBooking';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {listManualOffers,decideManualOffer,manualOffersEnabled} from '@/lib/manualOffers';
import {assessmentOfferFlowEnabled,offerBookingFlowEnabled,supplementBookingEnabled,supplementOfferAssessment,supplementForOffer,supplementAssessmentOrigin} from '@/lib/supplementBooking';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);
 const id=req.nextUrl.searchParams.get('id');if(!id||id.length>100)return response({error:'Referință invalidă'},400);
 const offers=listManualOffers(db,id,u.id).map(offer=>{const linked=supplementOfferAssessment(db,offer.id)?db.prepare('SELECT job_id FROM assessment_offer_jobs WHERE offer_id=? AND client_id=?').get(offer.id,u.id) as {job_id:string}|undefined:null;if(linked)return {...offer,booking:{enabled:true,jobId:linked.job_id}};if(offer.status!=='accepted'||!offerBookingFlowEnabled(db,offer.id,manualOfferBookingEnabled()))return offer;try{const operation=latestAssistedOperation(db,offer.id);const result=compatibleManualOffer(db,u.id,offer.id,Boolean(operation));const origin=supplementForOffer(db,offer.id);const supplement=origin?{originalJobId:origin.originalJobId,proposalId:origin.proposalId,street:origin.street,postalCode:origin.postalCode,floor:origin.floor,spaceType:origin.spaceType}:null;return {...offer,booking:{enabled:true,jobId:result.jobId,windowsSqm:result.windowsSqm,operation,supplement,schedule:publicOfferSchedule(latestOfferSchedule(db,offer.id))}};}catch(e){if(e instanceof MarginError)return {...offer,booking:{enabled:false,reason:e.message}};throw e;}});
 return response({offers,supplement:supplementAssessmentOrigin(db,id,u.id),enabled:assessmentOfferFlowEnabled(db,id,manualOffersEnabled())});
}
export async function POST(req:NextRequest){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOffersEnabled()&&!supplementBookingEnabled())return response({error:'Deciziile asupra ofertelor nu sunt activate.'},403);
 if(!consumeRateLimit(`manual-offers:${u.id}`,20,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>2000)return response({error:'Cerere prea mare'},413);const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);const assessment=supplementOfferAssessment(db,body.id);if(!assessmentOfferFlowEnabled(db,assessment??'',manualOffersEnabled()))return response({error:'Deciziile asupra ofertelor nu sunt activate pentru această cerere.'},403);return response({offer:decideManualOffer(db,u.id,body)});}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Decizia nu a fost confirmată. Reîncarcă oferta înainte de reîncercare.'},500);}
}
