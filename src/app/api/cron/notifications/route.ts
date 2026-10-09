import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/db';
import {notificationRecoveryConfigured,runNotificationRecovery} from '@/lib/notificationRecovery';

export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 const secret=process.env.CRON_SECRET??'';
 if(secret.trim().length<32||!notificationRecoveryConfigured())return reply({error:'Recuperarea notificărilor sandbox nu este configurată.'},503);
 const actual=Buffer.from(req.headers.get('x-cron-secret')??''),expected=Buffer.from(secret);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply({error:'Neautorizat'},401);
 try{return reply(await runNotificationRecovery(db));}
 catch{return reply({error:'Rulare neconfirmată. Verifică notificările în ADMIN.'},503);}
}
