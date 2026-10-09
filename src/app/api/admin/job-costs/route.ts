import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {manualOfferBookingEnabled} from '@/lib/manualOfferBooking';
import {MarginError} from '@/lib/operationalMargin';
import {jobCostReport,saveJobActualCosts} from '@/lib/jobActualCosts';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId('reports'))return response({error:'Neautorizat'},401);
 try{return response({report:jobCostReport(db,req.nextUrl.searchParams.get('offerId')),enabled:manualOfferBookingEnabled()&&!!await getAdminActorId('finance')});}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);return response({error:'Raportul nu poate fi încărcat.'},500);}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('finance');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 if(!manualOfferBookingEnabled())return response({error:'Înregistrarea costurilor efective nu este activată în sandbox.'},403);
 try{
 const raw=await req.text();if(Buffer.byteLength(raw)>30000)return response({error:'Cerere prea mare'},413);
 const input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new MarginError('Date invalide.');
 const report=db.transaction(()=>{const result=saveJobActualCosts(db,input,actor);auditAdminAction('job.actual_costs_saved',result.jobId,{actorId:actor,revision:result.history[0].revision});return result;}).immediate();
 return response({report});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Date invalide'},400);return response({error:'Salvarea nu a fost confirmată. Reîncarcă istoricul.'},500);}
}
