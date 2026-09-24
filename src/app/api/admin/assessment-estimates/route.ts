import {NextRequest,NextResponse} from 'next/server';
import {getAdminActorId,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {MarginError} from '@/lib/operationalMargin';
import {listManualEstimates,saveManualEstimate} from '@/lib/manualEstimates';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 if(!await getAdminActorId())return response({error:'Neautorizat'},401);
 const id=req.nextUrl.searchParams.get('id');if(!id||id.length>100)return response({error:'Referință invalidă'},400);
 return response({estimates:listManualEstimates(db,id),clientVisible:false});
}
export async function POST(req:NextRequest){
 const actor=await getAdminActorId();if(!actor)return response({error:'Neautorizat'},401);
 if(!hasTrustedMutationOrigin(req))return response({error:'Origine invalidă'},403);
 try{
 const raw=await req.text();if(Buffer.byteLength(raw)>30000)return response({error:'Cerere prea mare'},413);
 const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Cerere invalidă'},400);
 const estimate=db.transaction(()=>{const result=saveManualEstimate(db,body,actor);auditAdminAction('assessment.estimate_saved',body.id,{actorId:actor,revision:result.revision,assessmentVersion:result.assessment_version});return result;}).immediate();
 return response({estimate,clientVisible:false});
 }catch(e){if(e instanceof MarginError)return response({error:e.message},e.status);if(e instanceof SyntaxError)return response({error:'Cerere invalidă'},400);return response({error:'Salvarea nu a fost confirmată. Reîncarcă istoricul înainte de reîncercare.'},500);}
}
