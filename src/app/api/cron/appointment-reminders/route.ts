import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {appointmentReminderMetrics,appointmentReminderConfig,processAppointmentReminders} from '@/lib/appointmentReminders';
export const runtime='nodejs';
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
function authorized(req:NextRequest){const key=process.env.NITIDO_APPOINTMENT_CRON_SECRET??'',actual=Buffer.from(req.headers.get('x-cron-secret')??''),expected=Buffer.from(key);return key.length>=32&&actual.length===expected.length&&timingSafeEqual(actual,expected);}
export async function GET(req:NextRequest){if(!authorized(req))return reply({error:'Neautorizat'},401);return reply(appointmentReminderMetrics(db));}
export async function POST(req:NextRequest){if(!authorized(req))return reply({error:'Neautorizat'},401);if(!appointmentReminderConfig().enabled)return reply({status:'disabled',queued:0,sent:0,suppressed:0,blocked:0});try{return reply({status:'completed',...await processAppointmentReminders(db)});}catch{return reply({error:'Procesarea reamintirilor necesită verificare.'},503);}}
