import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {adminNotificationFeed,markAdminNotificationsRead} from '@/lib/adminNotificationCenter';
import type {AdminNotificationCategory} from '@/lib/adminNotificationCenterShared';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const actor=await getAdminActorId();if(!actor)return reply({error:'UNAUTHORIZED'},401);try{return reply(adminNotificationFeed(db,actor,(req.nextUrl.searchParams.get('category')??'all') as AdminNotificationCategory|'all',Number(req.nextUrl.searchParams.get('offset')??0)));}catch(e){return reply({error:'NOTIFICATIONS_UNAVAILABLE'},e instanceof Error&&e.message==='INVALID_FILTER'?400:503);}}
export async function POST(req:NextRequest){const actor=await getAdminActorId();if(!actor)return reply({error:'UNAUTHORIZED'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'INVALID_ORIGIN'},403);const raw=await req.text();if(Buffer.byteLength(raw)>12000)return reply({error:'REQUEST_TOO_LARGE'},413);try{const input=JSON.parse(raw);if(!input||Object.keys(input).length!==1||!Object.hasOwn(input,'items'))return reply({error:'INVALID_ITEMS'},400);return reply(db.transaction(()=>{const result=markAdminNotificationsRead(db,actor,input.items);auditAdminAction('ADMIN_NOTIFICATIONS_READ',actor,{count:result.changed});return result;}).immediate());}catch{return reply({error:'NOTIFICATION_READ_NOT_CONFIRMED'},409);}}
