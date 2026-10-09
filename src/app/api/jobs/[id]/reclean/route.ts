import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
export async function POST(req:NextRequest){
 const user=await getCurrentUser(req);
 if(!user||user.role!=='client')return NextResponse.json({error:'Autentificare necesară'},{status:401});
 return NextResponse.json({error:'Deschide dosarul din Instrucțiuni, recepție și remedieri. Firma propune intervalul revenirii, iar tu îl confirmi.',code:'REMEDIATION_CONFIRMATION_REQUIRED'},{status:409});
}
