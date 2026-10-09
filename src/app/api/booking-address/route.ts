import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,requestIp} from '@/lib/security';
import {addressFromGoogle,validAddressPosition} from '@/lib/bookingAddress';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){if(!await getCurrentUser(req))return reply({error:'Autentificare necesară'},401);return reply({configured:Boolean(process.env.GOOGLE_GEOCODING_API_KEY)})}
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);if(!user)return reply({error:'Autentificare necesară'},401);
 const origin=req.headers.get('origin');
 const allowed=new Set([req.nextUrl.origin,'https://nitido.ro','https://www.nitido.ro']);
 if(!origin||!allowed.has(origin))return reply({error:'Origine invalidă'},403);
 if(!consumeRateLimit(`booking-address-user:${user.id}`,10,3600000)||!consumeRateLimit(`booking-address-ip:${requestIp(req)}`,30,3600000))return reply({error:'Prea multe localizări. Completează adresa manual sau reîncearcă mai târziu.'},429);
 const key=process.env.GOOGLE_GEOCODING_API_KEY;if(!key)return reply({error:'Localizarea adresei este temporar indisponibilă. Completează manual.'},503);
 const raw=await req.text();if(raw.length>512)return reply({error:'Cerere prea mare'},413);
 let coords:unknown;try{coords=JSON.parse(raw)}catch{return reply({error:'Cerere invalidă'},400)}
 if(!validAddressPosition(coords))return reply({error:'Poziția nu este suficient de precisă pentru stradă. Completează manual sau încearcă lângă o fereastră.'},400);
 const params=new URLSearchParams({latlng:`${coords.latitude},${coords.longitude}`,key,language:'ro',result_type:'street_address|premise|route'});
 try{
  const result=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`,{cache:'no-store',signal:AbortSignal.any([req.signal,AbortSignal.timeout(8000)])});
  if(!result.ok)return reply({error:'Serviciul de adrese nu răspunde. Completează manual.'},502);
  const address=addressFromGoogle(await result.json());return reply({address});
 }catch{return reply({error:'Adresa nu a putut fi identificată. Poți completa manual.'},502)}
}
