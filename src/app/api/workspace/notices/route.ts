import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {hasTrustedMutationOrigin} from '@/lib/security';
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const u=await getCurrentUser(req);if(!u)return reply({error:'Autentificare necesară'},401);return reply({notices:db.prepare('SELECT id,message,path,created_at FROM workspace_notices WHERE user_id=? AND read_at IS NULL ORDER BY created_at DESC LIMIT 30').all(u.id)})}
export async function POST(req:NextRequest){const u=await getCurrentUser(req);if(!u)return reply({error:'Autentificare necesară'},401);if(!hasTrustedMutationOrigin(req))return reply({error:'Origine invalidă'},403);const raw=await req.text();if(raw.length>1000)return reply({error:'Cerere prea mare'},413);try{const b=JSON.parse(raw);if(typeof b?.id!=='string'||b.id.length>100)return reply({error:'Cerere invalidă'},400);db.prepare('UPDATE workspace_notices SET read_at=? WHERE id=? AND user_id=?').run(new Date().toISOString(),b.id,u.id);return reply({ok:true})}catch{return reply({error:'Cerere invalidă'},400)}}
