import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {availabilityAlertsEnabled,alertChannels,subscribeAvailability,unsubscribeAvailability,batchMatches} from '@/lib/availabilityAlerts';
import {AvailabilityError} from '@/lib/weeklyAvailability';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
  const u=await getCurrentUser(req,{readOnly:true});if(u?.role!=='client')return reply({error:'Autentificare client necesară'},401);
  if(!consumeRateLimit('alerts-read:'+u.id,60,60000))return reply({error:'Reîncearcă într-un minut.'},429);
  const id=req.nextUrl.searchParams.get('batch');
  if(id){if(!db.prepare('SELECT 1 FROM availability_alert_batches WHERE id=? AND client_id=?').get(id,u.id))return reply({error:'Informare inexistentă'},404);return reply({matches:availabilityAlertsEnabled()?batchMatches(db,u.id,id):[],bookingConfirmed:false});}
  return reply({enabled:availabilityAlertsEnabled(),channels:alertChannels(db,u.id),subscriptions:db.prepare('SELECT id,criteria_json,channels_json,active,expires_at FROM availability_subscriptions WHERE client_id=? ORDER BY created_ms DESC LIMIT 100').all(u.id),batches:db.prepare('SELECT id,day_key FROM availability_alert_batches WHERE client_id=? ORDER BY created_ms DESC LIMIT 10').all(u.id)});
}
export async function POST(req:NextRequest){
  const u=await getCurrentUser(req);if(u?.role!=='client')return reply({error:'Autentificare client necesară'},401);
  if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
  if(!consumeRateLimit('alerts-write:'+u.id,20,60000))return reply({error:'Reîncearcă într-un minut.'},429);
  const text=await req.text();if(text.length>4000)return reply({error:'Cerere prea mare'},413);
  try{const b=JSON.parse(text);if(b.action==='unsubscribe'){if(typeof b.id!=='string'||b.id.length>100)return reply({error:'Cerere invalidă'},400);unsubscribeAvailability(db,u.id,b.id);return reply({ok:true});}if(b.action!=='subscribe')return reply({error:'Acțiune invalidă'},400);return reply({ok:true,id:subscribeAvailability(db,u.id,b)},201);}
  catch(e){return reply({error:e instanceof AvailabilityError?e.message:'Alerta nu a fost salvată.'},e instanceof AvailabilityError?e.status:400);}
}
