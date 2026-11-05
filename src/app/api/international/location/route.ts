import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin,requestIp} from '@/lib/security';
import {internationalPricingEnabled} from '@/lib/internationalRollout';
import {validAddressPosition} from '@/lib/bookingAddress';
import {internationalAddressFromGoogle} from '@/lib/internationalBookingLocation';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function access(req:NextRequest){
 const user=await getCurrentUser(req,{readOnly:true});
 if(!user||user.role!=='client')return reply({error:'Autentifică-te ca client.'},401);
 if(!internationalPricingEnabled())return reply({error:'Rezervările internaționale nu sunt activate.'},404);
 return user;
}
export async function GET(req:NextRequest){
 const result=await access(req);if(result instanceof Response)return result;
 return reply({configured:Boolean(process.env.GOOGLE_GEOCODING_API_KEY)});
}
export async function POST(req:NextRequest){
 const user=await access(req);if(user instanceof Response)return user;
 if(!hasTrustedMutationOrigin(req)||(!req.headers.get('origin')&&!(process.env.NITIDO_ENABLE_BEARER_AUTH==='true'&&/^Bearer \S+$/.test(req.headers.get('authorization')??''))))return reply({error:'Origine invalidă'},403);
 if(!consumeRateLimit(`international-location-user:${user.id}`,10,3600000)||!consumeRateLimit(`international-location-ip:${requestIp(req)}`,30,3600000))return reply({error:'Prea multe localizări. Completează adresa manual sau reîncearcă mai târziu.'},429);
 const key=process.env.GOOGLE_GEOCODING_API_KEY;if(!key)return reply({error:'Localizarea adresei este temporar indisponibilă. Completează manual.'},503);
 const raw=await req.text();if(Buffer.byteLength(raw)>512)return reply({error:'Cerere prea mare'},413);
 let coords:unknown;try{coords=JSON.parse(raw);}catch{return reply({error:'Cerere invalidă'},400);}
 if(!validAddressPosition(coords))return reply({error:'Poziția nu este suficient de precisă pentru stradă. Completează manual sau încearcă lângă o fereastră.'},400);
 const params=new URLSearchParams({latlng:`${coords.latitude},${coords.longitude}`,key,language:'en',result_type:'street_address|premise|route'});
 try{
  const r=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`,{cache:'no-store',signal:AbortSignal.any([req.signal,AbortSignal.timeout(8000)])});
  if(!r.ok)return reply({error:'Serviciul de adrese nu răspunde. Completează manual.'},502);
  let address;try{address=internationalAddressFromGoogle(await r.json());}catch{return reply({error:'Adresa nu a putut fi identificată. Completează manual.'},422);}
  return reply({address});
 }catch{return reply({error:'Adresa nu a putut fi identificată. Poți completa manual.'},502);}
}
