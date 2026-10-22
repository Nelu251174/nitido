import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {consumeRateLimit} from '@/lib/security';
import {favoriteFirms,saveFavorite,RetentionError} from '@/lib/clientRetention';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const u=await getCurrentUser(req,{readOnly:true});if(u?.role!=='client')return reply({error:'Autentificare client necesară'},401);return reply({firms:favoriteFirms(db,u.id)});}
export async function POST(req:NextRequest){
  const u=await getCurrentUser(req);if(u?.role!=='client')return reply({error:'Autentificare client necesară'},401);
  if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);
  if(!consumeRateLimit('favorite:'+u.id,30,60000))return reply({error:'Reîncearcă într-un minut.'},429);
  const text=await req.text();if(text.length>1000)return reply({error:'Cerere prea mare'},413);
  try{const b=JSON.parse(text);if(typeof b.firmId!=='string'||b.firmId.length>100||typeof b.save!=='boolean')return reply({error:'Cerere invalidă'},400);saveFavorite(db,u.id,b.firmId,b.save);return reply({ok:true});}
  catch(e){if(e instanceof RetentionError)return reply({error:e.message},e.status);return reply({error:'Preferința nu a fost salvată.'},400);}
}
