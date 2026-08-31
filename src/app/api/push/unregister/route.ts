import {NextRequest,NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {db} from "@/lib/db";
export async function POST(req:NextRequest){const user=await getCurrentUser(req);if(!user)return NextResponse.json({error:"Autentificare necesară"},{status:401});const body=await req.json().catch(()=>null) as {deviceToken?:unknown}|null;if(!body||typeof body.deviceToken!=="string")return NextResponse.json({error:"Token invalid"},{status:400});db.prepare("UPDATE push_devices SET push_enabled=0,revoked_at=datetime('now'),updated_at=datetime('now') WHERE device_token=? AND user_id=?").run(body.deviceToken,user.id);return NextResponse.json({ok:true});}
