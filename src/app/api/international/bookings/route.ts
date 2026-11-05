import {after,NextRequest,NextResponse} from 'next/server';
import {processPushOutbox,PUSH_RETRYABLE_SQL} from '@/lib/push';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin,consumeRateLimit} from '@/lib/security';
import {internationalPricingEnabled} from '@/lib/internationalRollout';
import {createInternationalJob,ownInternationalJobs} from '@/lib/internationalJobCreation';
import {InternationalTariffError} from '@/lib/internationalTariffs';
import {CustomerRestrictionError} from '@/lib/customerRestrictions';
import {CardSetupError} from '@/lib/savedCards';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req,{readOnly:true});
 if(!user||user.role!=='client')return reply({error:'Autentificare necesară.'},401);
 if(!internationalPricingEnabled())return reply({error:'Rezervările internaționale nu sunt activate.'},422);
 return reply({bookings:ownInternationalJobs(db,user.id)});
}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);
 if(!user||user.role!=='client')return reply({error:'Autentificare necesară.'},401);
 if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă.'},403);
 if(!consumeRateLimit('international-book:'+user.id,10,60000))return reply({error:'Prea multe cereri.'},429);
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>8000)return reply({error:'Cerere prea mare.'},413);
  const result=createInternationalJob(db,user.id,JSON.parse(raw));
  // Persisted queue rows survive an interrupted response or dispatch worker.
  const queued=db.prepare(`SELECT id FROM push_notification_outbox WHERE job_id=? AND event_type='JOB_CREATED_FIRM_PUSH' AND ${PUSH_RETRYABLE_SQL} ORDER BY created_at,rowid LIMIT 100`).all(result.booking.id) as {id:string}[];
  if(queued.length)after(()=>processPushOutbox(db,queued.map(row=>row.id)));
  return reply(result,result.replayed?200:201);
 }catch(error){
  if(error instanceof InternationalTariffError||error instanceof CustomerRestrictionError||error instanceof CardSetupError)return reply({error:error.message},error.status);
  if(error instanceof SyntaxError)return reply({error:'Date invalide.'},400);
  return reply({error:'Rezervarea nu a putut fi verificată. Nicio plată nu a fost inițiată.'},500);
 }
}
