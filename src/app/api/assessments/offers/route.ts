import {latestOfferSchedule,publicOfferSchedule} from '@/lib/manualOfferSchedule';
import {compatibleManualOffer,manualOfferBookingEnabled} from '@/lib/manualOfferBooking';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {listManualOffers,decideManualOffer,manualOffersEnabled} from '@/lib/manualOffers';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);
 const id=req.nextUrl.searchParams.get('id');if(!id||id.length>100)return response({error:'Referință invalidă'},400);
 const offers=listManualOffers(db,id,u.id).map(offer=>{if(offer.status!=='accepted'||!manualOfferBookingEnabled())return offer;try{const result=compatibleManualOffer(db,u.id,offer.id);return {...offer,booking:{enabled:true,jobId:result.jobId,windowsSqm:result.windowsSqm,schedule:publicOfferSchedule(latestOfferSchedule(db,offer.id))}};}catch(e){if(e instanceof MarginError)return {...offer,booking:{enabled:false,reason:e.message}};throw e;}});
 return response({offers,enabled:manualOffersEnabled()});
}
export async function POST(req:NextRequest){
 const u=await getCurrentUser(req);if(!u||u.role!=='client')return response({error:'Autentificare ca client necesară'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOffersEnabled())return response({error:'Deciziile asupra ofertelor sunt disponibile numai în sandbox, după activare.'},403);
 if(!consumeRateLimit(`manual-offers:${u.id}`,20,60000))return response({error:'Prea multe cereri. Reîncearcă într-un minut.'},429);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>2000)return response({error:'Cerere prea mare'},413);const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);return response({offer:decideManualOffer(db,u.id,body)});}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Decizia nu a fost confirmată. Reîncarcă oferta înainte de reîncercare.'},500);}
}
