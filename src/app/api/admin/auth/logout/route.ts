import {NextRequest,NextResponse} from 'next/server';
import {destroyAdminSession} from '@/lib/adminAuth';
import {hasTrustedAdminOrigin} from '@/lib/adminMfa';
export async function POST(req:NextRequest){
  if(!hasTrustedAdminOrigin(req))return NextResponse.json({error:'Origine nepermisă'},{status:403});
  await destroyAdminSession();
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}
