import {NextRequest,NextResponse} from 'next/server';
import {isAdmin,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {catalogDrafts,saveCatalogDraft,CatalogError} from '@/lib/serviceCatalog';
export async function GET(){if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});return NextResponse.json({drafts:catalogDrafts(db)});}
export async function POST(req:NextRequest){
 if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});
 if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă'},{status:403});
 const body=await req.json().catch(()=>null);if(!body||typeof body.key!=='string')return NextResponse.json({error:'Cerere invalidă'},{status:400});
 try{const version=db.transaction(()=>{const v=saveCatalogDraft(db,body.key,body.version,body.definition);auditAdminAction('catalog.draft.saved',body.key,{version:v});return v})();return NextResponse.json({version,drafts:catalogDrafts(db)});}catch(e){if(e instanceof CatalogError)return NextResponse.json({error:e.message},{status:e.status});throw e;}
}
