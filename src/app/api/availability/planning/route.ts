import {NextRequest,NextResponse} from 'next/server';
import {db,getFirmByUserId} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit} from '@/lib/security';
import {providerPlanning} from '@/lib/providerPlanning';
import {AvailabilityError} from '@/lib/weeklyAvailability';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);
 if(user?.role!=='firma')return reply({error:'Autentificare firmă necesară.'},401);
 const firm=getFirmByUserId(user.id);
 if(!firm)return reply({error:'Cont de firmă indisponibil.'},403);
 if(!consumeRateLimit('planning:'+user.id,30,60000))return reply({error:'Prea multe actualizări. Reîncearcă într-un minut.'},429);
 try{return reply(providerPlanning(db,firm.id,req.nextUrl.searchParams.get('from')??undefined));}
 catch(e){return reply({error:e instanceof AvailabilityError?e.message:'Planificarea nu a putut fi încărcată.'},e instanceof AvailabilityError?e.status:503);}
}
