import {NextRequest,NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {db} from "@/lib/db";
export async function GET(req:NextRequest){const user=await getCurrentUser(req);if(!user)return NextResponse.json({error:"Autentificare necesară"},{status:401});const devices=db.prepare("SELECT platform,push_enabled,created_at,updated_at,last_seen_at,revoked_at FROM push_devices WHERE user_id=? ORDER BY updated_at DESC").all(user.id);return NextResponse.json({pushEnabled:process.env.PUSH_ENABLED==="true",devices});}
