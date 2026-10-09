import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
export async function GET(req:NextRequest){const u=await getCurrentUser(req);if(!u)return NextResponse.json({error:'Autentificare necesară'},{status:401});const rows=db.prepare(`SELECT DISTINCT j.id,j.city,j.space_type,j.scheduled_at,j.status FROM visit_cases c JOIN jobs j ON j.id=c.job_id LEFT JOIN firms f ON f.id=j.accepted_firm_id WHERE j.client_id=? OR f.user_id=? OR ?='admin' ORDER BY j.scheduled_at DESC LIMIT 200`).all(u.id,u.id,u.role);return NextResponse.json({jobs:rows},{headers:{'Cache-Control':'private, no-store'}})}
