import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {webAlerts} from '@/lib/webAlerts';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);
 if(!user||!['client','firma'].includes(user.role))return reply({error:'Autentificare necesară'},401);
 return reply({userId:user.id,role:user.role,events:webAlerts(db,user.id)});
}
