import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {manualOffersEnabled} from '@/lib/manualOffers';
import {readAssessmentEvidence,reviewAssessmentEvidence} from '@/lib/assessmentEvidence';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const admin=req.nextUrl.searchParams.get('admin')==='true';let clientId:string|null=null;
 if(admin){if(!await getAdminActorId())return response({error:'Neautorizat'},401);}else{const user=await getCurrentUser(req);if(!user||user.role!=='client')return response({error:'Autentificare ca client necesară'},401);clientId=user.id;}
 try{return response({...readAssessmentEvidence(db,req.nextUrl.searchParams.get('id')??'',clientId),enabled:manualOffersEnabled()});}catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);throw e;}
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req)||!manualOffersEnabled())return response({error:'Operațiune permisă numai în sandbox activat, de la o origine autorizată.'},403);
 try{const raw=await req.text();if(Buffer.byteLength(raw)>5000)return response({error:'Cerere prea mare'},413);const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);const result=db.transaction(()=>{const reviewed=reviewAssessmentEvidence(db,body,actor);auditAdminAction('assessment.evidence_reviewed',body.id,{actorId:actor,reviewId:reviewed.review?.id,version:body.version,decision:body.decision});return reviewed;}).immediate();return response(result);}
 catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Verificarea nu a fost confirmată. Reîncarcă istoricul.'},500);}
}
