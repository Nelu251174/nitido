import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {isAdmin,auditAdminAction} from '@/lib/adminAuth';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {CatalogError} from '@/lib/serviceCatalog';
import {catalogCapacity,setCatalogFirm} from '@/lib/catalogCapacity';
export async function GET(req:NextRequest){if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});const p=req.nextUrl.searchParams;try{return NextResponse.json({firms:catalogCapacity(db,p.get('key')??'',p.get('city')??'',p.has('start')||p.has('end')?{start:p.get('start')??'',end:p.get('end')??''}:undefined)})}catch(e){if(e instanceof CatalogError)return NextResponse.json({error:e.message},{status:e.status});throw e}}
export async function POST(req:NextRequest){if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă'},{status:403});const b=await req.json().catch(()=>null);if(!b||typeof b.key!=='string'||typeof b.firmId!=='string'||typeof b.enabled!=='boolean')return NextResponse.json({error:'Cerere invalidă'},{status:400});try{db.transaction(()=>{if(setCatalogFirm(db,b.key,b.firmId,b.enabled))auditAdminAction('catalog.firm.changed',b.key,{firmId:b.firmId,enabled:b.enabled})})();return NextResponse.json({ok:true})}catch(e){if(e instanceof CatalogError)return NextResponse.json({error:e.message},{status:e.status});throw e}}
