import {NextRequest,NextResponse} from 'next/server';
import {db,getFirmByUserId} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {consumeRateLimit,hasTrustedMutationOrigin} from '@/lib/security';
import {WorkspaceError} from '@/lib/workspace';
import {acknowledgeAppointment,listFirmAppointments,appointmentReminderConfig} from '@/lib/appointmentReminders';
export const runtime='nodejs';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
async function own(req:NextRequest){const u=await getCurrentUser(req);if(u?.role!=='firma')return null;const f=getFirmByUserId(u.id);return f?{user:u,firm:f}:null;}
export async function GET(req:NextRequest){const a=await own(req);if(!a)return reply({error:'Autentificare firmă necesară.'},401);const target=req.nextUrl.searchParams.get('jobId');if(target!==null&&!/^[a-zA-Z0-9_-]{1,100}$/.test(target))return reply({error:'Programare invalidă.'},400);try{return reply({appointments:listFirmAppointments(db,a.firm.id,target),config:appointmentReminderConfig(),timezone:'Europe/Bucharest'});}catch{return reply({error:'Programările nu au putut fi încărcate.'},503)}}
export async function POST(req:NextRequest){const a=await own(req);if(!a)return reply({error:'Autentificare firmă necesară.'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă.'},403);if(!consumeRateLimit('appointment-ack:'+a.user.id,30,60000))return reply({error:'Prea multe confirmări. Reîncearcă într-un minut.'},429);
 const raw=await req.text();if(Buffer.byteLength(raw)>2000)return reply({error:'Cerere prea mare.'},413);
 try{const b=JSON.parse(raw);if(b?.action!=='confirm')return reply({error:'Acțiune invalidă.'},400);return reply(acknowledgeAppointment(db,a.firm.id,a.user.id,b.jobId,b.scheduledAt));}
 catch(e){return reply({error:e instanceof WorkspaceError?e.message:'Confirmarea nu a fost salvată.'},e instanceof WorkspaceError?e.status:e instanceof SyntaxError?400:503);}
}
