import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {executionAccess} from '@/lib/collaborationAccess';
import {mapsDirectionsUrl} from '@/lib/maps';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(req);
 const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(!user)return respond({error:'Autentificare necesară'},401);
 const {id}=await params;
 const job=db.prepare('SELECT client_id,status,street,city,postal_code FROM jobs WHERE id=?').get(id) as {client_id:string;status:string;street:string;city:string;postal_code:string|null}|undefined;
 if(!job)return respond({error:'Lucrare indisponibilă'},404);
 const allowed=job.client_id===user.id||(['accepted','arrived','completed'].includes(job.status)&&!!executionAccess(db,user.id,id));
 if(!allowed)return respond({error:'Acces interzis'},403);
 const pin=db.prepare('SELECT latitude AS lat,longitude AS lng FROM job_navigation WHERE job_id=?').get(id) as {lat:number;lng:number}|undefined;
 return respond({url:mapsDirectionsUrl(job,pin),hasPin:!!pin});
}
