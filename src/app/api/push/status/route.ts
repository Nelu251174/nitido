import {NextRequest,NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {pushPlatformConfigured} from '@/lib/pushProviders';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(req:NextRequest){const user=await getCurrentUser(req);if(!user)return NextResponse.json({error:"Autentificare necesară"},{status:401,headers});const devices=db.prepare("SELECT platform,push_enabled,created_at,updated_at,last_seen_at,revoked_at FROM push_devices WHERE user_id=? ORDER BY updated_at DESC").all(user.id);const enabled=process.env.PUSH_ENABLED==="true";return NextResponse.json({pushEnabled:enabled,platforms:{ANDROID:enabled&&pushPlatformConfigured('ANDROID'),IOS:enabled&&pushPlatformConfigured('IOS')},devices},{headers});}
