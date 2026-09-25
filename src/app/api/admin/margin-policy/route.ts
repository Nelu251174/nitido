import {NextRequest,NextResponse} from 'next/server';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {currentMarginPolicy,saveMarginPolicy,marginExceptionReport} from '@/lib/marginPolicy';
import {manualOffersEnabled} from '@/lib/manualOffers';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!await getAdminActorId('manage'))return response({error:'Neautorizat'},401);return response({policy:currentMarginPolicy(db),exceptions:marginExceptionReport(db),enabled:manualOffersEnabled()});}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId('manage');if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req)||!manualOffersEnabled())return response({error:'Modificarea este permisă numai în sandbox activat, de la o origine autorizată.'},403);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>5000)return response({error:'Cerere prea mare'},413);const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);
 const policy=db.transaction(()=>{const result=saveMarginPolicy(db,body,actor);auditAdminAction('margin.policy_saved',String(result.revision),{actorId:actor,minBani:result.min_bani,minBasisPoints:result.min_basis_points});return result;}).immediate();return response({policy});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Salvarea nu a fost confirmată. Reîncarcă regula.'},500);}
}
