import {NextRequest,NextResponse} from 'next/server';
import {constantTimeEqual} from '@/lib/security';
import {db} from '@/lib/db';
import {incidentSlaEnabled,runIncidentSla} from '@/lib/incidentSla';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 const secret=process.env.CRON_SECRET??'';
 if(!incidentSlaEnabled()||secret.trim().length<32)return reply({error:'Alertele interne SLA nu sunt activate și configurate.'},503);
 if(!constantTimeEqual(req.headers.get('x-cron-secret')??'',secret))return reply({error:'Neautorizat'},401);
 try{return reply(runIncidentSla(db));}catch{return reply({error:'Verificarea termenelor nu a fost confirmată. Alertele pot fi reverificate fără duplicate.'},503);}
}
