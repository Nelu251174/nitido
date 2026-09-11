import { hasTrustedMutationOrigin } from "@/lib/security";
import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {getCurrentUser} from "@/lib/auth";
import {authorizedJob,sendJobMessage,WorkspaceError} from "@/lib/workspace";
import {consumeRateLimit} from "@/lib/security";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:NextRequest){const user=await getCurrentUser(req);if(!user)return reply({error:"Autentificare necesară"},401);try{const id=req.nextUrl.searchParams.get("jobId")??"";authorizedJob(db,user.id,id);return reply({messages:db.prepare("SELECT m.id,m.body,m.created_at,m.sender_id,u.name AS sender_name FROM workspace_messages m JOIN users u ON u.id=m.sender_id WHERE m.job_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 200").all(id).reverse(),userId:user.id})}catch(e){return reply({error:e instanceof WorkspaceError?e.message:"Mesajele nu sunt disponibile"},e instanceof WorkspaceError?e.status:500)}}
export async function POST(req:NextRequest){const user=await getCurrentUser(req);if(!user)return reply({error:"Autentificare necesară"},401);if(!hasTrustedMutationOrigin(req))return reply({error:"Origine invalidă"},403);if(!consumeRateLimit(`message:${user.id}`,30,60000))return reply({error:"Prea multe mesaje. Reîncearcă într-un minut."},429);try{const raw=await req.text();if(raw.length>5000)throw new WorkspaceError("Mesaj prea mare",413);const b=JSON.parse(raw);return reply({id:sendJobMessage(db,user.id,String(b.jobId),b.body,b.requestId)})}catch(e){return reply({error:e instanceof WorkspaceError?e.message:"Mesajul nu a putut fi trimis"},e instanceof WorkspaceError?e.status:400)}}
